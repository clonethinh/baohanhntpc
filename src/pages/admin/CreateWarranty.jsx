import { useState, useEffect, useRef } from 'react';
import { Card, Row, Col, Form, Input, Select, InputNumber, Button, DatePicker, Alert, Modal, Typography, Space, App, AutoComplete, Radio, Switch, Upload, Image } from 'antd';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { warrantyFormSchema } from '../../lib/zodSchemas';
import { warrantyService, customerService } from '../../services/warrantyService';
import { BAO_HANH_OPTIONS, LOAI_XU_LY_OPTIONS } from '../../constants/warrantyOptions';
import { useAuth } from '../../contexts/AuthContext';
import { addBusinessDaysSkipSunday } from '../../utils/dateHelpers';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Title, Text } = Typography;

export default function CreateWarranty() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { currentStaff } = useAuth();
  const [nextCode, setNextCode] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState([]);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [serialWarning, setSerialWarning] = useState(null);
  const [baoHanhCustom, setBaoHanhCustom] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [previewImageOpen, setPreviewImageOpen] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);

  const handleImagePreview = async (file) => {
    const updatedFiles = await Promise.all(
      attachmentFiles.map(async (f) => {
        if (!f.url && !f.preview && f.originFileObj) {
          f.preview = await fileToDataUrl(f.originFileObj);
        }
        return f;
      })
    );
    setAttachmentFiles(updatedFiles);

    const index = updatedFiles.findIndex(f => f.uid === file.uid);
    setPreviewImageIndex(index >= 0 ? index : 0);
    setPreviewImageOpen(true);
  };

  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const timerRef = useRef(null);
  const draftPromptedRef = useRef(false);

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(warrantyFormSchema),
    defaultValues: {
      khachHang: '',
      soDienThoai: '',
      diaChi: '',
      loaiPhieu: 'nhan_bao_hanh',
      baoGiaSau: false,
      tenHang: '',
      soSeri: '',
      cauHinh: '',
      loiLucNhan: '',
      phuKien: '',
      chiPhi: 0,
      baoHanh: t('adminCreateWarranty.defaultWarranty'),
      loaiXuLy: 'bao_hanh',
      ghiChu: '',
      ngayMua: '',
      ngayHenTra: null,
      maNhanVien: currentStaff?.maNV || '',
    },
  });

  const watchKhachHang = watch('khachHang');
  const watchSoSeri = watch('soSeri');
  const watchLoaiPhieu = watch('loaiPhieu');
  const watchedValues = watch();

  useEffect(() => {
    warrantyService.getNextCode().then(res => {
      if (res.data.success) setNextCode(res.data.data.code);
    });
  }, []);

  useEffect(() => {
    if (currentStaff?.maNV) {
      setValue('maNhanVien', currentStaff.maNV);
    }
  }, [currentStaff, setValue]);

  useEffect(() => {
    try {
      if (draftPromptedRef.current) return;
      const draft = localStorage.getItem('ntpc-draft-warranty');
      if (draft) {
        draftPromptedRef.current = true;
        const parsed = JSON.parse(draft);
        Modal.confirm({
          title: t('adminCreateWarranty.restoreDraftTitle'),
          content: t('adminCreateWarranty.restoreDraftContent', { time: parsed.savedAt || t('adminCreateWarranty.unknownTime') }),
          okText: t('adminCreateWarranty.restore'),
          cancelText: t('adminCreateWarranty.skip'),
          onOk: () => {
            Object.keys(parsed).forEach(key => {
              if (key !== 'savedAt' && parsed[key] !== undefined) setValue(key, parsed[key]);
            });
          },
          onCancel: () => localStorage.removeItem('ntpc-draft-warranty'),
        });
      }
    } catch {
      // ignore bad draft
    }
  }, [setValue, t]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const values = { ...watchedValues, savedAt: dayjs().format('HH:mm DD/MM') };
      localStorage.setItem('ntpc-draft-warranty', JSON.stringify(values));
      setDraftSavedAt(dayjs().format('HH:mm'));
    }, 30000);
    return () => clearTimeout(timerRef.current);
  }, [watchedValues]);

  useEffect(() => {
    if (watchKhachHang && watchKhachHang.length >= 2) {
      customerService.suggest(watchKhachHang).then(res => {
        if (res.data.success) setCustomerSuggestions(res.data.data);
      });
    } else {
      setCustomerSuggestions([]);
    }
  }, [watchKhachHang]);

  useEffect(() => {
    if (watchSoSeri && watchSoSeri.length >= 3) {
      warrantyService.getList({ search: watchSoSeri, page: 1, limit: 1 }).then(res => {
        if (res.data.success && res.data.data.rows.length > 0) {
          const existing = res.data.data.rows[0];
          setSerialWarning(t('adminCreateWarranty.serialExists', { code: existing.soChungTu }));
        } else {
          setSerialWarning(null);
        }
      });
    } else {
      setSerialWarning(null);
    }
  }, [watchSoSeri, t]);

  useEffect(() => {
    if (watchLoaiPhieu === 'bien_nhan') {
      const curr = watchedValues.loaiXuLy;
      const next = (curr === 'sua_dv' || curr === 'khac') ? curr : 'sua_dv';
      setValue('loaiXuLy', next);
      setValue('baoGiaSau', true);
      setValue('chiPhi', 0);
    }
  }, [watchLoaiPhieu, setValue, watchedValues.loaiXuLy]);

  const onSubmit = async (values) => {
    const attachmentsInput = [];
    for (const f of attachmentFiles) {
      const raw = f.originFileObj || f;
      if (!raw) continue;
      const dataUrl = await fileToDataUrl(raw);
      attachmentsInput.push({
        id: f.uid || uuidv4(),
        name: raw.name || f.name || 'image',
        mime: raw.type || 'image/jpeg',
        dataUrl,
        publicVisible: true,
      });
    }
    setFormErrors([]);
    setSubmitting(true);
    try {
      const finalValues = {
        ...values,
        ngayHenTra: values.ngayHenTra || 'none',
      };
      const res = await warrantyService.create({ ...finalValues, attachmentsInput });
      if (res.data.success) {
        localStorage.removeItem('ntpc-draft-warranty');
        message.success(t('adminCreateWarranty.createSuccess'));
        navigate(`/admin/phieu/${res.data.data.id}/in?new=1`);
      }
    } catch (err) {
      if (err.response?.data?.error) {
        setFormErrors([err.response.data.error.message]);
      } else {
        message.error(t('adminCreateWarranty.createError'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreview = () => {
    setPreviewData(watchedValues);
    setPreviewOpen(true);
  };

  const handleSelectCustomer = (name) => {
    setValue('khachHang', name);
    setCustomerSuggestions([]);

    const q = String(name || '').trim();
    if (!q) return;

    customerService.lookup(q).then((res) => {
      if (res.data?.success && res.data.data) {
        setValue('khachHang', res.data.data.khachHang || q);
        setValue('soDienThoai', res.data.data.soDienThoai || '');
        setValue('diaChi', res.data.data.diaChi || '');
      }
    }).catch(() => {});
  };

  return (
    <div>
      <Title level={4}>{t('adminCreateWarranty.title')}</Title>
      {nextCode && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Text type="secondary">{t('adminWarrantyList.documentNumber')}: </Text>
          <Text strong>{nextCode}</Text>
          <Text type="secondary"> {t('adminCreateWarranty.autoCreated')}</Text>
        </Card>
      )}
      {draftSavedAt && (
        <Text type="secondary" style={{ fontSize: 12 }}>{t('adminCreateWarranty.draftSavedAt', { time: draftSavedAt })}</Text>
      )}

      {formErrors.length > 0 && (
        <Alert message={t('adminCreateWarranty.validationError')} description={<ul>{formErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>} type="error" showIcon style={{ marginBottom: 16 }} />
      )}

      <form onSubmit={handleSubmit(onSubmit, errs => setFormErrors(Object.values(errs).map(e => e.message)))}>
        <Card title={t('adminCreateWarranty.ticketType')} style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label={t('adminCreateWarranty.ticketType')}>
                <Controller name="loaiPhieu" control={control} render={({ field }) => (
                  <Radio.Group
                    {...field}
                    options={[
                      { label: t('adminCreateWarranty.receiveWarranty'), value: 'nhan_bao_hanh' },
                      { label: t('adminCreateWarranty.receipt'), value: 'bien_nhan' },
                    ]}
                    optionType="button"
                    buttonStyle="solid"
                  />
                )} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title={t('field.khachHang')} style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label={t('adminCreateWarranty.customerRequiredLabel')} validateStatus={errors.khachHang ? 'error' : ''} help={errors.khachHang?.message}>
                <Controller name="khachHang" control={control} render={({ field }) => (
                  <AutoComplete
                    {...field}
                    options={customerSuggestions.map(s => ({ value: s }))}
                    onSelect={handleSelectCustomer}
                    onBlur={() => {
                      const q = String(field.value || '').trim();
                      if (q.length < 1) return;
                      customerService.lookup(q).then((res) => {
                        if (res.data?.success && res.data.data) {
                          setValue('khachHang', res.data.data.khachHang || q);
                          setValue('soDienThoai', res.data.data.soDienThoai || '');
                          setValue('diaChi', res.data.data.diaChi || '');
                        }
                      }).catch(() => {});
                    }}
                  >
                    <Input placeholder={t('adminCustomer.customerNameRequired')} />
                  </AutoComplete>
                )} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label={t('field.soDienThoai')} validateStatus={errors.soDienThoai ? 'error' : ''} help={errors.soDienThoai?.message}>
                <Controller name="soDienThoai" control={control} render={({ field }) => (
                  <Input
                    {...field}
                    placeholder={t('adminCreateWarranty.optional')}
                    onBlur={() => {
                      const q = String(field.value || '').trim();
                      if (q.length < 1) return;
                      customerService.lookup(q).then((res) => {
                        if (res.data?.success && res.data.data) {
                          setValue('khachHang', res.data.data.khachHang || '');
                          setValue('soDienThoai', res.data.data.soDienThoai || q);
                          setValue('diaChi', res.data.data.diaChi || '');
                        }
                      }).catch(() => {});
                    }}
                  />
                )} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label={t('field.diaChi')} validateStatus={errors.diaChi ? 'error' : ''} help={errors.diaChi?.message}>
                <Controller name="diaChi" control={control} render={({ field }) => (
                  <Input {...field} placeholder={t('adminCreateWarranty.optional')} />
                )} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title={t('field.sanPham')} style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label={t('adminCreateWarranty.productRequiredLabel')} validateStatus={errors.tenHang ? 'error' : ''} help={errors.tenHang?.message}>
                <Controller name="tenHang" control={control} render={({ field }) => (
                  <Input {...field} placeholder={t('trackingResult.productName')} />
                )} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label={t('adminCreateWarranty.serialRequiredLabel')} validateStatus={errors.soSeri ? 'error' : ''} help={errors.soSeri?.message}>
                <Controller name="soSeri" control={control} render={({ field }) => (
                  <Input {...field} placeholder={t('trackingResult.serial')} />
                )} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label={t('field.cauHinh')}>
                <Controller name="cauHinh" control={control} render={({ field }) => (
                  <Input {...field} placeholder={t('adminCreateWarranty.configPlaceholder')} />
                )} />
              </Form.Item>
            </Col>
          </Row>
          {serialWarning && <Alert message={serialWarning} type="warning" showIcon style={{ marginTop: 8 }} />}
        </Card>

        <Card title={t('adminCreateWarranty.reception')} style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label={t('adminCreateWarranty.receivedIssueRequiredLabel')} validateStatus={errors.loiLucNhan ? 'error' : ''} help={errors.loiLucNhan?.message}>
                <Controller name="loiLucNhan" control={control} render={({ field }) => (
                  <TextArea {...field} rows={3} placeholder={t('adminCreateWarranty.issuePlaceholder')} />
                )} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label={t('field.phuKien')}>
                <Controller name="phuKien" control={control} render={({ field }) => (
                  <Input {...field} placeholder={t('adminCreateWarranty.accessoriesPlaceholder')} />
                )} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label={t('adminCreateWarranty.costVnd')} validateStatus={errors.chiPhi ? 'error' : ''} help={errors.chiPhi?.message}>
                {watchLoaiPhieu === 'bien_nhan' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#666' }}>{t('adminCreateWarranty.quoteLater')}</span>
                    <Controller name="baoGiaSau" control={control} render={({ field }) => (
                      <Switch checked={Boolean(field.value)} onChange={(v) => field.onChange(v)} />
                    )} />
                  </div>
                )}

                <Controller name="chiPhi" control={control} render={({ field }) => (
                  <InputNumber
                    {...field}
                    style={{ width: '100%' }}
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    min={0}
                    disabled={watchLoaiPhieu === 'bien_nhan' && Boolean(watchedValues.baoGiaSau)}
                  />
                )} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label={t('adminCreateWarranty.handlingType')} validateStatus={errors.loaiXuLy ? 'error' : ''} help={errors.loaiXuLy?.message}>
                <Controller name="loaiXuLy" control={control} render={({ field }) => (
                  <Select
                    {...field}
                    options={(
                      watchLoaiPhieu === 'bien_nhan'
                        ? LOAI_XU_LY_OPTIONS.filter(o => o.value === 'sua_dv' || o.value === 'khac')
                        : LOAI_XU_LY_OPTIONS
                    )}
                  />
                )} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label={t('adminCreateWarranty.warrantyTerm')} validateStatus={errors.baoHanh ? 'error' : ''} help={errors.baoHanh?.message}>
                <Controller name="baoHanh" control={control} render={({ field }) => (
                  <Select {...field} options={BAO_HANH_OPTIONS} onChange={v => { setBaoHanhCustom(v === 'khac'); if (v !== 'khac') field.onChange(v); }} />
                )} />
              </Form.Item>
              {baoHanhCustom && (
                <Input placeholder={t('adminCreateWarranty.customWarrantyPlaceholder')} onChange={e => setValue('baoHanh', e.target.value)} style={{ marginTop: 8 }} />
              )}
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label={t('field.nhanVien')} validateStatus={errors.maNhanVien ? 'error' : ''} help={errors.maNhanVien?.message}>
                <Controller name="maNhanVien" control={control} render={({ field }) => (
                  <Input {...field} disabled value={currentStaff?.maNV || ''} />
                )} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title={t('adminCreateWarranty.time')} style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label={t('field.ngayMua')}>
                <Controller name="ngayMua" control={control} render={({ field }) => (
                  <DatePicker {...field} style={{ width: '100%' }} format="DD/MM/YYYY" value={field.value ? dayjs(field.value) : null} onChange={d => field.onChange(d ? d.format('YYYY-MM-DD') : '')} />
                )} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label={t('field.ngayHenTra')} validateStatus={errors.ngayHenTra ? 'error' : ''} help={errors.ngayHenTra?.message}>
                <Controller name="ngayHenTra" control={control} render={({ field }) => (
                  <DatePicker allowClear placeholder="Chọn thời điểm" {...field} style={{ width: '100%' }} format="DD/MM/YYYY" value={field.value ? dayjs(field.value) : null} onChange={d => field.onChange(d ? d.format('YYYY-MM-DD') : '')} />
                )} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title={t('adminCreateWarranty.attachments')} style={{ marginBottom: 16 }}>
          <Upload
            multiple
            listType="picture-card"
            accept="image/png,image/jpeg,image/webp"
            fileList={attachmentFiles}
            onChange={({ fileList }) => {
              const updated = fileList.slice(0, 10).map((f) => {
                if (!f.url && !f.thumbUrl && f.originFileObj) {
                  const blobUrl = URL.createObjectURL(f.originFileObj);
                  f.thumbUrl = blobUrl;
                  f.preview = blobUrl;
                }
                return f;
              });
              setAttachmentFiles(updated);
            }}
            onPreview={handleImagePreview}
            beforeUpload={() => false}
          >
            {attachmentFiles.length >= 10 ? null : <div>{t('adminCreateWarranty.addImage')}</div>}
          </Upload>
          <Text type="secondary">{t('adminCreateWarranty.attachmentHint')}</Text>
        </Card>

        <Card title={t('field.ghiChu')} style={{ marginBottom: 16 }}>
          <Form.Item>
            <Controller name="ghiChu" control={control} render={({ field }) => (
              <TextArea {...field} rows={2} placeholder={t('adminCreateWarranty.notePlaceholder')} />
            )} />
          </Form.Item>
        </Card>

        <Space>
          <Button type="primary" htmlType="submit" loading={submitting}>{t('adminCreateWarranty.saveTicket')}</Button>
          <Button onClick={handlePreview}>{t('adminCreateWarranty.preview')}</Button>
          <Button onClick={() => navigate('/admin/phieu')}>{t('adminCreateWarranty.back')}</Button>
        </Space>
      </form>

      <Modal title={t('adminCreateWarranty.previewTitle')} open={previewOpen} onCancel={() => setPreviewOpen(false)} width={700} footer={[
        <Button key="back" onClick={() => setPreviewOpen(false)}>{t('adminCreateWarranty.backToEdit')}</Button>,
        <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit(onSubmit)}>{t('adminCreateWarranty.saveTicket')}</Button>,
      ]}>
        {previewData && (
          <div>
            <p><strong>{t('adminWarrantyList.documentNumber')}:</strong> {nextCode}</p>
            <p><strong>{t('field.khachHang')}:</strong> {previewData.khachHang}</p>
            <p><strong>{t('field.tenHang')}:</strong> {previewData.tenHang}</p>
            <p><strong>{t('field.soSeri')}:</strong> {previewData.soSeri}</p>
            <p><strong>{t('field.loiLucNhan')}:</strong> {previewData.loiLucNhan}</p>
            <p><strong>{t('field.chiPhi')}:</strong> {previewData.chiPhi || 0} {t('adminCreateWarranty.currencyDong')}</p>
            <p><strong>{t('field.baoHanh')}:</strong> {previewData.baoHanh}</p>
            <p><strong>{t('field.ngayHenTra')}:</strong> {previewData.ngayHenTra}</p>
            {previewData.ghiChu && <p><strong>{t('field.ghiChu')}:</strong> {previewData.ghiChu}</p>}
          </div>
        )}
      </Modal>

      <div style={{ display: 'none' }}>
        <Image.PreviewGroup
          preview={{
            visible: previewImageOpen,
            onVisibleChange: (visible) => setPreviewImageOpen(visible),
            current: previewImageIndex,
            onChange: (current) => setPreviewImageIndex(current)
          }}
        >
          {attachmentFiles.map((file, idx) => (
            <Image
              key={file.uid || idx}
              src={file.url || file.preview}
            />
          ))}
        </Image.PreviewGroup>
      </div>
    </div>
  );
}



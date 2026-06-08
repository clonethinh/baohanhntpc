import { useRef, useState } from 'react';
import { Row, Col, Card, Upload, Button, Table, Modal, Radio, Alert, Tag, Space, App } from 'antd';
import { getStatusBadgeColor } from '../../constants/badgeConfig';
import { Button as MobileButton, Card as MobileCard, Dialog, Space as MobileSpace, Tag as MobileTag } from 'antd-mobile';
import { DownloadOutlined, UploadOutlined, FileExcelOutlined, CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { warrantyService } from '../../services/warrantyService';
import { parseExcelFile, mapExcelRows } from '../../utils/excelHelpers';
import api from '../../lib/axios';
import { useTranslation } from 'react-i18next';
import BackupRestorePanel from '../../components/admin/BackupRestorePanel';

export default function ImportExport() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [previewData, setPreviewData] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [exportType, setExportType] = useState('all');
  const fileInputRef = useRef(null);

  const runDeleteAll = async () => {
    try {
      const res = await api.delete('/warranties');
      if (res.data.success) {
        message.success(t('adminImportExport.deleteSuccess', { count: res.data.data.deleted }));
        setPreviewData([]);
        setImportResult(null);
      }
    } catch {
      message.error(t('adminImportExport.deleteError'));
    }
  };

  const handleMobileDeleteAll = () => {
    Dialog.confirm({
      content: t('adminImportExport.deleteAllContent'),
      confirmText: t('adminImportExport.deleteAllOk'),
      cancelText: t('button.huy'),
      onConfirm: runDeleteAll,
    });
  };

  const handleDeleteAll = async () => {
    Modal.confirm({
      title: t('adminImportExport.deleteAllTitle'),
      content: t('adminImportExport.deleteAllContent'),
      okText: t('adminImportExport.deleteAllOk'),
      okType: 'danger',
      cancelText: t('button.huy'),
      onOk: runDeleteAll,
    });
  };

  const handleMobileFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (file) await handleFileUpload(file);
    event.target.value = '';
  };

  const handleFileUpload = async (file) => {
    setUploading(true);
    try {
      const raw = await parseExcelFile(file);
      const mapped = mapExcelRows(raw);
      setPreviewData(mapped);
      message.success(t('adminImportExport.readSuccess', { count: mapped.length }));
    } catch (err) {
      message.error(t('adminImportExport.readError'));
    } finally {
      setUploading(false);
    }
    return false;
  };

  const handleImport = async () => {
    if (previewData.length === 0) {
      message.warning(t('adminImportExport.emptyImport'));
      return;
    }
    setUploading(true);
    try {
      const res = await warrantyService.importWarranties(previewData);
      if (res.data.success) {
        setImportResult(res.data.data);
        message.success(t('adminImportExport.importSuccess', { count: res.data.data.inserted }));
      }
    } catch {
      message.error(t('adminImportExport.importError'));
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    warrantyService.downloadTemplate().then(res => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ntpc-warranty-template.xlsx';
      link.click();
    });
  };

  const handleExport = () => {
    warrantyService.exportWarranties(exportType === 'filtered' ? {} : {}).then(res => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ntpc-warranties-export.xlsx';
      link.click();
    });
  };

  const validateRow = (row) => {
    const errors = [];
    if (!row.soChungTu) errors.push(t('adminImportExport.missingDocument'));
    if (!row.khachHang) errors.push(t('adminImportExport.missingCustomer'));
    return errors;
  };

  const previewColumns = [
    { title: t('table.stt'), dataIndex: 'stt', width: 50 },
    { title: t('adminWarrantyList.documentNumber'), dataIndex: 'soChungTu', width: 150, render: value => value ? <Tag color="blue">{value}</Tag> : <Tag color="red">{t('adminImportExport.missing')}</Tag> },
    { title: t('field.khachHang'), dataIndex: 'khachHang', width: 150 },
    { title: t('field.tenHang'), dataIndex: 'tenHang', width: 200, ellipsis: true },
    { title: t('field.soSeri'), dataIndex: 'soSeri', width: 130 },
    { title: t('field.baoHanh'), dataIndex: 'baoHanh', width: 100 },
    { title: t('table.trangThai'), dataIndex: 'trangThai', width: 100, render: v => {
      const labelMap = { da_nhan: t('status:trangThai.da_nhan'), dang_xu_ly: t('status:trangThai.dang_xu_ly'), da_tra: t('status:trangThai.da_tra'), huy: t('status:trangThai.huy'), cho_xu_ly: t('status:trangThai.da_nhan'), cho_lien_he: t('status:trangThai.dang_xu_ly') };
      return <Tag color={getStatusBadgeColor(v)}>{labelMap[v] || v}</Tag>;
    } },
    {
      title: t('table.trangThai'),
      key: 'valid',
      width: 120,
      render: (_, row) => {
        const errors = validateRow(row);
        return errors.length === 0
          ? <Tag color="success"><CheckCircleOutlined /> {t('adminImportExport.valid')}</Tag>
          : <Tag color="error"><CloseCircleOutlined /> {errors[0]}</Tag>;
      },
    },
  ];

  const validCount = previewData.filter(r => validateRow(r).length === 0).length;
  const invalidCount = previewData.length - validCount;

  return (
    <div>
      <div className="mobile-only admin-mobile-page">
        <MobileSpace direction="vertical" block style={{ '--gap': '12px' }}>
          <MobileCard title={t('adminImportExport.importExcel')}>
            <MobileSpace direction="vertical" block>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleMobileFileChange} style={{ display: 'none' }} />
              <MobileButton block color="primary" loading={uploading} onClick={() => fileInputRef.current?.click()}>
                <UploadOutlined /> {t('adminImportExport.dropExcel')}
              </MobileButton>
              <MobileButton block onClick={handleDownloadTemplate}>
                <DownloadOutlined /> {t('adminImportExport.downloadTemplate')}
              </MobileButton>
              {previewData.length > 0 && (
                <>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <MobileTag color="primary">{t('adminImportExport.totalTickets', { count: previewData.length })}</MobileTag>
                    <MobileTag color="success">{t('adminImportExport.validCount', { count: validCount })}</MobileTag>
                    <MobileTag color="danger">{t('adminImportExport.errorCount', { count: invalidCount })}</MobileTag>
                  </div>
                  <div style={{ maxHeight: 360, overflow: 'auto', display: 'grid', gap: 8 }}>
                    {previewData.slice(0, 50).map((row, index) => {
                      const errors = validateRow(row);
                      return <div key={row.soChungTu || index} style={{ border: '1px solid var(--adm-color-border)', borderRadius: 10, padding: 10, display: 'grid', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <b>{row.soChungTu || t('adminImportExport.missing')}</b>
                          <MobileTag color={errors.length ? 'danger' : 'success'}>{errors.length ? errors[0] : t('adminImportExport.valid')}</MobileTag>
                        </div>
                        <div>{row.khachHang || '-'}</div>
                        <small>{row.tenHang || '-'} · {row.soSeri || '-'}</small>
                      </div>;
                    })}
                  </div>
                  {previewData.length > 50 && <small>Đang xem 50 dòng đầu</small>}
                  {validCount > 0 && <MobileButton block color="primary" loading={uploading} onClick={handleImport}>{t('adminImportExport.confirmImport', { count: validCount })}</MobileButton>}
                  <MobileButton block onClick={() => { setPreviewData([]); setImportResult(null); }}>{t('adminImportExport.clearData')}</MobileButton>
                </>
              )}
            </MobileSpace>
          </MobileCard>

          {importResult && (
            <MobileCard title={t('importExport.importResult')}>
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <MobileTag color="success">Đã thêm: {importResult.inserted}</MobileTag>
                  <MobileTag color="warning">Bỏ qua: {importResult.skipped}</MobileTag>
                  {importResult.errors?.length > 0 && <MobileTag color="danger">Lỗi: {importResult.errors.length}</MobileTag>}
                </div>
                {importResult.errors?.length > 0 && (
                  <div style={{ maxHeight: 120, overflow: 'auto', fontSize: 11, color: 'var(--adm-color-danger)' }}>
                    {importResult.errors.map((e, i) => (
                      <div key={i}>Dòng {e.row}: {e.reason}</div>
                    ))}
                  </div>
                )}
                <MobileButton block size="small" onClick={() => setImportResult(null)}>Đóng</MobileButton>
              </div>
            </MobileCard>
          )}

          <MobileCard title={t('adminImportExport.exportExcel')}>
            <MobileSpace direction="vertical" block>
              <Radio.Group value={exportType} onChange={e => setExportType(e.target.value)}>
                <Radio value="all">{t('adminImportExport.all')}</Radio>
                <Radio value="filtered">{t('adminImportExport.currentFilter')}</Radio>
              </Radio.Group>
              <MobileButton block color="primary" onClick={handleExport}><FileExcelOutlined /> {t('adminImportExport.exportExcel')}</MobileButton>
              <MobileButton block onClick={() => window.print()}>{t('adminImportExport.exportPdf')}</MobileButton>
              <MobileButton block color="danger" onClick={handleMobileDeleteAll}><DeleteOutlined /> {t('adminImportExport.deleteAllButton')}</MobileButton>
            </MobileSpace>
          </MobileCard>
        </MobileSpace>
      </div>

      <div className="desktop-only">
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Button danger icon={<DeleteOutlined />} onClick={handleDeleteAll}>
            {t('adminImportExport.deleteAllButton')}
          </Button>
        </div>
        <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={t('adminImportExport.importExcel')}>
            <Upload.Dragger
              accept=".xlsx,.xls"
              beforeUpload={handleFileUpload}
              showUploadList={false}
              loading={uploading}
            >
              <p><UploadOutlined /> {t('adminImportExport.dropExcel')}</p>
            </Upload.Dragger>
            <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate} style={{ marginTop: 12 }}>
              {t('adminImportExport.downloadTemplate')}
            </Button>
            {previewData.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Space style={{ marginBottom: 8 }}>
                  <Tag color="blue">{t('adminImportExport.totalTickets', { count: previewData.length })}</Tag>
                  <Tag color="success">{t('adminImportExport.validCount', { count: validCount })}</Tag>
                  <Tag color="error">{t('adminImportExport.errorCount', { count: invalidCount })}</Tag>
                </Space>
                <Table
                  dataSource={previewData}
                  columns={previewColumns}
                  rowKey="soChungTu"
                  size="small"
                  scroll={{ x: 900 }}
                  pagination={{ pageSize: 20 }}
                />
                {validCount > 0 && (
                  <Button type="primary" onClick={handleImport} loading={uploading} style={{ marginTop: 12 }} icon={<UploadOutlined />}>
                    {t('adminImportExport.confirmImport', { count: validCount })}
                  </Button>
                )}
                <Button onClick={() => { setPreviewData([]); setImportResult(null); }} style={{ marginTop: 12, marginLeft: 8 }}>
                  {t('adminImportExport.clearData')}
                </Button>
              </div>
            )}
            {importResult && (
              <Modal open={!!importResult} onCancel={() => setImportResult(null)} footer={null} title={t('adminImportExport.resultTitle')} width={600}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Alert
                    message={t('adminImportExport.importDone')}
                    description={t('adminImportExport.importDescription', { inserted: importResult.inserted, skipped: importResult.skipped, errors: importResult.errors?.length || 0 })}
                    type={importResult.errors?.length > 0 ? 'warning' : 'success'}
                    showIcon
                  />
                  {importResult.errors?.length > 0 && (
                    <div style={{ maxHeight: 200, overflow: 'auto' }}>
                      <strong>{t('adminImportExport.errorDetails')}</strong>
                      {importResult.errors.map((e, i) => (
                        <div key={i} style={{ fontSize: 12, color: '#ff4d4f', marginBottom: 4 }}>
                          {t('adminImportExport.rowError', { row: e.row, reason: e.reason })}
                        </div>
                      ))}
                    </div>
                  )}
                </Space>
              </Modal>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={t('adminImportExport.exportExcel')}>
            <Radio.Group value={exportType} onChange={e => setExportType(e.target.value)} style={{ marginBottom: 16 }}>
              <Radio value="all">{t('adminImportExport.all')}</Radio>
              <Radio value="filtered">{t('adminImportExport.currentFilter')}</Radio>
            </Radio.Group>
            <br />
            <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExport} style={{ marginRight: 8 }}>
              {t('adminImportExport.exportExcel')}
            </Button>
            <Button onClick={() => window.print()}>{t('adminImportExport.exportPdf')}</Button>
          </Card>
        </Col>
        </Row>
      </div>
      <BackupRestorePanel />
    </div>
  );
}

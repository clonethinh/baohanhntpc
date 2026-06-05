import { useEffect, useMemo, useState } from 'react';
import { App, Button, Card, DatePicker, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography, Grid, Row, Col, theme } from 'antd';
import { SearchOutlined, EditOutlined, StopOutlined, CheckOutlined, HistoryOutlined, FormOutlined } from '@ant-design/icons';
import { Button as MobileButton, Card as MobileCard, DatePicker as MobileDatePicker, Dialog, Input as MobileInput, List, Popup, Space as MobileSpace, Switch as MobileSwitch, Tag as MobileTag, TextArea as MobileTextArea, Toast } from 'antd-mobile';
import { EditSOutline } from 'antd-mobile-icons';
import dayjs from 'dayjs';
import { nhanVienService, supplierService, warrantyService } from '../../services/warrantyService';
import StatusTag from '../../components/warranty/StatusTag';
import WarrantyDetail from '../../components/warranty/WarrantyDetail';
import { getStatusBadgeColor } from '../../constants/badgeConfig';
import { useTranslation } from 'react-i18next';

const { Title, Text, Link } = Typography;

function formatDateTime(value) {
  if (!value) return '-';
  const d = dayjs(value);
  return d.isValid() ? d.format('DD-MM-YYYY HH:mm') : value;
}

function getStatusLabel(t, status) {
  return status ? t(`status:trangThai.${status}`, { defaultValue: status }) : '-';
}

function getTicketStatusColor(status) {
  return getStatusBadgeColor(status, 'mobile');
}

export default function Suppliers() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.xl;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expandedSupplierId, setExpandedSupplierId] = useState(null);
  const [trackingRowsMap, setTrackingRowsMap] = useState({});
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [selectedWarranty, setSelectedWarranty] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const openDetail = (id) => {
    setDetailId(id);
    setDetailOpen(true);
  };

  const [receiveForm] = Form.useForm();
  const [form] = Form.useForm();

  const [mobileFormOpen, setMobileFormOpen] = useState(false);
  const [mobileForm, setMobileForm] = useState({ name: '', phone: '', email: '', address: '', contactPerson: '', note: '', isActive: true, code: '' });
  const [mobileReceiveOpen, setMobileReceiveOpen] = useState(false);
  const [mobileReturnedAt, setMobileReturnedAt] = useState('');
  const [mobileReceiveNote, setMobileReceiveNote] = useState('');
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteEditTarget, setNoteEditTarget] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await supplierService.getList({ page: 1, limit: 300 });
      if (res.data.success) setData(res.data.data.rows || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    nhanVienService.getList().then((res) => {
      if (res.data?.success) setStaffList(res.data.data || []);
    }).catch(() => {});
  }, []);

  const getStaffName = (code) => {
    if (!code) return '-';
    const key = String(code).trim().toLowerCase();
    const staff = staffList.find((item) => String(item.maNV || '').trim().toLowerCase() === key);
    return staff?.tenNV || code;
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((row) => {
      if (filterActive === '1' && !row.isActive) return false;
      if (filterActive === '0' && row.isActive) return false;
      if (!q) return true;
      return [row.code, row.name, row.phone, row.contactPerson, row.address].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [data, search, filterActive]);

  const summary = useMemo(() => {
    const total = filteredRows.length;
    const active = filteredRows.filter((r) => r.isActive).length;
    return { total, active, inactive: total - active };
  }, [filteredRows]);

  const openCreate = () => {
    setEditing(null);
    if (isMobile) {
      setMobileForm({ name: '', phone: '', email: '', address: '', contactPerson: '', note: '', isActive: true, code: '' });
      setMobileFormOpen(true);
      return;
    }
    form.setFieldsValue({ name: '', phone: '', email: '', address: '', contactPerson: '', note: '', isActive: true });
    setOpenForm(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    if (isMobile) {
      setMobileForm({
        name: row.name || '', phone: row.phone || '', email: row.email || '', address: row.address || '',
        contactPerson: row.contactPerson || '', note: row.note || '', isActive: row.isActive !== false, code: row.code || '',
      });
      setMobileFormOpen(true);
      return;
    }
    form.setFieldsValue(row);
    setOpenForm(true);
  };

  const submit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) await supplierService.update(editing.id, values);
      else await supplierService.create(values);
      message.success(editing ? t('adminSuppliers.updateSuccess') : t('adminSuppliers.createSuccess'));
      setOpenForm(false);
      fetchData();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.error?.message || t('adminSuppliers.saveError'));
    }
  };

  const submitMobileForm = async () => {
    if (!mobileForm.name?.trim()) return Toast.show({ content: t('adminSuppliers.nameRequired') });
    const payload = {
      name: mobileForm.name.trim(),
      phone: mobileForm.phone || '',
      email: mobileForm.email || '',
      address: mobileForm.address || '',
      contactPerson: mobileForm.contactPerson || '',
      note: mobileForm.note || '',
      isActive: Boolean(mobileForm.isActive),
      ...(editing ? { code: mobileForm.code || '' } : {}),
    };
    if (editing) await supplierService.update(editing.id, payload);
    else await supplierService.create(payload);
    Toast.show({ content: editing ? t('adminSuppliers.updateSuccess') : t('adminSuppliers.createSuccess') });
    setMobileFormOpen(false);
    fetchData();
  };

  const openTracking = async (row) => {
    if (expandedSupplierId === row.id) return setExpandedSupplierId(null);
    const res = await supplierService.getWarranties(row.id);
    if (res.data.success) {
      setTrackingRowsMap((prev) => ({ ...prev, [row.id]: res.data.data || [] }));
      setExpandedSupplierId(row.id);
    }
  };

  const refreshTracking = async () => {
    if (!expandedSupplierId) return;
    const res = await supplierService.getWarranties(expandedSupplierId);
    if (res.data.success) setTrackingRowsMap((prev) => ({ ...prev, [expandedSupplierId]: res.data.data || [] }));
  };

  const openReceiveModal = (warrantyRow) => {
    setSelectedWarranty(warrantyRow);
    if (isMobile) {
      setMobileReturnedAt(new Date());
      setMobileReceiveNote('');
      setMobileReceiveOpen(true);
      return;
    }
    receiveForm.setFieldsValue({ returnedAt: dayjs(), note: '' });
    setReceiveModalOpen(true);
  };

  const submitReceive = async () => {
    try {
      const values = await receiveForm.validateFields();
      await warrantyService.returnFromSupplier(selectedWarranty.id, { returnedAt: values.returnedAt.format('YYYY-MM-DDTHH:mm:ss'), note: values.note || '' });
      message.success(t('adminSuppliers.receivedSuccess'));
      setReceiveModalOpen(false);
      refreshTracking();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.error?.message || t('adminSuppliers.receiveError'));
    }
  };

  const submitMobileReceive = async () => {
    await warrantyService.returnFromSupplier(selectedWarranty.id, { returnedAt: dayjs(mobileReturnedAt).format('YYYY-MM-DDTHH:mm:ss'), note: mobileReceiveNote || '' });
    Toast.show({ content: t('adminSuppliers.receivedSuccess') });
    setMobileReceiveOpen(false);
    refreshTracking();
  };

  const toggleSupplierStatus = async (row) => {
    await supplierService.setStatus(row.id, !row.isActive);
    if (isMobile) Toast.show({ content: row.isActive ? t('adminSuppliers.inactive') : t('adminSuppliers.active') });
    fetchData();
  };

  const openEditNote = (warrantyRecord, historyRecord) => {
    setNoteEditTarget({ warrantyId: warrantyRecord.id, logId: historyRecord.id });
    setNoteDraft(historyRecord.note || '');
    setNoteModalOpen(true);
  };

  const submitEditNote = async () => {
    if (!noteEditTarget?.warrantyId || !noteEditTarget?.logId) return;
    setNoteSaving(true);
    try {
      await warrantyService.updateSupplierLogNote(noteEditTarget.warrantyId, noteEditTarget.logId, { note: noteDraft || '' });
      message.success('Đã cập nhật ghi chú');
      setNoteModalOpen(false);
      setNoteEditTarget(null);
      setNoteDraft('');
      refreshTracking();
    } catch (err) {
      message.error(err?.response?.data?.error?.message || 'Không thể cập nhật ghi chú');
    } finally {
      setNoteSaving(false);
    }
  };

  const renderTrackingTable = (row) => (
    <Card className="supplier-tracking-level1" size="small" title={<Space><HistoryOutlined />{t('adminSuppliers.trackingTitle', { code: row.code, name: row.name })}</Space>} styles={{ body: { padding: 8 } }}>
      <Table
        rowKey="id"
        dataSource={trackingRowsMap[row.id] || []}
        pagination={false}
        expandable={{
          expandRowByClick: true,
          expandedRowClassName: () => 'supplier-level2-expanded-row',
          expandedRowRender: (record) => (
            <Table
              size="small"
              pagination={false}
              rowKey={(r) => `${record.id}-${r.action}-${r.at}-${r.createdBy || 'system'}-${r.sentAt || ''}-${r.returnedAt || ''}`}
              dataSource={record.supplierHistory || []}
              columns={[
                { title: t('adminSuppliers.event'), dataIndex: 'action', key: 'action', width: 130, render: (v) => (v === 'sent' ? <Tag color="green">{t('adminSuppliers.sentToSupplier')}</Tag> : <Tag color="blue">{t('adminSuppliers.received')}</Tag>) },
                { title: t('adminSuppliers.recordedAt'), dataIndex: 'at', key: 'at', width: 160, render: formatDateTime },
                { title: t('adminSuppliers.sentAt'), dataIndex: 'sentAt', key: 'sentAt', width: 140, render: formatDateTime },
                { title: t('adminSuppliers.expectedReturnAt'), dataIndex: 'expectedReturnAt', key: 'expectedReturnAt', width: 140, render: formatDateTime },
                { title: t('adminSuppliers.returnedAt'), dataIndex: 'returnedAt', key: 'returnedAt', width: 140, render: formatDateTime },
                { title: t('field.nhanVien'), dataIndex: 'createdBy', key: 'createdBy', width: 160, render: getStaffName },
                { title: t('field.ghiChu'), dataIndex: 'note', key: 'note', render: (value, historyRecord) => (<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}><span style={{ whiteSpace: 'normal', wordBreak: 'break-word', flex: 1 }}>{value || '-'}</span><Button type="text" size="small" icon={<FormOutlined />} aria-label="Sửa ghi chú" onClick={() => openEditNote(record, historyRecord)} style={{ flex: '0 0 auto', marginTop: -2 }} /></div>) },
              ]}
            />
          ),
          rowExpandable: (record) => (record.supplierHistory || []).length > 0,
        }}
        columns={[
          { title: t('adminWarrantyList.documentNumber'), dataIndex: 'soChungTu', key: 'soChungTu', render: (v, record) => <Link onClick={() => openDetail(record.id)} strong>{v}</Link> },
          { title: t('field.khachHang'), dataIndex: 'khachHang', key: 'khachHang' },
          { title: t('field.sanPham'), dataIndex: 'tenHang', key: 'tenHang' },
          {
            title: t('adminSuppliers.ticketStatus'),
            dataIndex: 'trangThai',
            key: 'trangThai',
            render: (_, record) => (record.supplierStatus === 'returned' ? <StatusTag status="da_tra" /> : <StatusTag status={record.trangThai} doiTra={record.doiTra} />),
          },
          {
            title: t('adminSuppliers.supplierStatus'),
            dataIndex: 'supplierStatus',
            key: 'supplierStatus',
            render: (v) => {
              if (v === 'sent') return <Tag color="green">{t('adminSuppliers.sent')}</Tag>;
              if (v === 'returned') return <Tag color="blue">{t('adminSuppliers.returned')}</Tag>;
              return <Tag>{t('adminSuppliers.notSent')}</Tag>;
            },
          },
          {
            title: t('adminWarrantyList.action'),
            key: 'actions',
            render: (_, record) => (record.supplierStatus === 'sent' ? <Button size="small" type="primary" onClick={() => openReceiveModal(record)}>{t('adminSuppliers.received')}</Button> : <Tag>---</Tag>),
          },
        ]}
      />
    </Card>
  );

  const renderMobileTracking = (row) => {
    const trackingRows = trackingRowsMap[row.id] || [];
    if (!trackingRows.length) return <div className="admin-mobile-empty">{t('adminWarrantyList.emptyFiltered')}</div>;

    return (
      <List>
        {trackingRows.map((record) => (
          <List.Item
            key={record.id}
            clickable
            onClick={() => openDetail(record.id)}
            description={`${record.khachHang || '-'} · ${record.tenHang || '-'}`}
            extra={record.supplierStatus === 'sent' ? <MobileButton size="mini" color="primary" onClick={(e) => { e.stopPropagation(); openReceiveModal(record); }}>{t('adminSuppliers.received')}</MobileButton> : null}
          >
            <div style={{ display: 'grid', gap: 6 }}>
              <Link onClick={(e) => { e.stopPropagation(); openDetail(record.id); }} strong>{record.soChungTu}</Link>
              <MobileSpace wrap>
                <MobileTag color={record.supplierStatus === 'sent' ? 'success' : record.supplierStatus === 'returned' ? 'primary' : 'default'}>
                  {record.supplierStatus === 'sent' ? t('adminSuppliers.sent') : record.supplierStatus === 'returned' ? t('adminSuppliers.returned') : t('adminSuppliers.notSent')}
                </MobileTag>
                <MobileTag color={getTicketStatusColor(record.supplierStatus === 'returned' ? 'da_tra' : record.trangThai)}>
                  {record.supplierStatus === 'returned' ? t('status:trangThai.da_tra') : getStatusLabel(t, record.trangThai)}
                </MobileTag>
              </MobileSpace>
              {(record.supplierHistory || []).slice().reverse().map((h, idx) => (
                <div key={`${record.id}-${h.action}-${h.at}-${idx}`} style={{ fontSize: 12, color: 'var(--adm-color-weak)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span>
                    {h.action === 'sent' ? t('adminSuppliers.sentToSupplier') : t('adminSuppliers.received')} · {formatDateTime(h.at)}
                    {h.note ? ` · ${h.note}` : ''}
                  </span>
                  <MobileButton size="mini" fill="none" style={{ padding: 0 }} onClick={(e) => { e.stopPropagation(); openEditNote(record, h); }}>
                    <EditSOutline fontSize={12} />
                  </MobileButton>
                </div>
              ))}
            </div>
          </List.Item>
        ))}
      </List>
    );
  };

  if (isMobile) {
    return (
      <div className="admin-mobile-page">
        <MobileCard className="admin-mobile-card" title={t('adminSuppliers.title')}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, padding: '0 4px' }}>
            <MobileTag color="primary">{t('adminSuppliers.summaryTotal', { count: summary.total })}</MobileTag>
            <MobileTag color="success">{t('adminSuppliers.summaryActive', { count: summary.active })}</MobileTag>
            <MobileTag color="default">{t('adminSuppliers.summaryInactive', { count: summary.inactive })}</MobileTag>
          </div>
          <MobileSpace direction="vertical" block style={{ '--gap': '8px' }}>
            <MobileInput placeholder={t('adminSuppliers.searchMobile')} value={search} onChange={setSearch} />
            <MobileSpace wrap>
              <MobileButton size="small" color={filterActive === '' ? 'primary' : 'default'} onClick={() => setFilterActive('')}>{t('adminSuppliers.allStatus')}</MobileButton>
              <MobileButton size="small" color={filterActive === '1' ? 'success' : 'default'} onClick={() => setFilterActive('1')}>{t('adminSuppliers.activeStatus')}</MobileButton>
              <MobileButton size="small" color={filterActive === '0' ? 'warning' : 'default'} onClick={() => setFilterActive('0')}>{t('adminSuppliers.inactiveStatus')}</MobileButton>
            </MobileSpace>
            <MobileButton color="primary" onClick={openCreate}>+ {t('adminSuppliers.addSupplier')}</MobileButton>
          </MobileSpace>
        </MobileCard>

        {loading ? <MobileCard className="admin-mobile-card">{t('adminCustomer.loading')}</MobileCard> : null}

        <div className="admin-mobile-supplier-list">
          {filteredRows.map((row) => {
            const isExpanded = expandedSupplierId === row.id;
            return (
              <div key={row.id}>
                <MobileCard className="admin-mobile-card" onClick={() => openTracking(row)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{row.code} {row.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--adm-color-weak)' }}>{row.phone || '-'} · {row.contactPerson || '-'}</div>
                    </div>
                    <MobileTag color={row.isActive ? 'success' : 'default'}>{row.isActive ? t('adminSuppliers.active') : t('adminSuppliers.inactive')}</MobileTag>
                  </div>
                  <MobileSpace wrap style={{ marginTop: 10 }}>
                    <MobileButton size="mini" onClick={(e) => { e.stopPropagation(); openEdit(row); }}>{t('button.sua')}</MobileButton>
                    <MobileButton
                      size="mini"
                      color={row.isActive ? 'danger' : 'success'}
                      onClick={(e) => {
                        e.stopPropagation();
                        Dialog.confirm({
                          content: row.isActive ? t('adminSuppliers.disableConfirm') : t('adminSuppliers.enableConfirm'),
                          onConfirm: () => toggleSupplierStatus(row),
                        });
                      }}
                    >
                      {row.isActive ? t('adminSuppliers.disable') : t('adminSuppliers.enable')}
                    </MobileButton>
                  </MobileSpace>
                </MobileCard>
                {isExpanded ? <MobileCard className="admin-mobile-card" title={t('adminSuppliers.trackingShort', { code: row.code })}>{renderMobileTracking(row)}</MobileCard> : null}
              </div>
            );
          })}
        </div>

        <Popup visible={mobileFormOpen} onMaskClick={() => setMobileFormOpen(false)} bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 12 }}>
          <h3>{editing ? t('adminSuppliers.editSupplier') : t('adminSuppliers.addSupplier')}</h3>
          <List>
            {editing ? <List.Item title={t('adminSuppliers.supplierCode')}><MobileInput value={mobileForm.code} onChange={(v) => setMobileForm((s) => ({ ...s, code: v }))} /></List.Item> : null}
            <List.Item title={t('adminSuppliers.supplierName')}><MobileInput value={mobileForm.name} onChange={(v) => setMobileForm((s) => ({ ...s, name: v }))} /></List.Item>
            <List.Item title={t('trackingResult.phone')}><MobileInput value={mobileForm.phone} onChange={(v) => setMobileForm((s) => ({ ...s, phone: v }))} /></List.Item>
            <List.Item title="Email"><MobileInput value={mobileForm.email} onChange={(v) => setMobileForm((s) => ({ ...s, email: v }))} /></List.Item>
            <List.Item title={t('field.diaChi')}><MobileInput value={mobileForm.address} onChange={(v) => setMobileForm((s) => ({ ...s, address: v }))} /></List.Item>
            <List.Item title={t('adminSuppliers.contactPerson')}><MobileInput value={mobileForm.contactPerson} onChange={(v) => setMobileForm((s) => ({ ...s, contactPerson: v }))} /></List.Item>
            <List.Item title={t('field.ghiChu')}><MobileTextArea rows={2} value={mobileForm.note} onChange={(v) => setMobileForm((s) => ({ ...s, note: v }))} /></List.Item>
            <List.Item title={t('adminSuppliers.active')}><MobileSwitch checked={Boolean(mobileForm.isActive)} onChange={(v) => setMobileForm((s) => ({ ...s, isActive: v }))} /></List.Item>
          </List>
          <MobileSpace block justify="between" style={{ marginTop: 12 }}>
            <MobileButton onClick={() => setMobileFormOpen(false)}>{t('button.huy')}</MobileButton>
            <MobileButton color="primary" onClick={submitMobileForm}>{t('button.luu')}</MobileButton>
          </MobileSpace>
        </Popup>

        <Popup visible={mobileReceiveOpen} onMaskClick={() => setMobileReceiveOpen(false)} bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 12 }}>
          <h3>{t('adminSuppliers.confirmReceived')}</h3>
          <List>
            <List.Item title={t('field.ngayNhan')}>
              <MobileDatePicker value={mobileReturnedAt} onConfirm={setMobileReturnedAt} precision="minute">
                {(value) => <MobileButton size="small">{dayjs(value || new Date()).format('DD-MM-YYYY HH:mm')}</MobileButton>}
              </MobileDatePicker>
            </List.Item>
            <List.Item title={t('field.ghiChu')}><MobileTextArea rows={2} value={mobileReceiveNote} onChange={setMobileReceiveNote} /></List.Item>
          </List>
          <MobileSpace block justify="between" style={{ marginTop: 12 }}>
            <MobileButton onClick={() => setMobileReceiveOpen(false)}>{t('button.huy')}</MobileButton>
            <MobileButton color="primary" onClick={submitMobileReceive}>{t('button.xacNhan')}</MobileButton>
          </MobileSpace>
        </Popup>
      </div>
    );
  }

  return (
    <>
      <div className="desktop-only" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Title level={4}>{t('adminSuppliers.title')}</Title>

        <Card>
          <Row gutter={12} align="middle">
            <Col flex="auto">
              <Input prefix={<SearchOutlined />} placeholder={t('adminSuppliers.searchDesktop')} value={search} onChange={(e) => setSearch(e.target.value)} />
            </Col>
            <Col>
              <Select style={{ width: 180 }} value={filterActive} onChange={setFilterActive} options={[{ label: t('adminSuppliers.allStatus'), value: '' }, { label: t('adminSuppliers.activeStatus'), value: '1' }, { label: t('adminSuppliers.inactiveStatus'), value: '0' }]} />
            </Col>
            <Col>
              <Button type="primary" onClick={openCreate}>{t('adminSuppliers.addSupplier')}</Button>
            </Col>
          </Row>
        </Card>

        <Card extra={<Space><Tag color="blue">{t('adminSuppliers.summaryTotal', { count: summary.total })}</Tag><Tag color="green">{t('adminSuppliers.summaryActive', { count: summary.active })}</Tag><Tag>{t('adminSuppliers.summaryInactive', { count: summary.inactive })}</Tag></Space>} styles={{ body: { padding: 12 } }}>
          {loading ? <div style={{ padding: 24, color: token.colorTextSecondary }}>{t('adminCustomer.loading')}</div> : (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px minmax(240px,1.2fr) 140px 180px 120px 110px', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: token.colorFillTertiary, color: token.colorTextSecondary, fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
                <div>{t('adminSuppliers.supplierCode')}</div><div>{t('adminSuppliers.supplierName')}</div><div>{t('trackingResult.phone')}</div><div>{t('adminSuppliers.contact')}</div><div>{t('table.trangThai')}</div><div style={{ textAlign: 'right' }}>{t('adminStaff.action')}</div>
              </div>

              {filteredRows.map((row) => {
                const active = expandedSupplierId === row.id;
                return (
                  <div key={row.id} style={{ border: active ? `1px solid ${token.colorPrimary}` : `1px solid ${token.colorBorderSecondary}`, borderRadius: 12, background: active ? token.colorPrimaryBg : token.colorBgContainer, overflow: 'visible' }}>
                    <div role="button" tabIndex={0} onClick={() => openTracking(row)} onKeyDown={(e) => e.key === 'Enter' && openTracking(row)} style={{ display: 'grid', gridTemplateColumns: '140px minmax(240px,1.2fr) 140px 180px 120px 110px', gap: 12, alignItems: 'center', padding: '12px', cursor: 'pointer' }}>
                      <div><Text strong>{row.code}</Text></div>
                      <div><Text strong>{row.name}</Text></div>
                      <div>{row.phone || '-'}</div>
                      <div>{row.contactPerson || '-'}</div>
                      <div><Tag color={row.isActive ? 'green' : 'default'}>{row.isActive ? t('adminSuppliers.active') : t('adminSuppliers.inactive')}</Tag></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button size="small" shape="circle" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); openEdit(row); }} />
                        <Popconfirm title={row.isActive ? t('adminSuppliers.disableConfirm') : t('adminSuppliers.enableConfirm')} onConfirm={async () => { await supplierService.setStatus(row.id, !row.isActive); fetchData(); }}>
                          <Button size="small" shape="circle" icon={row.isActive ? <StopOutlined /> : <CheckOutlined />} danger={row.isActive} onClick={(e) => e.stopPropagation()} />
                        </Popconfirm>
                      </div>
                    </div>

                    {active ? <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, paddingLeft: 12, paddingRight: 12, paddingBottom: 12, paddingTop: 12 }}>{renderTrackingTable(row)}</div> : null}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Modal title={editing ? t('adminSuppliers.editSupplier') : t('adminSuppliers.addSupplier')} open={openForm} onOk={submit} onCancel={() => setOpenForm(false)}>
        <Form form={form} layout="vertical">
          {editing ? <Form.Item label={t('adminSuppliers.supplierCode')} name="code" rules={[{ required: true, message: t('adminSuppliers.codeRequired') }]}><Input /></Form.Item> : null}
          <Form.Item label={t('adminSuppliers.supplierName')} name="name" rules={[{ required: true, message: t('adminSuppliers.nameRequiredShort') }]}><Input /></Form.Item>
          <Form.Item label={t('trackingResult.phone')} name="phone"><Input /></Form.Item>
          <Form.Item label="Email" name="email"><Input /></Form.Item>
          <Form.Item label={t('field.diaChi')} name="address"><Input /></Form.Item>
          <Form.Item label={t('adminSuppliers.contactPerson')} name="contactPerson"><Input /></Form.Item>
          <Form.Item label={t('field.ghiChu')} name="note"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item label={t('adminSuppliers.active')} name="isActive" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`${t('adminSuppliers.confirmReceived')}${selectedWarranty?.soChungTu ? ` - ${selectedWarranty.soChungTu}` : ''}`} open={receiveModalOpen} onOk={submitReceive} onCancel={() => setReceiveModalOpen(false)} okText={t('button.xacNhan')} cancelText={t('button.huy')}>
        <Form form={receiveForm} layout="vertical">
          <Form.Item label={t('field.ngayNhan')} name="returnedAt" rules={[{ required: true, message: t('adminSuppliers.chooseReceivedDate') }]}>
            <DatePicker showTime style={{ width: '100%' }} format="DD-MM-YYYY HH:mm" />
          </Form.Item>
          <Form.Item label={t('field.ghiChu')} name="note">
            <Input.TextArea rows={2} placeholder={t('adminSuppliers.receiveNotePlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Sửa ghi chú"
        open={noteModalOpen}
        confirmLoading={noteSaving}
        onOk={submitEditNote}
        onCancel={() => {
          setNoteModalOpen(false);
          setNoteEditTarget(null);
          setNoteDraft('');
        }}
        okText={t('button.xacNhan')}
        cancelText={t('button.huy')}
      >
        <Input.TextArea
          rows={4}
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          placeholder="Nhập ghi chú"
        />
      </Modal>

      <WarrantyDetail
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        warrantyId={detailId}
        onRefresh={refreshTracking}
      />
    </>
  );
}


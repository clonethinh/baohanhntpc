import { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Input, AutoComplete, Tag, Typography, Space, Table, DatePicker, Button, Select, Modal, Form, App, theme, Popconfirm } from 'antd';
import { SearchOutlined, HistoryOutlined, EditOutlined, DeleteOutlined, UserAddOutlined } from '@ant-design/icons';
import {
  Button as MobileButton,
  Card as MobileCard,
  Dialog,
  SearchBar,
  Selector,
  Space as MobileSpace,
  Tag as MobileTag,
} from 'antd-mobile';
import { EditSOutline } from 'antd-mobile-icons';
import { useTranslation } from 'react-i18next';
import { customerService, warrantyService } from '../../services/warrantyService';
import { STATUS_LABELS } from '../../constants/statusConfig';
import { getStatusBadgeColor } from '../../constants/badgeConfig';
import { formatDate } from '../../utils/dateHelpers';
import WarrantyDetail from '../../components/warranty/WarrantyDetail';
import CustomerPickerModal from '../../components/common/CustomerPickerModal';
import dayjs from 'dayjs';

const { Title, Text, Link } = Typography;
const { RangePicker } = DatePicker;

const STATUS_KEYS = ['da_nhan', 'dang_xu_ly', 'da_tra', 'huy', 'cho_xu_ly', 'cho_lien_he'];
const statusColor = Object.fromEntries(STATUS_KEYS.map((key) => [key, getStatusBadgeColor(key)]));
const mobileStatusColor = Object.fromEntries(STATUS_KEYS.map((key) => [key, getStatusBadgeColor(key, 'mobile')]));

export default function CustomerInfo() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { colorBgContainer, colorBgElevated, colorBgLayout, colorBorderSecondary, colorBorder, colorText, colorTextSecondary, colorPrimary, colorPrimaryBg, colorFillTertiary } = token;
  const [editForm] = Form.useForm();
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [customerList, setCustomerList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [unassignedList, setUnassignedList] = useState([]);
  const [unassignedLoading, setUnassignedLoading] = useState(false);
  const [dateRange, setDateRange] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedCustomerKey, setSelectedCustomerKey] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [assigningWarrantyId, setAssigningWarrantyId] = useState('');
  const [assigningCustomer, setAssigningCustomer] = useState(false);

  const lookupCustomer = useCallback((query) => {
    if (!query || query.length < 2) {
      setCustomerInfo(null);
      setSelectedCustomerKey('');
      return;
    }
    setLoading(true);
    customerService.lookup(query).then(res => {
      if (res.data.success && res.data.data) setCustomerInfo(res.data.data);
      else setCustomerInfo(null);
    }).finally(() => setLoading(false));
  }, []);

  const lookupCustomerByKey = useCallback((key) => {
    if (!key) {
      setCustomerInfo(null);
      setSelectedCustomerKey('');
      return;
    }
    setLoading(true);
    customerService.lookupByKey(key).then(res => {
      if (res.data.success && res.data.data) setCustomerInfo(res.data.data);
      else setCustomerInfo(null);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (search && search.length >= 2) {
      customerService.suggest(search).then(res => {
        if (res.data.success) setSuggestions(res.data.data);
      });
    } else {
      setSuggestions([]);
    }
  }, [search]);

  useEffect(() => {
    setListLoading(true);
    customerService.list().then((res) => {
      if (res.data?.success) setCustomerList(res.data.data || []);
    }).finally(() => setListLoading(false));
  }, []);

  useEffect(() => {
    setUnassignedLoading(true);
    customerService.unassigned().then((res) => {
      if (res.data?.success) setUnassignedList(res.data.data || []);
    }).finally(() => setUnassignedLoading(false));
  }, []);

  const handleSearch = () => lookupCustomer(search);
  const handleSelect = (value) => {
    setSearch(value);
    setSuggestions([]);
    lookupCustomer(value);
  };

  const handleSelectCustomerRow = (row) => {
    const nextKey = row.key || `${String(row.khachHang || '').trim().toLowerCase()}|${String(row.soDienThoai || '').trim()}`;

    setSuggestions([]);

    if (selectedCustomerKey !== nextKey) {
      setSelectedCustomerKey(nextKey);
      lookupCustomerByKey(nextKey);
    } else {
      setSelectedCustomerKey('');
      setCustomerInfo(null);
      setFilterStatus('');
      setDateRange(null);
    }
  };

  const handleOpenDetail = (id) => {
    setDetailId(id);
    setDetailOpen(true);
  };

  const refreshCustomerList = async () => {
    setListLoading(true);
    try {
      const res = await customerService.list();
      if (res.data?.success) setCustomerList(res.data.data || []);
    } finally {
      setListLoading(false);
    }
  };

  const refreshUnassignedList = async () => {
    setUnassignedLoading(true);
    try {
      const res = await customerService.unassigned();
      if (res.data?.success) setUnassignedList(res.data.data || []);
    } finally {
      setUnassignedLoading(false);
    }
  };

  const refreshCustomerData = async () => {
    await Promise.all([refreshCustomerList(), refreshUnassignedList()]);
  };

  const handleDeleteCustomer = async (row) => {
    try {
      const res = await customerService.deleteCustomer(row.key);
      const count = res.data?.data?.detached || 0;
      message.success(`Đã xóa khách hàng khỏi ${count} CT. CT đã chuyển vào Chưa có khách hàng.`);
      if (selectedCustomerKey === row.key) {
        setSelectedCustomerKey('');
        setCustomerInfo(null);
        setFilterStatus('');
        setDateRange(null);
      }
      await refreshCustomerData();
    } catch (err) {
      message.error(err?.response?.data?.error?.message || 'Không thể xóa khách hàng');
    }
  };

  const openAssignCustomer = (warrantyId) => {
    setAssigningWarrantyId(warrantyId);
    setCustomerPickerOpen(true);
    if (!customerList.length) refreshCustomerList();
  };

  const handleAssignCustomer = async (customer) => {
    if (!assigningWarrantyId || !customer?.key || assigningCustomer) return;
    setAssigningCustomer(true);
    try {
      await warrantyService.transferCustomer(assigningWarrantyId, customer.key);
      message.success('Đã gán khách hàng cho CT');
      setCustomerPickerOpen(false);
      setAssigningWarrantyId('');
      await refreshCustomerData();
      if (search) lookupCustomer(search);
    } catch (err) {
      message.error(err?.response?.data?.error?.message || 'Không thể gán khách hàng');
    } finally {
      setAssigningCustomer(false);
    }
  };

  const openEditCustomer = (row) => {
    setEditingCustomer(row);
    setEditOpen(true);
  };

  useEffect(() => {
    if (!editOpen || !editingCustomer) return;
    editForm.setFieldsValue({
      khachHang: editingCustomer.khachHang || '',
      soDienThoai: editingCustomer.soDienThoai || '',
      diaChi: editingCustomer.diaChi || '',
    });
  }, [editOpen, editingCustomer, editForm]);

  const saveCustomer = async () => {
    const values = await editForm.validateFields();
    setSavingCustomer(true);
    try {
      await customerService.update({ key: editingCustomer.key, ...values });
      message.success(t('adminCustomer.updateSuccess'));
      setEditOpen(false);
      setEditingCustomer(null);
      await refreshCustomerData();
      if (selectedCustomerKey === editingCustomer.key) {
        setSelectedCustomerKey('');
        setCustomerInfo(null);
      }
    } catch (err) {
      message.error(err?.response?.data?.error?.message || t('adminCustomer.updateError'));
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleDetailRefresh = () => {
    refreshCustomerData();
    if (search) lookupCustomer(search);
  };

  const filteredHistory = customerInfo?.history?.filter(item => {
    if (filterStatus && item.trangThai !== filterStatus) return false;
    if (dateRange) {
      const d = dayjs(item.ngayNhan);
      if (d.isBefore(dateRange[0]) || d.isAfter(dateRange[1])) return false;
    }
    return true;
  }) || [];

  const customerRows = customerList.filter((row) => {
    const q = String(search || '').trim().toLowerCase();
    if (!q || selectedCustomerKey) return true;
    return (
      String(row.maKhachHang || '').toLowerCase().includes(q) ||
      String(row.khachHang || '').toLowerCase().includes(q) ||
      String(row.soDienThoai || '').toLowerCase().includes(q) ||
      String(row.diaChi || '').toLowerCase().includes(q)
    );
  });

  const customerSummary = {
    total: customerRows.length,
    warrantyCount: customerRows.reduce((sum, row) => sum + (Number(row.totalWarranties) || 0), 0),
    activeCount: customerRows.reduce((sum, row) => sum + (Number(row.dangXuLyCount) || 0), 0),
  };

  const historyColumns = [
    { title: t('adminWarrantyList.documentNumber'), dataIndex: 'soChungTu', key: 'soChungTu', width: 150, render: (text, record) => <Link onClick={() => handleOpenDetail(record.id)}>{text}</Link> },
    { title: t('field.ngayNhan'), dataIndex: 'ngayNhan', key: 'ngayNhan', width: 110, render: text => formatDate(text) },
    { title: t('field.tenHang'), dataIndex: 'tenHang', key: 'tenHang', ellipsis: true },
    { title: t('field.soSeri'), dataIndex: 'soSeri', key: 'soSeri', width: 120 },
    { title: t('field.loiLucNhan'), dataIndex: 'loiLucNhan', key: 'loiLucNhan', ellipsis: true },
    { title: t('field.henTra'), dataIndex: 'ngayHenTra', key: 'ngayHenTra', width: 100, render: text => text ? formatDate(text) : '-' },
    { title: t('table.trangThai'), dataIndex: 'trangThai', key: 'trangThai', width: 130, render: s => <Tag color={statusColor[s] || 'default'}>{STATUS_LABELS[s] || s}</Tag> },
  ];

  const unassignedColumns = [
    { title: t('adminWarrantyList.documentNumber'), dataIndex: 'soChungTu', key: 'soChungTu', width: 150, render: (text, record) => <Link onClick={() => handleOpenDetail(record.id)}>{text}</Link> },
    { title: t('field.ngayNhan'), dataIndex: 'ngayNhan', key: 'ngayNhan', width: 120, render: text => formatDate(text) },
    { title: t('field.tenHang'), dataIndex: 'tenHang', key: 'tenHang', ellipsis: true },
    { title: t('field.soSeri'), dataIndex: 'soSeri', key: 'soSeri', width: 130 },
    { title: t('table.trangThai'), dataIndex: 'trangThai', key: 'trangThai', width: 130, render: s => <Tag color={statusColor[s] || 'default'}>{STATUS_LABELS[s] || s}</Tag> },
    {
      title: t('adminStaff.action'),
      key: 'action',
      width: 190,
      render: (_, record) => (
        <Space size={6}>
          <Button size="small" onClick={() => handleOpenDetail(record.id)}>Mở CT</Button>
          <Button size="small" type="primary" icon={<UserAddOutlined />} loading={assigningCustomer && assigningWarrantyId === record.id} onClick={() => openAssignCustomer(record.id)}>Gán khách</Button>
        </Space>
      ),
    },
  ];

  const statusOptions = [
    { label: t('common.tatCa'), value: '' },
    ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ label, value })),
  ];

  const cardStyle = { background: colorBgContainer, borderColor: colorBorder };
  const surfaceStyle = { background: colorBgElevated, borderColor: colorBorderSecondary };
  const mutedTextStyle = { color: colorTextSecondary };

  return (
    <>
      <div className="mobile-only admin-mobile-page customer-mobile-page">
        <MobileCard className="admin-mobile-card customer-mobile-section" style={cardStyle}>
          <MobileSpace direction="vertical" block style={{ '--gap': '10px' }}>
            <SearchBar
              placeholder={t('adminCustomer.searchPlaceholder')}
              value={search}
              onChange={setSearch}
              onSearch={handleSearch}
              clearable
              style={{ '--height': '42px', '--border-radius': '12px' }}
            />
            <MobileButton block color="primary" loading={loading} onClick={handleSearch}>
              {t('adminCustomer.search')}
            </MobileButton>
            {suggestions.length > 0 && (
              <div className="customer-mobile-suggestions" style={{ background: colorBgContainer, borderColor: colorBorder }}>
                {suggestions.slice(0, 6).map(item => (
                  <button key={item} type="button" onClick={() => handleSelect(item)}>{item}</button>
                ))}
              </div>
            )}
          </MobileSpace>
        </MobileCard>

        <MobileCard className="admin-mobile-card customer-mobile-section" title={t('adminCustomer.title')} style={cardStyle}>
          {listLoading ? (
            <div className="admin-mobile-empty">{t('adminCustomer.loading')}</div>
          ) : customerRows.length === 0 ? (
            <div className="admin-mobile-empty">{t('adminCustomer.emptyCustomers')}</div>
          ) : (
            <div className="customer-mobile-list" style={{ display: 'grid', gap: 10 }}>
              {customerRows.map(row => {
                const active = selectedCustomerKey === row.key;
                return (
                  <div key={row.key} style={{ border: active ? `1px solid ${colorPrimary}` : `1px solid ${colorBorderSecondary}`, borderRadius: 14, background: active ? colorPrimaryBg : colorBgContainer, overflow: 'hidden' }}>
                    <div role="button" tabIndex={0} onClick={() => handleSelectCustomerRow(row)} onKeyDown={(e) => { if (e.key === 'Enter') handleSelectCustomerRow(row); }} style={{ width: '100%', border: 0, background: 'transparent', padding: 12, textAlign: 'left', display: 'grid', gap: 8, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, color: colorText }}>{row.khachHang || '-'}</div>
                            <MobileButton size="mini" color="primary" fill="none" aria-label={t('adminCustomer.editAria')} onClick={(e) => { e.stopPropagation(); openEditCustomer(row); }} style={{ width: 26, height: 24, padding: 0, flex: '0 0 auto' }}>
                              <EditSOutline fontSize={16} />
                            </MobileButton>
                            <MobileButton
                              size="mini"
                              color="danger"
                              fill="none"
                              aria-label="Xóa khách hàng"
                              onClick={(e) => {
                                e.stopPropagation();
                                Dialog.confirm({
                                  content: 'Xóa khách hàng này khỏi danh sách? Các CT sẽ không bị xóa và sẽ chuyển vào Chưa có khách hàng.',
                                  confirmText: 'Xóa',
                                  cancelText: 'Hủy',
                                  onConfirm: () => handleDeleteCustomer(row),
                                });
                              }}
                              style={{ width: 26, height: 24, padding: 0, flex: '0 0 auto' }}
                            >
                              <DeleteOutlined style={{ fontSize: 14 }} />
                            </MobileButton>
                          </div>
                          <div style={{ fontSize: 12, color: colorTextSecondary, marginTop: 2 }}><Tag color="geekblue" style={{ marginInlineEnd: 6 }}>{row.maKhachHang || '-'}</Tag>{row.soDienThoai || t('adminCustomer.noPhone')}</div>
                        </div>
                        <MobileTag color={active ? 'success' : 'primary'}>{t('adminCustomer.ticketCount', { count: row.totalWarranties || 0 })}</MobileTag>
                      </div>
                      <div style={{ fontSize: 12, color: colorTextSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.diaChi || t('adminCustomer.noAddress')}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(Number(row.dangXuLyCount) || 0) > 0 && <MobileTag color="warning">{t('adminCustomer.processingCount', { count: row.dangXuLyCount })}</MobileTag>}
                        {(Number(row.daTraCount) || 0) > 0 && <MobileTag color="success">{t('adminCustomer.doneCount', { count: row.daTraCount })}</MobileTag>}
                        <MobileTag color="default">{t('adminCustomer.latest', { date: formatDate(row.lastNgayNhan) || '-' })}</MobileTag>
                      </div>
                    </div>

                    {active && customerInfo && (
                      <div style={{ padding: '0 12px 12px' }}>
                        <div style={{ borderTop: `1px solid ${colorBorderSecondary}`, paddingTop: 8, display: 'grid', gap: 8 }}>
                          {filteredHistory.length === 0 ? (
                            <div className="admin-mobile-empty">{t('adminWarrantyList.emptyFiltered')}</div>
                          ) : filteredHistory.map(item => (
                            <button key={item.id} type="button" onClick={() => handleOpenDetail(item.id)} style={{ width: '100%', border: `1px solid ${colorBorderSecondary}`, background: colorBgContainer, borderRadius: 12, padding: 10, textAlign: 'left', display: 'grid', gap: 5 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                <b style={{ color: colorText }}>{item.soChungTu}</b>
                                <MobileTag color={mobileStatusColor[item.trangThai] || 'default'}>{STATUS_LABELS[item.trangThai] || item.trangThai}</MobileTag>
                              </div>
                              <span style={{ color: colorText }}>{item.tenHang || '-'}</span>
                              <small style={mutedTextStyle}>{formatDate(item.ngayNhan)} · {t('adminCustomer.serial', { serial: item.soSeri || '-' })}</small>
                              <em style={{ color: colorTextSecondary }}>{t('adminCustomer.issue', { issue: item.loiLucNhan || '-' })}</em>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </MobileCard>

        <MobileCard className="admin-mobile-card customer-mobile-section" title={`Chưa có khách hàng (${unassignedList.length})`} style={cardStyle}>
          {unassignedLoading ? (
            <div className="admin-mobile-empty">{t('common.dangTai')}...</div>
          ) : unassignedList.length === 0 ? (
            <div className="admin-mobile-empty">Không có CT chưa có khách hàng</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {unassignedList.map(item => (
                <div key={item.id} style={{ border: `1px solid ${colorBorderSecondary}`, background: colorBgContainer, borderRadius: 12, padding: 10, display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <b style={{ color: colorText }}>{item.soChungTu}</b>
                    <MobileTag color={mobileStatusColor[item.trangThai] || 'default'}>{STATUS_LABELS[item.trangThai] || item.trangThai}</MobileTag>
                  </div>
                  <span style={{ color: colorText }}>{item.tenHang || '-'}</span>
                  <small style={mutedTextStyle}>{formatDate(item.ngayNhan)} · {t('adminCustomer.serial', { serial: item.soSeri || '-' })}</small>
                  <MobileSpace wrap>
                    <MobileButton size="mini" onClick={() => handleOpenDetail(item.id)}>Mở CT</MobileButton>
                    <MobileButton size="mini" color="primary" loading={assigningCustomer && assigningWarrantyId === item.id} onClick={() => openAssignCustomer(item.id)}>Gán khách</MobileButton>
                  </MobileSpace>
                </div>
              ))}
            </div>
          )}
        </MobileCard>

        {customerInfo && selectedCustomerKey && (
          <MobileCard className="admin-mobile-card customer-mobile-section" title={t('adminCustomer.filterHistory')} style={cardStyle}>
            <Selector value={filterStatus ? [filterStatus] : []} onChange={arr => setFilterStatus(arr[0] || '')} options={statusOptions} />
          </MobileCard>
        )}

        {!customerInfo && search && search.length >= 2 && !loading && customerRows.length === 0 && (
          <MobileCard className="admin-mobile-card customer-mobile-section" style={cardStyle}>{t('adminCustomer.notFound', { search })}</MobileCard>
        )}
      </div>

      <div className="desktop-only customer-desktop-page">
        <Title level={4}>{t('adminCustomer.title')}</Title>

        <Card className="customer-page-card customer-search-card" style={cardStyle}>
          <Row gutter={16} align="middle">
            <Col flex="auto">
              <AutoComplete options={suggestions.map(s => ({ value: s }))} onSelect={handleSelect} style={{ width: '100%' }}>
                <Input prefix={<SearchOutlined />} placeholder={t('adminCustomer.desktopSearchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} onPressEnter={handleSearch} size="large" allowClear />
              </AutoComplete>
            </Col>
            <Col>
              <Button type="primary" size="large" onClick={handleSearch} loading={loading}>{t('adminCustomer.search')}</Button>
            </Col>
          </Row>
        </Card>

        <Card className="customer-page-card customer-list-card" style={cardStyle} extra={<Space className="customer-stats-row" size={8}><Tag color="blue">{t('adminCustomer.customerCount', { count: customerSummary.total })}</Tag><Tag color="purple">{t('adminCustomer.ticketCount', { count: customerSummary.warrantyCount })}</Tag><Tag color="orange">{t('adminCustomer.activeCount', { count: customerSummary.activeCount })}</Tag></Space>} styles={{ body: { padding: 12 } }}>
          {listLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: colorTextSecondary }}>{t('adminCustomer.loading')}</div>
          ) : customerRows.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: colorTextSecondary }}>{t('adminCustomer.emptyCustomers')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              <div className="customer-table-header-row" style={{ display: 'grid', gridTemplateColumns: '110px minmax(220px, 1.1fr) 145px minmax(260px, 1.3fr) 210px 102px', gap: 12, alignItems: 'center', padding: '8px 12px', borderRadius: 10, background: colorFillTertiary, color: colorTextSecondary, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .15 }}>
                <div>Mã khách hàng</div>
                <div>{t('field.khachHang')}</div>
                <div>{t('field.soDienThoai')}</div>
                <div>{t('field.diaChi')}</div>
                <div style={{ textAlign: 'right' }}>{t('adminCustomer.stats')}</div>
                <div style={{ textAlign: 'center' }}>{t('adminStaff.action')}</div>
              </div>
              {customerRows.map(row => {
                const active = selectedCustomerKey === row.key;
                return (
                  <div key={row.key} style={{ border: active ? `1px solid ${colorPrimary}` : `1px solid ${colorBorderSecondary}`, borderRadius: 12, background: active ? colorPrimaryBg : colorBgContainer, boxShadow: active ? '0 4px 12px rgba(22,119,255,.08)' : 'var(--ant-box-shadow-tertiary, 0 1px 6px rgba(15,23,42,.04))', overflow: 'hidden' }}>
                    <div role="button" tabIndex={0} onClick={() => handleSelectCustomerRow(row)} onKeyDown={(e) => { if (e.key === 'Enter') handleSelectCustomerRow(row); }} style={{ width: '100%', border: 0, background: 'transparent', padding: '9px 12px', textAlign: 'left', cursor: 'pointer', display: 'grid', gridTemplateColumns: '110px minmax(220px, 1.1fr) 145px minmax(260px, 1.3fr) 210px 102px', gap: 12, alignItems: 'center' }}>
                      <div><Tag color="geekblue" style={{ marginInlineEnd: 0 }}>{row.maKhachHang || '-'}</Tag></div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: colorText }}>{row.khachHang || '-'}</div>
                        <div style={{ color: colorTextSecondary, fontSize: 11, fontWeight: 400, opacity: 0.78, marginTop: 1 }}>{t('adminCustomer.latest', { date: formatDate(row.lastNgayNhan) || '-' })}</div>
                      </div>

                      <div style={{ color: colorText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.soDienThoai || t('adminCustomer.noPhone')}</div>

                      <div style={{ color: colorTextSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.diaChi || t('adminCustomer.noAddress')}</div>

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Tag color={active ? 'green' : 'blue'} style={{ marginInlineEnd: 0 }}>{t('adminCustomer.ticketCount', { count: row.totalWarranties || 0 })}</Tag>
                        {(Number(row.dangXuLyCount) || 0) > 0 && <Tag color="orange" style={{ marginInlineEnd: 0 }}>{t('adminCustomer.processingCount', { count: row.dangXuLyCount })}</Tag>}
                        {(Number(row.daTraCount) || 0) > 0 && <Tag color="green" style={{ marginInlineEnd: 0 }}>{t('adminCustomer.doneCount', { count: row.daTraCount })}</Tag>}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Space size={6}>
                          <Button size="small" shape="circle" icon={<EditOutlined />} aria-label={t('adminCustomer.editAria')} onClick={(e) => { e.stopPropagation(); openEditCustomer(row); }} />
                          <Popconfirm
                            title="Xóa khách hàng?"
                            description="Các CT sẽ không bị xóa và sẽ chuyển vào Chưa có khách hàng."
                            okText="Xóa"
                            cancelText="Hủy"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => handleDeleteCustomer(row)}
                          >
                            <Button size="small" shape="circle" danger icon={<DeleteOutlined />} aria-label="Xóa khách hàng" onClick={(e) => e.stopPropagation()} />
                          </Popconfirm>
                        </Space>
                      </div>
                    </div>

                    {active && customerInfo && (
                      <div style={{ borderTop: `1px solid ${colorBorderSecondary}`, padding: 12 }}>
                        <Card size="small" title={<Space><HistoryOutlined />{t('adminCustomer.historyTitle', { count: filteredHistory.length })}</Space>} extra={<Space><Select placeholder={t('adminWarrantyList.statusPlaceholder')} allowClear style={{ width: 150 }} value={filterStatus} onChange={setFilterStatus} options={Object.entries(STATUS_LABELS).map(([k, v]) => ({ label: v, value: k }))} /><RangePicker value={dateRange} onChange={setDateRange} /></Space>} styles={{ body: { padding: 8 } }}>
                          <Table columns={historyColumns} dataSource={filteredHistory} rowKey="id" size="small" pagination={{ pageSize: 5, showTotal: total => t('adminCustomer.ticketCount', { count: total }) }} onRow={(record) => ({ onClick: () => handleOpenDetail(record.id), style: { cursor: 'pointer' } })} />
                        </Card>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card
          className="customer-page-card customer-unassigned-card"
          title="Chưa có khách hàng"
          style={cardStyle}
          extra={<Tag color={unassignedList.length ? 'orange' : 'default'}>{t('adminCustomer.ticketCount', { count: unassignedList.length })}</Tag>}
          styles={{ body: { padding: 8 } }}
        >
          <Table
            columns={unassignedColumns}
            dataSource={unassignedList}
            rowKey="id"
            size="small"
            loading={unassignedLoading}
            pagination={{ pageSize: 5, showTotal: total => t('adminCustomer.ticketCount', { count: total }) }}
            locale={{ emptyText: 'Không có CT chưa có khách hàng' }}
          />
        </Card>

        {!customerInfo && search && search.length >= 2 && !loading && (
          <Card className="customer-page-card" style={cardStyle}><Text type="secondary">{t('adminCustomer.notFound', { search })}</Text></Card>
        )}
      </div>

      <Modal title={t('adminCustomer.editTitle')} open={editOpen} onCancel={() => setEditOpen(false)} onOk={saveCustomer} okText={t('button.luu')} cancelText={t('button.huy')} confirmLoading={savingCustomer} destroyOnHidden>
        <Form form={editForm} layout="vertical">
          <Form.Item name="khachHang" label={t('adminCustomer.customerName')} rules={[{ required: true, message: t('adminCustomer.customerNameRequired') }]}><Input placeholder={t('adminCustomer.customerName')} /></Form.Item>
          <Form.Item name="soDienThoai" label={t('field.soDienThoai')}><Input placeholder={t('field.soDienThoai')} /></Form.Item>
          <Form.Item name="diaChi" label={t('field.diaChi')}><Input.TextArea rows={3} placeholder={t('field.diaChi')} /></Form.Item>
        </Form>
      </Modal>

      <CustomerPickerModal
        open={customerPickerOpen}
        title="Gán khách hàng cho CT"
        customers={customerList}
        loading={listLoading}
        onCancel={() => {
          setCustomerPickerOpen(false);
          setAssigningWarrantyId('');
        }}
        onSelect={handleAssignCustomer}
      />

      <WarrantyDetail open={detailOpen} onClose={() => setDetailOpen(false)} warrantyId={detailId} onRefresh={handleDetailRefresh} />
    </>
  );
}





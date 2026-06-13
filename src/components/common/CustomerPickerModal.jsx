import { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  ConfigProvider,
  Empty,
  Input,
  Modal,
  Segmented,
  Space,
  Tag,
  Tooltip,
  Typography,
  theme as antdTheme,
} from 'antd';
import {
  CheckCircleOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  SearchOutlined,
  SwapOutlined,
  UserOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

const { Text, Title } = Typography;

const FILTERS = [
  { value: 'all', labelKey: 'all' },
  { value: 'top', labelKey: 'top' },
  { value: 'recent', labelKey: 'recent' },
];

function getInitials(name) {
  if (!name) return '?';
  const trimmed = String(name).trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatLastActivity(value) {
  if (!value) return null;
  const d = dayjs(value);
  if (!d.isValid()) return null;
  const diffDays = dayjs().diff(d, 'day');
  if (diffDays === 0) return 'Hôm nay';
  if (diffDays === 1) return 'Hôm qua';
  if (diffDays < 7) return `${diffDays} ngày trước`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần trước`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} tháng trước`;
  return `${Math.floor(diffDays / 365)} năm trước`;
}

function formatPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 7) return phone;
  // Vietnamese mobile: 0xx xxx xx xx
  if (digits.startsWith('0') && digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

export default function CustomerPickerModal({
  open,
  customers = [],
  loading = false,
  title,
  excludedKey = '',
  currentCustomer = null, // { khachHang, soDienThoai, diaChi, key } - người sắp được thay thế
  onCancel,
  onSelect,
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedKey, setSelectedKey] = useState(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (open) {
      setQuery('');
      setFilter('all');
      setSelectedKey(null);
      setConfirming(false);
    }
  }, [open]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers
      .filter((row) => row.key !== excludedKey)
      .filter((row) => {
        if (!q) return true;
        return (
          String(row.khachHang || '').toLowerCase().includes(q) ||
          String(row.maKhachHang || '').toLowerCase().includes(q) ||
          String(row.soDienThoai || '').toLowerCase().includes(q) ||
          String(row.diaChi || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (filter === 'top') {
          return (b.totalWarranties || 0) - (a.totalWarranties || 0);
        }
        if (filter === 'recent') {
          const ad = a.lastNgayNhan ? new Date(a.lastNgayNhan).getTime() : 0;
          const bd = b.lastNgayNhan ? new Date(b.lastNgayNhan).getTime() : 0;
          return bd - ad;
        }
        // 'all': keep server order (usually by totalWarranties desc)
        return (b.totalWarranties || 0) - (a.totalWarranties || 0);
      });
  }, [customers, excludedKey, query, filter]);

  const selected = useMemo(
    () => rows.find((r) => r.key === selectedKey) || null,
    [rows, selectedKey]
  );

  const handleSelect = () => {
    if (!selected) return;
    setConfirming(true);
    onSelect?.(selected);
  };

  const handleRowClick = (item) => {
    setSelectedKey(item.key);
  };

  const handleRowDoubleClick = (item) => {
    setSelectedKey(item.key);
    setConfirming(true);
    onSelect?.(item);
  };

  const totalCount = customers.filter((r) => r.key !== excludedKey).length;

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      width={880}
      centered
      destroyOnHidden
      closable
      maskClosable
      title={null}
      className="ntpc-customer-picker"
      styles={{ body: { padding: 0 }, header: { display: 'none' } }}
      afterOpenChange={(visible) => {
        if (!visible) setSelectedKey(null);
      }}
    >
      {/* HEADER */}
      <div className="ntpc-customer-picker-header">
        <div className="ntpc-customer-picker-header-title">
          <SwapOutlined className="ntpc-customer-picker-header-icon" />
          <div>
            <Title level={5} style={{ margin: 0 }}>
              {title || t('customerPicker.title', { defaultValue: 'Chuyển khách hàng cho phiếu bảo hành' })}
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('customerPicker.subtitle', { defaultValue: 'Tìm và chọn khách hàng phù hợp để chuyển quyền sở hữu phiếu' })}
            </Text>
          </div>
        </div>
        {currentCustomer?.khachHang && (
          <div className="ntpc-customer-picker-header-current">
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Đang chuyển từ
            </Text>
            <Space size={6} style={{ marginTop: 2 }}>
              <Avatar size={20} style={{ background: 'var(--ant-color-warning-bg, #fffbe6)', color: 'var(--ant-color-warning, #faad14)' }}>
                {getInitials(currentCustomer.khachHang)}
              </Avatar>
              <Text strong style={{ fontSize: 13 }}>{currentCustomer.khachHang}</Text>
              {currentCustomer.soDienThoai && (
                <Text type="secondary" style={{ fontSize: 12 }}>· {formatPhone(currentCustomer.soDienThoai)}</Text>
              )}
            </Space>
          </div>
        )}
      </div>

      {/* SEARCH + FILTER */}
      <div className="ntpc-customer-picker-toolbar">
        <Input
          allowClear
          autoFocus
          size="large"
          prefix={<SearchOutlined />}
          placeholder={t('customerPicker.searchPlaceholder', { defaultValue: 'Tìm theo tên, mã KH, SĐT hoặc địa chỉ' })}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="ntpc-customer-picker-search"
        />
        <Segmented
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((f) => ({
            value: f.value,
            label: t(`customerPicker.filter.${f.labelKey}`, { defaultValue: f.value === 'all' ? 'Tất cả' : f.value === 'top' ? 'Nhiều CT nhất' : 'Mới nhất' }),
          }))}
          className="ntpc-customer-picker-filter"
        />
        <div className="ntpc-customer-picker-count">
          <Text type="secondary">
            <Text strong>{rows.length}</Text>
            {rows.length !== totalCount && (
              <span> / {totalCount}</span>
            )}
            <span> khách hàng</span>
          </Text>
        </div>
      </div>

      {/* BODY 2-COL */}
      <div className="ntpc-customer-picker-body">
        {/* LIST */}
        <div className="ntpc-customer-picker-list">
          {loading ? (
            <div className="ntpc-customer-picker-loading">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="ntpc-customer-picker-row-skel" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="ntpc-customer-picker-empty">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  query
                    ? `Không tìm thấy khách hàng với từ khóa "${query}"`
                    : 'Không có khách hàng phù hợp'
                }
              />
            </div>
          ) : (
            rows.map((item) => {
              const isActive = selectedKey === item.key;
              const lastActivity = formatLastActivity(item.lastNgayNhan);
              return (
                <div
                  key={item.key}
                  className={`ntpc-customer-picker-row ${isActive ? 'ntpc-customer-picker-row--active' : ''}`}
                  onClick={() => handleRowClick(item)}
                  onDoubleClick={() => handleRowDoubleClick(item)}
                >
                  <Avatar size={40} className="ntpc-customer-picker-row-avatar">
                    {getInitials(item.khachHang)}
                  </Avatar>
                  <div className="ntpc-customer-picker-row-info">
                    <div className="ntpc-customer-picker-row-name">
                      <Text strong style={{ fontSize: 14 }} ellipsis>
                        {item.khachHang || '(Chưa có tên)'}
                      </Text>
                      {item.maKhachHang && (
                        <Tag className="ntpc-customer-picker-row-code">{item.maKhachHang}</Tag>
                      )}
                    </div>
                    <Space size={10} wrap className="ntpc-customer-picker-row-meta">
                      {item.soDienThoai && (
                        <span><PhoneOutlined /> {formatPhone(item.soDienThoai)}</span>
                      )}
                      {item.diaChi && (
                        <Tooltip title={item.diaChi}>
                          <span className="ntpc-customer-picker-row-addr">
                            <EnvironmentOutlined /> {item.diaChi}
                          </span>
                        </Tooltip>
                      )}
                    </Space>
                  </div>
                  <div className="ntpc-customer-picker-row-stats">
                    <Tooltip
                      title={
                        <div>
                          <div>Đang xử lý: {item.dangXuLyCount || 0}</div>
                          <div>Đã xong: {item.daTraCount || 0}</div>
                          {item.huyCount > 0 && <div>Đã hủy: {item.huyCount}</div>}
                        </div>
                      }
                    >
                      <div className="ntpc-customer-picker-row-stat">
                        <span className="ntpc-customer-picker-row-stat-num">{item.totalWarranties || 0}</span>
                        <span className="ntpc-customer-picker-row-stat-label">CT</span>
                      </div>
                    </Tooltip>
                    {lastActivity && (
                      <div className="ntpc-customer-picker-row-activity">
                        <ClockCircleOutlined /> {lastActivity}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* PREVIEW PANEL */}
        <div className="ntpc-customer-picker-preview">
          {!selected ? (
            <div className="ntpc-customer-picker-preview-empty">
              <UserOutlined className="ntpc-customer-picker-preview-empty-icon" />
              <Title level={5} type="secondary" style={{ marginTop: 12 }}>
                Chọn khách hàng
              </Title>
              <Text type="secondary" style={{ textAlign: 'center', display: 'block' }}>
                Click vào một khách hàng bên trái để xem chi tiết và xác nhận chuyển.
              </Text>
              <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
                Hoặc double-click để chuyển ngay.
              </Text>
            </div>
          ) : (
            <div className="ntpc-customer-picker-preview-card">
              <Avatar size={72} className="ntpc-customer-picker-preview-avatar">
                {getInitials(selected.khachHang)}
              </Avatar>
              <Title level={4} style={{ marginTop: 12, marginBottom: 4, textAlign: 'center' }}>
                {selected.khachHang}
              </Title>
              {selected.maKhachHang && (
                <Tag className="ntpc-customer-picker-preview-code">{selected.maKhachHang}</Tag>
              )}

              <div className="ntpc-customer-picker-preview-fields">
                {selected.soDienThoai && (
                  <div className="ntpc-customer-picker-preview-field">
                    <PhoneOutlined />
                    <a href={`tel:${selected.soDienThoai}`} onClick={(e) => e.stopPropagation()}>
                      {formatPhone(selected.soDienThoai)}
                    </a>
                  </div>
                )}
                {selected.diaChi && (
                  <div className="ntpc-customer-picker-preview-field">
                    <EnvironmentOutlined />
                    <span>{selected.diaChi}</span>
                  </div>
                )}
                {selected.lastNgayNhan && (
                  <div className="ntpc-customer-picker-preview-field">
                    <ClockCircleOutlined />
                    <span>CT gần nhất: {dayjs(selected.lastNgayNhan).format('DD/MM/YYYY')}</span>
                  </div>
                )}
              </div>

              <div className="ntpc-customer-picker-preview-stats">
                <div className="ntpc-customer-picker-preview-stat">
                  <div className="ntpc-customer-picker-preview-stat-num ntpc-stat--total">{selected.totalWarranties || 0}</div>
                  <div className="ntpc-customer-picker-preview-stat-label">Tổng CT</div>
                </div>
                <div className="ntpc-customer-picker-preview-stat">
                  <div className="ntpc-customer-picker-preview-stat-num ntpc-stat--active">{selected.dangXuLyCount || 0}</div>
                  <div className="ntpc-customer-picker-preview-stat-label">Đang XL</div>
                </div>
                <div className="ntpc-customer-picker-preview-stat">
                  <div className="ntpc-customer-picker-preview-stat-num ntpc-stat--done">{selected.daTraCount || 0}</div>
                  <div className="ntpc-customer-picker-preview-stat-label">Đã xong</div>
                </div>
              </div>

              {currentCustomer?.khachHang && currentCustomer.key !== selected.key && (
                <div className="ntpc-customer-picker-preview-warning">
                  <SwapOutlined />
                  <span>
                    Phiếu sẽ được chuyển từ <b>{currentCustomer.khachHang}</b> → <b>{selected.khachHang}</b>
                  </span>
                </div>
              )}

              <ConfigProvider theme={{ algorithm: confirming ? antdTheme.defaultAlgorithm : antdTheme.defaultAlgorithm }}>
                <Button
                  block
                  type="primary"
                  size="large"
                  icon={<CheckCircleOutlined />}
                  loading={confirming}
                  disabled={confirming}
                  onClick={handleSelect}
                  className="ntpc-customer-picker-preview-cta"
                >
                  {t('customerPicker.confirm', { defaultValue: 'Chuyển cho khách này' })}
                </Button>
              </ConfigProvider>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

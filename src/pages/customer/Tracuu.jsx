import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Alert, Button, Card, Col, Empty, Grid, Input, List, Row, Skeleton, Space, Tag, Typography } from 'antd';
import { Button as MobileButton, Card as MobileCard, Dialog, Empty as MobileEmpty, List as MobileList, Skeleton as MobileSkeleton, Space as MobileSpace, Tag as MobileTag, TabBar, NavBar, SwipeAction, SearchBar, Toast, Collapse, Popup, CapsuleTabs } from 'antd-mobile';
import { useTheme } from '../../hooks/useTheme';
import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  FileSearchOutlined,
  PhoneOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { publicService } from '../../services/warrantyService';
import { getStatusBadgeColor } from '../../constants/badgeConfig';

const { Link } = Typography;
const CT_REGEX = /^\d{8}NTPC\d+$/;
const LS_KEY = 'ntpc-recent-tracks';
const MAX_RECENT = 6;

function formatLookupTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function recentCode(item) {
  return typeof item === 'string' ? item : item?.code;
}

function recentTime(item) {
  return typeof item === 'string' ? '' : formatLookupTime(item?.time);
}
const STATUS_LABELS = {
  da_nhan: 'Đã nhận',
  dang_xu_ly: 'Đang xử lý',
  cho_xu_ly: 'Chờ xử lý',
  cho_lien_he: 'Chờ liên hệ',
  da_tra: 'Đã trả',
  huy: 'Hủy',
};
const STATUS_COLORS = Object.fromEntries(
  Object.keys(STATUS_LABELS).map((key) => [key, getStatusBadgeColor(key)])
);

function normalizeCode(raw) {
  return String(raw || '').toUpperCase().replace(/\s/g, '');
}

function normalizePhone(raw) {
  const text = String(raw ?? '').trim();
  const only = text.replace(/[^\d+]/g, '');
  if (only.startsWith('+84')) return `0${only.slice(3)}`;
  if (only.startsWith('84')) return `0${only.slice(2)}`;
  return only;
}

function isPhoneQuery(raw) {
  const n = normalizePhone(raw).replace(/\D/g, '');
  return /^\d{9,11}$/.test(n);
}

function readRecent() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((item) => recentCode(item)).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function writeRecent(list) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {}
}

export default function Tracuu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const activeTab = queryParams.get('tab') || 'search';
  const screens = Grid.useBreakpoint();
  const isCompact = !screens.lg;
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [recent, setRecent] = useState(() => readRecent());
  const [phoneResults, setPhoneResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === LS_KEY) setRecent(readRecent());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const remember = (soChungTu) => {
    const next = [
      { code: soChungTu, time: new Date().toISOString() },
      ...recent.filter((x) => recentCode(x) !== soChungTu),
    ].slice(0, MAX_RECENT);
    setRecent(next);
    writeRecent(next);
  };

  const clearRecent = () => {
    setRecent([]);
    writeRecent([]);
  };

  const submit = async (value = code) => {
    const raw = String(value || '').trim();
    const soChungTu = normalizeCode(raw);
    setError('');
    setPhoneResults(null);
    setFilterStatus('all');

    if (!raw) {
      setError('Vui lòng nhập mã phiếu hoặc số điện thoại.');
      return;
    }

    if (CT_REGEX.test(soChungTu)) {
      remember(soChungTu);
      navigate(`/tra-cuu/${soChungTu}`);
      return;
    }

    if (!isPhoneQuery(raw)) {
      setError('Mã phiếu hoặc số điện thoại không hợp lệ.');
      return;
    }

    setSearching(true);
    try {
      const phone = normalizePhone(raw);
      const res = await publicService.search(phone);
      if (res.data?.success && res.data?.mode === 'phone') {
        const rows = Array.isArray(res.data?.data?.items) ? res.data.data.items : [];
        setPhoneResults({ phone: res.data?.data?.phone || phone, total: rows.length, items: rows });
        if (!rows.length) setError('Không tìm thấy phiếu theo số điện thoại này.');
      } else {
        setError(res.data?.message || 'Không tìm thấy dữ liệu.');
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tra cứu lúc này.');
    } finally {
      setSearching(false);
    }
  };

  const getFilteredItems = () => {
    const items = phoneResults?.items || [];
    if (filterStatus === 'all') return items;
    if (filterStatus === 'pending') {
      return items.filter(item => !['da_tra', 'da_tra_hang', 'da_sua_xong', 'huy', 'da_huy'].includes(item.trangThai));
    }
    if (filterStatus === 'completed') {
      return items.filter(item => ['da_tra', 'da_tra_hang', 'da_sua_xong'].includes(item.trangThai));
    }
    return items;
  };

  const renderMobileResults = () => {
    if (searching) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {[1, 2].map((i) => (
            <MobileCard key={i} className="ntpc-mobile-card ntpc-glass-card" style={{ padding: '16px 16px 12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <MobileSkeleton animated style={{ '--width': '110px', '--height': '18px', '--border-radius': '4px' }} />
                <MobileSkeleton animated style={{ '--width': '76px', '--height': '18px', '--border-radius': '999px' }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <MobileSkeleton animated style={{ '--width': '85%', '--height': '16px', '--border-radius': '4px' }} />
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <MobileSkeleton animated style={{ '--width': '100px', '--height': '13px', '--border-radius': '4px' }} />
                <MobileSkeleton animated style={{ '--width': '100px', '--height': '13px', '--border-radius': '4px' }} />
              </div>
            </MobileCard>
          ))}
        </div>
      );
    }
    if (!phoneResults) return null;
    const filtered = getFilteredItems();
    return (
      <MobileCard title={`Kết quả theo SĐT ${phoneResults.phone} (${phoneResults.total})`} className="ntpc-mobile-card ntpc-glass-card" style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 12, marginTop: -4 }}>
          <CapsuleTabs activeKey={filterStatus} onChange={setFilterStatus} style={{ '--capsule-border-radius': '8px' }}>
            <CapsuleTabs.Tab title={`Tất cả (${phoneResults.items?.length || 0})`} key="all" />
            <CapsuleTabs.Tab title={`Chờ xử lý (${phoneResults.items?.filter(x => !['da_tra', 'da_tra_hang', 'da_sua_xong', 'huy', 'da_huy'].includes(x.trangThai)).length || 0})`} key="pending" />
            <CapsuleTabs.Tab title={`Đã xong (${phoneResults.items?.filter(x => ['da_tra', 'da_tra_hang', 'da_sua_xong'].includes(x.trangThai)).length || 0})`} key="completed" />
          </CapsuleTabs>
        </div>
        {filtered.length ? (
          <MobileList>
            {filtered.map((item) => (
              <MobileList.Item
                key={item.id || item.soChungTu}
                onClick={() => navigate(`/tra-cuu/${item.soChungTu}`)}
                description={(
                  <div className="tracuu-result-meta">
                    <div className="tracuu-result-product" style={{ fontSize: 13, fontWeight: 500 }}>{item.tenHang || '-'}</div>
                    <div className="tracuu-result-dates" style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                      <span style={{ marginRight: 12 }}><CalendarOutlined /> Nhận: {item.ngayNhan || '-'}</span>
                      <span><CalendarOutlined /> Hẹn trả: {item.ngayHenTra || '-'}</span>
                    </div>
                  </div>
                )}
              >
                <MobileSpace wrap align="center">
                  <span className="admin-mobile-code" style={{ fontWeight: 800 }}>{item.soChungTu}</span>
                  <MobileTag color={getStatusBadgeColor(item.trangThai, 'mobile')}>{STATUS_LABELS[item.trangThai] || item.trangThai || '-'}</MobileTag>
                </MobileSpace>
              </MobileList.Item>
            ))}
          </MobileList>
        ) : (
          <MobileEmpty description="Không có phiếu nào ở mục này." />
        )}
      </MobileCard>
    );
  };

  return (
    <>
    <main className="mobile-only ntpc-mobile-page">
      <section className="ntpc-mobile-hero ntpc-glass-card">
        <h1>{t('tracking.title')}</h1>
        <p>{t('tracking.description')}</p>
      </section>

      <MobileCard className="ntpc-mobile-card ntpc-glass-card" style={{ marginBottom: 12 }}>
        <MobileSpace direction="vertical" block style={{ '--gap': '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 800, fontSize: 16, color: isDark ? '#fff' : '#26361f' }}>{t('tracking.newSearch')}</span>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Vui lòng nhập mã chứng từ hoặc số điện thoại của bạn.</span>
          </div>
          
          <div className="ntpc-searchbar-container" style={{ padding: '2px 4px', borderRadius: 12 }}>
            <SearchBar
              placeholder={t('tracking.placeholder')}
              value={code}
              onChange={(value) => {
                setCode(value);
                if (error) setError('');
              }}
              onSearch={submit}
              clearable
            />
          </div>

          <MobileButton block color="primary" loading={searching} onClick={() => submit(code)} style={{ borderRadius: 10 }}>
            {t('tracking.newSearch')}
          </MobileButton>
          {error ? <div className="ntpc-mobile-error" style={{ borderRadius: 10 }}>{error}</div> : null}
        </MobileSpace>
      </MobileCard>

      {renderMobileResults()}

      {recent.length > 0 && (
        <MobileCard title={t('tracking.historyTitle')} className="ntpc-mobile-card ntpc-glass-card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {recent.map((item, index) => {
              const codeValue = recentCode(item);
              const timeValue = recentTime(item);
              return (
                <div className="ntpc-history-swipe-item" key={codeValue}>
                  <SwipeAction
                    rightActions={[
                      {
                        key: 'delete',
                        text: 'Xóa',
                        color: 'danger',
                        onClick: () => {
                          const next = recent.filter((x) => recentCode(x) !== codeValue);
                          setRecent(next);
                          writeRecent(next);
                          Toast.show({ content: 'Đã xóa khỏi lịch sử' });
                        }
                      }
                    ]}
                  >
                    <MobileList.Item
                      onClick={() => submit(codeValue)}
                      description={timeValue || (index === 0 ? t('tracking.latest') : t('tracking.searched'))}
                      arrow={<RightOutlined style={{ fontSize: 12, opacity: 0.5 }} />}
                    >
                      <span style={{ fontWeight: 700, color: isDark ? '#fff' : '#1f2a1d' }}>{codeValue}</span>
                    </MobileList.Item>
                  </SwipeAction>
                </div>
              );
            })}
          </div>
          <MobileButton
            block
            size="small"
            onClick={() => Dialog.confirm({
              content: 'Xóa toàn bộ lịch sử tra cứu?',
              confirmText: 'Xóa',
              cancelText: 'Hủy',
              onConfirm: clearRecent
            })}
            style={{ borderRadius: 10 }}
          >
            {t('tracking.clearHistory')}
          </MobileButton>
        </MobileCard>
      )}

      <MobileCard title="📞 Hỗ trợ kỹ thuật & Bản đồ" className="ntpc-mobile-card ntpc-glass-card" style={{ marginBottom: 12 }}>
        <div className="ntpc-mobile-contact-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <a className="ntpc-mobile-contact-btn" href="tel:0937632000" style={{ borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: isDark ? 'rgba(255,255,255,0.04)' : '#f5f7f4', border: '1px solid rgba(0,0,0,0.05)', textDecoration: 'none' }}>
            <span style={{ fontSize: 11, opacity: 0.7, color: isDark ? '#bbb' : '#666' }}>Gọi kỹ thuật</span>
            <b style={{ fontSize: 13, color: '#1677ff', marginTop: 2 }}>0937 63 2000</b>
          </a>
          <a className="ntpc-mobile-contact-btn" href="tel:0903602240" style={{ borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: isDark ? 'rgba(255,255,255,0.04)' : '#f5f7f4', border: '1px solid rgba(0,0,0,0.05)', textDecoration: 'none' }}>
            <span style={{ fontSize: 11, opacity: 0.7, color: isDark ? '#bbb' : '#666' }}>Gọi hotline</span>
            <b style={{ fontSize: 13, color: '#1677ff', marginTop: 2 }}>0903 602 240</b>
          </a>
        </div>
        <a className="ntpc-mobile-contact-map" href="https://maps.app.goo.gl/Nx6WgejPbu1YJGWR7" target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', padding: '10px', background: '#1677ff', color: '#fff', borderRadius: 10, fontWeight: 700, textDecoration: 'none', marginBottom: 12, fontSize: 13 }}>
          🗺️ Chỉ đường (Google Maps)
        </a>
        <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.4, color: isDark ? '#ccc' : '#444' }}>
          <b>Địa chỉ bảo hành:</b> {t('tracking.address')}
        </div>
      </MobileCard>

      <MobileCard title="🛡️ Điều kiện & Chính sách" className="ntpc-mobile-card ntpc-glass-card" style={{ marginBottom: 24 }}>
        <MobileSpace direction="vertical" block style={{ '--gap': '12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <CheckCircleOutlined style={{ color: '#52c41a', marginTop: 3 }} />
            <span style={{ fontSize: 13, lineHeight: 1.4, color: isDark ? '#ddd' : '#333' }}>{t('tracking.deliveryNote')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <CheckCircleOutlined style={{ color: '#52c41a', marginTop: 3 }} />
            <span style={{ fontSize: 13, lineHeight: 1.4, color: isDark ? '#ddd' : '#333' }}>{t('tracking.storageNote')}</span>
          </div>
          <a href="https://nguyentanpc.com/pages/dieu-kien-bao-hanh" target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block', width: '100%', marginTop: 8 }}>
            <MobileButton block color="primary" fill="outline" style={{ borderRadius: 10, fontSize: 13, pointerEvents: 'none' }}>
              Xem toàn bộ chính sách
            </MobileButton>
          </a>
        </MobileSpace>
      </MobileCard>

      <div style={{ textAlign: 'center', paddingBottom: 24, paddingTop: 4 }}>
        <button
          onClick={() => navigate('/admin')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            color: isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.32)',
            padding: '4px 8px',
            letterSpacing: 0.1,
          }}
        >
          Bạn là nhân viên? <span style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)', fontWeight: 600 }}>Đăng nhập →</span>
        </button>
      </div>
    </main>

    <main className="desktop-only tracuu-old-page">
      <section className="tracuu-old-hero">
        <div>
          <Typography.Title level={1}>{t('tracking.title')}</Typography.Title>
          <Typography.Paragraph>{t('tracking.description')}</Typography.Paragraph>
        </div>
      </section>

      <Row gutter={[24, 24]} align="stretch" className="tracuu-old-layout">
        <Col xs={24} lg={16} xl={17}>
          <Card className="tracuu-old-search-card" variant="borderless">
            <Space direction="vertical" size={18} className="tracuu-old-search-stack">
              <div>
                <Typography.Title level={3}>{t('tracking.newSearch')}</Typography.Title>
              </div>

              <Input.Search
                size="large"
                value={code}
                loading={searching}
                allowClear
                enterButton={t('tracking.newSearch')}
                prefix={<SearchOutlined />}
                placeholder={t('tracking.placeholder')}
                onChange={(event) => {
                  setCode(event.target.value);
                  if (error) setError('');
                }}
                onSearch={submit}
              />

              {searching ? (
                <Card size="small" className="tracuu-old-card">
                  <Skeleton active avatar paragraph={{ rows: isCompact ? 4 : 3 }} />
                </Card>
              ) : null}

              {error ? <Alert message={error} type="error" showIcon /> : null}

              <Row gutter={[12, 12]}>
                <Col xs={24} md={8}><div className="tracuu-old-guide-item"><FileSearchOutlined /><b>Nhập mã phiếu</b><span>Ví dụ: 20250101NTPC123.</span></div></Col>
                <Col xs={24} md={8}><div className="tracuu-old-guide-item"><PhoneOutlined /><b>Hoặc nhập SĐT</b><span>Xem tất cả phiếu liên quan.</span></div></Col>
                <Col xs={24} md={8}><div className="tracuu-old-guide-item"><SafetyCertificateOutlined /><b>Theo dõi bảo hành</b><span>Cập nhật trạng thái xử lý.</span></div></Col>
              </Row>
            </Space>
          </Card>

          {phoneResults ? (
            <Card className="tracuu-old-card" variant="borderless" title={`Kết quả theo SĐT ${phoneResults.phone} (${phoneResults.total})`}>
              <List
                locale={{ emptyText: <Empty description="Không có phiếu liên quan SĐT này." /> }}
                dataSource={phoneResults.items || []}
                renderItem={(item) => (
                  <List.Item className="tracuu-old-result-item" onClick={() => navigate(`/tra-cuu/${item.soChungTu}`)}>
                    <List.Item.Meta
                      title={<Space><b>{item.soChungTu}</b><Tag color={STATUS_COLORS[item.trangThai] || 'default'}>{STATUS_LABELS[item.trangThai] || item.trangThai || '-'}</Tag></Space>}
                      description={(
                        <div className="tracuu-result-meta">
                          <div className="tracuu-result-product">{item.tenHang || '-'}</div>
                          <div className="tracuu-result-dates">
                            <span><CalendarOutlined /> Nhận: {item.ngayNhan || '-'}</span>
                            <span><CalendarOutlined /> Hẹn trả: {item.ngayHenTra || '-'}</span>
                          </div>
                        </div>
                      )}
                    />
                    <RightOutlined className="tracuu-result-chevron" />
                  </List.Item>
                )}
              />
            </Card>
          ) : null}
        </Col>

        <Col xs={24} lg={8} xl={7}>
          <Card className="tracuu-old-card tracuu-old-history-card" variant="borderless" title={<Space><ClockCircleOutlined />{t('tracking.historyTitle')}</Space>} extra={<Button type="text" size="small" icon={<DeleteOutlined />} disabled={!recent.length} onClick={clearRecent}>{t('tracking.clearHistory')}</Button>}>
            {recent.length ? (
              <List dataSource={recent} renderItem={(item, index) => {
                const codeValue = recentCode(item);
                const timeValue = recentTime(item);
                return (
                  <List.Item className="tracuu-old-history-item" onClick={() => submit(codeValue)}>
                    <List.Item.Meta avatar={<FileSearchOutlined />} title={codeValue} description={timeValue || (index === 0 ? t('tracking.latest') : t('tracking.searched'))} />
                  </List.Item>
                );
              }} />
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('tracking.emptyHistory')} />}
          </Card>

          <Card className="tracuu-old-card tracuu-old-contact-card" variant="borderless" title={<Space><PhoneOutlined />{t('tracking.contactTitle')}</Space>}>
            <div className="tracuu-old-contact-list">
              <a className="tracuu-old-contact-action" href="tel:0937632000">
                <span className="tracuu-old-contact-icon"><PhoneOutlined /></span>
                <span>
                  <small>{t('tracking.technical')}</small>
                  <b>0937 63 2000</b>
                </span>
              </a>
              <a className="tracuu-old-contact-action" href="tel:0903602240">
                <span className="tracuu-old-contact-icon"><PhoneOutlined /></span>
                <span>
                  <small>Hotline</small>
                  <b>0903 602 240</b>
                </span>
              </a>
              <a className="tracuu-old-contact-action tracuu-old-contact-map" href="https://maps.app.goo.gl/Nx6WgejPbu1YJGWR7" target="_blank" rel="noreferrer">
                <span className="tracuu-old-contact-icon"><EnvironmentOutlined /></span>
                <span>
                  <small>Địa chỉ bảo hành</small>
                  <b>{t('tracking.address')}</b>
                </span>
              </a>
            </div>
          </Card>

          <Card className="tracuu-old-card tracuu-old-policy-card" variant="borderless" title={<Space><SafetyCertificateOutlined />{t('tracking.policyTitle')}</Space>}>
            <div className="tracuu-old-policy-list">
              <div className="tracuu-old-policy-item"><CheckCircleOutlined /><span>{t('tracking.deliveryNote')}</span></div>
              <div className="tracuu-old-policy-item"><CheckCircleOutlined /><span>{t('tracking.storageNote')}</span></div>
            </div>
            <Link className="tracuu-old-policy-link" href="https://nguyentanpc.com/pages/dieu-kien-bao-hanh" target="_blank">{t('tracking.fullPolicy')}</Link>
          </Card>
        </Col>
      </Row>
    </main>
    </>
  );
}

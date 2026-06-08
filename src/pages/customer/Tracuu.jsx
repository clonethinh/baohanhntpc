import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Alert, Button, Card, Col, Empty, Grid, Input, List, Row, Skeleton, Space, Tag, Typography } from 'antd';
import { Button as MobileButton, Card as MobileCard, Dialog, Empty as MobileEmpty, List as MobileList, Skeleton as MobileSkeleton, Space as MobileSpace, Tag as MobileTag, TabBar, NavBar, SwipeAction, SearchBar, Toast, Popup, CapsuleTabs } from 'antd-mobile';
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
function statusLabel(t, status) {
  const key = normalizeStatusKey(status);
  return t(`statusLabel.${key}`, { defaultValue: String(status || '').replace(/_/g, ' ') });
}

function normalizeStatusKey(status) {
  const key = String(status || '').trim();
  if (key === 'da_tra_hang' || key === 'da_sua_xong' || key === 'da_tra') return 'da_tra';
  if (key === 'da_huy' || key === 'huy') return 'huy';
  if (key === 'tiep_nhan' || key === 'da_nhan' || key === 'cho_xu_ly') return 'da_nhan';
  if (key === 'cho_linh_kien' || key === 'dang_xu_ly' || key === 'cho_lien_he') return 'dang_xu_ly';
  return key;
}

function statusColor(status, target = 'desktop') {
  return getStatusBadgeColor(normalizeStatusKey(status), target);
}

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
  useTheme();
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
  const phonePageSize = 5;

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
      setError(t('tracuu.nhapMaHoacSdt'));
      return;
    }

    if (CT_REGEX.test(soChungTu)) {
      remember(soChungTu);
      navigate(`/tra-cuu/${soChungTu}`);
      return;
    }

    if (!isPhoneQuery(raw)) {
      setError(t('tracuu.maHoacSdtKhongHopLe'));
      return;
    }

    setSearching(true);
    try {
      const phone = normalizePhone(raw);
      const res = await publicService.search(phone);
      if (res.data?.success && res.data?.mode === 'phone') {
        const rows = Array.isArray(res.data?.data?.items) ? res.data.data.items : [];
        setPhoneResults({ phone: res.data?.data?.phone || phone, total: rows.length, items: rows });
        if (!rows.length) setError(t('tracuu.khongTimThayTheoSdt'));
      } else {
        setError(res.data?.message || t('tracuu.khongTimThayDuLieu'));
      }
    } catch (err) {
      setError(err?.response?.data?.message || t('tracuu.khongTheTraCuu'));
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

  const filteredPhoneItems = getFilteredItems();
  const [phonePage, setPhonePage] = useState(1);
  const phoneTotalPages = Math.max(1, Math.ceil(filteredPhoneItems.length / phonePageSize));
  const visiblePhoneItems = filteredPhoneItems.slice((phonePage - 1) * phonePageSize, phonePage * phonePageSize);

  useEffect(() => {
    setPhonePage(1);
  }, [phoneResults, filterStatus]);

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
    return (
      <MobileCard title={t('tracuu.chungTuTheoSdt', { phone: phoneResults.phone, total: phoneResults.total })} className="ntpc-mobile-card ntpc-glass-card tracuu-mobile-phone-card" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12, marginTop: -2 }}>
          <CapsuleTabs activeKey={filterStatus} onChange={setFilterStatus} style={{ '--capsule-border-radius': '8px' }}>
            <CapsuleTabs.Tab title={t('tracuu.tatCa', { count: phoneResults.items?.length || 0 })} key="all" />
            <CapsuleTabs.Tab title={t('tracuu.choXuLyTab', { count: phoneResults.items?.filter(x => !['da_tra', 'da_tra_hang', 'da_sua_xong', 'huy', 'da_huy'].includes(x.trangThai)).length || 0 })} key="pending" />
            <CapsuleTabs.Tab title={t('tracuu.daXongTab', { count: phoneResults.items?.filter(x => ['da_tra', 'da_tra_hang', 'da_sua_xong'].includes(x.trangThai)).length || 0 })} key="completed" />
          </CapsuleTabs>
        </div>
        {visiblePhoneItems.length ? (
          <>
            <div className="tracuu-mobile-related-list">
              {visiblePhoneItems.map((item, i) => (
                <button
                  key={`${item.id || item.soChungTu}-${i}`}
                  type="button"
                  className="tracuu-mobile-related-card"
                  onClick={() => navigate(`/tra-cuu/${item.soChungTu}`)}
                >
                  <div className="tracuu-mobile-related-top">
                    <span className="tracuu-mobile-related-code">{item.soChungTu}</span>
                    <MobileTag color={statusColor(item.trangThai, 'mobile')}>
                      {statusLabel(t, item.trangThai) || '-'}
                    </MobileTag>
                  </div>
                  <div className="tracuu-mobile-related-product">{item.tenHang || '-'}</div>
                  <div className="tracuu-mobile-related-meta">
                    <span><CalendarOutlined /> Nhận: {item.ngayNhan || '-'}</span>
                    <span><CalendarOutlined /> Hẹn trả: {item.ngayHenTra || '-'}</span>
                  </div>
                </button>
              ))}
            </div>
            {filteredPhoneItems.length > phonePageSize && (
              <div className="tracuu-mobile-related-pagination">
                <button
                  type="button"
                  className="tracuu-mobile-related-page-button"
                  disabled={phonePage <= 1}
                  onClick={() => setPhonePage((p) => Math.max(1, p - 1))}
                >
                  Trước
                </button>
                <span className="tracuu-mobile-related-page-info">Trang {phonePage} / {phoneTotalPages}</span>
                <button
                  type="button"
                  className="tracuu-mobile-related-page-button"
                  disabled={phonePage >= phoneTotalPages}
                  onClick={() => setPhonePage((p) => Math.min(phoneTotalPages, p + 1))}
                >
                  Sau
                </button>
              </div>
            )}
          </>
        ) : (
          <MobileEmpty description={t('tracuu.khongCoPhieuMucNay')} />
        )}
      </MobileCard>
    );
  };

  return (
    <>
    <main className="mobile-only ntpc-mobile-page tracuu-mobile-v2">
      <section className="ntpc-mobile-hero ntpc-glass-card tracuu-mobile-hero-v2">
        <div className="ntpc-mobile-eyebrow">{t('tracuu.trungTamBaoHanh', { defaultValue: 'Trung tâm bảo hành' })}</div>
        <h1>{t('tracking.title')}</h1>
        <p>{t('tracuu.heroSubtitle', { defaultValue: 'Nhập mã phiếu hoặc số điện thoại để xem tiến trình xử lý.' })}</p>
      </section>

      <MobileCard className="ntpc-mobile-card ntpc-glass-card tracuu-mobile-search-card" style={{ marginBottom: 12 }}>
        <div className="tracuu-mobile-search-stack">
          <div className="tracuu-mobile-search-title">
            <span>Tra cứu phiếu bảo hành</span>
            <small>Hỗ trợ tra cứu theo mã phiếu hoặc số điện thoại.</small>
          </div>

          <div className="ntpc-searchbar-container tracuu-mobile-searchbar">
            <SearchBar
              placeholder={t('tracuu.nhapMaPhieuHoacSdt')}
              value={code}
              onChange={(value) => {
                setCode(value);
                if (error) setError('');
              }}
              onSearch={submit}
              clearable
            />
          </div>

          <MobileButton block color="primary" loading={searching} onClick={() => submit(code)} className="tracuu-mobile-primary-btn">
            Tra cứu ngay
          </MobileButton>
          <div className="tracuu-mobile-input-hint">VD: 20250101NTPC123 hoặc 0903xxxxxx</div>
          {error ? <div className="ntpc-mobile-error tracuu-mobile-error">{error}</div> : null}
        </div>
      </MobileCard>

      {renderMobileResults()}

      {recent.length > 0 && (
        <MobileCard title={t('tracuu.traCuuGanDay')} className="ntpc-mobile-card ntpc-glass-card tracuu-mobile-recent-card" style={{ marginBottom: 12 }}>
          <div className="tracuu-mobile-recent-list">
            {recent.map((item, index) => {
              const codeValue = recentCode(item);
              const timeValue = recentTime(item);
              return (
                <SwipeAction
                  key={codeValue}
                  rightActions={[
                    {
                      key: 'delete',
                      text: t('button.xoa'),
                      color: 'danger',
                      onClick: () => {
                        const next = recent.filter((x) => recentCode(x) !== codeValue);
                        setRecent(next);
                        writeRecent(next);
                        Toast.show({ content: t('tracuu.daXoaKhoiLichSu') });
                      }
                    }
                  ]}
                >
                  <button type="button" className="tracuu-mobile-recent-chip" onClick={() => submit(codeValue)}>
                    <div className="tracuu-mobile-recent-copy">
                      <span>{codeValue}</span>
                      <small>{timeValue || (index === 0 ? t('tracking.latest') : t('tracking.searched'))}</small>
                    </div>
                    <RightOutlined className="tracuu-mobile-recent-arrow" />
                  </button>
                </SwipeAction>
              );
            })}
          </div>
          <MobileButton
            block
            size="small"
            fill="outline"
            onClick={() => Dialog.confirm({
              content: t('tracuu.xoaToanBoLichSu'),
              confirmText: t('button.xoa'),
              cancelText: t('button.huy'),
              onConfirm: clearRecent
            })}
            className="tracuu-mobile-clear-btn"
          >
            Xóa lịch sử
          </MobileButton>
        </MobileCard>
      )}

      <MobileCard title={t('tracuu.hoTroNhanh')} className="ntpc-mobile-card ntpc-glass-card tracuu-mobile-support-card" style={{ marginBottom: 12 }}>
        <div className="tracuu-mobile-support-stack">
          <a className="tracuu-mobile-support-row tracuu-mobile-support-row-primary" href="tel:0937632000">
            <div>
              <span>Bảo hành - kỹ thuật</span>
              <b>0937 63 2000</b>
            </div>
            <RightOutlined />
          </a>
          <a className="tracuu-mobile-support-row" href="tel:0903602240">
            <div>
              <span>Hotline</span>
              <b>0903 602 240</b>
            </div>
            <RightOutlined />
          </a>
          <a className="tracuu-mobile-support-row" href="https://maps.app.goo.gl/Nx6WgejPbu1YJGWR7" target="_blank" rel="noreferrer">
            <div>
              <span>Địa chỉ bảo hành</span>
              <b>Xem đường đi trên Google Maps</b>
            </div>
            <RightOutlined />
          </a>
        </div>
        <div className="tracuu-mobile-support-footer">
          <span>🏢 {t('tracking.address')}</span>
        </div>
      </MobileCard>

      <MobileCard className="ntpc-mobile-card ntpc-glass-card tracuu-mobile-policy-card" style={{ marginBottom: 24 }}>
        <div className="tracuu-mobile-policy-header">Điều kiện & lưu ý bảo hành</div>
        <div className="tracuu-mobile-policy-list">
          <div>
            <CheckCircleOutlined />
            <span>{t('tracking.deliveryNote')}</span>
          </div>
          <div>
            <CheckCircleOutlined />
            <span>{t('tracking.storageNote')}</span>
          </div>
          <a href="https://nguyentanpc.com/pages/dieu-kien-bao-hanh" target="_blank" rel="noreferrer">
            Xem chính sách đầy đủ
          </a>
        </div>
      </MobileCard>
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
            <Card className="tracuu-old-card" variant="borderless" title={t('tracuu.ketQuaTheoSdt', { phone: phoneResults.phone, total: phoneResults.total })}>
              <List
                locale={{ emptyText: <Empty description={t('tracuu.khongCoPhieuLienQuanSdt')} /> }}
                dataSource={phoneResults.items || []}
                renderItem={(item) => (
                  <List.Item className="tracuu-old-result-item" onClick={() => navigate(`/tra-cuu/${item.soChungTu}`)}>
                    <List.Item.Meta
                      title={<Space><b>{item.soChungTu}</b><Tag color={statusColor(item.trangThai)}>{statusLabel(t, item.trangThai) || '-'}</Tag></Space>}
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

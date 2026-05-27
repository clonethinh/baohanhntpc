import { useEffect, useState } from 'react';

const ZALO_WEB_URL = 'https://zalo.me/0937632000';
const ZALO_APP_URL = 'zalo://chat?phone=0937632000';

function openZaloApp(event) {
  event?.preventDefault?.();
  const ua = navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  if (!isMobile) {
    window.open(ZALO_WEB_URL, '_blank', 'noopener,noreferrer');
    return;
  }
  window.location.href = ZALO_APP_URL;
  setTimeout(() => {
    window.location.href = ZALO_WEB_URL;
  }, 800);
}
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Col, Empty, Grid, Input, List, Row, Skeleton, Space, Tag, Typography } from 'antd';
import { Button as MobileButton, Card as MobileCard, Dialog, Empty as MobileEmpty, Input as MobileInput, List as MobileList, Skeleton as MobileSkeleton, Space as MobileSpace, Tag as MobileTag } from 'antd-mobile';
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
  const screens = Grid.useBreakpoint();
  const isCompact = !screens.lg;
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [recent, setRecent] = useState(() => readRecent());
  const [phoneResults, setPhoneResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [showZaloBubble, setShowZaloBubble] = useState(true);

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

  const renderMobileResults = () => {
    if (searching) {
      return <MobileCard className="ntpc-mobile-card"><MobileSkeleton.Title animated /><MobileSkeleton.Paragraph lineCount={4} animated /></MobileCard>;
    }
    if (!phoneResults) return null;
    return (
      <MobileCard title={`Kết quả theo SĐT ${phoneResults.phone} (${phoneResults.total})`} className="ntpc-mobile-card">
        {(phoneResults.items || []).length ? (
          <MobileList>
            {(phoneResults.items || []).map((item) => (
              <MobileList.Item
                key={item.id || item.soChungTu}
                onClick={() => navigate(`/tra-cuu/${item.soChungTu}`)}
                description={(
                  <div className="tracuu-result-meta">
                    <div className="tracuu-result-product">{item.tenHang || '-'}</div>
                    <div className="tracuu-result-dates">
                      <span><CalendarOutlined /> Nhận: {item.ngayNhan || '-'}</span>
                      <span><CalendarOutlined /> Hẹn trả: {item.ngayHenTra || '-'}</span>
                    </div>
                  </div>
                )}
              >
                <MobileSpace wrap>
                  <span className="admin-mobile-code">{item.soChungTu}</span>
                  <MobileTag color={getStatusBadgeColor(item.trangThai, 'mobile')}>{STATUS_LABELS[item.trangThai] || item.trangThai || '-'}</MobileTag>
                </MobileSpace>
              </MobileList.Item>
            ))}
          </MobileList>
        ) : <MobileEmpty description="Không có phiếu liên quan SĐT này." />}
      </MobileCard>
    );
  };

  return (
    <>
    <main className="mobile-only ntpc-mobile-page">
      <section className="ntpc-mobile-hero">
        <h1>{t('tracking.title')}</h1>
        <p>{t('tracking.description')}</p>
      </section>

      <MobileCard title={t('tracking.newSearch')} className="ntpc-mobile-card">
        <MobileSpace direction="vertical" block style={{ '--gap': '12px' }}>
          <MobileInput
            clearable
            value={code}
            placeholder={t('tracking.placeholder')}
            onChange={(value) => {
              setCode(value);
              if (error) setError('');
            }}
            onEnterPress={() => submit(code)}
          />
          <MobileButton block color="primary" loading={searching} onClick={() => submit(code)}>{t('tracking.newSearch')}</MobileButton>
          {error ? <div style={{ color: '#ff4d4f', fontSize: 13 }}>{error}</div> : null}
        </MobileSpace>
      </MobileCard>

      {renderMobileResults()}

      <MobileCard title={t('tracking.historyTitle')} className="ntpc-mobile-card">
        {recent.length ? (
          <MobileList>
            {recent.map((item, index) => {
              const codeValue = recentCode(item);
              const timeValue = recentTime(item);
              return (
                <MobileList.Item key={codeValue} onClick={() => submit(codeValue)} description={timeValue || (index === 0 ? t('tracking.latest') : t('tracking.searched'))}>
                  {codeValue}
                </MobileList.Item>
              );
            })}
          </MobileList>
        ) : <MobileEmpty description={t('tracking.emptyHistory')} />}
        <MobileButton block size="small" disabled={!recent.length} onClick={() => Dialog.confirm({ content: 'Xóa lịch sử tra cứu?', confirmText: 'Xóa', cancelText: 'Hủy', onConfirm: clearRecent })}>{t('tracking.clearHistory')}</MobileButton>
      </MobileCard>

      <MobileCard title={t('tracking.contactTitle')} className="ntpc-mobile-card ntpc-mobile-contact">
        <div className="ntpc-mobile-contact-actions">
          <a className="ntpc-mobile-contact-btn" href="tel:0937632000" aria-label="Gọi kỹ thuật 0937 63 2000">
            <span className="ntpc-mobile-contact-label">Gọi kỹ thuật</span>
            <b>0937 63 2000</b>
          </a>
          <a className="ntpc-mobile-contact-btn" href="tel:0903602240" aria-label="Gọi hotline 0903 602 240">
            <span className="ntpc-mobile-contact-label">Gọi hotline</span>
            <b>0903 602 240</b>
          </a>
        </div>

        <a className="ntpc-mobile-contact-map" href="https://maps.app.goo.gl/Nx6WgejPbu1YJGWR7" target="_blank" rel="noreferrer">
          Chỉ đường (Google Maps)
        </a>

        <div className="ntpc-mobile-contact-address">{t('tracking.address')}</div>
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
    <style>{`@keyframes zalo-bounce{0%,20%,50%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}60%{transform:translateY(-3px)}}`}</style>
    {showZaloBubble && (
      <a
        href={ZALO_WEB_URL}
        onClick={openZaloApp}
        style={{
          position: 'fixed',
          right: 80,
          bottom: 20,
          background: '#fff',
          borderRadius: 12,
          padding: '10px 14px 10px 12px',
          boxShadow: '0 8px 30px rgba(0,104,255,0.15)',
          border: '1px solid #d9d9d9',
          zIndex: 1199,
          maxWidth: 240,
          cursor: 'pointer',
          textDecoration: 'none',
          animation: 'zalo-bounce 2s infinite',
          display: 'block',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: -6,
            bottom: 16,
            width: 10,
            height: 10,
            background: '#fff',
            transform: 'rotate(45deg)',
            borderRight: '1px solid #d9d9d9',
            borderTop: '1px solid #d9d9d9',
          }}
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setShowZaloBubble(false);
          }}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            border: 'none',
            background: 'none',
            fontSize: 10,
            color: '#bfbfbf',
            cursor: 'pointer',
            padding: 2,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
        <div style={{ fontSize: 13, color: '#262626', fontWeight: 500, lineHeight: 1.4 }}>
          Bạn cần trợ giúp?
        </div>
        <div style={{ fontSize: 12, color: '#0068ff', fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
          Chat ngay <RightOutlined style={{ fontSize: 10 }} />
        </div>
      </a>
    )}
    <a
      href={ZALO_WEB_URL}
      onClick={openZaloApp}
      aria-label="Chat Zalo 0937 63 2000"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: '#fff',
        color: '#0068ff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        textDecoration: 'none',
        boxShadow: '0 10px 24px rgba(0,104,255,0.32)',
        border: '2px solid #0068ff',
        zIndex: 1200,
        animation: 'zalo-bounce 2s infinite',
      }}
    >
      <img
        src="/zalo.png"
        alt="Zalo"
        width="34"
        height="34"
        style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }}
      />
    </a>
    </>
  );
}

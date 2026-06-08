import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Input, Typography, Alert, Tag, Space, Divider } from 'antd';
import {
  Button as MobileButton,
  Card as MobileCard,
  Divider as MobileDivider,
  List,
  NoticeBar,
  ProgressBar,
  SafeArea,
  SearchBar,
  Selector,
  Space as MobileSpace,
  Tag as MobileTag,
} from 'antd-mobile';
import { PhoneOutlined, EnvironmentOutlined, SafetyCertificateOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import { publicService } from '../../services/warrantyService';
import { getStatusBadgeColor } from '../../constants/badgeConfig';

const { Title, Text, Link } = Typography;

const STATUS_LABELS = {
  tiep_nhan: 'Tiếp nhận',
  dang_xu_ly: 'Đang xử lý',
  cho_linh_kien: 'Chờ linh kiện',
  da_sua_xong: 'Đã sửa xong',
  da_tra_hang: 'Đã trả hàng',
  da_huy: 'Đã hủy',
};

function formatStatus(t, status) {
  const key = String(status || '').trim();
  return t(`statusLabel.${key}`, { defaultValue: key.replace(/_/g, ' ') });
}

function normalizeStatusKey(status) {
  const key = String(status || '').trim();
  if (key === 'da_tra_hang' || key === 'da_sua_xong') return 'da_tra';
  if (key === 'da_huy') return 'huy';
  if (key === 'tiep_nhan') return 'da_nhan';
  if (key === 'cho_linh_kien') return 'dang_xu_ly';
  return key;
}

function statusColor(status) {
  return getStatusBadgeColor(normalizeStatusKey(status));
}

function normalizeProductName(name) {
  const text = String(name || '').trim();
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
    .replace(/\bMsi\b/g, 'MSI')
    .replace(/\bCpu\b/g, 'CPU')
    .replace(/\bPcie\b/g, 'PCIe')
    .replace(/\bModual\b/gi, 'Modular');
}

export default function CustomerPortal() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [phoneMatches, setPhoneMatches] = useState([]);
  const [phoneQuery, setPhoneQuery] = useState('');
  const navigate = useNavigate();

  const recentTracks = (() => {
    try {
      return JSON.parse(localStorage.getItem('ntpc-recent-tracks') || '[]');
    } catch {
      return [];
    }
  })();

  const handleSearch = async () => {
    const raw = String(code || '').trim();
    if (!raw) {
      setError(t('tracking.legacyInvalidCode'));
      return;
    }

    try {
      const res = await publicService.search(raw);
      if (res.data?.success && res.data?.mode === 'single') {
        const soChungTu = String(res.data?.data?.soChungTu || '').trim();
        if (!soChungTu) {
          setError(t('tracking.legacyInvalidCode'));
          return;
        }
        setError('');
        setPhoneMatches([]);
        setPhoneQuery('');
        navigate(`/tra-cuu/${soChungTu}`);
        return;
      }

      if (res.data?.success && res.data?.mode === 'phone') {
        const items = Array.isArray(res.data?.data?.items) ? res.data.data.items : [];
        if (!items.length) {
          setPhoneMatches([]);
          setPhoneQuery('');
          setError(t('customerPortal.notFoundByPhone'));
          return;
        }

        const sorted = [...items].sort((a, b) => new Date(b.ngayNhan || 0) - new Date(a.ngayNhan || 0));
        const newest = sorted[0];
        if (!newest?.soChungTu) {
          setPhoneMatches([]);
          setPhoneQuery('');
          setError(t('tracking.legacyInvalidCode'));
          return;
        }

        setPhoneMatches(sorted);
        setPhoneQuery(String(res.data?.data?.phone || raw));
        setError(t('customerPortal.foundByPhone', { count: sorted.length, soChungTu: newest.soChungTu }));
        return;
      }

      setPhoneMatches([]);
      setPhoneQuery('');
      setError(t('tracking.legacyInvalidCode'));
    } catch {
      setError(t('tracking.legacyInvalidCode'));
    }
  };

  return (
    <>
    <div className="mobile-only ntpc-mobile-page">
      {/* Hero section với gradient xanh thương hiệu */}
      <section className="ntpc-mobile-hero ntpc-glass-card" style={{ margin: '0 0 12px 0' }}>
        <div className="ntpc-mobile-eyebrow">{t('app.customerBrand')}</div>
        <h1 style={{ margin: '8px 0 6px' }}>{t('tracking.progressTitle')}</h1>
        <p style={{ margin: 0 }}>{t('tracking.progressDescription')}</p>
        {/* Mini progress bar gợi ý hành trình bảo hành */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, opacity: 0.75 }}>
            <span>{t('customerPortal.stepReceive', { defaultValue: 'Nhận hàng' })}</span><span>{t('customerPortal.stepProcess', { defaultValue: 'Xử lý' })}</span><span>{t('customerPortal.stepReturn', { defaultValue: 'Hoàn trả' })}</span>
          </div>
          <ProgressBar percent={40} style={{ '--fill-color': '#1677ff', '--track-color': 'rgba(22,119,255,0.15)', '--track-width': '5px' }} />
        </div>
      </section>

      {/* Search card */}
      <MobileCard className="ntpc-mobile-card ntpc-glass-card" style={{ marginBottom: 12 }}>
        <MobileSpace direction="vertical" block style={{ '--gap': '12px' }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: isDark ? '#fff' : '#26361f' }}>{t('customerPortal.searchTitle', { defaultValue: 'Tra cứu bảo hành' })}</div>
          <div className="ntpc-searchbar-container" style={{ padding: '2px 4px', borderRadius: 12 }}>
            <SearchBar
              placeholder={t('tracking.legacyPlaceholder')}
              value={code}
              onChange={value => { setCode(value); setError(''); }}
              onSearch={handleSearch}
              clearable
            />
          </div>
          <MobileButton block color="primary" size="large" onClick={handleSearch} style={{ borderRadius: 10 }}>
            {t('tracking.title')}
          </MobileButton>
          {error && (
            <NoticeBar
              color={error.includes('Tìm thấy') ? 'info' : 'alert'}
              wrap
              content={error}
              style={{ borderRadius: 10 }}
            />
          )}
        </MobileSpace>
      </MobileCard>

      {/* Phone search results */}
      {phoneMatches.length > 0 && (
        <MobileCard title={`📋 Lịch sử bảo hành SĐT ${phoneQuery}`} className="ntpc-mobile-card ntpc-glass-card" style={{ marginBottom: 12 }}>
          <List>
            {phoneMatches.map((item, i) => (
              <List.Item
                key={`${item.soChungTu}-${i}`}
                description={(
                  <MobileSpace direction="vertical" block style={{ '--gap': '4px' }}>
                    <span style={{ fontSize: 13, opacity: 0.8 }}>{normalizeProductName(item.tenHang)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MobileTag color={statusColor(item.trangThai)} fill="outline">{formatStatus(t, item.trangThai)}</MobileTag>
                      {item.ngayNhan && <span style={{ fontSize: 11, opacity: 0.6 }}>{item.ngayNhan}</span>}
                    </div>
                  </MobileSpace>
                )}
                extra={
                  <span style={{ fontSize: 13, fontWeight: 800, color: isDark ? '#8fc7ff' : '#1677ff' }}>
                    {item.soChungTu}
                  </span>
                }
                onClick={() => navigate(`/tra-cuu/${item.soChungTu}`)}
                arrow
              />
            ))}
          </List>
        </MobileCard>
      )}

      {/* Recent tracks dùng Selector để trải nghiệm native hơn */}
      {recentTracks.length > 0 && (
        <MobileCard title={`🕐 ${t('tracking.recentTitle')}`} className="ntpc-mobile-card ntpc-glass-card" style={{ marginBottom: 12 }}>
          <Selector
            columns={2}
            options={recentTracks.map(track => ({
              label: track,
              value: track,
              description: 'Nhấn để xem',
            }))}
            onChange={(val) => {
              if (val[0]) navigate(`/tra-cuu/${val[0]}`);
            }}
            style={{
              '--border-radius': '10px',
              '--checked-color': 'var(--adm-color-primary)',
              '--checked-text-color': '#fff',
              '--checked-border': 'none',
            }}
          />
        </MobileCard>
      )}

      {/* Contact card nâng cấp với List.Item có icon */}
      <MobileCard title={`📞 ${t('tracking.contactTitle')}`} className="ntpc-mobile-card ntpc-glass-card" style={{ marginBottom: 12 }}>
        <List>
          <List.Item prefix={<span style={{ fontSize: 16 }}>🏢</span>} title={t('tracking.companyTitle')}>
            {t('print:company')}
          </List.Item>
          <List.Item prefix={<PhoneOutlined style={{ fontSize: 15, color: '#1677ff' }} />} title="BH-KT" extra="08h30 - 18h">
            <a href="tel:0937632000" style={{ color: '#1677ff', fontWeight: 700, textDecoration: 'none' }}>0937 63 2000</a>
          </List.Item>
          <List.Item prefix={<PhoneOutlined style={{ fontSize: 15, color: '#52c41a' }} />} title="Hotline">
            <a href="tel:0903602240" style={{ color: '#52c41a', fontWeight: 700, textDecoration: 'none' }}>0903 602 240</a>
          </List.Item>
          <List.Item prefix={<span style={{ fontSize: 15 }}>🪪</span>} title="MST">3603797285</List.Item>
          <List.Item prefix={<EnvironmentOutlined style={{ fontSize: 15, color: '#ff7a00' }} />} title={t('tracking.addressTitle')}>
            {t('print:address').replace(new RegExp(`^${t('print:addressPrefix')} `), '')}
          </List.Item>
        </List>
        <MobileDivider />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <MobileButton
            block
            color="primary"
            fill="outline"
            onClick={() => { window.location.href = 'tel:0937632000'; }}
            style={{ borderRadius: 10 }}
          >
            <PhoneOutlined style={{ marginRight: 4 }} />{t('tracking.callWarranty')}
          </MobileButton>
          <MobileButton
            block
            color="success"
            fill="outline"
            onClick={() => { window.location.href = 'tel:0903602240'; }}
            style={{ borderRadius: 10 }}
          >
            <PhoneOutlined style={{ marginRight: 4 }} />{t('tracking.callHotline')}
          </MobileButton>
        </div>
      </MobileCard>

      {/* Policy card */}
      <MobileCard title={`🛡️ ${t('tracking.policyCardTitle')}`} className="ntpc-mobile-card ntpc-glass-card" style={{ marginBottom: 12 }}>
        <List>
          <List.Item prefix={<span>✅</span>}>{t('tracking.deliveryNote')}</List.Item>
          <List.Item prefix={<span>📦</span>}>{t('tracking.storageNote')}</List.Item>
        </List>
        <div style={{ padding: '8px 0 0' }}>
          <a href="https://nguyentanpc.com/pages/dieu-kien-bao-hanh" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            <MobileButton block fill="outline" style={{ borderRadius: 10, fontSize: 13, pointerEvents: 'none' }}>
              {t('customerPortal.viewFullPolicy', { defaultValue: 'Xem toàn bộ chính sách →' })}
            </MobileButton>
          </a>
        </div>
      </MobileCard>

      <SafeArea position="bottom" />
    </div>

    <div className="desktop-only" style={{ maxWidth: 1040, width: '100%', margin: '0 auto' }}>
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Title level={2} style={{ color: '#1677FF', marginBottom: 8 }}>{t('tracking.progressTitle')}</Title>
            <Text type="secondary">{t('tracking.desktopDescription')}</Text>
          </div>
          <Input.Search
            placeholder="Nhập SĐT hoặc mã chứng từ"
            size="large"
            value={code}
            onChange={e => { setCode(e.target.value); setError(''); }}
            onSearch={handleSearch}
            enterButton={t('tracking.title')}
          />
          {error && <Alert message={error} type="info" showIcon />}
        </Space>
      </Card>

      {phoneMatches.length > 0 && (
        <Card title={`Kết quả theo SĐT ${phoneQuery}`} style={{ marginBottom: 16 }}>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {phoneMatches.map((item, i) => (
              <button
                key={`${item.soChungTu}-${i}`}
                type="button"
                onClick={() => navigate(`/tra-cuu/${item.soChungTu}`)}
                style={{ display: 'grid', gridTemplateColumns: '170px 1fr 140px 120px', gap: 8, alignItems: 'center', width: '100%', border: '1px solid #f0f0f0', borderRadius: 8, padding: '8px 10px', background: '#fff', cursor: 'pointer', textAlign: 'left' }}
              >
                <Text strong>{item.soChungTu}</Text>
                <Text type="secondary" ellipsis>{normalizeProductName(item.tenHang)}</Text>
                <Tag color={statusColor(item.trangThai)} style={{ width: 'fit-content', marginInlineEnd: 0 }}>{formatStatus(t, item.trangThai)}</Tag>
                <Text type="secondary">{item.ngayNhan || ''}</Text>
              </button>
            ))}
          </Space>
        </Card>
      )}

      <Card style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>{t('tracking.recentTitle')}:</Text>
        <Space wrap style={{ marginTop: 8 }}>
          {recentTracks.length ? recentTracks.map((track, i) => (
            <Tag key={i} style={{ cursor: 'pointer' }} onClick={() => navigate(`/tra-cuu/${track}`)}>{track}</Tag>
          )) : <Text type="secondary">{t('customerPortal.noHistory', { defaultValue: 'Chưa có lịch sử' })}</Text>}
        </Space>
      </Card>

      <Card>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text strong>{t('print:company')}</Text>
          <Text>{t('print:address')}</Text>
          <Text>{t('tracking.desktopWarrantyPhone')} • {t('tracking.desktopHotline')}</Text>
          <Text>MST: 3603797285</Text>
          <Text>Website: <Link href="https://nguyentanpc.com/" target="_blank">https://nguyentanpc.com/</Link></Text>
          <Text>Fanpage: <Link href="https://www.facebook.com/vitinhnguyentan.vn" target="_blank">https://www.facebook.com/vitinhnguyentan.vn</Link></Text>
          <Divider style={{ margin: '8px 0' }} />
          <Text>{t('tracking.desktopPolicyLink')} <Link href="https://nguyentanpc.com/pages/dieu-kien-bao-hanh" target="_blank">https://nguyentanpc.com/pages/dieu-kien-bao-hanh</Link></Text>
          <Text>• {t('tracking.deliveryNote')}</Text>
          <Text>{t('tracking.desktopStorageNote')}</Text>
        </Space>
      </Card>
    </div>
    </>
  );
}

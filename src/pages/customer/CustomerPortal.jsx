import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Input, Typography, Alert, Tag, Space, Divider, Row, Col, Table, Collapse } from 'antd';
import { Button as MobileButton, Card as MobileCard, Divider as MobileDivider, List, SearchBar, Space as MobileSpace, Tag as MobileTag } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
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

function formatStatus(status) {
  const key = String(status || '').trim();
  return STATUS_LABELS[key] || key.replace(/_/g, ' ');
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
          setError('Không tìm thấy chứng từ theo số điện thoại này');
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
        setError(`Tìm thấy ${sorted.length} chứng từ theo SĐT. CT mới nhất: ${newest.soChungTu}. Chọn bên dưới để xem chi tiết.`);
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
      <section className="ntpc-mobile-hero">
        <div className="ntpc-mobile-eyebrow">{t('app.customerBrand')}</div>
        <h1>{t('tracking.progressTitle')}</h1>
        <p>{t('tracking.progressDescription')}</p>
      </section>

      <MobileCard className="ntpc-mobile-card">
        <MobileSpace direction="vertical" block style={{ '--gap': '12px' }}>
          <SearchBar
            placeholder={t('tracking.legacyPlaceholder')}
            value={code}
            onChange={value => { setCode(value); setError(''); }}
            onSearch={handleSearch}
            clearable
            style={{ '--height': '44px', '--border-radius': '12px' }}
          />
          <MobileButton block color="primary" size="large" onClick={handleSearch}>
            {t('tracking.title')}
          </MobileButton>
          {error && <div className="ntpc-mobile-error">{error}</div>}
        </MobileSpace>
      </MobileCard>

      {phoneMatches.length > 0 && (
        <MobileCard title={`Lịch sử bảo hành SĐT ${phoneQuery}`} className="ntpc-mobile-card">
          <List>
            {phoneMatches.map((item, i) => (
              <List.Item
                key={`${item.soChungTu}-${i}`}
                title={item.soChungTu}
                description={(
                  <Space direction="vertical" size={4}>
                    <span>{normalizeProductName(item.tenHang)}</span>
                    <Tag color={statusColor(item.trangThai)}>{formatStatus(item.trangThai)}</Tag>
                  </Space>
                )}
                extra={item.ngayNhan || ''}
                onClick={() => navigate(`/tra-cuu/${item.soChungTu}`)}
              />
            ))}
          </List>
        </MobileCard>
      )}

      {recentTracks.length > 0 && (
        <MobileCard title={t('tracking.recentTitle')} className="ntpc-mobile-card">
          <div className="ntpc-mobile-tags">
            {recentTracks.map((track, i) => (
              <MobileTag key={i} round color="primary" fill="outline" onClick={() => navigate(`/tra-cuu/${track}`)}>
                {track}
              </MobileTag>
            ))}
          </div>
        </MobileCard>
      )}

      <MobileCard title={t('tracking.contactTitle')} className="ntpc-mobile-card">
        <List>
          <List.Item title={t('tracking.companyTitle')}>{t('print:company')}</List.Item>
          <List.Item title="BH-KT" extra="08h30 - 18h">0937 63 2000</List.Item>
          <List.Item title="Hotline">0903 602 240</List.Item>
          <List.Item title="MST">3603797285</List.Item>
          <List.Item title={t('tracking.addressTitle')}>{t('print:address').replace(new RegExp(`^${t('print:addressPrefix')} `), '')}</List.Item>
        </List>
        <MobileDivider />
        <MobileSpace direction="vertical" block style={{ '--gap': '8px' }}>
          <MobileButton block onClick={() => { window.location.href = 'tel:0937632000'; }}>{t('tracking.callWarranty')}</MobileButton>
          <MobileButton block onClick={() => { window.location.href = 'tel:0903602240'; }}>{t('tracking.callHotline')}</MobileButton>
        </MobileSpace>
      </MobileCard>

      <MobileCard title={t('tracking.policyCardTitle')} className="ntpc-mobile-card">
        <MobileSpace direction="vertical" block style={{ '--gap': '8px' }}>
          <a href="https://nguyentanpc.com/pages/dieu-kien-bao-hanh" target="_blank" rel="noreferrer">{t('tracking.policyDetail')}</a>
          <span>{t('tracking.deliveryNote')}</span>
          <span>{t('tracking.storageNote')}</span>
        </MobileSpace>
      </MobileCard>
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
                <Tag color={statusColor(item.trangThai)} style={{ width: 'fit-content', marginInlineEnd: 0 }}>{formatStatus(item.trangThai)}</Tag>
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
          )) : <Text type="secondary">Chưa có lịch sử</Text>}
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

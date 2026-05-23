import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, Result, Button, Tag, Descriptions, Steps, Alert, Typography, Space, Timeline, Row, Col, Divider, Image, Collapse, List as DesktopList } from 'antd';
import {
  Button as MobileButton,
  Card as MobileCard,
  Collapse as MobileCollapse,
  Divider as MobileDivider,
  Grid as MobileGrid,
  List,
  NoticeBar,
  Result as MobileResult,
  Space as MobileSpace,
  Steps as MobileSteps,
  Tag as MobileTag,
  Toast,
} from 'antd-mobile';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  PrinterOutlined,
  LinkOutlined,
  ClockCircleOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
  SwapOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { publicService } from '../../services/warrantyService';
import { STATUS } from '../../constants/statusConfig';
import { getStatusBadgeColor } from '../../constants/badgeConfig';
import dayjs from 'dayjs';
import { useTheme } from '../../hooks/useTheme';
import { normalizeHistoryNote } from '../../utils/historyDisplay';
import styles from './TrackingResult.module.css';

const { Title, Text, Paragraph } = Typography;

function parseTrackDate(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const dmy = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmy) {
      const [, day, month, year] = dmy;
      const parsed = dayjs(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      return parsed.isValid() ? parsed : null;
    }
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
}

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

function mobileStatusColor(status) {
  return getStatusBadgeColor(normalizeStatusKey(status), 'mobile');
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

function timelineColor(type, index) {
  if (type === 'exchange' || type === 'return') return 'green';
  if (type === 'log') return 'purple';
  if (type === 'status') return 'orange';
  if (type === 'update' || type === 'priority') return 'blue';
  return index === 0 ? 'green' : 'gray';
}


function CopyButton({ url }) {
  const { t } = useTranslation();
  return (
    <Button icon={<LinkOutlined />} onClick={() => navigator.clipboard.writeText(url)}>
      {t('trackingResult.copyLink')}
    </Button>
  );
}

function TrackingResultSkeleton() {
  const block = (style = {}) => ({
    borderRadius: 12,
    background: 'var(--color-background-secondary, var(--ant-color-fill-secondary))',
    ...style,
  });

  return (
    <>
      <div className="mobile-only ntpc-mobile-page">
        <MobileCard className="ntpc-mobile-card">
          <div style={block({ width: 200, height: 24, marginBottom: 16 })} />
          <div style={block({ width: '100%', height: 120 })} />
        </MobileCard>
      </div>
      <div className="desktop-only" style={{ width: '100%', maxWidth: 1180, margin: '0 auto', padding: '8px 0 24px' }}>
        <Card styles={{ body: { padding: 24 } }}>
          <div style={block({ width: 200, height: 24, marginBottom: 20 })} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 120px)', gap: 12, marginBottom: 24 }}>
            {[0, 1, 2, 3].map((i) => <div key={i} style={block({ width: 120, height: 90 })} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 16, alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={block({ width: '100%', height: 96 })} />
              <div style={block({ width: '88%', height: 96 })} />
            </div>
            <div style={block({ width: '100%', height: 220 })} />
          </div>
        </Card>
      </div>
    </>
  );
}

export default function TrackingResult() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { soChungTu } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [relatedByPhone, setRelatedByPhone] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    publicService.track(soChungTu)
      .then(res => {
        if (res.data.success) {
          setData(res.data.data);
          try {
            const recent = JSON.parse(localStorage.getItem('ntpc-recent-tracks') || '[]');
            const codeOf = (item) => (typeof item === 'string' ? item : item?.code);
            const updated = [
              { code: soChungTu, time: new Date().toISOString() },
              ...recent.filter(r => codeOf(r) !== soChungTu),
            ].slice(0, 5);
            localStorage.setItem('ntpc-recent-tracks', JSON.stringify(updated));
          } catch {
            // ignore
          }
        } else {
          setError('not_found');
        }
      })
      .catch(() => setError('not_found'))
      .finally(() => setLoading(false));
  }, [soChungTu]);

  useEffect(() => {
    const phone = String(data?.soDienThoai || '').trim();
    if (!phone) {
      setRelatedByPhone([]);
      return;
    }
    publicService.search(phone)
      .then((res) => {
        if (!(res.data?.success && res.data?.mode === 'phone')) {
          setRelatedByPhone([]);
          return;
        }
        const items = Array.isArray(res.data?.data?.items) ? res.data.data.items : [];
        const normalizedCurrent = String(soChungTu || '').toUpperCase().trim();
        const sorted = items
          .filter((x) => String(x?.soChungTu || '').toUpperCase().trim() !== normalizedCurrent)
          .sort((a, b) => new Date(b.ngayNhan || 0) - new Date(a.ngayNhan || 0));
        setRelatedByPhone(sorted);
      })
      .catch(() => setRelatedByPhone([]));
  }, [data?.soDienThoai, soChungTu]);

  if (loading) return <TrackingResultSkeleton />;

  if (error === 'not_found') {
    return (
      <Result
        status="404"
        title={t('trackingResult.notFoundTitle')}
        subTitle={t('trackingResult.notFoundSubtitle')}
        extra={[
          <Button type="primary" key="search" onClick={() => navigate('/tra-cuu')}>{t('trackingResult.searchAgain')}</Button>,
          <Button key="hotline" href="tel:0903602240">{t('trackingResult.hotline')}</Button>,
        ]}
      />
    );
  }

  if (!data) return null;

  const currentStep = (() => {
    let idx = 0;
    data.steps.forEach((s, i) => {
      if (s.current) idx = i;
    });
    return idx;
  })();

  const statusConfig = STATUS[data.trangThai] || STATUS.da_nhan;
  const Icon = statusConfig.icon;
  const dueDate = parseTrackDate(data.ngayHenTraRaw || data.ngayHenTra);
  const isClosed = data.trangThai === 'da_tra' || data.trangThai === 'huy';
  const isOverdue = !isClosed && dueDate && dueDate.isBefore(dayjs(), 'day');
  const isUrgent = !isClosed && dueDate && dueDate.diff(dayjs(), 'day') <= 3 && !isOverdue;
  const timelineItems = [...(data.statusLog || [])]
    .filter((log) => {
      const note = String(log?.note || '');
      if (note.includes('supplierLogs:')) return false;
      if (note.includes('Xóa 1 dòng lịch sử gửi / nhận NCC')) return false;
      return true;
    })
    .reverse();
  const support = data.supportInfo || {};
  const statusSummary = data.doiTra?.type === 'doi_hang'
    ? t('trackingResult.summaryExchange')
    : data.doiTra?.type === 'tra_hang'
      ? t('trackingResult.summaryReturn')
      : data.trangThai === 'da_tra'
        ? t('trackingResult.summaryDone')
        : data.trangThai === 'huy'
          ? t('trackingResult.summaryCanceled')
          : isOverdue
            ? t('trackingResult.summaryOverdue')
            : isUrgent
              ? t('trackingResult.summaryUrgent')
              : t('trackingResult.summaryProcessing');

  const shellStyle = {
    width: '100%',
    maxWidth: 1180,
    margin: '0 auto',
    padding: '8px 0 24px',
  };
  const heroStyle = {
    border: `1px solid ${isDark ? '#303030' : '#d7e2d2'}`,
    background: isDark
      ? 'linear-gradient(135deg, #1f1f1f 0%, #1a261d 50%, #20262b 100%)'
      : 'linear-gradient(135deg, #f5f1e8 0%, #eef7ea 50%, #dce8d3 100%)',
    boxShadow: isDark ? 'none' : '0 18px 60px rgba(35, 55, 31, 0.12)',
    overflow: 'hidden',
  };
  const cardStyle = { borderRadius: 18, borderColor: isDark ? '#303030' : '#e6eadf' };
  const miniStyle = {
    padding: 14,
    borderRadius: 14,
    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.68)',
    border: isDark ? '1px solid #303030' : '1px solid rgba(77,99,64,0.12)',
  };
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    Toast.show({ content: t('trackingResult.copiedLink') });
  };

  return (
    <>
    <div className="mobile-only ntpc-mobile-page tracking-mobile">
      <section className="ntpc-mobile-hero tracking-hero">
        <MobileTag round color={isOverdue ? 'danger' : mobileStatusColor(data.trangThai)}>
          {statusConfig.label}
        </MobileTag>
        <h1>{data.soChungTu}</h1>
        <p>{statusSummary}</p>
      </section>

      {(isOverdue || isUrgent || data.trangThai === 'huy' || data.trangThai === 'da_tra') && (
        <NoticeBar
          color={data.trangThai === 'huy' || isOverdue ? 'error' : data.trangThai === 'da_tra' ? 'success' : 'alert'}
          wrap
          content={
            data.trangThai === 'huy'
              ? t('trackingResult.canceled')
              : data.trangThai === 'da_tra'
                ? (data.ngayTra ? t('trackingResult.doneOn', { date: data.ngayTra }) : t('trackingResult.done'))
                : isOverdue
                  ? t('trackingResult.overdueDays', { count: dayjs().diff(dueDate, 'day') })
                  : t('trackingResult.remainingDays', { count: dueDate.diff(dayjs(), 'day') })
          }
        />
      )}

      <MobileGrid columns={2} gap={8} className="ntpc-mobile-kpis">
        <MobileGrid.Item>
          <div className="ntpc-mobile-kpi"><span>{t('trackingResult.receivedDate')}</span><b>{data.ngayNhan || '-'}</b></div>
        </MobileGrid.Item>
        <MobileGrid.Item>
          <div className="ntpc-mobile-kpi"><span>{isClosed ? t('trackingResult.doneDate') : t('trackingResult.dueDateShort')}</span><b>{isClosed ? (data.ngayTra || '-') : (data.ngayHenTra || '-')}</b></div>
        </MobileGrid.Item>
        <MobileGrid.Item>
          <div className="ntpc-mobile-kpi"><span>{t('trackingResult.customer')}</span><b>{data.khachHang || '-'}</b></div>
        </MobileGrid.Item>
        <MobileGrid.Item>
          <div className="ntpc-mobile-kpi"><span>{t('trackingResult.phone')}</span><b>{data.soDienThoai || '-'}</b></div>
        </MobileGrid.Item>
      </MobileGrid>

      <MobileCard title={t('trackingResult.progressTitle')} className="ntpc-mobile-card ntpc-mobile-progress-desktop">
        <Steps
          size="small"
          direction="vertical"
          current={currentStep >= 0 ? currentStep : 0}
          items={(data.steps || []).map((s) => ({ title: s.label, description: s.date || '' }))}
        />
        {data.doiTra && (
          <div className="ntpc-mobile-success">
            {data.doiTra.type === 'doi_hang'
              ? t('trackingResult.exchangeDone', { name: data.doiTra.tenHangMoi || '-', serial: data.doiTra.soSeriMoi || '-' })
              : t('trackingResult.returnDone', { reason: data.doiTra.reason || data.doiTra.note || '-' })}
          </div>
        )}
      </MobileCard>

      {timelineItems.length > 0 && (
        <MobileCard title={t('trackingResult.detailProgress')} className="ntpc-mobile-card">
          <div className="ntpc-mobile-timeline">
            {timelineItems.map((log, i) => (
              <div className="ntpc-mobile-timeline-item" key={`${log.action}-${log.time}-${i}`}>
                <b>{log.action}</b>
                <span>{log.time}</span>
                {log.note && <p style={{ whiteSpace: 'pre-line' }}>{normalizeHistoryNote(log.note)}</p>}
              </div>
            ))}
          </div>
        </MobileCard>
      )}

      {relatedByPhone.length > 0 && (
        <MobileCard className="ntpc-mobile-card tracking-related-card">
          <MobileCollapse defaultActiveKey={["related"]}>
            <MobileCollapse.Panel key="related" title="Chứng từ khác cùng số điện thoại">
              <List>
                {relatedByPhone.map((item, i) => (
                  <List.Item
                    key={`${item.soChungTu}-${i}`}
                    onClick={() => navigate(`/tra-cuu/${item.soChungTu}`)}
                    description={(
                      <div className="tracuu-result-meta">
                        <div className="tracuu-result-product">{normalizeProductName(item.tenHang) || '-'}</div>
                        <div className="tracuu-result-dates">
                          <span><CalendarOutlined /> Nhận: {item.ngayNhan || '-'}</span>
                          <span><CalendarOutlined /> Hẹn trả: {item.ngayHenTra || '-'}</span>
                        </div>
                      </div>
                    )}
                  >
                    <MobileSpace wrap>
                      <span className="admin-mobile-code">{item.soChungTu}</span>
                      <MobileTag color={mobileStatusColor(item.trangThai)}>{formatStatus(item.trangThai)}</MobileTag>
                    </MobileSpace>
                  </List.Item>
                ))}
              </List>
            </MobileCollapse.Panel>
          </MobileCollapse>
        </MobileCard>
      )}

      <MobileCard title={t('trackingResult.ticketInfo')} className="ntpc-mobile-card tracking-info-card">
        <List>
          <List.Item title={t('trackingResult.documentNumber')} extra={<span className={styles.infoValue}>{data.soChungTu}</span>} />
          <List.Item title={t('trackingResult.status')} extra={<MobileTag color={mobileStatusColor(data.trangThai)}>{statusConfig.label}</MobileTag>} />
          <List.Item title={t('trackingResult.customer')} extra={<span className={`${styles.infoValue} ${styles.infoValueLong}`}>{data.khachHang || '-'}</span>} />
          <List.Item title={t('trackingResult.phoneLong')} extra={<span className={styles.infoValue}>{data.soDienThoai || '-'}</span>} />
          <List.Item title={t('trackingResult.receivedDate')} extra={<span className={styles.infoValue}>{data.ngayNhan || '-'}</span>} />
          {!isClosed && (
            <List.Item title={t('trackingResult.dueDate')} extra={<span className={styles.infoValue}>{data.ngayHenTra || '-'}</span>} />
          )}
          {isClosed && (
            <List.Item title={t('trackingResult.doneDate')} extra={<span className={styles.infoValue}>{data.ngayTra || '-'}</span>} />
          )}
          {data.ghiChu && (
            <List.Item title={t('trackingResult.note')} extra={<span className={`${styles.infoValue} ${styles.infoValueLong}`}>{data.ghiChu}</span>} />
          )}
        </List>
      </MobileCard>

      <MobileCard title={t('trackingResult.productInfo')} className="ntpc-mobile-card tracking-info-card">
        <List>
          <List.Item title={t('trackingResult.productName')} extra={<span className={`${styles.infoValue} ${styles.infoValueLong}`}>{data.tenHang || '-'}</span>} />
          <List.Item title={t('trackingResult.serial')} extra={<span className={styles.infoValue}>{data.soSeri || '-'}</span>} />
          <List.Item title={t('trackingResult.warranty')} extra={<span className={styles.infoValue}>{data.baoHanh || '-'}</span>} />
          <List.Item title={t('trackingResult.purchaseDate')} extra={<span className={styles.infoValue}>{data.ngayMua || '-'}</span>} />
          <List.Item title={t('trackingResult.receivedIssue')} extra={<span className={`${styles.infoValue} ${styles.infoValueLong}`}>{data.loiLucNhan || '-'}</span>} />
          <List.Item title={t('trackingResult.accessories')} extra={<span className={`${styles.infoValue} ${styles.infoValueLong}`}>{data.phuKien || '-'}</span>} />
        </List>
      </MobileCard>


      {(data.attachmentsPublic || []).length > 0 && (
        <MobileCard title={t('trackingResult.viewImages')} className="ntpc-mobile-card">
          <Image.PreviewGroup>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(data.attachmentsPublic || []).map((img) => (
                <Image key={img.id || img.url} src={img.url} alt={img.name || 'image'} preview={{ mask: t('trackingResult.viewImage') }} width="100%" height={120} wrapperStyle={{ display: 'block', width: '100%' }} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }} />
              ))}
            </div>
          </Image.PreviewGroup>
        </MobileCard>
      )}
      {data.doiTra && (
        <MobileCard title={t('trackingResult.exchangeReturn')} className="ntpc-mobile-card">
        <List>
            <List.Item title={t('trackingResult.handlingType')}>{data.doiTra.type === 'doi_hang' ? t('trackingResult.exchange') : t('trackingResult.return')}</List.Item>
            <List.Item title={t('trackingResult.time')}>{data.doiTra.at || '-'}</List.Item>
            <List.Item title={t('trackingResult.oldProduct')}>{data.doiTra.tenHangCu || '-'}</List.Item>
            <List.Item title={t('trackingResult.oldSerial')}>{data.doiTra.soSeriCu || '-'}</List.Item>
            {data.doiTra.type === 'doi_hang' ? (
              <>
                <List.Item title={t('trackingResult.newProduct')}>{data.doiTra.tenHangMoi || '-'}</List.Item>
                <List.Item title={t('trackingResult.newSerial')}>{data.doiTra.soSeriMoi || '-'}</List.Item>
              </>
            ) : (
              <List.Item title={t('trackingResult.returnReason')}>{data.doiTra.reason || '-'}</List.Item>
            )}
            {data.doiTra.note && <List.Item title={t('trackingResult.note')}>{data.doiTra.note}</List.Item>}
          </List>
        </MobileCard>
      )}

      <MobileCard title={t('trackingResult.policyTitle')} className="ntpc-mobile-card">
        <MobileSpace direction="vertical" block style={{ '--gap': '8px' }}>
          <span>{t('trackingResult.policyDelivery')}</span>
          <span>{t('trackingResult.policyStorage')}</span>
          <a href={support.policyUrl} target="_blank" rel="noreferrer">{t('trackingResult.policyLinkText')}</a>
        </MobileSpace>
      </MobileCard>

      <MobileCard title={t('trackingResult.supportContact')} className="ntpc-mobile-card">
        <MobileSpace direction="vertical" block style={{ '--gap': '8px' }}>
          <b>{support.company || t('trackingResult.companyFallback')}</b>
          <span>{support.address}</span>
          <MobileDivider />
          <MobileButton block color="primary" href={`tel:${(support.warrantyPhone || '0937632000').replace(/\s/g, '')}`}>
            BH-KT: {support.warrantyPhone || '0937 63 2000'}
          </MobileButton>
          <MobileButton block href={`tel:${(support.hotline || '0903602240').replace(/\s/g, '')}`}>
            Hotline: {support.hotline || '0903 602 240'}
          </MobileButton>
        </MobileSpace>
      </MobileCard>

      <div className="ntpc-mobile-actions">
        <MobileButton block onClick={handleCopyLink}>{t('trackingResult.copyLink')}</MobileButton>
        <MobileButton block onClick={() => navigate('/tra-cuu')}>{t('trackingResult.searchAgain')}</MobileButton>
      </div>
    </div>

    <div className="desktop-only" style={shellStyle}>
      <Card style={{ ...heroStyle, marginBottom: 16 }} styles={{ body: { padding: 24 } }}>
        <Row gutter={[20, 20]} align="middle">
          <Col xs={24} lg={15}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Tag color={statusConfig.color} icon={<Icon />} style={{ width: 'fit-content', fontSize: 15, padding: '6px 16px', borderRadius: 999 }}>
                {statusConfig.label}
              </Tag>
              <div>
                <Text type="secondary">{t('trackingResult.warrantyCode')}</Text>
                <Title level={2} style={{ margin: '2px 0 0', letterSpacing: 0.3 }}>{data.soChungTu}</Title>
              </div>
              <Paragraph style={{ margin: 0, fontSize: 16, color: isDark ? '#d9d9d9' : '#40513a' }}>{statusSummary}</Paragraph>
              {(isOverdue || isUrgent || data.trangThai === 'huy' || data.trangThai === 'da_tra') && (
                <Alert
                  type={data.trangThai === 'huy' ? 'error' : data.trangThai === 'da_tra' ? 'success' : isOverdue ? 'error' : 'warning'}
                  showIcon
                  message={
                    data.trangThai === 'huy'
                      ? t('trackingResult.canceled')
                      : data.trangThai === 'da_tra'
                        ? (data.ngayTra ? t('trackingResult.doneOn', { date: data.ngayTra }) : t('trackingResult.done'))
                        : isOverdue
                          ? t('trackingResult.overdueDays', { count: dayjs().diff(dueDate, 'day') })
                          : t('trackingResult.remainingDays', { count: dueDate.diff(dayjs(), 'day') })
                  }
                />
              )}
            </Space>
          </Col>
          <Col xs={24} lg={9}>
            <Row gutter={[10, 10]}>
              <Col xs={12}>
                <div style={miniStyle}>
                  <Text type="secondary">{t('trackingResult.receivedDate')}</Text>
                  <div><Text strong>{data.ngayNhan || '-'}</Text></div>
                </div>
              </Col>
              <Col xs={12}>
                <div style={miniStyle}>
                  <Text type="secondary">{isClosed ? t('trackingResult.doneDate') : t('trackingResult.dueDateShort')}</Text>
                  <div><Text strong>{isClosed ? (data.ngayTra || '-') : (data.ngayHenTra || '-')}</Text></div>
                </div>
              </Col>
              <Col xs={12}>
                <div style={miniStyle}>
                  <Text type="secondary">{t('trackingResult.customer')}</Text>
                  <div><Text strong ellipsis={{ tooltip: data.khachHang }}>{data.khachHang || '-'}</Text></div>
                </div>
              </Col>
              <Col xs={12}>
                <div style={miniStyle}>
                  <Text type="secondary">{t('trackingResult.phone')}</Text>
                  <div><Text strong>{data.soDienThoai || '-'}</Text></div>
                </div>
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} align="top">
        <Col xs={24} lg={15}>
          <Card title={t('trackingResult.progressTitle')} style={{ ...cardStyle, marginBottom: 16 }}>
            <Steps
              current={currentStep >= 0 ? currentStep : 0}
              responsive
              items={data.steps.map(s => ({ title: s.label, description: s.date }))}
            />
            {data.doiTra && (
              <Alert
                style={{ marginTop: 16 }}
                type="success"
                showIcon
                message={data.doiTra.type === 'doi_hang' ? t('trackingResult.exchangeAlert') : t('trackingResult.returnAlert')}
                description={data.doiTra.type === 'doi_hang'
                  ? `${data.doiTra.tenHangMoi || '-'} - Serial: ${data.doiTra.soSeriMoi || '-'}`
                  : (data.doiTra.reason || data.doiTra.note || '-')}
              />
            )}
          </Card>

    
      {(data.attachmentsPublic || []).length > 0 && (
          <Card title={t('trackingResult.viewImages')} style={{ ...cardStyle, marginBottom: 16 }}>
            <Image.PreviewGroup>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                {(data.attachmentsPublic || []).map((img) => (
                  <Image key={img.id || img.url} src={img.url} alt={img.name || 'image'} preview={{ mask: t('trackingResult.viewImage') }} width="100%" height={130} wrapperStyle={{ display: 'block', width: '100%' }} style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 8, border: `1px solid ${isDark ? '#303030' : '#e5e7eb'}` }} />
                ))}
              </div>
            </Image.PreviewGroup>
          </Card>
      )}
      {timelineItems.length > 0 && (
            <Card title={t('trackingResult.detailProgress')} extra={<Text type="secondary">{t('trackingResult.newestFirst')}</Text>} style={{ ...cardStyle, marginBottom: 16 }}>
              <Timeline
                items={timelineItems.map((log, i) => ({
                  color: timelineColor(log.actionType, i),
                  children: (
                    <div>
                      <Text strong>{log.action}</Text>
                      <div style={{ marginTop: 2 }}>
                        <ClockCircleOutlined style={{ fontSize: 12, marginRight: 4 }} />
                        <Text type="secondary">{log.time}</Text>
                      </div>
                      {log.note && <div style={{ marginTop: 6, fontSize: 13, color: isDark ? '#b8b8b8' : '#4b5563', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{normalizeHistoryNote(log.note)}</div>}
                    </div>
                  ),
                }))}
              />
            </Card>
          )}

          {relatedByPhone.length > 0 && (
            <Collapse
              style={{ marginBottom: 16 }}
              defaultActiveKey={["related"]}
              items={[
                {
                  key: 'related',
                  label: 'Chứng từ khác cùng số điện thoại',
                  children: (
                    <DesktopList
                      className="tracking-related-desktop-list"
                      dataSource={relatedByPhone}
                      renderItem={(item, i) => (
                        <DesktopList.Item className="tracuu-old-result-item" onClick={() => navigate(`/tra-cuu/${item.soChungTu}`)}>
                          <DesktopList.Item.Meta
                            title={<Space><b>{item.soChungTu}</b><Tag color={statusColor(item.trangThai)}>{formatStatus(item.trangThai)}</Tag></Space>}
                            description={(
                              <div className="tracuu-result-meta">
                                <div className="tracuu-result-product">{normalizeProductName(item.tenHang) || '-'}</div>
                                <div className="tracuu-result-dates">
                                  <span><CalendarOutlined /> Nhận: {item.ngayNhan || '-'}</span>
                                  <span><CalendarOutlined /> Hẹn trả: {item.ngayHenTra || '-'}</span>
                                </div>
                              </div>
                            )}
                          />
                          <RightOutlined className="tracuu-result-chevron" />
                        </DesktopList.Item>
                      )}
                    />
                  ),
                },
              ]}
            />
          )}

          <Card title={<Space><ToolOutlined />{t('trackingResult.supportContact')}</Space>} style={{ ...cardStyle, marginBottom: 16 }}>
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Text strong>{support.company || t('trackingResult.companyFallback')}</Text>
              <Text type="secondary">{support.address}</Text>
              <Row gutter={[10, 10]}>
                <Col xs={24} sm={12}>
                  <Button block type="primary" icon={<PhoneOutlined />} href={`tel:${(support.warrantyPhone || '0937632000').replace(/\s/g, '')}`}>
                    BH-KT: {support.warrantyPhone || '0937 63 2000'}
                  </Button>
                </Col>
                <Col xs={24} sm={12}>
                  <Button block icon={<PhoneOutlined />} href={`tel:${(support.hotline || '0903602240').replace(/\s/g, '')}`}>
                    Hotline: {support.hotline || '0903 602 240'}
                  </Button>
                </Col>
              </Row>
              <Text type="secondary">{t('trackingResult.workingHours')} {support.workingHours || t('trackingResult.workingHoursFallback')}</Text>

              <Divider style={{ margin: '8px 0' }} />

              <Space direction="vertical" size={8}>
                <Text><InfoCircleOutlined /> {t('trackingResult.policyDelivery')}</Text>
                <Text><SafetyCertificateOutlined /> {t('trackingResult.policyStorageLong')}</Text>
                <Text><FileTextOutlined /> {t('trackingResult.policyDetailLabel')} <a href={support.policyUrl} target="_blank" rel="noreferrer">{t('trackingResult.policyLinkText')}</a></Text>
              </Space>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          <Card title={t('trackingResult.ticketInfo')} className="tracking-info-card tracking-info-card-desktop" style={{ ...cardStyle, marginBottom: 16 }}>
            <Descriptions layout="vertical" column={2} size="small">
              <Descriptions.Item label={t('trackingResult.documentNumber')}>{data.soChungTu}</Descriptions.Item>
              <Descriptions.Item label={t('trackingResult.status')}><Tag color={statusConfig.color}>{statusConfig.label}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('trackingResult.customer')}>{data.khachHang || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('trackingResult.phoneLong')}>{data.soDienThoai || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('trackingResult.receivedDate')}>{data.ngayNhan || '-'}</Descriptions.Item>
              {!isClosed && <Descriptions.Item label={t('trackingResult.dueDate')}>{data.ngayHenTra || '-'}</Descriptions.Item>}
              {isClosed && <Descriptions.Item label={t('trackingResult.doneDate')}>{data.ngayTra || '-'}</Descriptions.Item>}
              {data.ghiChu && <Descriptions.Item label={t('trackingResult.note')}>{data.ghiChu}</Descriptions.Item>}
            </Descriptions>
          </Card>

          <Card title={t('trackingResult.productInfo')} className="tracking-info-card tracking-info-card-desktop" style={{ ...cardStyle, marginBottom: 16 }}>
            <Descriptions layout="vertical" column={1} size="small">
              <Descriptions.Item label={t('trackingResult.productName')}>{data.tenHang || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('trackingResult.serial')}>{data.soSeri || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('trackingResult.warranty')}>{data.baoHanh || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('trackingResult.purchaseDate')}>{data.ngayMua || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('trackingResult.receivedIssue')}>{data.loiLucNhan || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('trackingResult.accessories')}>{data.phuKien || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>

          {data.doiTra && (
            <Card title={<Space><SwapOutlined />{t('trackingResult.exchangeReturn')}</Space>} style={{ ...cardStyle, marginBottom: 16 }}>
              <Descriptions layout="vertical" column={1} size="small">
                <Descriptions.Item label={t('trackingResult.handlingType')}>{data.doiTra.type === 'doi_hang' ? t('trackingResult.exchange') : t('trackingResult.return')}</Descriptions.Item>
                <Descriptions.Item label={t('trackingResult.time')}>{data.doiTra.at || '-'}</Descriptions.Item>
                <Descriptions.Item label={t('trackingResult.oldProduct')}>{data.doiTra.tenHangCu || '-'}</Descriptions.Item>
                <Descriptions.Item label={t('trackingResult.oldSerial')}>{data.doiTra.soSeriCu || '-'}</Descriptions.Item>
                {data.doiTra.type === 'doi_hang' ? (
                  <>
                    <Descriptions.Item label={t('trackingResult.newProduct')}>{data.doiTra.tenHangMoi || '-'}</Descriptions.Item>
                    <Descriptions.Item label={t('trackingResult.newSerial')}>{data.doiTra.soSeriMoi || '-'}</Descriptions.Item>
                  </>
                ) : (
                  <Descriptions.Item label={t('trackingResult.returnReason')}>{data.doiTra.reason || '-'}</Descriptions.Item>
                )}
                {data.doiTra.note && <Descriptions.Item label={t('trackingResult.note')}>{data.doiTra.note}</Descriptions.Item>}
              </Descriptions>
            </Card>
          )}

          <Card style={{ ...cardStyle, marginBottom: 16 }}>
            <Space wrap>
              <Button icon={<PrinterOutlined />} onClick={() => window.print()}>{t('trackingResult.print')}</Button>
              <CopyButton url={window.location.href} />
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/tra-cuu')}>{t('trackingResult.searchAgain')}</Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
    </>
  );
}


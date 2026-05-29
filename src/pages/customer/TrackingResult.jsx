import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, Result, Button, Tag, Descriptions, Steps, Alert, Typography, Space, Timeline, Row, Col, Divider, Image, Collapse, List as DesktopList, Watermark } from 'antd';
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
  PullToRefresh,
  Popup,
  ActionSheet,
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
  CloseOutlined,
  ExpandOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { publicService } from '../../services/warrantyService';
import { STATUS } from '../../constants/statusConfig';
import { getStatusBadgeColor } from '../../constants/badgeConfig';
import dayjs from 'dayjs';
import { useTheme } from '../../hooks/useTheme';
import { normalizeHistoryNote } from '../../utils/historyDisplay';
import styles from './TrackingResult.module.css';


function renderHistoryDetail(detail) {
  if (!detail || typeof detail !== 'string') return detail;
  const regex = /Đang cập nhập\.\.\.|Đang cập nhập/g;
  const matches = [...detail.matchAll(regex)];
  if (matches.length === 0) return detail;

  const elements = [];
  let lastIndex = 0;
  matches.forEach((match, idx) => {
    const textBefore = detail.substring(lastIndex, match.index);
    if (textBefore) elements.push(textBefore);
    elements.push(
      <span key={`loading-${idx}`}>
        Đang cập nhập
        <span className="loading-dots" />
      </span>
    );
    lastIndex = match.index + match[0].length;
  });
  const textAfter = detail.substring(lastIndex);
  if (textAfter) elements.push(textAfter);

  return elements;
}

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
  da_nhan: 'Đã nhận',
  tiep_nhan: 'Đã nhận',
  dang_xu_ly: 'Đang xử lý',
  cho_xu_ly: 'Đã nhận',
  cho_lien_he: 'Đang xử lý',
  cho_linh_kien: 'Chờ linh kiện',
  da_sua_xong: 'Đã sửa xong',
  da_tra: 'Đã xong',
  da_tra_hang: 'Đã xong',
  huy: 'Đã hủy',
  da_huy: 'Đã hủy',
};

function formatStatus(status) {
  const key = String(status || '').trim();
  return STATUS_LABELS[key] || key.replace(/_/g, ' ');
}

function normalizeStatusKey(status) {
  const key = String(status || '').trim();
  if (key === 'da_tra_hang' || key === 'da_sua_xong' || key === 'da_tra') return 'da_tra';
  if (key === 'da_huy' || key === 'huy') return 'huy';
  if (key === 'tiep_nhan' || key === 'da_nhan' || key === 'cho_xu_ly') return 'da_nhan';
  if (key === 'cho_linh_kien' || key === 'dang_xu_ly' || key === 'cho_lien_he') return 'dang_xu_ly';
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
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [imageViewerHintVisible, setImageViewerHintVisible] = useState(false);
  const [imageViewerDragY, setImageViewerDragY] = useState(0);
  const imageViewerTouchRef = useRef({ startY: 0, startX: 0, dragging: false });
  const [mobileGalleryIndex, setMobileGalleryIndex] = useState(0);
  const [relatedPage, setRelatedPage] = useState(1);

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

  useEffect(() => {
    setMobileGalleryIndex(0);
    setImageViewerVisible(false);
    setImageViewerHintVisible(false);
    setImageViewerIndex(0);
    setImageViewerDragY(0);
    imageViewerTouchRef.current = { startY: 0, startX: 0, dragging: false };
  }, [soChungTu]);

  useEffect(() => {
    if (!imageViewerVisible || !imageViewerHintVisible) return undefined;
    const timer = window.setTimeout(() => setImageViewerHintVisible(false), 2200);
    return () => window.clearTimeout(timer);
  }, [imageViewerVisible, imageViewerHintVisible]);

  useEffect(() => {
    setRelatedPage(1);
  }, [soChungTu, relatedByPhone.length]);

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
  const isDoneStage = normalizeStatusKey(data.trangThai) === 'da_tra';
  const isOverdue = !isClosed && dueDate && dueDate.isBefore(dayjs(), 'day');
  const isUrgent = !isClosed && dueDate && dueDate.diff(dayjs(), 'day') <= 3 && !isOverdue;
  const timelineItems = [...(data.statusLog || [])]
    .filter((log) => {
      const note = String(log?.note || '');
      if (note.includes('supplierLogs:')) return false;
      if (note.includes('Xóa 1 dòng lịch sử gửi / nhận NCC')) return false;
      return true;
    });
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

  const publicImages = data.attachmentsPublic || [];
  const activeMobileImage = publicImages[mobileGalleryIndex] || publicImages[0] || null;
  const relatedPageSize = 5;
  const relatedTotalPages = Math.max(1, Math.ceil(relatedByPhone.length / relatedPageSize));
  const relatedVisibleItems = relatedByPhone.slice((relatedPage - 1) * relatedPageSize, relatedPage * relatedPageSize);
  const getImageLabel = (_img, idx) => {
    return `Ảnh ${idx + 1}`;
  };
  const openMobileImageViewer = (idx) => {
    setImageViewerIndex(idx);
    setMobileGalleryIndex(idx);
    setImageViewerVisible(true);
    setImageViewerHintVisible(true);
  };
  const selectMobileGalleryImage = (idx) => {
    setMobileGalleryIndex(idx);
  };
  const showNextImage = () => {
    if (publicImages.length <= 1) return;
    const nextIndex = (imageViewerIndex + 1) % publicImages.length;
    setImageViewerIndex(nextIndex);
    setMobileGalleryIndex(nextIndex);
  };
  const showPrevImage = () => {
    if (publicImages.length <= 1) return;
    const prevIndex = (imageViewerIndex - 1 + publicImages.length) % publicImages.length;
    setImageViewerIndex(prevIndex);
    setMobileGalleryIndex(prevIndex);
  };
  const openCurrentImageInNewTab = () => {
    const currentUrl = publicImages[imageViewerIndex]?.url;
    if (!currentUrl) return;
    window.open(currentUrl, '_blank', 'noopener,noreferrer');
  };
  const closeImageViewer = () => {
    setImageViewerVisible(false);
    setImageViewerDragY(0);
    imageViewerTouchRef.current = { startY: 0, startX: 0, dragging: false };
  };
  const handleViewerTouchStart = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    imageViewerTouchRef.current = {
      startY: touch.clientY,
      startX: touch.clientX,
      dragging: false,
    };
  };
  const handleViewerTouchMove = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    const deltaY = touch.clientY - imageViewerTouchRef.current.startY;
    const deltaX = Math.abs(touch.clientX - imageViewerTouchRef.current.startX);

    if (deltaY <= 0) {
      if (imageViewerTouchRef.current.dragging || imageViewerDragY !== 0) {
        setImageViewerDragY(0);
      }
      return;
    }

    if (!imageViewerTouchRef.current.dragging) {
      if (deltaY < 12 || deltaY <= deltaX) return;
      imageViewerTouchRef.current.dragging = true;
    }

    event.preventDefault();
    setImageViewerDragY(Math.min(deltaY, 220));
  };
  const handleViewerTouchEnd = () => {
    if (imageViewerDragY > 110) {
      closeImageViewer();
      return;
    }
    setImageViewerDragY(0);
    imageViewerTouchRef.current = { startY: 0, startX: 0, dragging: false };
  };

  return (
    <>
    <div className="mobile-only ntpc-mobile-page tracking-mobile" style={{ position: 'relative' }}>
      <Watermark
        content={`Nguyễn Tân PC - ${data.soChungTu}`}
        gapX={100}
        gapY={120}
        rotate={-30}
        opacity={isDark ? 0.05 : 0.07}
      />
      <PullToRefresh
        onRefresh={async () => {
          try {
            const res = await publicService.track(soChungTu);
            if (res.data.success) {
              setData(res.data.data);
              Toast.show({ content: 'Đã cập nhật trạng thái mới nhất', icon: 'success' });
            }
          } catch {
            Toast.show({ content: 'Không thể làm mới dữ liệu lúc này', icon: 'fail' });
          }
        }}
      >
        <section className="ntpc-mobile-hero tracking-hero ntpc-glass-card" style={{ margin: '0 0 16px 0' }}>
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
            style={{ borderRadius: 12, marginBottom: 16 }}
          />
        )}

        <MobileCard title={t('trackingResult.ticketInfo')} className="ntpc-mobile-card tracking-info-card ntpc-glass-card">
          <div className={styles.mobileInfoGrid}>
            <div className={styles.mobileInfoBlock}>
              <span className={styles.mobileInfoLabel}>{t('trackingResult.documentNumber')}</span>
              <div className={styles.mobileInfoValue}>{data.soChungTu}</div>
            </div>
            <div className={styles.mobileInfoBlock}>
              <span className={styles.mobileInfoLabel}>{t('trackingResult.status')}</span>
              <div className={styles.mobileInfoValue}>
                <span className={styles.mobileStatusBadge}>{statusConfig.label}</span>
              </div>
            </div>
            <div className={styles.mobileInfoBlock}>
              <span className={styles.mobileInfoLabel}>{t('trackingResult.customer')}</span>
              <div className={`${styles.mobileInfoValue} ${styles.mobileInfoValueLong}`}>{data.khachHang || '-'}</div>
            </div>
            <div className={styles.mobileInfoBlock}>
              <span className={styles.mobileInfoLabel}>{t('trackingResult.phoneLong')}</span>
              <div className={styles.mobileInfoValue}>{data.soDienThoai || '-'}</div>
            </div>
            <div className={styles.mobileInfoBlock}>
              <span className={styles.mobileInfoLabel}>{t('trackingResult.receivedDate')}</span>
              <div className={styles.mobileInfoValue}>{data.ngayNhan || '-'}</div>
            </div>
            {!isClosed ? (
              <div className={styles.mobileInfoBlock}>
                <span className={styles.mobileInfoLabel}>{t('trackingResult.dueDate')}</span>
                <div className={styles.mobileInfoValue}>
                  {data.ngayHenTraRaw === 'none' ? <span>Đang cập nhập<span className="loading-dots" /></span> : (data.ngayHenTra || '-')}
                </div>
              </div>
            ) : (
              <div className={styles.mobileInfoBlock}>
                <span className={styles.mobileInfoLabel}>{t('trackingResult.doneDate')}</span>
                <div className={styles.mobileInfoValue}>{data.ngayTra || '-'}</div>
              </div>
            )}
            {data.ghiChu && (
              <div className={`${styles.mobileInfoBlock} ${styles.mobileInfoBlockFull}`}>
                <span className={styles.mobileInfoLabel}>{t('trackingResult.note')}</span>
                <div className={`${styles.mobileInfoValue} ${styles.mobileInfoValueLong}`}>{data.ghiChu}</div>
              </div>
            )}
          </div>
        </MobileCard>

        <MobileCard title={t('trackingResult.progressTitle')} className="ntpc-mobile-card ntpc-glass-card">
          <div className={styles.mobileSectionStack}>
            <div className={styles.mobileProgressSummary}>
              <span className={styles.mobileProgressChip}>{statusConfig.label}</span>
              <span className={styles.mobileProgressMeta}>
                Bước {Math.max((currentStep >= 0 ? currentStep : 0) + 1, 1)} / {Math.max((data.steps || []).length, 1)}
              </span>
            </div>

            <div className={styles.mobileProgressRail}>
              {(data.steps || []).map((s, idx) => {
                const state = idx < currentStep ? 'done' : idx === currentStep ? 'current' : 'upcoming';
                return (
                  <div key={idx} className={`${styles.mobileProgressItem} ${styles[`mobileProgressItem${state.charAt(0).toUpperCase() + state.slice(1)}`]}`}>
                    <div className={styles.mobileProgressMarkerWrap}>
                      <span className={styles.mobileProgressMarker}>{idx + 1}</span>
                      {idx < (data.steps || []).length - 1 && <span className={styles.mobileProgressLine} />}
                    </div>
                    <div className={styles.mobileProgressContent}>
                      <div className={styles.mobileProgressTitleRow}>
                        <b className={styles.mobileProgressTitle}>{s.label}</b>
                        {idx === currentStep && <span className={styles.mobileProgressCurrentBadge}>Hiện tại</span>}
                      </div>
                      {!!s.date && <div className={styles.mobileProgressDate}>{s.date}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {data.doiTra && (
            <div className="ntpc-mobile-success" style={{ borderRadius: 12, marginTop: 12 }}>
              {data.doiTra.type === 'doi_hang'
                ? t('trackingResult.exchangeDone', { name: data.doiTra.tenHangMoi || '-', serial: data.doiTra.soSeriMoi || '-' })
                : t('trackingResult.returnDone', { reason: data.doiTra.reason || data.doiTra.note || '-' })}
            </div>
          )}
        </MobileCard>

        {timelineItems.length > 0 && (
          <MobileCard title={t('trackingResult.detailProgress')} className="ntpc-mobile-card ntpc-glass-card">
            <div className={styles.mobileEventIntro}>
              <span className={styles.mobileEventIntroTitle}>Hành trình xử lý từ lúc tiếp nhận đến hoàn tất</span>
              <span className={styles.mobileEventIntroMeta}>{timelineItems.length} cập nhật • Cũ nhất trước</span>
            </div>
            <div className={styles.mobileEventList}>
              {timelineItems.map((log, i) => (
                <div className={styles.mobileEventItem} key={`${log.action}-${log.time}-${i}`}>
                  <div className={styles.mobileEventRail}>
                    <span className={`${styles.mobileEventDot} ${i === 0 ? styles.mobileEventDotStart : ''} ${i === timelineItems.length - 1 ? styles.mobileEventDotEnd : ''}`}>{i + 1}</span>
                    {i < timelineItems.length - 1 && <span className={styles.mobileEventLine} />}
                  </div>

                  <div className={`${styles.mobileEventCard} ${i === 0 ? styles.mobileEventCardStart : ''} ${i === timelineItems.length - 1 && isDoneStage ? styles.mobileEventCardEnd : ''}`}>
                    <div className={styles.mobileEventHeader}>
                      <div className={styles.mobileEventTitleRow}>
                        <b className={styles.mobileEventTitle}>{log.action}</b>
                        {i === 0 && <span className={styles.mobileEventBadgeStart}>Bắt đầu</span>}
                        {i === timelineItems.length - 1 && isDoneStage && <span className={styles.mobileEventBadgeEnd}>Hoàn tất</span>}
                      </div>
                      <span className={styles.mobileEventTime}>{log.time}</span>
                    </div>
                    {log.note && (
                      <div className={styles.mobileEventBody}>
                        {renderHistoryDetail(normalizeHistoryNote(log.note))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </MobileCard>
        )}

        {relatedByPhone.length > 0 && (
          <MobileCard className="ntpc-mobile-card ntpc-glass-card">
            <MobileCollapse defaultActiveKey={[]}>
              <MobileCollapse.Panel key="related" title="Chứng từ khác cùng số điện thoại">
                <div className={styles.mobileRelatedList}>
                  {relatedVisibleItems.map((item) => (
                    <button
                      key={item.soChungTu}
                      type="button"
                      className={styles.mobileRelatedCard}
                      onClick={() => navigate(`/tra-cuu/${item.soChungTu}`)}
                    >
                      <div className={styles.mobileRelatedTop}>
                        <span className={styles.mobileRelatedCode}>{item.soChungTu}</span>
                        <MobileTag round color={mobileStatusColor(item.trangThai)}>
                          {formatStatus(item.trangThai)}
                        </MobileTag>
                      </div>
                      <div className={styles.mobileRelatedProduct}>{normalizeProductName(item.tenHang) || '-'}</div>
                      <div className={styles.mobileRelatedMeta}>
                        <span>Nhận: {item.ngayNhan || '-'}</span>
                        <span>Hẹn trả: {item.ngayHenTra || '-'}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {relatedTotalPages > 1 && (
                  <div className={styles.mobileRelatedPagination}>
                    <button
                      type="button"
                      className={styles.mobileRelatedPageButton}
                      onClick={() => setRelatedPage((p) => Math.max(1, p - 1))}
                      disabled={relatedPage <= 1}
                    >
                      Trước
                    </button>
                    <span className={styles.mobileRelatedPageInfo}>Trang {relatedPage} / {relatedTotalPages}</span>
                    <button
                      type="button"
                      className={styles.mobileRelatedPageButton}
                      onClick={() => setRelatedPage((p) => Math.min(relatedTotalPages, p + 1))}
                      disabled={relatedPage >= relatedTotalPages}
                    >
                      Sau
                    </button>
                  </div>
                )}
              </MobileCollapse.Panel>
            </MobileCollapse>
          </MobileCard>
        )}

        <MobileCard title={t('trackingResult.productInfo')} className="ntpc-mobile-card tracking-info-card ntpc-glass-card">
          <div className={styles.mobileInfoGrid}>
            <div className={`${styles.mobileInfoBlock} ${styles.mobileInfoBlockFull}`}>
              <span className={styles.mobileInfoLabel}>{t('trackingResult.productName')}</span>
              <div className={`${styles.mobileInfoValue} ${styles.mobileInfoValueLong}`}>{data.tenHang || '-'}</div>
            </div>
            <div className={styles.mobileInfoBlock}>
              <span className={styles.mobileInfoLabel}>{t('trackingResult.serial')}</span>
              <div className={styles.mobileInfoValue}>{data.soSeri || '-'}</div>
            </div>
            <div className={styles.mobileInfoBlock}>
              <span className={styles.mobileInfoLabel}>{t('trackingResult.warranty')}</span>
              <div className={styles.mobileInfoValue}>{data.baoHanh || '-'}</div>
            </div>
            <div className={styles.mobileInfoBlock}>
              <span className={styles.mobileInfoLabel}>{t('trackingResult.purchaseDate')}</span>
              <div className={styles.mobileInfoValue}>{data.ngayMua || '-'}</div>
            </div>
            <div className={`${styles.mobileInfoBlock} ${styles.mobileInfoBlockFull}`}>
              <span className={styles.mobileInfoLabel}>{t('trackingResult.receivedIssue')}</span>
              <div className={`${styles.mobileInfoValue} ${styles.mobileInfoValueLong}`}>{data.loiLucNhan || '-'}</div>
            </div>
            <div className={`${styles.mobileInfoBlock} ${styles.mobileInfoBlockFull}`}>
              <span className={styles.mobileInfoLabel}>{t('trackingResult.accessories')}</span>
              <div className={`${styles.mobileInfoValue} ${styles.mobileInfoValueLong}`}>{data.phuKien || '-'}</div>
            </div>
          </div>
        </MobileCard>

        {publicImages.length > 0 && (
          <MobileCard title={t('trackingResult.viewImages')} className="ntpc-mobile-card ntpc-glass-card">
            <div className={styles.mobileGalleryShell}>
              <div className={styles.mobileGalleryIntro}>Chạm ảnh lớn hoặc nút bên dưới để xem toàn màn hình</div>

              {activeMobileImage && (
                <button
                  type="button"
                  className={styles.mobileGalleryHero}
                  onClick={() => openMobileImageViewer(mobileGalleryIndex)}
                  aria-label={`Mở ${getImageLabel(activeMobileImage, mobileGalleryIndex)}`}
                >
                  <img
                    src={activeMobileImage.url}
                    alt={activeMobileImage.name || `Ảnh ${mobileGalleryIndex + 1}`}
                    className={styles.mobileGalleryHeroImage}
                  />
                  <div className={styles.mobileGalleryHeroTop}>
                    <span className={styles.mobileGalleryBadge}>{publicImages.length} ảnh</span>
                    <span className={styles.mobileGalleryHeroIndex}>Ảnh {mobileGalleryIndex + 1} / {publicImages.length}</span>
                  </div>
                  <div className={styles.mobileGalleryHeroBottom} />
                </button>
              )}

              <div className={styles.mobileGalleryThumbStrip}>
                {publicImages.map((img, idx) => (
                  <button
                    key={img.id || img.url}
                    type="button"
                    className={`${styles.mobileGalleryThumb} ${idx === mobileGalleryIndex ? styles.mobileGalleryThumbActive : ''}`}
                    onClick={() => selectMobileGalleryImage(idx)}
                    aria-label={`Chọn ${getImageLabel(img, idx)}`}
                  >
                    <img
                      src={img.url}
                      alt={img.name || `Ảnh ${idx + 1}`}
                      className={styles.mobileGalleryThumbImage}
                    />
                    <span className={styles.mobileGalleryThumbLabel}>Ảnh {idx + 1}</span>
                  </button>
                ))}
              </div>
            </div>

            <Popup
              visible={imageViewerVisible}
              onMaskClick={closeImageViewer}
              bodyStyle={{
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                minHeight: '88vh',
                background: '#0b0b0c',
                paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
                transform: imageViewerDragY ? `translateY(${imageViewerDragY}px)` : 'translateY(0)',
                transition: imageViewerDragY ? 'none' : 'transform 0.2s ease',
              }}
            >
              <div
                className={styles.mobileOneHandViewer}
                onTouchStart={handleViewerTouchStart}
                onTouchMove={handleViewerTouchMove}
                onTouchEnd={handleViewerTouchEnd}
                onTouchCancel={handleViewerTouchEnd}
              >
                <div className={styles.mobileOneHandViewerHandleWrap}>
                  <div className={styles.mobileOneHandViewerHandle} />
                </div>

                <div className={styles.mobileOneHandViewerTopInfo}>
                  <span className={styles.mobileOneHandViewerCounter}>{imageViewerIndex + 1} / {publicImages.length}</span>
                  {imageViewerHintVisible && (
                    <span className={styles.mobileOneHandViewerHint}>Vuốt thumbnail hoặc dùng nút dưới để đổi ảnh</span>
                  )}
                </div>

                <div className={styles.mobileOneHandViewerStage}>
                  {publicImages[imageViewerIndex] && (
                    <img
                      src={publicImages[imageViewerIndex].url}
                      alt={publicImages[imageViewerIndex].name || `Ảnh ${imageViewerIndex + 1}`}
                      className={styles.mobileOneHandViewerImage}
                    />
                  )}
                </div>

                <div className={styles.mobileOneHandViewerMeta}>
                  <div className={styles.mobileOneHandViewerTitle}>{getImageLabel(publicImages[imageViewerIndex], imageViewerIndex)}</div>
                  <div className={styles.mobileOneHandViewerSubtitle}>Ảnh đính kèm phiếu {data.soChungTu}</div>
                </div>

                <div className={styles.mobileOneHandViewerThumbStrip}>
                  {publicImages.map((img, idx) => (
                    <button
                      key={img.id || img.url}
                      type="button"
                      className={`${styles.mobileOneHandViewerThumb} ${idx === imageViewerIndex ? styles.mobileOneHandViewerThumbActive : ''}`}
                      onClick={() => {
                        setImageViewerIndex(idx);
                        setMobileGalleryIndex(idx);
                      }}
                      aria-label={`Xem ${getImageLabel(img, idx)}`}
                    >
                      <img src={img.url} alt={img.name || `Ảnh ${idx + 1}`} className={styles.mobileOneHandViewerThumbImage} />
                    </button>
                  ))}
                </div>

                <div className={styles.mobileOneHandViewerActionBar}>
                  <button type="button" className={styles.mobileOneHandViewerAction} onClick={showPrevImage}>
                    Ảnh trước
                  </button>
                  <button type="button" className={styles.mobileOneHandViewerAction} onClick={showNextImage}>
                    Ảnh sau
                  </button>
                  <button type="button" className={styles.mobileOneHandViewerActionPrimary} onClick={openCurrentImageInNewTab}>
                    Mở ảnh riêng
                  </button>
                  <button type="button" className={styles.mobileOneHandViewerActionClose} onClick={() => setImageViewerVisible(false)}>
                    Đóng
                  </button>
                </div>
              </div>
            </Popup>
          </MobileCard>
        )}

        {data.doiTra && (
          <MobileCard title={t('trackingResult.exchangeReturn')} className="ntpc-mobile-card ntpc-glass-card">
            <div className={styles.mobileExchangeShell}>
              <div className={styles.mobileExchangeTopRow}>
                <div className={styles.mobileExchangeTypeWrap}>
                  <span className={styles.mobileExchangeTypeLabel}>{t('trackingResult.handlingType')}</span>
                  <span className={`${styles.mobileExchangeTypeBadge} ${data.doiTra.type === 'doi_hang' ? styles.mobileExchangeTypeBadgeExchange : styles.mobileExchangeTypeBadgeReturn}`}>
                    <SwapOutlined />
                    {data.doiTra.type === 'doi_hang' ? t('trackingResult.exchange') : t('trackingResult.return')}
                  </span>
                </div>
                <div className={styles.mobileExchangeTimeWrap}>
                  <span className={styles.mobileExchangeTimeLabel}>{t('trackingResult.time')}</span>
                  <span className={styles.mobileExchangeTimeValue}>{data.doiTra.at || '-'}</span>
                </div>
              </div>

              <div className={styles.mobileExchangeFlow}>
                <div className={styles.mobileExchangeFlowCard}>
                  <span className={styles.mobileExchangeFlowEyebrow}>Sản phẩm cũ</span>
                  <div className={styles.mobileExchangeProductName}>{data.doiTra.tenHangCu || '-'}</div>
                  <div className={styles.mobileExchangeSerialRow}>
                    <span className={styles.mobileExchangeSerialLabel}>{t('trackingResult.oldSerial')}</span>
                    <span className={styles.mobileExchangeSerialValue}>{data.doiTra.soSeriCu || '-'}</span>
                  </div>
                </div>

                <div className={styles.mobileExchangeArrow} aria-hidden="true">
                  <SwapOutlined />
                </div>

                {data.doiTra.type === 'doi_hang' ? (
                  <div className={`${styles.mobileExchangeFlowCard} ${styles.mobileExchangeFlowCardAccent} ${styles.mobileExchangeFlowCardExchange}`}>
                    <span className={styles.mobileExchangeFlowEyebrow}>Sản phẩm đổi sang</span>
                    <div className={styles.mobileExchangeProductName}>{data.doiTra.tenHangMoi || '-'}</div>
                    <div className={styles.mobileExchangeSerialRow}>
                      <span className={styles.mobileExchangeSerialLabel}>{t('trackingResult.newSerial')}</span>
                      <span className={styles.mobileExchangeSerialValue}>{data.doiTra.soSeriMoi || '-'}</span>
                    </div>
                  </div>
                ) : (
                  <div className={`${styles.mobileExchangeFlowCard} ${styles.mobileExchangeFlowCardAccent} ${styles.mobileExchangeFlowCardReturn}`}>
                    <span className={styles.mobileExchangeFlowEyebrow}>{t('trackingResult.returnReason')}</span>
                    <div className={styles.mobileExchangeReasonText}>{data.doiTra.reason || '-'}</div>
                  </div>
                )}
              </div>

              {data.doiTra.note && (
                <div className={styles.mobileExchangeNoteCard}>
                  <span className={styles.mobileExchangeNoteLabel}>{t('trackingResult.note')}</span>
                  <div className={styles.mobileExchangeNoteValue}>{data.doiTra.note}</div>
                </div>
              )}
            </div>
          </MobileCard>
        )}

        <MobileCard title={t('trackingResult.policyTitle')} className="ntpc-mobile-card ntpc-glass-card">
          <div className={styles.mobilePolicyList}>
            <div className={styles.mobilePolicyItem}>
              <span className={styles.mobilePolicyIcon}>•</span>
              <span className={styles.mobilePolicyText}>{t('trackingResult.policyDelivery')}</span>
            </div>
            <div className={styles.mobilePolicyItem}>
              <span className={styles.mobilePolicyIcon}>•</span>
              <span className={styles.mobilePolicyText}>{t('trackingResult.policyStorage')}</span>
            </div>
          </div>
          <a
            href={support.policyUrl}
            target="_blank"
            rel="noreferrer"
            className={styles.mobilePolicyLinkButton}
          >
            {t('trackingResult.policyLinkText')}
          </a>
        </MobileCard>

        <MobileCard title={t('trackingResult.supportContact')} className="ntpc-mobile-card ntpc-glass-card" style={{ marginBottom: 20 }}>
          <div className={styles.mobileSupportCard}>
            <div className={styles.mobileSupportHeader}>
              <b className={styles.mobileSupportCompany}>{support.company || t('trackingResult.companyFallback')}</b>
              <span className={styles.mobileSupportAddress}>{support.address}</span>
            </div>

            <div className={styles.mobileSupportActions}>
              <button
                type="button"
                className={styles.mobileSupportPrimaryAction}
                onClick={() => window.open('tel:0937632000')}
              >
                Gọi kỹ thuật - bảo hành
                <span className={styles.mobileSupportActionSub}>0937 63 2000</span>
              </button>

              <div className={styles.mobileSupportSecondaryGrid}>
                <button
                  type="button"
                  className={styles.mobileSupportSecondaryAction}
                  onClick={() => window.open('tel:0903602240')}
                >
                  Hotline
                  <span className={styles.mobileSupportActionSub}>0903 602 240</span>
                </button>
                <button
                  type="button"
                  className={styles.mobileSupportSecondaryAction}
                  onClick={() => window.open('https://maps.app.goo.gl/Nx6WgejPbu1YJGWR7', '_blank')}
                >
                  Bản đồ
                  <span className={styles.mobileSupportActionSub}>Mở Google Maps</span>
                </button>
              </div>
            </div>
          </div>
        </MobileCard>
      </PullToRefresh>

      <div className="ntpc-mobile-actions">
        <MobileButton block onClick={handleCopyLink} style={{ borderRadius: 10 }}>{t('trackingResult.copyLink')}</MobileButton>
        <MobileButton block onClick={() => navigate('/tra-cuu')} style={{ borderRadius: 10 }}>{t('trackingResult.searchAgain')}</MobileButton>
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
                  <div>
                    <Text strong>
                      {isClosed
                        ? (data.ngayTra || '-')
                        : (data.ngayHenTraRaw === 'none'
                            ? <span>Đang cập nhập<span className="loading-dots" /></span>
                            : (data.ngayHenTra || '-'))}
                    </Text>
                  </div>
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
          <Card 
            title={t('trackingResult.progressTitle')} 
            style={{ ...cardStyle, marginBottom: 16 }}
            styles={{ body: { paddingTop: 28, paddingBottom: 20 } }}
          >
            <Steps
              className="tracuu-progress-steps"
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
                      {log.note && <div style={{ marginTop: 6, fontSize: 13, color: isDark ? '#b8b8b8' : '#4b5563', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{renderHistoryDetail(normalizeHistoryNote(log.note))}</div>}
                    </div>
                  ),
                }))}
              />
            </Card>
          )}

          {relatedByPhone.length > 0 && (
            <Collapse
              style={{ marginBottom: 16 }}
              defaultActiveKey={[]}
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
              {!isClosed && (
                <Descriptions.Item label={t('trackingResult.dueDate')}>
                  {data.ngayHenTraRaw === 'none'
                    ? <span>Đang cập nhập<span className="loading-dots" /></span>
                    : (data.ngayHenTra || '-')}
                </Descriptions.Item>
              )}
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
              <div className={styles.desktopExchangeShell}>
                <div className={styles.desktopExchangeHeader}>
                  <div className={styles.desktopExchangeTypeWrap}>
                    <span className={styles.desktopExchangeMetaLabel}>{t('trackingResult.handlingType')}</span>
                    <span className={`${styles.desktopExchangeTypeBadge} ${data.doiTra.type === 'doi_hang' ? styles.desktopExchangeTypeBadgeExchange : styles.desktopExchangeTypeBadgeReturn}`}>
                      <SwapOutlined />
                      {data.doiTra.type === 'doi_hang' ? t('trackingResult.exchange') : t('trackingResult.return')}
                    </span>
                  </div>
                  <div className={styles.desktopExchangeTimeWrap}>
                    <span className={styles.desktopExchangeMetaLabel}>{t('trackingResult.time')}</span>
                    <span className={styles.desktopExchangeTimeValue}>{data.doiTra.at || '-'}</span>
                  </div>
                </div>

                <div className={styles.desktopExchangeFlow}>
                  <div className={styles.desktopExchangeCard}>
                    <span className={styles.desktopExchangeCardLabel}>Sản phẩm cũ</span>
                    <div className={styles.desktopExchangeProduct}>{data.doiTra.tenHangCu || '-'}</div>
                    <div className={styles.desktopExchangeSerialBlock}>
                      <span className={styles.desktopExchangeSerialLabel}>{t('trackingResult.oldSerial')}</span>
                      <span className={styles.desktopExchangeSerialValue}>{data.doiTra.soSeriCu || '-'}</span>
                    </div>
                  </div>

                  <div className={styles.desktopExchangeArrow} aria-hidden="true">
                    <SwapOutlined />
                  </div>

                  {data.doiTra.type === 'doi_hang' ? (
                    <div className={`${styles.desktopExchangeCard} ${styles.desktopExchangeCardExchange}`}>
                      <span className={styles.desktopExchangeCardLabel}>Sản phẩm đổi sang</span>
                      <div className={styles.desktopExchangeProduct}>{data.doiTra.tenHangMoi || '-'}</div>
                      <div className={styles.desktopExchangeSerialBlock}>
                        <span className={styles.desktopExchangeSerialLabel}>{t('trackingResult.newSerial')}</span>
                        <span className={styles.desktopExchangeSerialValue}>{data.doiTra.soSeriMoi || '-'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className={`${styles.desktopExchangeCard} ${styles.desktopExchangeCardReturn}`}>
                      <span className={styles.desktopExchangeCardLabel}>{t('trackingResult.returnReason')}</span>
                      <div className={styles.desktopExchangeReason}>{data.doiTra.reason || '-'}</div>
                    </div>
                  )}
                </div>

                {data.doiTra.note && (
                  <div className={styles.desktopExchangeNoteCard}>
                    <span className={styles.desktopExchangeNoteLabel}>{t('trackingResult.note')}</span>
                    <div className={styles.desktopExchangeNoteValue}>{data.doiTra.note}</div>
                  </div>
                )}
              </div>
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

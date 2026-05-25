import { useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Typography, Button, Skeleton, Space, Tag, Timeline } from 'antd';
import { Button as MobileButton, Card as MobileCard, Grid as MobileGrid, List, Space as MobileSpace, Tag as MobileTag } from 'antd-mobile';
import { SyncOutlined, CheckCircleOutlined, ClockCircleOutlined, AlertOutlined, StarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { nhanVienService, statsService, warrantyService } from '../../services/warrantyService';
import { STATUS } from '../../constants/statusConfig';
import { getUrgency } from '../../utils/urgency';
import { formatDate, getWarrantyDueDate, shouldShowDueDate } from '../../utils/dateHelpers';
import { buildInternalHistoryTimeline } from '../../utils/historyTimeline';
import { normalizeHistoryNote } from '../../utils/historyDisplay';
import { useIsMobile } from '../../hooks/useIsMobile';
import StatusTag from '../../components/warranty/StatusTag';
import WarrantyDetail from '../../components/warranty/WarrantyDetail';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

function priorityRank(w) {
  if (w.uuTien) return 0;
  const u = getUrgency(w);
  if (u === 'overdue') return 1;
  const dueDate = parseWarrantyDate(getWarrantyDueDate(w));
  if (dueDate && dueDate.isSame(dayjs(), 'day')) return 2;
  return 3;
}

function parseWarrantyDate(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmy) {
      const [, day, month, year] = dmy;
      const parsed = dayjs(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      return parsed.isValid() ? parsed : null;
    }
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
}

function isOpenWarranty(warranty) {
  return warranty.trangThai !== 'da_tra' && warranty.trangThai !== 'huy';
}

function mapHistoryAction(action, t) {
  return t(`adminDashboard.historyAction.${action}`, { defaultValue: action });
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState(null);
  const [warrantyRows, setWarrantyRows] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const fetchDashboard = async (mounted = true, showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [sumRes, listRes, staffRes] = await Promise.all([
        statsService.summary(),
        warrantyService.getList({ page: 1, limit: 1000, sortBy: 'updatedAt', sortOrder: 'desc' }),
        nhanVienService.getList(),
      ]);

      if (!mounted) return;
      if (sumRes.data.success) setSummary(sumRes.data.data);
      if (listRes.data.success) setWarrantyRows(listRes.data.data.rows || []);
      if (staffRes.data.success) setStaffList(staffRes.data.data || []);
    } finally {
      if (mounted && showLoading) setLoading(false);
    }
  };

  const openDetail = (id) => {
    setDetailId(id);
    setDetailOpen(true);
  };

  const getStaffName = (code) => {
    if (!code) return 'system';
    const staff = staffList.find((item) => item.maNV === code);
    return staff?.tenNV || code;
  };

  useEffect(() => {
    let mounted = true;

    const run = () => fetchDashboard(mounted);

    run();
    const timer = setInterval(run, 60000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const insights = useMemo(() => {
    const active = warrantyRows.filter(w => !w.deletedAt);

    const dueToday = active.filter(w => {
      const dueDate = parseWarrantyDate(getWarrantyDueDate(w));
      return dueDate && dueDate.isSame(dayjs(), 'day') && isOpenWarranty(w);
    });
    const overdue = active.filter(w => {
      const dueDate = parseWarrantyDate(getWarrantyDueDate(w));
      return dueDate && dueDate.isBefore(dayjs(), 'day') && isOpenWarranty(w);
    });
    const priorityOpen = active.filter(w => Boolean(w.uuTien) && isOpenWarranty(w));

    const urgentBase = active.filter(w => {
      if (!isOpenWarranty(w)) return false;
      const u = getUrgency(w);
      const dueDate = parseWarrantyDate(getWarrantyDueDate(w));
      return w.uuTien || u === 'overdue' || u === 'urgent' || (dueDate && dueDate.isSame(dayjs(), 'day'));
    });

    const urgent = [...urgentBase]
      .sort((a, b) => {
        const rankA = priorityRank(a);
        const rankB = priorityRank(b);
        if (rankA !== rankB) return rankA - rankB;
        const dueA = parseWarrantyDate(getWarrantyDueDate(a)) || dayjs('9999-12-31');
        const dueB = parseWarrantyDate(getWarrantyDueDate(b)) || dayjs('9999-12-31');
        return dueA.valueOf() - dueB.valueOf();
      })
      .slice(0, 20);

    const historyEvents = active.flatMap(w => buildInternalHistoryTimeline(w.history || [], w));

    historyEvents.sort((a, b) => dayjs(b.at).valueOf() - dayjs(a.at).valueOf());

    return { dueToday, overdue, priorityOpen, urgent, latestEvents: historyEvents.slice(0, 10) };
  }, [warrantyRows]);

  const columns = [
    {
      title: t('trackingResult.documentNumber'),
      dataIndex: 'soChungTu',
      key: 'soChungTu',
      width: 140,
      render: (t, r) => <Typography.Link onClick={() => openDetail(r.id)}>{t}</Typography.Link>,
    },
    { title: t('field.khachHang'), dataIndex: 'khachHang', key: 'khachHang', width: 140, ellipsis: true },
    {
      title: t('field.tenHang'),
      dataIndex: 'tenHang',
      key: 'tenHang',
      ellipsis: { showTitle: false },
      render: (value) => (
        <Typography.Text title={value} style={{ whiteSpace: 'normal' }}>
          {value || '-'}
        </Typography.Text>
      ),
    },
    { title: t('field.henTra'), dataIndex: 'ngayHenTra', key: 'ngayHenTra', width: 110, render: (_, r) => shouldShowDueDate(r) ? formatDate(getWarrantyDueDate(r)) : '-' },
    { title: t('table.trangThai'), dataIndex: 'trangThai', key: 'trangThai', width: 120, render: s => <StatusTag status={s} /> },
    { title: t('notification.priority'), dataIndex: 'uuTien', key: 'uuTien', width: 90, render: (v, r) => (v && isOpenWarranty(r) ? <Tag color="red" icon={<StarOutlined />}>{t('adminDashboard.priority')}</Tag> : <Tag>---</Tag>) },
  ];

  if (loading) {
    return (
      <Row gutter={[16, 16]}>
        {[1, 2, 3, 4, 5].map(i => (
          <Col xs={24} sm={12} lg={8} key={i}>
            <Card><Skeleton active /></Card>
          </Col>
        ))}
      </Row>
    );
  }

  const s = summary || { daTraHomNay: 0, dangXuLy: 0 };

  return (
    <>
    {isMobile && <div className="mobile-only admin-mobile-page">
      <div className="admin-mobile-title">
        <h1>{t('adminDashboard.title')}</h1>
        <MobileButton size="small" onClick={() => navigate('/admin/phieu')}>{t('adminDashboard.openTicket')}</MobileButton>
      </div>

      <MobileGrid columns={2} gap={8}>
        <MobileGrid.Item><div className="admin-mobile-kpi warn"><span>{t('adminDashboard.dueToday')}</span><b>{insights.dueToday.length}</b></div></MobileGrid.Item>
        <MobileGrid.Item><div className="admin-mobile-kpi danger"><span>{t('adminDashboard.overdue')}</span><b>{insights.overdue.length}</b></div></MobileGrid.Item>
        <MobileGrid.Item><div className="admin-mobile-kpi danger"><span>{t('adminDashboard.priorityOpen')}</span><b>{insights.priorityOpen.length}</b></div></MobileGrid.Item>
        <MobileGrid.Item><div className="admin-mobile-kpi success"><span>{t('adminDashboard.doneToday')}</span><b>{s.daTraHomNay}</b></div></MobileGrid.Item>
        <MobileGrid.Item><div className="admin-mobile-kpi"><span>{t('adminDashboard.processing')}</span><b>{s.dangXuLy}</b></div></MobileGrid.Item>
      </MobileGrid>

      <MobileCard title={t('adminDashboard.quickNav')} className="admin-mobile-card">
        <MobileSpace direction="vertical" block style={{ '--gap': '8px' }}>
          <MobileButton block onClick={() => navigate('/admin/phieu?dueType=today')}>{t('adminDashboard.viewDueToday')}</MobileButton>
          <MobileButton block color="danger" onClick={() => navigate('/admin/phieu?dueType=overdue')}>{t('adminDashboard.viewOverdue')}</MobileButton>
          <MobileButton block color="primary" onClick={() => navigate('/admin/phieu?uuTien=1')}>{t('adminDashboard.viewPriority')}</MobileButton>
        </MobileSpace>
      </MobileCard>

      <MobileCard title={t('adminDashboard.urgentTitle')} className="admin-mobile-card">
        {insights.urgent.length === 0 ? (
          <div className="admin-mobile-empty">{t('adminDashboard.noUrgent')}</div>
        ) : (
          <List>
            {insights.urgent.map(w => (
              <List.Item
                key={w.id}
                clickable
                onClick={() => openDetail(w.id)}
                title={<span className="admin-mobile-code">{w.soChungTu}</span>}
                description={`${w.khachHang || '-'} · ${w.tenHang || '-'}`}
                extra={shouldShowDueDate(w) ? formatDate(getWarrantyDueDate(w)) : '-'}
              >
                <MobileSpace wrap>
                  <MobileTag color={w.uuTien ? 'danger' : getUrgency(w) === 'overdue' ? 'danger' : 'warning'}>
                    {w.uuTien ? t('adminDashboard.priority') : getUrgency(w) === 'overdue' ? t('adminDashboard.overdue') : t('adminDashboard.nearDue')}
                  </MobileTag>
                  <span>{STATUS[w.trangThai]?.label || w.trangThai}</span>
                </MobileSpace>
              </List.Item>
            ))}
          </List>
        )}
      </MobileCard>

      <MobileCard title={t('adminDashboard.latestHistory')} className="admin-mobile-card">
        <div className="admin-mobile-history">
          {insights.latestEvents.map((ev, idx) => {
            const note = normalizeHistoryNote(ev.note);
            const updateDetail = ev.action === 'update' ? formatUpdateChanges(ev.changes) : '';
            const detail = updateDetail || note;
            return (
              <button key={`${ev.id}-${ev.at}-${ev.action}-${idx}`} type="button" onClick={() => openDetail(ev.id)}>
                <b>{mapHistoryAction(ev.action, t)}</b>
                <span>{ev.soChungTu} · {ev.khachHang || t('adminDashboard.unknownCustomer')}</span>
                <small>{formatDate(ev.at, 'DD/MM/YYYY - HH:mm')} · {getStaffName(ev.by)}</small>
                {detail ? <em style={{ whiteSpace: 'pre-line' }}>{detail}</em> : null}
              </button>
            );
          })}
        </div>
      </MobileCard>
    </div>}

    {!isMobile && <div className="desktop-only">
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{t('adminDashboard.title')}</Title>
        <Button onClick={() => navigate('/admin/phieu')}>{t('adminDashboard.openTicketList')}</Button>
      </Space>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={5}>
          <Card><Statistic title={t('adminDashboard.dueToday')} value={insights.dueToday.length} prefix={<ClockCircleOutlined />} valueStyle={{ color: insights.dueToday.length > 0 ? '#faad14' : undefined }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <Card><Statistic title={t('adminDashboard.overdue')} value={insights.overdue.length} prefix={<AlertOutlined />} valueStyle={{ color: insights.overdue.length > 0 ? '#ff4d4f' : undefined }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <Card><Statistic title={t('adminDashboard.priorityOpen')} value={insights.priorityOpen.length} prefix={<StarOutlined />} valueStyle={{ color: insights.priorityOpen.length > 0 ? '#ff4d4f' : undefined }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <Card><Statistic title={t('adminDashboard.doneToday')} value={s.daTraHomNay} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title={t('adminDashboard.processing')}
              value={s.dangXuLy}
              prefix={<SyncOutlined />}
              valueStyle={{ color: s.dangXuLy > 0 ? '#fa8c16' : undefined }}
            />
          </Card>
        </Col>
      </Row>



      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title={t('adminDashboard.urgentTitle')}
            extra={
              <Space wrap>
                <Button size="small" onClick={() => navigate('/admin/phieu?dueType=today')}>
                  {t('adminDashboard.viewDueToday')}
                </Button>
                <Button size="small" danger onClick={() => navigate('/admin/phieu?dueType=overdue')}>
                  {t('adminDashboard.viewOverdue')}
                </Button>
                <Button size="small" type="primary" onClick={() => navigate('/admin/phieu?uuTien=1')}>
                  {t('adminDashboard.viewPriority')}
                </Button>
              </Space>
            }
          >
            {insights.urgent.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>{t('adminDashboard.noUrgent')}</div>
            ) : (
              <Table
                dataSource={insights.urgent}
                columns={columns}
                rowKey="id"
                size="small"
                tableLayout="fixed"
                pagination={false}
                onRow={(record) => ({
                  onClick: () => openDetail(record.id),
                  style: { cursor: 'pointer' },
                })}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={t('adminDashboard.latestHistory')} extra={<Button size="small" onClick={() => navigate('/admin/phieu')}>{t('adminDashboard.openTicket')}</Button>}>
            <Timeline
              items={insights.latestEvents.map((ev, idx) => {
                const detail = normalizeHistoryNote(ev.detail || ev.note || '');
                return {
                  color: ev.color,
                  children: (
                    <div>
                      <Text strong>{ev.title || mapHistoryAction(ev.actionType || ev.action, t)}</Text>
                      <div>
                        <Typography.Link onClick={() => openDetail(ev.id)}>{ev.soChungTu}</Typography.Link>
                        <Text type="secondary"> · {ev.khachHang || t('adminDashboard.unknownCustomer')}</Text>
                      </div>
                      <div><Text type="secondary">{formatDate(ev.at, 'DD/MM/YYYY - HH:mm')} · {getStaffName(ev.by)}</Text></div>
                      {detail ? <div><Text style={{ whiteSpace: 'pre-line' }}>{detail}</Text></div> : null}
                    </div>
                  ),
                };
              })}
            />
          </Card>
        </Col>
      </Row>
    </div>}
    <WarrantyDetail
      open={detailOpen}
      onClose={() => setDetailOpen(false)}
      warrantyId={detailId}
      onRefresh={() => fetchDashboard(true, false)}
    />
    </>
  );
}



import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Popover, List, App, Tag, Button, Space, Typography, Tooltip, Drawer, Input, Segmented } from 'antd';
import { BellOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useWarranties } from '../../hooks/useWarranties';
import { getUrgency } from '../../utils/urgency';
import StatusTag from '../warranty/StatusTag';
import { formatDate, getWarrantyDueDate, shouldShowDueDate } from '../../utils/dateHelpers';
import WarrantyDetail from '../warranty/WarrantyDetail';
import dayjs from 'dayjs';

const DISMISSED_KEY = 'ntpc-dismissed-notifications';
const { Text } = Typography;

export default function NotificationBell() {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const { data } = useWarranties({ page: 1, limit: 200, sortBy: 'updatedAt', sortOrder: 'desc' });
  const seenPriorityIdsRef = useRef(new Set());
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerQuery, setDrawerQuery] = useState('');
  const [drawerFilter, setDrawerFilter] = useState('all');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
    } catch {
      return [];
    }
  });

  const openDetail = (id) => {
    setPopoverOpen(false);
    notification.destroy();
    setDetailId(id);
    setDetailOpen(true);
    dismissOne(id);
  };

  const rows = data.rows || [];

  const urgentItems = useMemo(() => rows.filter(w => {
    const u = getUrgency(w);
    return u === 'overdue' || u === 'urgent';
  }), [rows]);

  const priorityItems = useMemo(() => rows.filter(w => Boolean(w.uuTien) && w.trangThai !== 'da_tra' && w.trangThai !== 'huy'), [rows]);

  useEffect(() => {
    if (!rows.length) return;

    if (seenPriorityIdsRef.current.size === 0) {
      seenPriorityIdsRef.current = new Set(priorityItems.map(w => w.id));
      return;
    }

    const newPriorities = priorityItems.filter(w => !seenPriorityIdsRef.current.has(w.id));
    newPriorities.forEach(w => {
      const key = `priority-${w.id}`;
      notification.warning({
        key,
        message: t('notification.newPriority'),
        description: `${w.soChungTu} - ${w.khachHang || t('notification.unknownCustomer')}${w.tenHang ? ` | ${w.tenHang}` : ''}`,
        placement: 'topRight',
        duration: 6,
        onClick: () => {
          notification.destroy(key);
          openDetail(w.id);
        },
      });
    });

    seenPriorityIdsRef.current = new Set(priorityItems.map(w => w.id));
  }, [rows, priorityItems, notification, t]);

  const mergedItems = useMemo(() => {
    const m = new Map();

    priorityItems.forEach(w => {
      m.set(w.id, { ...w, __type: 'priority' });
    });

    urgentItems.forEach(w => {
      if (m.has(w.id)) {
        m.set(w.id, { ...m.get(w.id), __type: 'both' });
      } else {
        m.set(w.id, { ...w, __type: 'urgent' });
      }
    });

    return Array.from(m.values()).filter(w => !dismissedIds.includes(w.id));
  }, [priorityItems, urgentItems, dismissedIds]);

  const popoverItems = useMemo(() => mergedItems.slice(0, 6), [mergedItems]);

  const dismissOne = (id) => {
    setDismissedIds(prev => {
      const next = Array.from(new Set([...prev, id]));
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
      return next;
    });
  };

  const dismissAll = () => {
    const next = Array.from(new Set([...dismissedIds, ...mergedItems.map(w => w.id)]));
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    setDismissedIds(next);
  };

  const getUrgencyText = (urgency, diff) => (
    urgency === 'overdue'
      ? t('notification.overdueDays', { count: Math.abs(diff) })
      : t('notification.remainingDays', { count: diff })
  );

  const title = (
    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
      <Text strong>{t('notification.title')}</Text>
      {mergedItems.length > 0 && (
        <Button size="small" type="link" onClick={dismissAll}>
          {t('button.xoaTatCa')}
        </Button>
      )}
    </Space>
  );

  const renderTags = (w, urgency, dueDate, urgencyText) => (
    <Space size={4} wrap style={{ marginTop: 6 }}>
      {(w.__type === 'priority' || w.__type === 'both') && <Tag color="red">{t('notification.priority')}</Tag>}
      {(w.__type === 'urgent' || w.__type === 'both') && (
        <Tag color={urgency === 'overdue' ? 'error' : 'warning'}>{urgencyText}</Tag>
      )}
      {shouldShowDueDate(w) && (
        <Tag color="default">{t('notification.dueDate', { date: formatDate(dueDate) || '-' })}</Tag>
      )}
    </Space>
  );

  const content = (
    <div style={{ width: 420, maxWidth: 'calc(100vw - 48px)' }}>
      {mergedItems.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: '#999' }}>{t('notification.none')}</div>
      ) : (
        <>
          <div style={{ maxHeight: 'min(60vh, 520px)', overflowY: 'auto', paddingRight: 4 }}>
            <List
              size="small"
              dataSource={popoverItems}
              renderItem={w => {
                const u = getUrgency(w);
                const dueDate = getWarrantyDueDate(w);
                const diff = dueDate ? dayjs(dueDate).diff(dayjs(), 'day') : null;
                const urgencyText = getUrgencyText(u, diff);

                return (
                  <List.Item
                    style={{ padding: '8px 0', alignItems: 'flex-start' }}
                    actions={[
                      <Space key="actions" size={4}>
                        <Button
                          size="small"
                          type="link"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetail(w.id);
                          }}
                        >
                          {t('button.xem')}
                        </Button>
                        <Tooltip title={t('notification.remove')}>
                          <Button
                            size="small"
                            type="text"
                            icon={<CloseOutlined />}
                            aria-label={t('notification.remove')}
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissOne(w.id);
                            }}
                          />
                        </Tooltip>
                      </Space>,
                    ]}
                  >
                    <div style={{ minWidth: 0, width: '100%' }}>
                      <Space size={6} wrap style={{ marginBottom: 2 }}>
                        <Typography.Link strong onClick={() => openDetail(w.id)}>
                          {w.soChungTu}
                        </Typography.Link>
                        <StatusTag status={w.trangThai} />
                      </Space>

                      <div style={{ display: 'grid', gap: 1 }}>
                        <Text strong ellipsis={{ tooltip: w.khachHang }}>
                          {w.khachHang || t('notification.unknownCustomer')}
                        </Text>
                        <Text type="secondary" ellipsis={{ tooltip: w.tenHang }}>
                          {w.tenHang || t('notification.noProductName')}
                        </Text>
                      </div>

                      {renderTags(w, u, dueDate, urgencyText)}
                    </div>
                  </List.Item>
                );
              }}
            />
          </div>

          <div style={{ padding: '8px 0 0', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'center' }}>
            <Button
              type="link"
              size="small"
              onClick={() => {
                setPopoverOpen(false);
                setDrawerOpen(true);
              }}
            >
              {t('button.xemChiTiet')}
            </Button>
          </div>
        </>
      )}
    </div>
  );

  const drawerItems = useMemo(() => {
    const q = String(drawerQuery || '').trim().toLowerCase();
    return mergedItems
      .filter((w) => {
        if (drawerFilter === 'priority') return w.__type === 'priority' || w.__type === 'both';
        if (drawerFilter === 'urgent') return w.__type === 'urgent' || w.__type === 'both';
        return true;
      })
      .filter((w) => {
        if (!q) return true;
        return (
          String(w.soChungTu || '').toLowerCase().includes(q) ||
          String(w.khachHang || '').toLowerCase().includes(q) ||
          String(w.tenHang || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 200);
  }, [mergedItems, drawerQuery, drawerFilter]);

  const drawerContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '0 0 12px' }}>
        <Input.Search
          allowClear
          placeholder={t('notification.drawerSearchPlaceholder')}
          value={drawerQuery}
          onChange={(e) => setDrawerQuery(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        <Segmented
          value={drawerFilter}
          onChange={setDrawerFilter}
          options={[
            { label: t('common.tatCa'), value: 'all' },
            { label: t('notification.priority'), value: 'priority' },
            { label: t('notification.urgent'), value: 'urgent' },
          ]}
        />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
        <List
          size="small"
          dataSource={drawerItems}
          locale={{ emptyText: t('notification.emptyFiltered') }}
          renderItem={(w) => {
            const u = getUrgency(w);
            const dueDate = getWarrantyDueDate(w);
            const diff = dueDate ? dayjs(dueDate).diff(dayjs(), 'day') : null;
            const urgencyText = getUrgencyText(u, diff);

            return (
              <List.Item
                style={{ padding: '10px 0', alignItems: 'flex-start' }}
                actions={[
                  <Space key="actions" size={4}>
                    <Button
                      size="small"
                      type="link"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDrawerOpen(false);
                        openDetail(w.id);
                      }}
                    >
                      {t('button.xem')}
                    </Button>
                    <Tooltip title={t('notification.remove')}>
                      <Button
                        size="small"
                        type="text"
                        icon={<CloseOutlined />}
                        aria-label={t('notification.remove')}
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissOne(w.id);
                        }}
                      />
                    </Tooltip>
                  </Space>,
                ]}
              >
                <div style={{ minWidth: 0, width: '100%' }}>
                  <Space size={6} wrap style={{ marginBottom: 2 }}>
                    <Typography.Link
                      strong
                      onClick={() => {
                        setDrawerOpen(false);
                        openDetail(w.id);
                      }}
                    >
                      {w.soChungTu}
                    </Typography.Link>
                    <StatusTag status={w.trangThai} />
                  </Space>

                  <div style={{ display: 'grid', gap: 1 }}>
                    <Text strong ellipsis={{ tooltip: w.khachHang }}>
                      {w.khachHang || t('notification.unknownCustomer')}
                    </Text>
                    <Text type="secondary" ellipsis={{ tooltip: w.tenHang }}>
                      {w.tenHang || t('notification.noProductName')}
                    </Text>
                  </div>

                  {renderTags(w, u, dueDate, urgencyText)}
                </div>
              </List.Item>
            );
          }}
        />
      </div>

      <div style={{ paddingTop: 12, borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('common.hienThiTong', { shown: drawerItems.length, total: mergedItems.length })}
        </Text>
        {mergedItems.length > 0 && (
          <Button size="small" type="link" onClick={dismissAll}>{t('button.xoaTatCa')}</Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Popover
        content={content}
        title={title}
        trigger="click"
        placement="bottomRight"
        open={popoverOpen}
        onOpenChange={(open) => {
          setPopoverOpen(open);
          if (!open) {
            setDrawerQuery('');
            setDrawerFilter('all');
          }
        }}
      >
        <Badge count={mergedItems.length} size="small" className="admin-header-notification-badge">
          <Button
            type="text"
            className="admin-header-icon-button"
            icon={<BellOutlined />}
            aria-label={t('notification.title')}
          />
        </Badge>
      </Popover>
      <Drawer
        title={t('notification.title')}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="right"
        width={480}
        styles={{ body: { padding: 16 } }}
      >
        {drawerContent}
      </Drawer>
      <WarrantyDetail
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        warrantyId={detailId}
      />
    </>
  );
}

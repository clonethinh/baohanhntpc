import { Button, Popconfirm, Table, Tag, Tooltip, Typography } from 'antd';
import { CheckOutlined, DeleteOutlined, EditOutlined, PauseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { RichNotificationContent } from '../../../components/customer/CustomerNotifications';
import { effectiveStatusMeta, formatDateTime } from './helpers';

const { Text } = Typography;

function scheduleDisplay(t, row) {
  if (row.scheduleType !== 'range') return t('adminCustomerNotifications.manualSchedule');
  return `${formatDateTime(row.startAt)} → ${formatDateTime(row.endAt)}`;
}

export default function NotificationDesktopTable({
  t,
  data,
  loading,
  handleTableChange,
  openEdit,
  toggleStatus,
  deleteRow,
  submitting,
  rowActionId,
}) {
  return (
    <Table
      rowKey="id"
      loading={loading}
      dataSource={data.rows}
      onChange={handleTableChange}
      size="middle"
      pagination={{
        current: data.page,
        pageSize: data.limit,
        total: data.total,
        showSizeChanger: true,
        pageSizeOptions: ['10', '25', '50'],
        showTotal: (total) => `${total} thông báo`,
        size: 'small',
      }}
      columns={[
        {
          title: t('adminCustomerNotifications.notification'),
          dataIndex: 'title',
          ellipsis: true,
          render: (_, row) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text strong style={{ fontSize: 14 }}>{row.title}</Text>
                  <Tag color={row.displayType === 'popup' ? 'gold' : 'blue'} style={{ margin: 0 }}>
                    {row.displayType === 'popup' ? t('adminCustomerNotifications.popup') : t('adminCustomerNotifications.banner')}
                  </Tag>
                  {Number(row.priority || 0) > 0 && (
                    <Tag color="volcano" style={{ margin: 0 }}>{t('adminCustomerNotifications.priority')}: {row.priority}</Tag>
                  )}
                </div>
                <div style={{ maxHeight: 40, overflow: 'hidden', color: '#6b7280', fontSize: 13, marginTop: 4 }}>
                  <RichNotificationContent html={row.content} style={{ lineHeight: 1.5 }} />
                </div>
              </div>
            </div>
          ),
        },
        {
          title: t('table.trangThai'),
          width: 160,
          render: (_, row) => {
            const meta = effectiveStatusMeta(t, row);
            return <Tag color={meta.color}>{meta.label}</Tag>;
          },
        },
        {
          title: t('adminCustomerNotifications.schedule'),
          width: 220,
          render: (_, row) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280' }}>
              <ClockCircleOutlined />
              <span>{scheduleDisplay(t, row)}</span>
            </div>
          ),
        },
        {
          title: '',
          width: 120,
          align: 'right',
          render: (_, row) => (
            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
              <Tooltip title={t('button.sua')}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  aria-label={t('adminCustomerNotifications.editAria')}
                  onClick={() => openEdit(row)}
                  disabled={submitting || rowActionId === `toggle:${row.id}` || rowActionId === `delete:${row.id}`}
                />
              </Tooltip>
              <Popconfirm
                title={row.isActive ? t('adminCustomerNotifications.pauseConfirm') : t('adminCustomerNotifications.activateConfirm')}
                onConfirm={() => toggleStatus(row)}
              >
                <Tooltip title={row.isActive ? t('adminCustomerNotifications.pause') : t('adminCustomerNotifications.activate')}>
                  <Button
                    type="text"
                    size="small"
                    icon={row.isActive ? <PauseCircleOutlined /> : <CheckOutlined />}
                    aria-label={row.isActive ? t('adminCustomerNotifications.pauseAria') : t('adminCustomerNotifications.activateAria')}
                    style={{ color: row.isActive ? '#faad14' : '#52c41a' }}
                    loading={rowActionId === `toggle:${row.id}`}
                    disabled={submitting || rowActionId === `delete:${row.id}`}
                  />
                </Tooltip>
              </Popconfirm>
              <Popconfirm title={t('adminCustomerNotifications.deleteConfirm')} onConfirm={() => deleteRow(row)}>
                <Tooltip title={t('button.xoa')}>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label={t('adminCustomerNotifications.deleteAria')}
                    loading={rowActionId === `delete:${row.id}`}
                    disabled={submitting || rowActionId === `toggle:${row.id}`}
                  />
                </Tooltip>
              </Popconfirm>
            </div>
          ),
        },
      ]}
    />
  );
}

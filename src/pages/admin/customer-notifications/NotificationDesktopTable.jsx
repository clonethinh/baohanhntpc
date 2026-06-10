import { Button, Card, Popconfirm, Space, Table, Tag, Typography, Tooltip } from 'antd';
import { CheckOutlined, DeleteOutlined, EditOutlined, StopOutlined, ClockCircleOutlined, NotificationOutlined } from '@ant-design/icons';
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
    <Card styles={{ body: { padding: 12 } }}>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={data.rows}
        onChange={handleTableChange}
        pagination={{
          current: data.page,
          pageSize: data.limit,
          total: data.total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '25', '50', '100'],
          showQuickJumper: true,
        }}
        columns={[
          {
            title: t('adminCustomerNotifications.notification'),
            dataIndex: 'title',
            render: (_, row) => (
              <div style={{ display: 'grid', gap: 8, maxWidth: 560 }}>
                <Space size={8} wrap>
                  <Text strong style={{ fontSize: 15 }}>{row.title}</Text>
                  <Tag color={row.displayType === 'popup' ? 'gold' : 'blue'}>{row.displayType === 'popup' ? t('adminCustomerNotifications.popup') : t('adminCustomerNotifications.banner')}</Tag>
                  <Tag color={Number(row.priority || 0) > 0 ? 'volcano' : 'default'}>{t('adminCustomerNotifications.priority')}: {row.priority || 0}</Tag>
                </Space>
                <div style={{ maxHeight: 92, overflow: 'hidden', color: '#4b5563' }}>
                  <RichNotificationContent html={row.content} style={{ lineHeight: 1.6 }} />
                </div>
              </div>
            ),
          },
          {
            title: t('table.trangThai'),
            width: 180,
            render: (_, row) => {
              const meta = effectiveStatusMeta(t, row);
              return <Tag color={meta.color}>{meta.label}</Tag>;
            },
          },
          {
            title: t('adminCustomerNotifications.schedule'),
            width: 260,
            render: (_, row) => (
              <div style={{ display: 'grid', gap: 6 }}>
                <Space size={6}>
                  <ClockCircleOutlined style={{ color: '#6b7280' }} />
                  <Text>{scheduleDisplay(t, row)}</Text>
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {row.scheduleType === 'range' ? t('adminCustomerNotifications.rangeSchedule') : t('adminCustomerNotifications.manualSchedule')}
                </Text>
              </div>
            ),
          },
          {
            title: t('adminStaff.action'),
            width: 190,
            render: (_, row) => (
              <Space wrap>
                <Tooltip title={t('button.sua')}>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} disabled={submitting || rowActionId === `toggle:${row.id}` || rowActionId === `delete:${row.id}`}>{t('button.sua')}</Button>
                </Tooltip>
                <Popconfirm title={row.isActive ? t('adminCustomerNotifications.pauseConfirm') : t('adminCustomerNotifications.activateConfirm')} onConfirm={() => toggleStatus(row)}>
                  <Button size="small" icon={row.isActive ? <StopOutlined /> : <CheckOutlined />} danger={row.isActive} loading={rowActionId === `toggle:${row.id}`} disabled={submitting || rowActionId === `delete:${row.id}`}>
                    {row.isActive ? t('adminCustomerNotifications.pause') : t('adminCustomerNotifications.activate')}
                  </Button>
                </Popconfirm>
                <Popconfirm title={t('adminCustomerNotifications.deleteConfirm')} onConfirm={() => deleteRow(row)}>
                  <Button size="small" danger icon={<DeleteOutlined />} loading={rowActionId === `delete:${row.id}`} disabled={submitting || rowActionId === `toggle:${row.id}`}>
                    {t('button.xoa')}
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </Card>
  );
}

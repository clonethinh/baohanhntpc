import { Button, Card, Popconfirm, Space, Table, Tag, Typography } from 'antd';
import { CheckOutlined, DeleteOutlined, EditOutlined, StopOutlined } from '@ant-design/icons';
import { RichNotificationContent } from '../../../components/customer/CustomerNotifications';
import { effectiveStatusMeta, formatDateTime } from './helpers';

const { Text } = Typography;

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
              <Space direction="vertical" size={2} style={{ maxWidth: 520 }}>
                <Text strong>{row.title}</Text>
                <div style={{ maxHeight: 88, overflow: 'hidden' }}>
                  <RichNotificationContent html={row.content} style={{ lineHeight: 1.55 }} />
                </div>
              </Space>
            ),
          },
          {
            title: t('adminCustomerNotifications.displayType'),
            dataIndex: 'displayType',
            width: 120,
            render: (v) => <Tag color={v === 'popup' ? 'orange' : 'blue'}>{v === 'popup' ? t('adminCustomerNotifications.popup') : t('adminCustomerNotifications.banner')}</Tag>,
          },
          { title: t('adminCustomerNotifications.priority'), dataIndex: 'priority', width: 90 },
          {
            title: t('table.trangThai'),
            width: 170,
            render: (_, row) => {
              const meta = effectiveStatusMeta(t, row);
              return <Tag color={meta.color}>{meta.label}</Tag>;
            },
          },
          {
            title: t('adminCustomerNotifications.schedule'),
            width: 240,
            render: (_, row) => row.scheduleType === 'range'
              ? <span>{formatDateTime(row.startAt)}<br />{formatDateTime(row.endAt)}</span>
              : t('adminCustomerNotifications.manualSchedule'),
          },
          {
            title: t('adminStaff.action'),
            width: 150,
            render: (_, row) => (
              <Space>
                <Button size="small" shape="circle" icon={<EditOutlined />} onClick={() => openEdit(row)} disabled={submitting || rowActionId === `toggle:${row.id}` || rowActionId === `delete:${row.id}`} />
                <Popconfirm title={row.isActive ? t('adminCustomerNotifications.pauseConfirm') : t('adminCustomerNotifications.activateConfirm')} onConfirm={() => toggleStatus(row)}>
                  <Button size="small" shape="circle" icon={row.isActive ? <StopOutlined /> : <CheckOutlined />} danger={row.isActive} loading={rowActionId === `toggle:${row.id}`} disabled={submitting || rowActionId === `delete:${row.id}`} />
                </Popconfirm>
                <Popconfirm title={t('adminCustomerNotifications.deleteConfirm')} onConfirm={() => deleteRow(row)}>
                  <Button size="small" shape="circle" danger icon={<DeleteOutlined />} loading={rowActionId === `delete:${row.id}`} disabled={submitting || rowActionId === `toggle:${row.id}`} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </Card>
  );
}

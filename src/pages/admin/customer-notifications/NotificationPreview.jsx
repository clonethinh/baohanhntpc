import { Card, Typography, Tag, Space } from 'antd';
import { NotificationOutlined, PictureOutlined, DesktopOutlined } from '@ant-design/icons';
import { RichNotificationContent } from '../../../components/customer/CustomerNotifications';

const { Text } = Typography;

export default function NotificationPreview({ title, content, displayType, t }) {
  const previewTag = displayType === 'popup'
    ? { icon: <DesktopOutlined />, color: 'gold', label: t('adminCustomerNotifications.popup') }
    : { icon: <PictureOutlined />, color: 'blue', label: t('adminCustomerNotifications.banner') };

  return (
    <Card
      size="small"
      title={
        <Space size={8}>
          <NotificationOutlined />
          <span>{displayType === 'popup' ? t('adminCustomerNotifications.previewPopup') : t('adminCustomerNotifications.previewBanner')}</span>
        </Space>
      }
      extra={<Tag color={previewTag.color} icon={previewTag.icon}>{previewTag.label}</Tag>}
      styles={{ body: { display: 'grid', gap: 14 } }}
    >
      <div style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 12, background: 'linear-gradient(180deg, #fafcff 0%, #f5f7fb 100%)', border: '1px solid #eef2f6' }}>
        <Text strong style={{ fontSize: 16 }}>{title || t('adminCustomerNotifications.emptyPreviewTitle')}</Text>
        <RichNotificationContent html={content || ''} style={{ lineHeight: 1.7, color: '#4b5563' }} />
      </div>
    </Card>
  );
}

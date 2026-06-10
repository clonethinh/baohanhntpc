import { Card, Typography } from 'antd';
import { RichNotificationContent } from '../../../components/customer/CustomerNotifications';

const { Text } = Typography;

export default function NotificationPreview({ title, content, displayType, t }) {
  return (
    <Card size="small" title={displayType === 'popup' ? t('adminCustomerNotifications.previewPopup') : t('adminCustomerNotifications.previewBanner')}>
      <div style={{ display: 'grid', gap: 12 }}>
        <Text strong>{title || t('adminCustomerNotifications.emptyPreviewTitle')}</Text>
        <RichNotificationContent html={content || ''} style={{ lineHeight: 1.7 }} />
      </div>
    </Card>
  );
}

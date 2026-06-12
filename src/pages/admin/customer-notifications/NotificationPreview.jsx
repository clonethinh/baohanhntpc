import { Tag, Typography, Space } from 'antd';
import { NotificationOutlined, PictureOutlined, DesktopOutlined } from '@ant-design/icons';
import { RichNotificationContent } from '../../../components/customer/CustomerNotifications';

const { Text } = Typography;

export default function NotificationPreview({ title, content, displayType, t }) {
  const isPopup = displayType === 'popup';
  const previewTag = isPopup
    ? { icon: <DesktopOutlined />, color: 'gold', label: t('adminCustomerNotifications.popup') }
    : { icon: <PictureOutlined />, color: 'blue', label: t('adminCustomerNotifications.banner') };

  return (
    <div className="notif-preview-frame">
      <div className="notif-preview-head">
        <Space size={8}>
          <NotificationOutlined style={{ color: '#2563eb' }} />
          <Text strong style={{ fontSize: 14 }}>{isPopup ? t('adminCustomerNotifications.previewPopup') : t('adminCustomerNotifications.previewBanner')}</Text>
        </Space>
        <Tag color={previewTag.color} icon={previewTag.icon} style={{ margin: 0 }}>{previewTag.label}</Tag>
      </div>

      <div className="notif-preview-stage">
        <div className={isPopup ? 'notif-preview-popup' : 'notif-preview-banner'}>
          <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>
            {title || t('adminCustomerNotifications.emptyPreviewTitle')}
          </Text>
          <RichNotificationContent html={content || ''} style={{ lineHeight: 1.7, color: '#4b5563' }} />
        </div>
      </div>
    </div>
  );
}

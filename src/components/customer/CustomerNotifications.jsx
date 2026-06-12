import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Modal, Space, Typography } from 'antd';
import { Card as MobileCard, Popup, Button as MobileButton } from 'antd-mobile';
import { CloseOutlined, NotificationOutlined } from '@ant-design/icons';
import { publicService } from '../../services/warrantyService';
import { sanitizeRichText } from '../../lib/richText';

const { Title, Paragraph } = Typography;

function dismissKey(item) {
  return item ? `ntpc-dismissed-popup:${item.id}:${item.updatedAt || ''}` : '';
}

export function RichNotificationContent({ html, style }) {
  return <div className="ql-editor ntpc-rich-preview" style={style} dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }} />;
}

function notificationContent(item) {
  return <RichNotificationContent html={item.content} style={{ lineHeight: 1.6 }} />;
}

export default function CustomerNotifications({ mobile = false }) {
  const [banners, setBanners] = useState([]);
  const [popup, setPopup] = useState(null);
  const [popupOpen, setPopupOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    publicService.getCustomerNotifications()
      .then((res) => {
        if (!mounted || !res.data?.success) return;
        const data = res.data.data || {};
        const nextBanners = Array.isArray(data.banners) ? data.banners : [];
        const nextPopup = data.popup || null;
        setBanners(nextBanners);
        setPopup(nextPopup);
        if (nextPopup) {
          let dismissed = false;
          try {
            dismissed = sessionStorage.getItem(dismissKey(nextPopup)) === '1';
          } catch {}
          setPopupOpen(!dismissed);
        } else {
          setPopupOpen(false);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const closePopup = () => {
    if (popup) {
      try {
        sessionStorage.setItem(dismissKey(popup), '1');
      } catch {}
    }
    setPopupOpen(false);
  };

  const bannerNodes = useMemo(() => banners.map((item) => {
    if (mobile) {
      return (
        <MobileCard key={item.id} className="ntpc-mobile-card ntpc-glass-card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              <NotificationOutlined />
              <span>{item.title}</span>
            </div>
            <RichNotificationContent html={item.content} style={{ color: 'var(--adm-color-weak)', lineHeight: 1.55 }} />
          </div>
        </MobileCard>
      );
    }
    return (
      <Alert
        key={item.id}
        type="info"
        showIcon
        message={item.title}
        description={notificationContent(item)}
        style={{ marginBottom: 12, borderRadius: 12 }}
      />
    );
  }), [banners, mobile]);

  if (!banners.length && !popup) return null;

  if (mobile) {
    return (
      <>
        {bannerNodes}
        <Popup visible={popupOpen && !!popup} onMaskClick={closePopup} bodyStyle={{ borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16 }}>
          {popup ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{popup.title}</div>
                <MobileButton size="mini" fill="none" onClick={closePopup}><CloseOutlined /></MobileButton>
              </div>
              <RichNotificationContent html={popup.content} style={{ lineHeight: 1.6 }} />
              <MobileButton block color="primary" onClick={closePopup}>Đã hiểu</MobileButton>
            </div>
          ) : null}
        </Popup>
      </>
    );
  }

  return (
    <>
      {banners.length ? <div style={{ width: '100%', maxWidth: 1180, margin: '0 auto 12px' }}>{bannerNodes}</div> : null}
      <Modal open={popupOpen && !!popup} onCancel={closePopup} footer={null} centered width={520} destroyOnClose>
        {popup ? (
          <Card bordered={false} styles={{ body: { padding: 0 } }}>
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <Title level={4} style={{ margin: 0 }}>{popup.title}</Title>
              <Paragraph style={{ margin: 0 }}>
                <RichNotificationContent html={popup.content} style={{ lineHeight: 1.7 }} />
              </Paragraph>
              <Button type="primary" block onClick={closePopup}>Đã hiểu</Button>
            </Space>
          </Card>
        ) : null}
      </Modal>
    </>
  );
}

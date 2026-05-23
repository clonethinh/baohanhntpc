import { useState } from 'react';
import { Layout } from 'antd';
import { Popup } from 'antd-mobile';
import AppSider from './AppSider';
import AppHeader from './AppHeader';

const { Content } = Layout;

export default function AdminLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSiderOpen, setMobileSiderOpen] = useState(false);

  return (
    <Layout className="admin-shell">
      <div className="desktop-only admin-desktop-sider-shell">
        <AppSider collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>
      <Popup
        visible={mobileSiderOpen}
        onMaskClick={() => setMobileSiderOpen(false)}
        position="left"
        bodyStyle={{ width: '92vw', maxWidth: 420, height: '100vh' }}
        className="mobile-only admin-mobile-menu"
      >
        <AppSider collapsed={false} onToggle={() => setMobileSiderOpen(false)} mobile />
      </Popup>
      <Layout className="admin-main-layout">
        <AppHeader
          onHamburger={() => setMobileSiderOpen(true)}
          collapsed={collapsed}
        />
        <Content className="admin-main-content">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}

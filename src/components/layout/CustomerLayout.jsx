import { useState, useEffect } from 'react';
import { Layout, Typography, Button, Space, Tooltip } from 'antd';
import { NavBar, SafeArea, Footer as MobileFooter } from 'antd-mobile';
import {
  MoonOutlined,
  SunOutlined,
  PhoneOutlined,
  SearchOutlined,
  ClockCircleOutlined,
  SafetyCertificateOutlined,
  LeftOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { useNavigate, useLocation } from 'react-router-dom';
import FloatingZalo from '../common/FloatingZalo';

const { Header, Footer, Content } = Layout;

export default function CustomerLayout({ children }) {
  const { t } = useTranslation();
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const themeLabel = isDark ? t('common.cheDoSang') : t('common.cheDoToi');

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const queryParams = new URLSearchParams(location.search);
  const currentTab = queryParams.get('tab') || 'search';

  const showBack = location.pathname !== '/tra-cuu';
  const onBack = () => {
    navigate('/tra-cuu');
  };

  const handleTabChange = (key) => {
    navigate(`/tra-cuu?tab=${key}`);
  };

  if (isMobile) {
    return (
      <>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: isDark ? '#141414' : '#f5f5f5' }}>
        {/* Mobile top Glassmorphic NavBar */}
        <NavBar
          className="ntpc-nav-glass"
          back={showBack ? '' : (
            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate('/tra-cuu')}>
              <img src={isDark ? "/white.png" : "/logo.png"} alt="Nguyễn Tân PC" style={{ height: 42, objectFit: 'contain' }} />
            </div>
          )}
          backIcon={showBack ? <LeftOutlined style={{ fontSize: 18, color: isDark ? '#fff' : '#1f2a1d' }} /> : null}
          onBack={onBack}
          right={
            <Space size={12}>
              <Button
                type="text"
                shape="circle"
                icon={<PhoneOutlined style={{ fontSize: 17, color: isDark ? '#fff' : '#1f2a1d' }} />}
                href="tel:0903602240"
                aria-label={t('common.hotline')}
              />
              <Button
                type="text"
                shape="circle"
                icon={isDark ? <SunOutlined style={{ fontSize: 17, color: '#fff' }} /> : <MoonOutlined style={{ fontSize: 17, color: '#1f2a1d' }} />}
                onClick={toggle}
                aria-label={themeLabel}
              />
            </Space>
          }
        >
          {showBack ? (
            <span style={{ fontWeight: 700, fontSize: 16, color: isDark ? '#fff' : '#1f2a1d' }}>
              Chi tiết bảo hành
            </span>
          ) : (
            <span style={{ fontWeight: 800, fontSize: 14, color: '#1677ff', letterSpacing: '0.5px' }}>
              TRUNG TÂM BẢO HÀNH
            </span>
          )}
        </NavBar>

        {/* Content body */}
        <div style={{ flex: 1, padding: '14px 12px 0' }}>
          {children}
        </div>

        {/* Footer */}
        <MobileFooter
          label={
            <>
              <Typography.Link href="/admin" style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)' }}>
                {t('common.nhanVienDangNhap')}
              </Typography.Link>
            </>
          }
          links={[]}
          content={
            <span style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)' }}>
              {t('app.companyFooter')}
            </span>
          }
          style={{
            background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.6)',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            padding: '10px 16px',
          }}
        />
        <SafeArea position="bottom" />
      </div>
      <FloatingZalo />
    </>
  );
}

  // Desktop view
  return (
    <>
      <Layout style={{ minHeight: '100vh' }}>
      <Header className="customer-header" style={{ background: isDark ? '#1F1F1F' : '#fff', padding: '0 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div className="brand-wrap brand-left" style={{ cursor: 'pointer' }} onClick={() => navigate('/tra-cuu')}>
          <img src={isDark ? "/white.png" : "/logo.png"} alt="Nguyễn Tân PC" className="brand-logo" />
        </div>

        <div className="brand-center" aria-label="TRUNG TÂM BẢO HÀNH">
          TRUNG TÂM BẢO HÀNH
        </div>

        <Space size={6} className="brand-right">
          <Typography.Text type="secondary" className="hotline">
            {t('common.hotline')}
          </Typography.Text>

          <Tooltip title={t('common.hotline')}>
            <Button
              type="text"
              className="mobile-call"
              icon={<PhoneOutlined />}
              href="tel:0903602240"
              aria-label={t('common.hotline')}
            />
          </Tooltip>

          <Tooltip title={themeLabel}>
            <Button
              type="text"
              className="mobile-theme"
              icon={isDark ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggle}
              aria-label={themeLabel}
            />
          </Tooltip>
        </Space>
      </Header>
      <Content style={{ padding: '40px 16px', display: 'flex', justifyContent: 'center' }}>
        {children}
      </Content>
      <Footer style={{ textAlign: 'center', background: isDark ? '#141414' : '#fafafa' }}>
        <Typography.Text type="secondary">
          {t('app.companyFooter')}
        </Typography.Text>
        <br />
        <Typography.Link href="/admin" style={{ fontSize: 12 }}>
          {t('common.nhanVienDangNhap')}
        </Typography.Link>
      </Footer>
    </Layout>
    <FloatingZalo />
  </>
);
}


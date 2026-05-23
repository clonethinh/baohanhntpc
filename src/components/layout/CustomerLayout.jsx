import { Layout, Typography, Button, Space, Tooltip } from 'antd';
import { MoonOutlined, SunOutlined, PhoneOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';

const { Header, Footer, Content } = Layout;

export default function CustomerLayout({ children }) {
  const { t } = useTranslation();
  const { isDark, toggle } = useTheme();
  const themeLabel = isDark ? t('common.cheDoSang') : t('common.cheDoToi');

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header className="customer-header" style={{ background: isDark ? '#1F1F1F' : '#fff', padding: '0 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div className="brand-wrap brand-left">
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
  );
}

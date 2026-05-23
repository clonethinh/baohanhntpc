import { Button } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  PlusCircleOutlined,
  BarChartOutlined,
  SwapOutlined,
  GlobalOutlined,
  UserOutlined,
  TeamOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import { Badge, Button as MobileButton, List } from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWarranties } from '../../hooks/useWarranties';
import { getUrgency } from '../../utils/urgency';

const menuItemDefs = [
  { key: '/admin/dashboard', icon: <DashboardOutlined />, labelKey: 'menu.dashboard' },
  { key: '/admin/phieu', icon: <FileTextOutlined />, labelKey: 'menu.phieu' },
  { key: '/admin/tao-phieu', icon: <PlusCircleOutlined />, labelKey: 'menu.taoPhieu' },
  { key: '/admin/khach-hang', icon: <UserOutlined />, labelKey: 'menu.khachHang' },
  { key: '/admin/nhan-vien', icon: <TeamOutlined />, labelKey: 'menu.nhanVien' },
  { key: '/admin/nha-cung-cap', icon: <ShopOutlined />, labelKey: 'menu.nhaCungCap' },
  { key: '/admin/thong-ke', icon: <BarChartOutlined />, labelKey: 'menu.thongKe' },
  { key: '/admin/import-export', icon: <SwapOutlined />, labelKey: 'menu.importExport' },
  { key: '/tra-cuu', icon: <GlobalOutlined />, labelKey: 'menu.traCuu' },
];

export default function AppSider({ collapsed, onToggle, mobile = false }) {
  const { t } = useTranslation(['nav', 'ui']);
  const navigate = useNavigate();
  const location = useLocation();
  const { data } = useWarranties({ page: 1, limit: 1 });
  const menuItems = menuItemDefs.map((item) => ({ ...item, label: t(item.labelKey) }));

  const overdueCount = data.rows?.filter((w) => {
    const u = getUrgency(w);
    return u === 'overdue' || u === 'urgent';
  }).length || 0;

  const go = (key) => {
    if (key === '/tra-cuu') window.open('/tra-cuu', '_blank');
    else navigate(key);
    if (mobile) onToggle?.();
  };

  const renderBadge = (active) => (
    <Badge className={`ntpc-nav-badge ${active ? 'is-active' : ''}`} content={overdueCount} />
  );

  if (mobile) {
    return (
      <div className="admin-mobile-sider">
        <div className="admin-mobile-brand">
          <div className="admin-mobile-brand-mark">NTPC</div>
          <div>
            <strong>{t('ui:app.brandShort')}</strong>
            <span>{t('ui:app.brandCompany')}</span>
          </div>
        </div>
        <List className="admin-mobile-nav">
          {menuItems.map((item) => {
            const active = location.pathname === item.key;
            return (
              <List.Item
                key={item.key}
                clickable
                prefix={<span className="admin-mobile-nav-icon">{item.icon}</span>}
                extra={item.key === '/admin/phieu' && overdueCount > 0 ? renderBadge(active) : null}
                className={active ? 'admin-mobile-nav-active' : ''}
                onClick={() => go(item.key)}
              >
                {item.label}
              </List.Item>
            );
          })}
        </List>
      </div>
    );
  }

  return (
    <aside className={`admin-desktop-sider ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="admin-desktop-brand">
        <div className="admin-desktop-brand-mark">NT</div>
        {!collapsed && (
          <div>
            <strong>{t('ui:app.brandShort')}</strong>
            <span>{t('ui:app.brandCompany')}</span>
          </div>
        )}
      </div>

      <nav className="admin-desktop-button-nav">
        {menuItems.map((item) => {
          const active = location.pathname === item.key;
          return (
            <MobileButton
              key={item.key}
              block
              fill={active ? 'solid' : 'none'}
              color={active ? 'primary' : 'default'}
              className={`admin-desktop-nav-button ${collapsed ? 'is-icon-only' : ''}`}
              onClick={() => go(item.key)}
            >
              <span className="admin-desktop-nav-button-inner">
                <span className="admin-desktop-nav-icon">{item.icon}</span>
                {!collapsed && <span className="admin-desktop-nav-label">{item.label}</span>}
                {!collapsed && item.key === '/admin/phieu' && overdueCount > 0 && renderBadge(active)}
              </span>
            </MobileButton>
          );
        })}
      </nav>

      <Button className="admin-desktop-collapse" type="text" onClick={onToggle}>
        {collapsed ? '>' : '<'}
      </Button>
    </aside>
  );
}

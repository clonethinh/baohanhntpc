import { Layout, Breadcrumb, Button, Space, Avatar, Dropdown, Tooltip } from 'antd';
import {
  MenuOutlined,
  MoonOutlined,
  SunOutlined,
  SearchOutlined,
  QuestionCircleOutlined,
  UserOutlined,
  UserSwitchOutlined,
  LogoutOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { NavBar } from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useState } from 'react';
import NotificationBell from './NotificationBell';
import GlobalSearch from './GlobalSearch';
import StaffPickerModal from '../common/StaffPickerModal';
import ChangePasswordModal from '../common/ChangePasswordModal';

const { Header } = Layout;

const routeLabelKeys = {
  '/admin/dashboard': 'page.dashboard',
  '/admin/phieu': 'page.phieu',
  '/admin/tao-phieu': 'page.taoPhieu',
  '/admin/khach-hang': 'page.khachHang',
  '/admin/nhan-vien': 'page.nhanVien',
  '/admin/nha-cung-cap': 'page.nhaCungCap',
  '/admin/thong-bao-khach-hang': 'page.thongBaoKhachHang',
  '/admin/thong-ke': 'page.thongKe',
  '/admin/import-export': 'page.importExport',
};

export default function AppHeader({ onHamburger }) {
  const { t } = useTranslation(['nav', 'ui']);
  const { isDark, toggle } = useTheme();
  const { currentStaff, logout } = useAuth();
  const location = useLocation();
  const staffInitial = (currentStaff?.tenNV || 'NV').slice(0, 1).toUpperCase();
  const themeLabel = isDark ? t('ui:common.cheDoSang') : t('ui:common.cheDoToi');
  const staffLabel = t('ui:field.nhanVien');
  const [staffPickerOpen, setStaffPickerOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const items = [{ title: 'Admin', href: '/admin' }];
  const pathParts = location.pathname.split('/').filter(Boolean);
  pathParts.forEach((part, i) => {
    const path = '/' + pathParts.slice(0, i + 1).join('/');
    items.push({ title: routeLabelKeys[path] ? t(routeLabelKeys[path]) : part });
  });
  const currentLabel = routeLabelKeys[location.pathname] ? t(routeLabelKeys[location.pathname]) : 'Admin';

  const changeStaff = () => {
    setStaffPickerOpen(true);
  };

  const staffMenu = {
    items: [
      {
        key: 'staff',
        disabled: true,
        label: (
          <div className="admin-header-staff-menu">
            <strong>{currentStaff?.tenNV || t('ui:common.chuaChon')}</strong>
            <span>{currentStaff?.maNV || t('ui:common.chuaChonMa')}</span>
          </div>
        ),
      },
      { type: 'divider' },
      {
        key: 'change',
        icon: <UserSwitchOutlined />,
        label: t('action.doiNhanVien'),
        onClick: changeStaff,
      },
      {
        key: 'password',
        icon: <LockOutlined />,
        label: t('ui:adminStaff.changePassword'),
        onClick: () => setPasswordOpen(true),
      },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: t('ui:button.dangXuat', { defaultValue: 'Đăng xuất' }),
        onClick: logout,
      },
    ],
  };

  const staffButton = (
    <Dropdown menu={staffMenu} trigger={['click']} placement="bottomRight">
      <Tooltip title={currentStaff?.tenNV ? `${staffLabel}: ${currentStaff.tenNV}` : staffLabel}>
        <Button
          type="text"
          className="admin-header-staff-button"
          icon={(
            <Avatar size={28} icon={!currentStaff ? <UserOutlined /> : null}>
              {currentStaff ? staffInitial : null}
            </Avatar>
          )}
          aria-label={staffLabel}
        />
      </Tooltip>
    </Dropdown>
  );

  const iconButtonClass = 'admin-header-icon-button';

  return (
    <>
      <div className="mobile-only admin-mobile-header">
        <NavBar
          back={null}
          left={<Button className={iconButtonClass} type="text" icon={<MenuOutlined />} onClick={onHamburger} aria-label={t('action.moMenu')} />}
          right={(
            <Space size={4}>
              <Button
                className={iconButtonClass}
                type="text"
                icon={<SearchOutlined />}
                onClick={() => { if (window.__focusSearch) window.__focusSearch(); }}
                aria-label={t('action.timKiem')}
              />
              {staffButton}
              <Tooltip title={themeLabel}>
                <Button className={iconButtonClass} type="text" icon={isDark ? <SunOutlined /> : <MoonOutlined />} onClick={toggle} aria-label={themeLabel} />
              </Tooltip>
              <NotificationBell />
            </Space>
          )}
        >
          {currentLabel}
        </NavBar>
      </div>
      <Header className="desktop-only" style={{ padding: '0 24px', background: 'var(--ant-color-bg-container)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, position: 'sticky', top: 0, zIndex: 100 }}>
        <Space>
          <Breadcrumb items={items} />
        </Space>
        <Space>
          <GlobalSearch />
          {staffButton}
          <Tooltip title={themeLabel}>
            <Button className={iconButtonClass} type="text" icon={isDark ? <SunOutlined /> : <MoonOutlined />} onClick={toggle} aria-label={themeLabel} />
          </Tooltip>
          <NotificationBell />
          <Tooltip title={t('action.phimTat')}>
            <Button className={iconButtonClass} type="text" icon={<QuestionCircleOutlined />} onClick={() => { if (window.__showShortcuts) window.__showShortcuts(); }} aria-label={t('action.phimTat')} />
          </Tooltip>
        </Space>
      </Header>
      <StaffPickerModal
        open={staffPickerOpen}
        mode="switchStaff"
        onClose={() => setStaffPickerOpen(false)}
        onPicked={() => {
          setStaffPickerOpen(false);
        }}
      />
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </>
  );
}

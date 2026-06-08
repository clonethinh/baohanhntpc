import { Suspense, lazy, useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp, Result } from 'antd';
import { ConfigProvider as MobileConfigProvider } from 'antd-mobile';
import viVN from 'antd/locale/vi_VN';
import viVNMob from 'antd-mobile/es/locales/vi-VN';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useTheme } from './hooks/useTheme';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import ErrorBoundary from './components/common/ErrorBoundary';
import SkeletonCard from './components/common/SkeletonCard';
import StaffPickerModal from './components/common/StaffPickerModal';
import ShortcutsModal from './components/common/ShortcutsModal';
import AdminLayout from './components/layout/AdminLayout';
import CustomerLayout from './components/layout/CustomerLayout';
import './styles/global.css';
import './styles/print.css';

const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const WarrantyList = lazy(() => import('./pages/admin/WarrantyList'));
const CreateWarranty = lazy(() => import('./pages/admin/CreateWarranty'));
const CustomerInfo = lazy(() => import('./pages/admin/CustomerInfo'));
const Statistics = lazy(() => import('./pages/admin/Statistics'));
const ImportExport = lazy(() => import('./pages/admin/ImportExport'));
const StaffManagement = lazy(() => import('./pages/admin/StaffManagement'));
const Suppliers = lazy(() => import('./pages/admin/Suppliers'));
const WarrantyPrint = lazy(() => import('./components/warranty/WarrantyPrint'));
const Tracuu = lazy(() => import('./pages/customer/Tracuu'));
const TrackingResult = lazy(() => import('./pages/customer/TrackingResult'));
const NotFound = lazy(() => import('./pages/NotFound'));

function RequireStaff({ children }) {
  const { currentStaff, authLoading } = useAuth();
  if (authLoading) return <SkeletonCard />;
  if (!currentStaff) return <StaffPickerModal />;
  return children;
}

function RequireAdminRole({ children }) {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  if (!isAdmin) {
    return (
      <Result
        status="403"
        title="403"
        subTitle={t('app.noAdminPermission')}
      />
    );
  }
  return children;
}

function AdminRoute({ children }) {
  return (
    <RequireStaff>
      <AdminLayout>{children}</AdminLayout>
    </RequireStaff>
  );
}

function AdminOnlyRoute({ children }) {
  return (
    <RequireStaff>
      <AdminLayout>
        <RequireAdminRole>{children}</RequireAdminRole>
      </AdminLayout>
    </RequireStaff>
  );
}

function AppShortcuts({ onShowShortcuts }) {
  const navigate = useNavigate();

  useKeyboardShortcuts({
    onSearchFocus: () => { if (window.__focusSearch) window.__focusSearch(); },
    onShowShortcuts,
    onNavigate: navigate,
  });

  return null;
}

export default function App() {
  const { theme } = useTheme();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const handleShowShortcuts = useCallback(() => setShortcutsOpen(true), []);
  const handleCloseShortcuts = useCallback(() => setShortcutsOpen(false), []);

  useEffect(() => {
    window.__showShortcuts = handleShowShortcuts;
  }, [handleShowShortcuts]);

  return (
    <ErrorBoundary>
      <ConfigProvider
        theme={theme}
        locale={viVN}
        componentSize="middle"
      >
        <MobileConfigProvider locale={viVNMob}>
          <AntdApp>
            <AuthProvider>
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <AppShortcuts onShowShortcuts={handleShowShortcuts} />
                <Suspense fallback={<SkeletonCard />}>
                  <Routes>
                    <Route path="/" element={<Navigate to="/tra-cuu" replace />} />
                    <Route path="/tra-cuu" element={<CustomerLayout><Tracuu /></CustomerLayout>} />
                    <Route path="/tracuu" element={<Navigate to="/tra-cuu" replace />} />
                    <Route path="/tra-cuu/:soChungTu" element={<CustomerLayout><TrackingResult /></CustomerLayout>} />
                    <Route path="/tracuu/:soChungTu" element={<Navigate to="/tra-cuu/:soChungTu" replace />} />
                    <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                    <Route path="/admin/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
                    <Route path="/admin/phieu" element={<AdminRoute><WarrantyList /></AdminRoute>} />
                    <Route path="/admin/phieu/:id/in" element={<AdminRoute><WarrantyPrint /></AdminRoute>} />
                    <Route path="/admin/tao-phieu" element={<AdminRoute><CreateWarranty /></AdminRoute>} />
                    <Route path="/admin/khach-hang" element={<AdminRoute><CustomerInfo /></AdminRoute>} />
                    <Route path="/admin/nhan-vien" element={<AdminOnlyRoute><StaffManagement /></AdminOnlyRoute>} />
                    <Route path="/admin/nha-cung-cap" element={<AdminRoute><Suppliers /></AdminRoute>} />
                    <Route path="/admin/thong-ke" element={<AdminRoute><Statistics /></AdminRoute>} />
                    <Route path="/admin/import-export" element={<AdminOnlyRoute><ImportExport /></AdminOnlyRoute>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                <ShortcutsModal open={shortcutsOpen} onClose={handleCloseShortcuts} />
              </BrowserRouter>
            </AuthProvider>
          </AntdApp>
        </MobileConfigProvider>
      </ConfigProvider>
    </ErrorBoundary>
  );
}

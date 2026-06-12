import { useEffect, useRef, useState } from 'react';
import { App, Card, Form, Grid, Modal, Space, Tag, Typography } from 'antd';
import { BellOutlined, NotificationOutlined, EyeOutlined, PictureOutlined, DesktopOutlined } from '@ant-design/icons';
import { Card as MobileCard, Space as MobileSpace } from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import 'react-quill/dist/quill.snow.css';
import { buildPreviewValues } from './customer-notifications/helpers';
import useCustomerNotificationsAdmin from './customer-notifications/useCustomerNotificationsAdmin';
import NotificationDesktopForm from './customer-notifications/NotificationDesktopForm';
import NotificationDesktopTable from './customer-notifications/NotificationDesktopTable';
import NotificationFilters from './customer-notifications/NotificationFilters';
import NotificationMobileForm from './customer-notifications/NotificationMobileForm';
import NotificationMobileList from './customer-notifications/NotificationMobileList';

const { Title, Text } = Typography;

export default function CustomerNotifications() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.xl;
  const [form] = Form.useForm();
  const editorRef = useRef(null);
  const [editorKey, setEditorKey] = useState(0);
  // HTML sẽ truyền làm defaultValue cho ReactQuill khi mount. Set bằng openEdit/openCreate.
  // Cần state riêng (không đọc trực tiếp từ form) vì:
  //  (1) ReactQuill uncontrolled — chỉ đọc defaultValue lúc mount/remount (key=editorKey).
  //  (2) Form.Item ẩn Input (noStyle) không inject value/defaultValue cho ReactQuill → defaultValue
  //      phải được truyền trực tiếp qua prop. State này là "snapshot" lúc mở modal, đảm bảo
  //      remount lần 2+ vẫn lấy đúng content 6 <p> (không bị state form rò rỉ từ lần mở trước).
  //  (3) Trước đây dùng useEffect setContents với skip-theo-40-ký-tự-đầu là không đáng tin cậy
  //      (1 <p> và 6 <p> đều khớp 40 ký tự đầu) → setContents bị skip → bug. Cách này loại bỏ hoàn toàn.
  const [pendingEditorHtml, setPendingEditorHtml] = useState('');

  const admin = useCustomerNotificationsAdmin({
    t,
    message,
    isMobile,
    form,
    setEditorKey,
    setPendingEditorHtml,
  });

  const scheduleType = Form.useWatch('scheduleType', form);
  const watchedContent = Form.useWatch('content', form);
  const previewValues = buildPreviewValues(Form.useWatch([], form), watchedContent || '');

  // Set content cho ReactQuill sau khi mount. Dùng `dangerouslyPasteHTML` thay vì
  // setContents + clipboard.convert vì:
  //  - dangerouslyPasteHTML trực tiếp parse HTML vào Quill, ít bước trung gian
  //  - KHÔNG CÓ skip logic (lỗi cũ là skip-theo-40-ký-tự-đầu, 1 <p> và 6 <p> đều match)
  //  - Chạy với source='silent' để KHÔNG fire text-change → không loop, không bị form
  //    onChange overwrite về 1 <p> collapsed (lỗi race condition đã thấy)
  //  - Chạy qua requestAnimationFrame để chờ ReactQuill mount xong (sau khi Modal/Form mount)
  //  - Deps [formOpen, editorKey, pendingEditorHtml]: chạy lại khi mở modal mới hoặc đổi row
  useEffect(() => {
    if (!admin.formOpen || !pendingEditorHtml) return;
    let cancelled = false;
    const trySet = () => {
      if (cancelled) return;
      if (!editorRef.current) {
        requestAnimationFrame(trySet);
        return;
      }
      const quill = editorRef.current.getEditor();
      // Parse + apply HTML trực tiếp. Source='silent' để text-change không fire → form không bị
      // overwrite về collapsed state. Sau đó setFieldValue mới để đồng bộ form với DOM.
      quill.clipboard.dangerouslyPasteHTML(pendingEditorHtml, 'silent');
      // Force-sync form value (vì 'silent' không trigger onChange)
      form.setFieldValue('content', quill.root.innerHTML);
    };
    trySet();
    return () => { cancelled = true; };
  }, [admin.formOpen, editorKey, pendingEditorHtml, form]);

  if (isMobile) {
    return (
      <div className="admin-mobile-page" style={{ display: 'grid', gap: 12 }}>
        <MobileCard className="admin-mobile-card" title={t('adminCustomerNotifications.title')}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Tag color="blue">{t('adminCustomerNotifications.total')}: {admin.summary.total}</Tag>
              <Tag color="green">{t('adminCustomerNotifications.visible')}: {admin.summary.visible}</Tag>
              <Tag color="gold">{t('adminCustomerNotifications.popup')}: {admin.summary.popup}</Tag>
              <Tag color="cyan">{t('adminCustomerNotifications.banner')}: {admin.summary.banner}</Tag>
            </div>
            <MobileSpace direction="vertical" block style={{ '--gap': '8px' }}>
              <NotificationFilters
                mobile
                t={t}
                search={admin.search}
                setSearch={admin.setSearch}
                displayType={admin.displayType}
                setDisplayType={admin.setDisplayType}
                activeFilter={admin.activeFilter}
                setActiveFilter={admin.setActiveFilter}
                effectiveStatus={admin.effectiveStatus}
                setEffectiveStatus={admin.setEffectiveStatus}
                displayOptions={admin.displayOptions}
                activeOptions={admin.activeOptions}
                effectiveOptions={admin.effectiveOptions}
                handleSearch={admin.handleSearch}
                openCreate={admin.openCreate}
                resetFilters={admin.resetFilters}
              />
            </MobileSpace>
          </div>
        </MobileCard>

        <NotificationMobileList
          t={t}
          data={admin.data}
          loading={admin.loading}
          openEdit={admin.openEdit}
          toggleStatus={admin.toggleStatus}
          deleteRow={admin.deleteRow}
          submitting={admin.submitting}
          rowActionId={admin.rowActionId}
        />

        <NotificationMobileForm
          t={t}
          editing={admin.editing}
          mobileFormOpen={admin.mobileFormOpen}
          setMobileFormOpen={admin.setMobileFormOpen}
          mobileForm={admin.mobileForm}
          setMobileForm={admin.setMobileForm}
          submitMobile={admin.submitMobile}
          submitting={admin.submitting}
        />
      </div>
    );
  }

  return (
    <div className="desktop-only" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header with title + KPI tags inline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Space size={12}>
          <NotificationOutlined style={{ fontSize: 22, color: '#2563eb' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>{t('adminCustomerNotifications.title')}</Title>
          </div>
        </Space>
        <div className="notif-kpi-strip">
          <span className="notif-kpi"><NotificationOutlined /> {admin.summary.total}</span>
          <span className="notif-kpi visible"><EyeOutlined /> {admin.summary.visible}</span>
          <span className="notif-kpi banner"><PictureOutlined /> {admin.summary.banner}</span>
          <span className="notif-kpi popup"><DesktopOutlined /> {admin.summary.popup}</span>
        </div>
      </div>

      {/* Filters row */}
      <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)' }}>
      <NotificationFilters
        t={t}
        search={admin.search}
        setSearch={admin.setSearch}
        displayType={admin.displayType}
        setDisplayType={admin.setDisplayType}
        activeFilter={admin.activeFilter}
        setActiveFilter={admin.setActiveFilter}
        effectiveStatus={admin.effectiveStatus}
        setEffectiveStatus={admin.setEffectiveStatus}
        displayOptions={admin.displayOptions}
        activeOptions={admin.activeOptions}
        effectiveOptions={admin.effectiveOptions}
        handleSearch={admin.handleSearch}
        openCreate={admin.openCreate}
        resetFilters={admin.resetFilters}
      />
      </div>

      {/* Table */}
      <Card styles={{ body: { padding: 0 } }} className="notif-table-card">
        <NotificationDesktopTable
          t={t}
          data={admin.data}
          loading={admin.loading}
          handleTableChange={admin.handleTableChange}
          openEdit={admin.openEdit}
          toggleStatus={admin.toggleStatus}
          deleteRow={admin.deleteRow}
          submitting={admin.submitting}
          rowActionId={admin.rowActionId}
        />
      </Card>

      <Modal
        title={<Space><BellOutlined />{admin.editing ? t('adminCustomerNotifications.edit') : t('adminCustomerNotifications.add')}</Space>}
        open={admin.formOpen}
        onOk={admin.submit}
        onCancel={() => {
          // Reset form để lần mở sau form.content = '' (sẽ được set lại bằng setFieldsValue
          // trong openEdit/openCreate). Tránh trường hợp form giữ content cũ → ReactQuill mount
          // với defaultValue cũ. Cũng clear pendingEditorHtml để lần mở sau ReactQuill unmount
          // và remount với defaultValue mới.
          form.resetFields();
          setPendingEditorHtml('');
          admin.setFormOpen(false);
        }}
        width={1180}
        centered
        className="notif-edit-modal"
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden', paddingRight: 8 } }}
        okText={t('button.luu')}
        cancelText={t('button.huy')}
        okButtonProps={{ loading: admin.submitting }}
        cancelButtonProps={{ disabled: admin.submitting }}
        destroyOnClose
      >
        <NotificationDesktopForm
          t={t}
          form={form}
          editorKey={editorKey}
          editorRef={editorRef}
          pendingEditorHtml={pendingEditorHtml}
          scheduleType={scheduleType}
          previewValues={previewValues}
        />
      </Modal>
    </div>
  );
}

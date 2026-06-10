import { useEffect, useRef, useState } from 'react';
import { App, Card, Form, Grid, Modal, Row, Col, Space, Typography } from 'antd';
import { BellOutlined } from '@ant-design/icons';
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
  const [editorContent, setEditorContent] = useState('');
  const [editorKey, setEditorKey] = useState(0);
  const [pendingEditorHtml, setPendingEditorHtml] = useState('');

  const admin = useCustomerNotificationsAdmin({
    t,
    message,
    isMobile,
    form,
    setEditorKey,
    setPendingEditorHtml,
    setEditorContent,
  });

  useEffect(() => {
    if (!admin.formOpen || !pendingEditorHtml || !editorRef.current) return;
    const quill = editorRef.current.getEditor();
    quill.setContents([]);
    quill.clipboard.dangerouslyPasteHTML(pendingEditorHtml);
    setEditorContent(quill.root.innerHTML);
    form.setFieldValue('content', quill.root.innerHTML);
    setPendingEditorHtml('');
  }, [admin.formOpen, editorKey, form, pendingEditorHtml]);

  const scheduleType = Form.useWatch('scheduleType', form);
  const previewValues = buildPreviewValues(Form.useWatch([], form), editorContent);

  if (isMobile) {
    return (
      <div className="admin-mobile-page">
        <MobileCard className="admin-mobile-card" title={t('adminCustomerNotifications.title')}>
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
    <div className="desktop-only" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Title level={4}>{t('adminCustomerNotifications.title')}</Title>
      <Row gutter={[12, 12]}>
        <Col span={6}><Card><Text type="secondary">{t('adminCustomerNotifications.total')}</Text><Title level={3}>{admin.summary.total}</Title></Card></Col>
        <Col span={6}><Card><Text type="secondary">{t('adminCustomerNotifications.visible')}</Text><Title level={3}>{admin.summary.visible}</Title></Card></Col>
        <Col span={6}><Card><Text type="secondary">{t('adminCustomerNotifications.banner')}</Text><Title level={3}>{admin.summary.banner}</Title></Card></Col>
        <Col span={6}><Card><Text type="secondary">{t('adminCustomerNotifications.popup')}</Text><Title level={3}>{admin.summary.popup}</Title></Card></Col>
      </Row>

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

      <Modal
        title={<Space><BellOutlined />{admin.editing ? t('adminCustomerNotifications.edit') : t('adminCustomerNotifications.add')}</Space>}
        open={admin.formOpen}
        onOk={admin.submit}
        onCancel={() => { setPendingEditorHtml(''); setEditorContent(''); admin.setFormOpen(false); }}
        width={1100}
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
          editorContent={editorContent}
          setEditorContent={setEditorContent}
          scheduleType={scheduleType}
          previewValues={previewValues}
        />
      </Modal>
    </div>
  );
}

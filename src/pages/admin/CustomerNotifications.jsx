import { useEffect, useRef, useState } from 'react';
import { App, Card, Form, Grid, Modal, Row, Col, Space, Typography, Tag } from 'antd';
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

function SummaryCard({ icon, label, value, color }) {
  return (
    <Card styles={{ body: { padding: 18, borderRadius: 16 } }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <Space size={10}>
          <div style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: color.bg, color: color.fg }}>
            {icon}
          </div>
          <Text type="secondary">{label}</Text>
        </Space>
        <Title level={3} style={{ margin: 0 }}>{value}</Title>
      </div>
    </Card>
  );
}

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
    <div className="desktop-only" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <Title level={4} style={{ margin: 0 }}>{t('adminCustomerNotifications.title')}</Title>
          <Text type="secondary">Quản lý banner và popup hiển thị cho khách hàng theo trạng thái và lịch hiển thị.</Text>
        </div>
        <Space wrap>
          <Tag color="blue">{t('adminCustomerNotifications.banner')}: {admin.summary.banner}</Tag>
          <Tag color="gold">{t('adminCustomerNotifications.popup')}: {admin.summary.popup}</Tag>
          <Tag color="green">{t('adminCustomerNotifications.visible')}: {admin.summary.visible}</Tag>
        </Space>
      </div>

      <Row gutter={[12, 12]}>
        <Col span={6}><SummaryCard icon={<NotificationOutlined />} label={t('adminCustomerNotifications.total')} value={admin.summary.total} color={{ bg: '#eff6ff', fg: '#2563eb' }} /></Col>
        <Col span={6}><SummaryCard icon={<EyeOutlined />} label={t('adminCustomerNotifications.visible')} value={admin.summary.visible} color={{ bg: '#ecfdf5', fg: '#059669' }} /></Col>
        <Col span={6}><SummaryCard icon={<PictureOutlined />} label={t('adminCustomerNotifications.banner')} value={admin.summary.banner} color={{ bg: '#ecfeff', fg: '#0891b2' }} /></Col>
        <Col span={6}><SummaryCard icon={<DesktopOutlined />} label={t('adminCustomerNotifications.popup')} value={admin.summary.popup} color={{ bg: '#fff7ed', fg: '#ea580c' }} /></Col>
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
        width={1180}
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

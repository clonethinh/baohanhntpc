import { Col, DatePicker, Form, Input, Radio, Row, Select, Switch, Card, Space, Typography } from 'antd';
import ReactQuill from 'react-quill';
import { RICH_TEXT_FORMATS, RICH_TEXT_MODULES } from '../../../lib/richText';
import NotificationPreview from './NotificationPreview';

const { Text } = Typography;

export default function NotificationDesktopForm({
  t,
  form,
  editorKey,
  editorRef,
  editorContent,
  setEditorContent,
  scheduleType,
  previewValues,
}) {
  return (
    <Row gutter={18}>
      <Col span={14}>
        <Card bordered={false} styles={{ body: { padding: 0, display: 'grid', gap: 16 } }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <Text strong style={{ fontSize: 16 }}>{t('adminCustomerNotifications.notification')}</Text>
            <Text type="secondary">{t('adminCustomerNotifications.contentPlaceholder')}</Text>
          </div>

          <Form form={form} layout="vertical">
            <Form.Item name="title" label={t('adminCustomerNotifications.titleField')} rules={[{ required: true, message: t('adminCustomerNotifications.titleRequired') }]}>
              <Input size="large" placeholder={t('adminCustomerNotifications.titlePlaceholder')} />
            </Form.Item>

            <Form.Item name="content" label={t('adminCustomerNotifications.contentField')} rules={[{ required: true, message: t('adminCustomerNotifications.contentRequired') }]}>
              <ReactQuill key={editorKey} ref={editorRef} theme="snow" value={editorContent || ''} onChange={(value) => { setEditorContent(value); form.setFieldValue('content', value); }} modules={RICH_TEXT_MODULES} formats={RICH_TEXT_FORMATS} style={{ background: '#fff' }} />
            </Form.Item>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="displayType" label={t('adminCustomerNotifications.displayType')}>
                  <Select size="large" options={[{ value: 'banner', label: t('adminCustomerNotifications.banner') }, { value: 'popup', label: t('adminCustomerNotifications.popup') }]} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="priority" label={t('adminCustomerNotifications.priority')}>
                  <Input size="large" type="number" min={0} />
                </Form.Item>
              </Col>
            </Row>

            <Card size="small" title={t('adminCustomerNotifications.activeStatus')} styles={{ body: { paddingBottom: 8 } }}>
              <Form.Item name="isActive" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Switch checkedChildren={t('adminCustomerNotifications.active')} unCheckedChildren={t('adminCustomerNotifications.paused')} />
              </Form.Item>
            </Card>

            <Card size="small" title={t('adminCustomerNotifications.scheduleType')} styles={{ body: { display: 'grid', gap: 12 } }}>
              <Form.Item name="scheduleType" style={{ marginBottom: 0 }}>
                <Radio.Group>
                  <Space direction="vertical">
                    <Radio value="manual">{t('adminCustomerNotifications.manualSchedule')}</Radio>
                    <Radio value="range">{t('adminCustomerNotifications.rangeSchedule')}</Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>

              {scheduleType === 'range' && (
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="startAt" label={t('adminCustomerNotifications.startAt')} rules={[{ required: true, message: t('adminCustomerNotifications.startAtRequired') }]}>
                      <DatePicker showTime format="DD-MM-YYYY HH:mm" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="endAt" label={t('adminCustomerNotifications.endAt')} rules={[{ required: true, message: t('adminCustomerNotifications.endAtRequired') }]}>
                      <DatePicker showTime format="DD-MM-YYYY HH:mm" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              )}
            </Card>
          </Form>
        </Card>
      </Col>

      <Col span={10}>
        <NotificationPreview title={previewValues.title} content={previewValues.content} displayType={previewValues.displayType} t={t} />
      </Col>
    </Row>
  );
}

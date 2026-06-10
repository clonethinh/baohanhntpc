import { Col, DatePicker, Form, Input, Radio, Row, Select, Switch } from 'antd';
import ReactQuill from 'react-quill';
import { RICH_TEXT_FORMATS, RICH_TEXT_MODULES } from '../../../lib/richText';
import NotificationPreview from './NotificationPreview';

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
    <Row gutter={16}>
      <Col span={14}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label={t('adminCustomerNotifications.titleField')} rules={[{ required: true, message: t('adminCustomerNotifications.titleRequired') }]}>
            <Input placeholder={t('adminCustomerNotifications.titlePlaceholder')} />
          </Form.Item>
          <Form.Item name="content" label={t('adminCustomerNotifications.contentField')} rules={[{ required: true, message: t('adminCustomerNotifications.contentRequired') }]}>
            <ReactQuill key={editorKey} ref={editorRef} theme="snow" value={editorContent || ''} onChange={(value) => { setEditorContent(value); form.setFieldValue('content', value); }} modules={RICH_TEXT_MODULES} formats={RICH_TEXT_FORMATS} style={{ background: '#fff' }} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="displayType" label={t('adminCustomerNotifications.displayType')}>
                <Select options={[{ value: 'banner', label: t('adminCustomerNotifications.banner') }, { value: 'popup', label: t('adminCustomerNotifications.popup') }]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label={t('adminCustomerNotifications.priority')}>
                <Input type="number" min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="isActive" label={t('adminCustomerNotifications.activeStatus')} valuePropName="checked">
            <Switch checkedChildren={t('adminCustomerNotifications.active')} unCheckedChildren={t('adminCustomerNotifications.paused')} />
          </Form.Item>
          <Form.Item name="scheduleType" label={t('adminCustomerNotifications.scheduleType')}>
            <Radio.Group>
              <Radio value="manual">{t('adminCustomerNotifications.manualSchedule')}</Radio>
              <Radio value="range">{t('adminCustomerNotifications.rangeSchedule')}</Radio>
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
        </Form>
      </Col>
      <Col span={10}>
        <NotificationPreview title={previewValues.title} content={previewValues.content} displayType={previewValues.displayType} t={t} />
      </Col>
    </Row>
  );
}

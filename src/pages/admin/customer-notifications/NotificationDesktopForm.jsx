import { Col, DatePicker, Form, Input, Radio, Row, Select, Switch, Segmented, Space, Typography, Divider } from 'antd';
import { FileTextOutlined, AppstoreOutlined, ClockCircleOutlined, PictureOutlined, DesktopOutlined, EyeOutlined } from '@ant-design/icons';
import ReactQuill from 'react-quill';
import { RICH_TEXT_FORMATS, RICH_TEXT_MODULES } from '../../../lib/richText';
import NotificationPreview from './NotificationPreview';

const { Text } = Typography;

function SectionHeader({ icon, title, desc, variant = 'blue' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
      <div className={`notif-section-icon notif-section-icon-${variant}`}>
        {icon}
      </div>
      <div style={{ display: 'grid', gap: 1 }}>
        <Text strong style={{ fontSize: 15 }}>{title}</Text>
        <Text type="secondary" style={{ fontSize: 12.5 }}>{desc}</Text>
      </div>
    </div>
  );
}

export default function NotificationDesktopForm({
  t,
  form,
  editorKey,
  editorRef,
  pendingEditorHtml,
  scheduleType,
  previewValues,
}) {
  const displayType = Form.useWatch('displayType', form);

  return (
    <Row gutter={24}>
      <Col span={14}>
        <Form form={form} layout="vertical" requiredMark="optional">
          {/* === Section 1: Nội dung === */}
          <div className="notif-form-section">
            <SectionHeader
              icon={<FileTextOutlined />}
              title={t('adminCustomerNotifications.contentSection')}
              desc={t('adminCustomerNotifications.contentSectionDesc')}
              variant="blue"
            />
            <Form.Item name="title" label={t('adminCustomerNotifications.titleField')} rules={[{ required: true, message: t('adminCustomerNotifications.titleRequired') }]}>
              <Input size="large" placeholder={t('adminCustomerNotifications.titlePlaceholder')} maxLength={120} showCount />
            </Form.Item>
            <Form.Item name="content" noStyle>
              {/* Hidden input cho form integration. ReactQuill ở uncontrolled mode
                  với defaultValue='' ban đầu. Sau khi mount, một useEffect trong component
                  cha sẽ dùng quill.clipboard.dangerouslyPasteHTML(pendingEditorHtml) để set
                  content từ form state. Form tự sync value qua onChange của editor. */}
              <Input type="hidden" />
            </Form.Item>
            <div className="ant-form-item">
              <label className="ant-form-item-label" style={{ display: 'block', marginBottom: 8 }}>
                {t('adminCustomerNotifications.contentField')}
              </label>
              <ReactQuill
                key={editorKey}
                ref={editorRef}
                theme="snow"
                modules={RICH_TEXT_MODULES}
                formats={RICH_TEXT_FORMATS}
                onChange={(value) => { form.setFieldValue('content', value); }}
                className="notif-quill"
              />
            </div>
          </div>

          {/* === Section 2: Cách hiển thị === */}
          <div className="notif-form-section">
            <SectionHeader
              icon={<AppstoreOutlined />}
              title={t('adminCustomerNotifications.displaySection')}
              desc={t('adminCustomerNotifications.displaySectionDesc')}
              variant="orange"
            />
            <Form.Item name="displayType" label={t('adminCustomerNotifications.displayType')}>
              <Segmented
                size="large"
                block
                options={[
                  { value: 'banner', label: (<Space size={6}><PictureOutlined />{t('adminCustomerNotifications.banner')}</Space>) },
                  { value: 'popup', label: (<Space size={6}><DesktopOutlined />{t('adminCustomerNotifications.popup')}</Space>) },
                ]}
              />
            </Form.Item>
            <Text type="secondary" style={{ fontSize: 12.5, display: 'block', marginTop: -8, marginBottom: 16 }}>
              {displayType === 'popup' ? t('adminCustomerNotifications.popupHint') : t('adminCustomerNotifications.bannerHint')}
            </Text>

            <Row gutter={16} align="bottom">
              <Col span={12}>
                <Form.Item name="priority" label={t('adminCustomerNotifications.priority')} extra={t('adminCustomerNotifications.priorityHint')} style={{ marginBottom: 0 }}>
                  <Input size="large" type="number" min={0} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={t('adminCustomerNotifications.activeStatus')} style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 40 }}>
                    <Form.Item name="isActive" valuePropName="checked" noStyle>
                      <Switch checkedChildren={t('adminCustomerNotifications.active')} unCheckedChildren={t('adminCustomerNotifications.paused')} />
                    </Form.Item>
                    <Form.Item shouldUpdate={(prev, cur) => prev.isActive !== cur.isActive} noStyle>
                      {({ getFieldValue }) => (
                        <Text type="secondary" style={{ fontSize: 12.5 }}>
                          {getFieldValue('isActive') ? t('adminCustomerNotifications.statusOnHint') : t('adminCustomerNotifications.statusOffHint')}
                        </Text>
                      )}
                    </Form.Item>
                  </div>
                </Form.Item>
              </Col>
            </Row>
          </div>

          {/* === Section 3: Lịch hiển thị === */}
          <div className="notif-form-section" style={{ marginBottom: 0 }}>
            <SectionHeader
              icon={<ClockCircleOutlined />}
              title={t('adminCustomerNotifications.scheduleSection')}
              desc={t('adminCustomerNotifications.scheduleSectionDesc')}
              variant="green"
            />
            <Form.Item name="scheduleType" style={{ marginBottom: scheduleType === 'range' ? 16 : 0 }}>
              <Radio.Group className="notif-schedule-radio" style={{ display: 'grid', gap: 10, width: '100%' }}>
                <Radio value="manual" className="notif-radio-card">
                  <div style={{ display: 'grid', gap: 2 }}>
                    <Text strong>{t('adminCustomerNotifications.manualSchedule')}</Text>
                    <Text type="secondary" style={{ fontSize: 12.5 }}>{t('adminCustomerNotifications.manualScheduleHint')}</Text>
                  </div>
                </Radio>
                <Radio value="range" className="notif-radio-card">
                  <div style={{ display: 'grid', gap: 2 }}>
                    <Text strong>{t('adminCustomerNotifications.rangeSchedule')}</Text>
                    <Text type="secondary" style={{ fontSize: 12.5 }}>{t('adminCustomerNotifications.rangeScheduleHint')}</Text>
                  </div>
                </Radio>
              </Radio.Group>
            </Form.Item>

            {scheduleType === 'range' && (
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="startAt" label={t('adminCustomerNotifications.startAt')} rules={[{ required: true, message: t('adminCustomerNotifications.startAtRequired') }]} style={{ marginBottom: 0 }}>
                    <DatePicker showTime format="DD-MM-YYYY HH:mm" style={{ width: '100%' }} size="large" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="endAt" label={t('adminCustomerNotifications.endAt')} rules={[{ required: true, message: t('adminCustomerNotifications.endAtRequired') }]} style={{ marginBottom: 0 }}>
                    <DatePicker showTime format="DD-MM-YYYY HH:mm" style={{ width: '100%' }} size="large" />
                  </Form.Item>
                </Col>
              </Row>
            )}
          </div>
        </Form>
      </Col>

      <Col span={10}>
        <div className="notif-preview-sticky">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: '#6b7280' }}>
            <EyeOutlined />
            <Text type="secondary" style={{ fontSize: 12.5, fontWeight: 600 }}>{t('adminCustomerNotifications.livePreview')}</Text>
          </div>
          <NotificationPreview title={previewValues.title} content={previewValues.content} displayType={previewValues.displayType} t={t} />
        </div>
      </Col>
    </Row>
  );
}

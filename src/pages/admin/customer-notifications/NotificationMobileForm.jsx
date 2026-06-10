import ReactQuill from 'react-quill';
import {
  Button as MobileButton,
  DatePicker as MobileDatePicker,
  Input as MobileInput,
  List,
  Popup,
  Selector,
  Space as MobileSpace,
  Switch as MobileSwitch,
} from 'antd-mobile';
import { RICH_TEXT_FORMATS, RICH_TEXT_MODULES } from '../../../lib/richText';
import NotificationPreview from './NotificationPreview';
import { mobileDateLabel } from './helpers';

export default function NotificationMobileForm({
  t,
  editing,
  mobileFormOpen,
  setMobileFormOpen,
  mobileForm,
  setMobileForm,
  submitMobile,
  submitting,
}) {
  return (
    <Popup visible={mobileFormOpen} onMaskClick={() => setMobileFormOpen(false)} bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 12, maxHeight: '88vh', overflow: 'auto' }}>
      <h3>{editing ? t('adminCustomerNotifications.edit') : t('adminCustomerNotifications.add')}</h3>
      <List>
        <List.Item title={t('adminCustomerNotifications.titleField')}><MobileInput value={mobileForm.title} onChange={(v) => setMobileForm((s) => ({ ...s, title: v }))} /></List.Item>
        <List.Item title={t('adminCustomerNotifications.contentField')}>
          <div style={{ width: '100%' }}>
            <ReactQuill theme="snow" value={mobileForm.content || ''} onChange={(v) => setMobileForm((s) => ({ ...s, content: v }))} modules={RICH_TEXT_MODULES} formats={RICH_TEXT_FORMATS} />
          </div>
        </List.Item>
        <List.Item title={t('adminCustomerNotifications.displayType')}>
          <Selector value={[mobileForm.displayType]} options={[{ label: t('adminCustomerNotifications.banner'), value: 'banner' }, { label: t('adminCustomerNotifications.popup'), value: 'popup' }]} onChange={(arr) => setMobileForm((s) => ({ ...s, displayType: arr[0] || 'banner' }))} />
        </List.Item>
        <List.Item title={t('adminCustomerNotifications.priority')}><MobileInput type="number" value={String(mobileForm.priority)} onChange={(v) => setMobileForm((s) => ({ ...s, priority: Number(v || 0) }))} /></List.Item>
        <List.Item title={t('adminCustomerNotifications.activeStatus')}><MobileSwitch checked={Boolean(mobileForm.isActive)} onChange={(v) => setMobileForm((s) => ({ ...s, isActive: v }))} /></List.Item>
        <List.Item title={t('adminCustomerNotifications.scheduleType')}>
          <Selector value={[mobileForm.scheduleType]} options={[{ label: t('adminCustomerNotifications.manualSchedule'), value: 'manual' }, { label: t('adminCustomerNotifications.rangeSchedule'), value: 'range' }]} onChange={(arr) => setMobileForm((s) => ({ ...s, scheduleType: arr[0] || 'manual' }))} />
        </List.Item>
        {mobileForm.scheduleType === 'range' ? (
          <>
            <List.Item title={t('adminCustomerNotifications.startAt')}>
              <MobileDatePicker value={mobileForm.startAt || new Date()} onConfirm={(v) => setMobileForm((s) => ({ ...s, startAt: v }))} precision="minute">
                {() => <MobileButton size="small">{mobileDateLabel(mobileForm.startAt, t)}</MobileButton>}
              </MobileDatePicker>
            </List.Item>
            <List.Item title={t('adminCustomerNotifications.endAt')}>
              <MobileDatePicker value={mobileForm.endAt || new Date()} onConfirm={(v) => setMobileForm((s) => ({ ...s, endAt: v }))} precision="minute">
                {() => <MobileButton size="small">{mobileDateLabel(mobileForm.endAt, t)}</MobileButton>}
              </MobileDatePicker>
            </List.Item>
          </>
        ) : null}
        <List.Item title={t('adminCustomerNotifications.preview')}>
          <div style={{ width: '100%' }}>
            <NotificationPreview title={mobileForm.title} content={mobileForm.content} displayType={mobileForm.displayType} t={t} />
          </div>
        </List.Item>
      </List>
      <MobileSpace block justify="between" style={{ marginTop: 12 }}>
        <MobileButton onClick={() => setMobileFormOpen(false)} disabled={submitting}>{t('button.huy')}</MobileButton>
        <MobileButton color="primary" onClick={submitMobile} loading={submitting}>{t('button.luu')}</MobileButton>
      </MobileSpace>
    </Popup>
  );
}

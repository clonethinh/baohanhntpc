import dayjs from 'dayjs';
import { isRichTextEmpty, sanitizeRichText } from '../../../lib/richText';
import { buildDefaultForm } from './defaults';

export function formatDateTime(value) {
  if (!value) return '-';
  const d = dayjs(value);
  return d.isValid() ? d.format('DD-MM-YYYY HH:mm') : '-';
}

export function effectiveStatusMeta(t, row) {
  if (row.isActive === false) return { color: 'red', mobileColor: 'danger', label: t('adminCustomerNotifications.pauseState') };
  if (row.scheduleType === 'manual') return { color: 'green', mobileColor: 'success', label: t('adminCustomerNotifications.manualActive') };
  if (row.effectiveStatus === 'scheduled') return { color: 'blue', mobileColor: 'primary', label: t('adminCustomerNotifications.scheduled') };
  if (row.effectiveStatus === 'expired') return { color: 'default', mobileColor: 'default', label: t('adminCustomerNotifications.expired') };
  if (row.effectiveStatus === 'visible') return { color: 'green', mobileColor: 'success', label: t('adminCustomerNotifications.rangeActive') };
  return { color: 'default', mobileColor: 'default', label: t('adminCustomerNotifications.unknownState') };
}

export function mobileDateLabel(value, t) {
  return value ? dayjs(value).format('DD-MM-YYYY HH:mm') : t('adminCustomerNotifications.chooseTime');
}

export function scheduleText(t, row) {
  if (row.scheduleType !== 'range') return t('adminCustomerNotifications.manualSchedule');
  return `${formatDateTime(row.startAt)} → ${formatDateTime(row.endAt)}`;
}

export function validateScheduleRange(startAt, endAt) {
  if (!startAt || !endAt) return true;
  return dayjs(endAt).valueOf() >= dayjs(startAt).valueOf();
}

export function normalizeDesktopFormValues(values) {
  return {
    ...values,
    content: sanitizeRichText(values.content),
    priority: Number(values.priority || 0),
    startAt: values.scheduleType === 'range' && values.startAt ? values.startAt.toISOString() : null,
    endAt: values.scheduleType === 'range' && values.endAt ? values.endAt.toISOString() : null,
  };
}

export function normalizeMobileFormValues(values) {
  return {
    ...values,
    content: sanitizeRichText(values.content),
    priority: Number(values.priority || 0),
    startAt: values.scheduleType === 'range' && values.startAt ? dayjs(values.startAt).toISOString() : null,
    endAt: values.scheduleType === 'range' && values.endAt ? dayjs(values.endAt).toISOString() : null,
  };
}

export function buildFormValuesFromRow(row) {
  return {
    title: row.title || '',
    content: sanitizeRichText(row.content || ''),
    displayType: row.displayType || 'banner',
    priority: Number(row.priority || 0),
    isActive: row.isActive !== false,
    scheduleType: row.scheduleType || 'manual',
    startAt: row.startAt ? dayjs(row.startAt) : null,
    endAt: row.endAt ? dayjs(row.endAt) : null,
  };
}

export function buildMobileFormValuesFromRow(row) {
  const values = buildFormValuesFromRow(row);
  return {
    ...values,
    startAt: values.startAt?.toDate() || null,
    endAt: values.endAt?.toDate() || null,
  };
}

export function validateDesktopForm(values, t) {
  if (isRichTextEmpty(values.content)) return t('adminCustomerNotifications.contentRequired');
  if (values.scheduleType === 'range' && !validateScheduleRange(values.startAt, values.endAt)) return t('adminCustomerNotifications.invalidRange');
  return '';
}

export function validateMobileForm(values, t) {
  if (!String(values.title || '').trim()) return t('adminCustomerNotifications.titleRequired');
  if (isRichTextEmpty(values.content)) return t('adminCustomerNotifications.contentRequired');
  if (values.scheduleType === 'range' && (!values.startAt || !values.endAt)) return t('adminCustomerNotifications.timeRequired');
  if (values.scheduleType === 'range' && !validateScheduleRange(values.startAt, values.endAt)) return t('adminCustomerNotifications.invalidRange');
  return '';
}

export function buildPreviewValues(formValues, editorContent) {
  return {
    ...buildDefaultForm(),
    ...(formValues || {}),
    content: editorContent,
  };
}

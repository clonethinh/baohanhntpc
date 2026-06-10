import { useEffect, useMemo, useState } from 'react';
import { buildDefaultForm, buildEmptyData } from './defaults';
import {
  buildFormValuesFromRow,
  buildMobileFormValuesFromRow,
  normalizeDesktopFormValues,
  normalizeMobileFormValues,
  validateDesktopForm,
  validateMobileForm,
} from './helpers';
import { customerNotificationService } from '../../../services/warrantyService';

const EMPTY_SUMMARY = {
  total: 0,
  visible: 0,
  banner: 0,
  popup: 0,
  scheduled: 0,
  expired: 0,
  inactive: 0,
};

export default function useCustomerNotificationsAdmin({
  t,
  message,
  isMobile,
  form,
  setEditorKey,
  setPendingEditorHtml,
  setEditorContent,
}) {
  const [data, setData] = useState(buildEmptyData());
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [displayType, setDisplayType] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [effectiveStatus, setEffectiveStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [mobileFormOpen, setMobileFormOpen] = useState(false);
  const [mobileForm, setMobileForm] = useState(buildDefaultForm());
  const [submitting, setSubmitting] = useState(false);
  const [rowActionId, setRowActionId] = useState('');

  const baseParams = useMemo(() => ({
    q: search,
    displayType,
    isActive: activeFilter,
  }), [search, displayType, activeFilter]);

  const fetchRows = async (next = {}) => {
    setLoading(true);
    try {
      const params = {
        ...baseParams,
        effectiveStatus,
        page: next.page || data.page || 1,
        limit: next.limit || data.limit || 10,
      };
      const [listRes, summaryRes] = await Promise.all([
        customerNotificationService.list(params),
        customerNotificationService.summary(baseParams),
      ]);
      if (listRes.data?.success) {
        setData(listRes.data.data || buildEmptyData());
      }
      if (summaryRes.data?.success) {
        setSummary({ ...EMPTY_SUMMARY, ...(summaryRes.data.data || {}) });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows({ page: 1, limit: data.limit });
  }, []);

  const displayOptions = [
    { value: '', label: t('adminCustomerNotifications.allTypes') },
    { value: 'banner', label: t('adminCustomerNotifications.banner') },
    { value: 'popup', label: t('adminCustomerNotifications.popup') },
  ];

  const activeOptions = [
    { value: '', label: t('adminCustomerNotifications.allStatus') },
    { value: '1', label: t('adminCustomerNotifications.active') },
    { value: '0', label: t('adminCustomerNotifications.paused') },
  ];

  const effectiveOptions = [
    { value: '', label: t('adminCustomerNotifications.allEffectiveStatus') },
    { value: 'visible', label: t('adminCustomerNotifications.visible') },
    { value: 'scheduled', label: t('adminCustomerNotifications.scheduled') },
    { value: 'expired', label: t('adminCustomerNotifications.expired') },
    { value: 'inactive', label: t('adminCustomerNotifications.inactive') },
  ];

  const openCreate = () => {
    setEditing(null);
    const values = buildDefaultForm();
    if (isMobile) {
      setMobileForm(values);
      setMobileFormOpen(true);
      return;
    }
    setEditorKey((x) => x + 1);
    setPendingEditorHtml(values.content);
    setEditorContent(values.content);
    form.setFieldsValue(values);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    if (isMobile) {
      setMobileForm(buildMobileFormValuesFromRow(row));
      setMobileFormOpen(true);
      return;
    }
    const values = buildFormValuesFromRow(row);
    setEditorKey((x) => x + 1);
    setPendingEditorHtml(values.content);
    setEditorContent(values.content);
    form.setFieldsValue(values);
    setFormOpen(true);
  };

  const submit = async () => {
    try {
      const values = await form.validateFields();
      const validationMessage = validateDesktopForm(values, t);
      if (validationMessage) {
        message.error(validationMessage);
        return;
      }
      setSubmitting(true);
      const payload = normalizeDesktopFormValues(values);
      if (editing) await customerNotificationService.update(editing.id, payload);
      else await customerNotificationService.create(payload);
      message.success(editing ? t('adminCustomerNotifications.updateSuccess') : t('adminCustomerNotifications.createSuccess'));
      setPendingEditorHtml('');
      setEditorContent('');
      setFormOpen(false);
      await fetchRows();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.error?.message || t('adminCustomerNotifications.saveError'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitMobile = async () => {
    const validationMessage = validateMobileForm(mobileForm, t);
    if (validationMessage) return;

    setSubmitting(true);
    const payload = normalizeMobileFormValues(mobileForm);
    try {
      if (editing) await customerNotificationService.update(editing.id, payload);
      else await customerNotificationService.create(payload);
      setMobileFormOpen(false);
      await fetchRows();
    } catch (err) {
      message.error(err?.response?.data?.error?.message || t('adminCustomerNotifications.saveError'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (row) => {
    setRowActionId(`toggle:${row.id}`);
    try {
      await customerNotificationService.setStatus(row.id, !row.isActive);
      message.success(row.isActive ? t('adminCustomerNotifications.pauseSuccess') : t('adminCustomerNotifications.activateSuccess'));
      await fetchRows();
    } catch (err) {
      message.error(err?.response?.data?.error?.message || t('adminCustomerNotifications.statusError'));
    } finally {
      setRowActionId('');
    }
  };

  const deleteRow = async (row) => {
    setRowActionId(`delete:${row.id}`);
    try {
      await customerNotificationService.remove(row.id);
      message.success(t('adminCustomerNotifications.deleteSuccess'));
      await fetchRows();
    } catch (err) {
      const errorMessage = err?.response?.data?.error?.message || t('adminCustomerNotifications.deleteError');
      message.error(errorMessage);
    } finally {
      setRowActionId('');
    }
  };

  const handleSearch = () => fetchRows({ page: 1, limit: data.limit });
  const handleTableChange = (pagination) => fetchRows({ page: pagination.current, limit: pagination.pageSize });
  const resetFilters = () => {
    setSearch('');
    setDisplayType('');
    setActiveFilter('');
    setEffectiveStatus('');
    fetchRows({ page: 1, limit: data.limit });
  };

  return {
    data,
    loading,
    search,
    setSearch,
    displayType,
    setDisplayType,
    activeFilter,
    setActiveFilter,
    effectiveStatus,
    setEffectiveStatus,
    formOpen,
    setFormOpen,
    editing,
    mobileFormOpen,
    setMobileFormOpen,
    mobileForm,
    setMobileForm,
    submitting,
    rowActionId,
    summary,
    displayOptions,
    activeOptions,
    effectiveOptions,
    fetchRows,
    openCreate,
    openEdit,
    submit,
    submitMobile,
    toggleStatus,
    deleteRow,
    handleSearch,
    handleTableChange,
    resetFilters,
  };
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Drawer, Tabs, Descriptions, Form, Input, Select, Button, Timeline, Tag, QRCode, Popconfirm, Space, Typography, App, Card, Modal, DatePicker, Alert, Table, Grid, Upload, Image, Skeleton } from 'antd';
import { EditOutlined, PrinterOutlined, CheckCircleOutlined, DeleteOutlined, CopyOutlined, SendOutlined, ClockCircleOutlined, UploadOutlined, CloseOutlined, SwapOutlined } from '@ant-design/icons';
import {
  Button as MobileButton,
  Card as MobileCard,
  Dialog,
  List,
  NavBar,
  Popup,
  Space as MobileSpace,
  Tabs as MobileTabs,
  Tag as MobileTag,
  TextArea as MobileTextArea,
} from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { customerService, nhanVienService, supplierService, warrantyService } from '../../services/warrantyService';
import { STATUS } from '../../constants/statusConfig';
import { getStatusBadgeColor } from '../../constants/badgeConfig';
import { buildInternalHistoryTimeline } from '../../utils/historyTimeline';
import { LOAI_XU_LY_OPTIONS, LOAI_XU_LY_LABELS } from '../../constants/warrantyOptions';
import { formatDate, shouldShowDueDate } from '../../utils/dateHelpers';
import { normalizeVietnameseText } from '../../utils/vietnameseText';
import StatusTag from './StatusTag';
import WarrantyProgress from './WarrantyProgress';
import CustomerPickerModal from '../common/CustomerPickerModal';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Text } = Typography;


function parseFormDate(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const dmy = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmy) {
      const [, day, month, year] = dmy;
      const parsed = dayjs(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      return parsed.isValid() ? parsed : null;
    }
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
}

export function normalizeHistoryText(text) {
  return normalizeVietnameseText(text || '')
    .replaceAll('soSeri:', 'Số seri:')
    .replaceAll('soSeri :', 'Số seri:');
}

function renderHistoryDetail(detail) {
  if (!detail || typeof detail !== 'string') return detail;
  const regex = /Đang cập nhập\.\.\.|Đang cập nhập/g;
  const matches = [...detail.matchAll(regex)];
  if (matches.length === 0) return detail;

  const elements = [];
  let lastIndex = 0;
  matches.forEach((match, idx) => {
    const textBefore = detail.substring(lastIndex, match.index);
    if (textBefore) elements.push(textBefore);
    elements.push(
      <span key={`loading-${idx}`}>
        Đang cập nhập
        <span className="loading-dots" />
      </span>
    );
    lastIndex = match.index + match[0].length;
  });
  const textAfter = detail.substring(lastIndex);
  if (textAfter) elements.push(textAfter);

  return elements;
}

function normalizeAttachments(value) {
  if (Array.isArray(value)) return value.filter((item) => item && item.url);
  if (value && typeof value === 'object') {
    if (value.url) return [value];
    return Object.values(value).filter((item) => item && typeof item === 'object' && item.url);
  }
  return [];
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

let isGlobalUploading = false;

export default function WarrantyDetail({ open, onClose, warrantyId, onRefresh }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const [warranty, setWarranty] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editSection, setEditSection] = useState('');
  const [form] = Form.useForm();
  const [logForm] = Form.useForm();
  const [exchangeForm] = Form.useForm();
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [exchangeSubmitting, setExchangeSubmitting] = useState(false);
  const [exchangeType, setExchangeType] = useState('doi_hang');
  const [exchangeAttachments, setExchangeAttachments] = useState([]);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [mobileLogNote, setMobileLogNote] = useState('');
  const [sendSubmitting, setSendSubmitting] = useState(false);
  const [supplierLogs, setSupplierLogs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [sendForm] = Form.useForm();
  const [supplierLogEditOpen, setSupplierLogEditOpen] = useState(false);
  const [supplierLogEditing, setSupplierLogEditing] = useState(null);
  const [supplierLogNote, setSupplierLogNote] = useState('');
  const [supplierLogSupplierId, setSupplierLogSupplierId] = useState('');
  const [supplierLogSaving, setSupplierLogSaving] = useState(false);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  // Keep body lightweight while close animation runs to avoid a mid-close stall.
  const [isClosing, setIsClosing] = useState(false);
  // Delay mounting the heaviest UI (tabs/forms) until after the open transition settles.
  const [renderHeavy, setRenderHeavy] = useState(false);
  const supplierSelectOptions = suppliers
    .filter((s) => s.isActive !== false)
    .map((s) => {
      const text = `${s.code || ''} ${s.name || ''} ${s.phone || ''}`.trim();
      return {
        value: s.id,
        searchText: text,
        label: text,
      };
    });
  const [customerList, setCustomerList] = useState([]);
  const [customerListLoading, setCustomerListLoading] = useState(false);
  const [customerTransferSubmitting, setCustomerTransferSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const exchangeFileInputRef = useRef(null);
  const isUploadingRef = useRef(false);
  // Keep last successful payload mounted to avoid Drawer/Popup layout jumps while refetching.
  const lastWarrantyRef = useRef(null);
  const hasChangedRef = useRef(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1199px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (warrantyId && open) {
      setLoading(true);
      setRenderHeavy(false);
      setEditing(false);
      setEditSection('');
      setCustomerPickerOpen(false);
      setExchangeType('doi_hang');
      setExchangeAttachments([]);
      // Let the drawer/popup open immediately; defer mounting heavy UI + data commit
      // until after the open transition to avoid a mid-animation stall.
      warrantyService.getById(warrantyId)
        .then(res => {
          if (res.data.success) {
            const next = res.data.data;
            lastWarrantyRef.current = next;
            // Commit payload on next frame to avoid blocking the first half of Drawer animation.
            window.requestAnimationFrame(() => setWarranty(next));
          }
        })
        .finally(() => setLoading(false));
    }
    if (!open) {
      setWarranty(null);
      lastWarrantyRef.current = null;
      setRenderHeavy(false);
      setEditing(false);
      setEditSection('');
      setCustomerPickerOpen(false);
    }
  }, [warrantyId, open]);

  useEffect(() => {
    if (!open) return;
    setIsClosing(false);
    // Let the open transition finish, then mount the heavy tabs/forms.
    const timer = window.setTimeout(() => setRenderHeavy(true), 180);
    return () => window.clearTimeout(timer);
  }, [open, warrantyId]);

  useEffect(() => {
    if (!open || !warranty || !editing) return;
    form.setFieldsValue({
      ...warranty,
      ngayNhan: parseFormDate(warranty.ngayNhan),
      ngayMua: parseFormDate(warranty.ngayMua),
      ngayHenTra: parseFormDate(warranty.ngayHenTra),
    });
  }, [open, warranty, editing, form]);


  useEffect(() => {
    // Defer supporting fetches until after the open transition settles.
    if (!open || !warrantyId || !warranty || !renderHeavy) return;
    supplierService.getList({ page: 1, limit: 200 }).then((res) => {
      if (res.data?.success) setSuppliers(res.data.data?.rows || []);
    }).catch(() => {});
    nhanVienService.getList().then((res) => {
      if (res.data?.success) setStaffList(res.data.data || []);
    }).catch(() => {});
  }, [open, warrantyId, warranty, renderHeavy]);

  useEffect(() => {
    if (!open || !warrantyId || !warranty || !renderHeavy) return;
    warrantyService.getSupplierLogs(warrantyId)
      .then((res) => {
        if (res.data?.success) setSupplierLogs(res.data.data || []);
      })
      .catch(() => {});
  }, [open, warrantyId, warranty, renderHeavy]);

  const markChanged = useCallback(() => {
    hasChangedRef.current = true;
  }, []);

  const handleClose = useCallback(() => {
    const shouldRefresh = hasChangedRef.current;
    hasChangedRef.current = false;
    setWarranty(null);
    lastWarrantyRef.current = null;
    setEditing(false);
    setCustomerPickerOpen(false);
    setIsClosing(false);
    onClose?.();
    if (shouldRefresh) onRefresh?.();
  }, [onClose, onRefresh]);

  const handleRequestClose = useCallback(() => {
    setIsClosing(true);
    setRenderHeavy(false);
    setCancelModal(false);
    setSupplierLogEditOpen(false);
    setCustomerPickerOpen(false);
    onClose?.();
  }, [onClose]);

  if (!open || loading || !warranty) {
    const cached = lastWarrantyRef.current;
    if (isMobile) {
      return (
        <Popup visible={open} onMaskClick={handleRequestClose} position="right" bodyStyle={{ width: '100vw', height: '100vh' }}>
          <div style={{ padding: 16 }}>
            {cached ? (
              <>
                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{cached.soChungTu || ''}</div>
                <Skeleton active paragraph={{ rows: 6 }} />
              </>
            ) : (
              <div className="warranty-mobile-detail-loading">{t('common.dangTai')}...</div>
            )}
          </div>
        </Popup>
      );
    }
    return (
      <Drawer
        open={open}
        onClose={handleRequestClose}
        loading={loading}
        afterOpenChange={(visible) => {
          if (!visible) handleClose();
        }}
        title={cached ? (<Space direction="vertical" size={2}><Text strong>{cached.soChungTu}</Text></Space>) : null}
      >
        <Skeleton active paragraph={{ rows: 10 }} />
      </Drawer>
    );
  }

  const statusConfig = STATUS[warranty.trangThai];
  const validNext = statusConfig?.next || [];
  const trackingUrl = `${window.location.origin}/tra-cuu/${warranty.soChungTu}`;
  const attachments = normalizeAttachments(warranty.attachments);
  const currentCustomerKey = `${String(warranty.khachHang || '').trim().toLowerCase()}|${String(warranty.soDienThoai || '').trim()}`;

  const handleStatusChange = async (newStatus, note) => {
    try {
      const res = await warrantyService.updateStatus(warranty.id, { trangThai: newStatus, note });
      if (res.data.success) {
        message.success(t('messages:success.updateStatusSuccess'));
        markChanged();
        setWarranty(res.data.data);
        lastWarrantyRef.current = res.data.data;
      }
    } catch {
      message.error(t('messages:error.updateError'));
    }
  };

  const handleTraHang = async () => {
    try {
      const res = await warrantyService.traHang(warranty.id, { ngayTra: dayjs().format('YYYY-MM-DD') });
      if (res.data.success) {
        message.success(t('messages:success.traHang'));
        markChanged();
        setWarranty(res.data.data);
        lastWarrantyRef.current = res.data.data;
      }
    } catch {
      message.error(t('messages:error.returnError'));
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      message.warning('Vui lòng nhập lý do hủy');
      return;
    }
    try {
      const res = await warrantyService.updateStatus(warranty.id, { trangThai: 'huy', note: cancelReason });
      if (res.data.success) {
        message.success('Đã hủy phiếu');
        markChanged();
        setWarranty(res.data.data);
        lastWarrantyRef.current = res.data.data;
        setCancelModal(false);
        setCancelReason('');
      }
    } catch {
      message.error('Lỗi khi hủy phiếu');
    }
  };

  const handleUploadAttachments = async (files) => {
    if (isGlobalUploading || isUploadingRef.current) return;
    isGlobalUploading = true;
    isUploadingRef.current = true;
    const selectedFiles = Array.from(files || []).filter(Boolean);
    if (!selectedFiles.length) {
      isUploadingRef.current = false;
      isGlobalUploading = false;
      return;
    }
    if (selectedFiles.some(file => !['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type))) {
      message.warning('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP');
      isUploadingRef.current = false;
      isGlobalUploading = false;
      return;
    }
    if (selectedFiles.some(file => file.size > 5 * 1024 * 1024)) {
      message.warning('Mỗi ảnh tối đa 5MB');
      isUploadingRef.current = false;
      isGlobalUploading = false;
      return;
    }
    if (attachments.length >= 10) {
      message.warning('Tối đa 10 ảnh đính kèm');
      isUploadingRef.current = false;
      isGlobalUploading = false;
      return;
    }
    const remainingSlots = 10 - attachments.length;
    if (selectedFiles.length > remainingSlots) {
      message.warning(`Chỉ có thể thêm tối đa ${remainingSlots} ảnh nữa`);
      isUploadingRef.current = false;
      isGlobalUploading = false;
      return;
    }

    setAttachmentUploading(true);
    try {
      const payload = await Promise.all(selectedFiles.map(async (file) => ({
        name: file.name || 'image',
        mime: file.type || 'image/jpeg',
        dataUrl: await fileToDataUrl(file),
        publicVisible: true,
      })));
      const res = await warrantyService.addAttachments(warranty.id, payload);
      if (res.data.success) {
        markChanged();
        setWarranty(res.data.data);
        message.success('Đã thêm ảnh đính kèm');
      }
    } catch (err) {
      message.error(err?.response?.data?.error?.message || 'Lỗi khi thêm ảnh');
    } finally {
      setAttachmentUploading(false);
      isUploadingRef.current = false;
      isGlobalUploading = false;
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    try {
      const res = await warrantyService.deleteAttachment(warranty.id, attachmentId);
      if (res.data.success) {
        markChanged();
        setWarranty(res.data.data);
        if (normalizeAttachments(res.data.data?.attachments).length === 0) {
          message.success('Đã xóa ảnh đính kèm');
        }
      }
    } catch (err) {
      message.error(err?.response?.data?.error?.message || 'Lỗi khi xóa ảnh');
    }
  };

  const loadCustomerList = async () => {
    setCustomerListLoading(true);
    try {
      const res = await customerService.list();
      if (res.data?.success) setCustomerList(res.data.data || []);
    } catch {
      message.error('Không thể tải danh sách khách hàng');
    } finally {
      setCustomerListLoading(false);
    }
  };

  const openCustomerTransfer = () => {
    setCustomerPickerOpen(true);
    loadCustomerList();
  };

  const handleTransferCustomer = async (customer) => {
    if (!customer?.key || customerTransferSubmitting) return;
    setCustomerTransferSubmitting(true);
    try {
      const res = await warrantyService.transferCustomer(warranty.id, customer.key);
      if (res.data?.success) {
        markChanged();
        setWarranty(res.data.data);
        setCustomerPickerOpen(false);
        message.success('Đã chuyển khách hàng cho CT');
      }
    } catch (err) {
      message.error(err?.response?.data?.error?.message || 'Không thể chuyển khách hàng');
    } finally {
      setCustomerTransferSubmitting(false);
    }
  };

  const startInlineEdit = (section) => {
    form.setFieldsValue({
      ...warranty,
      ngayNhan: parseFormDate(warranty.ngayNhan),
      ngayMua: parseFormDate(warranty.ngayMua),
      ngayHenTra: parseFormDate(warranty.ngayHenTra),
    });
    setEditSection(section);
    setEditing(true);
  };

  const cancelInlineEdit = () => {
    setEditing(false);
    setEditSection('');
  };

  const sectionActions = (section) => {
    if (editing && editSection === section) {
      return (
        <Space>
          <Button size="small" type="primary" onClick={handleSave}>Lưu</Button>
          <Button size="small" onClick={cancelInlineEdit}>Hủy</Button>
        </Space>
      );
    }

    if (section === 'customer') {
      return (
        <Space size={6}>
          <Button size="small" icon={<EditOutlined />} onClick={() => startInlineEdit(section)}>Sửa</Button>
          <Button size="small" icon={<SwapOutlined />} loading={customerTransferSubmitting} onClick={openCustomerTransfer}>Chuyển khách</Button>
        </Space>
      );
    }

    return <Button size="small" icon={<EditOutlined />} onClick={() => startInlineEdit(section)}>Sửa</Button>;
  };

  async function handleSave() {
    try {
      const rawValues = form.getFieldsValue();
      const values = {
        ...rawValues,
        ngayNhan: rawValues.ngayNhan ? rawValues.ngayNhan.format('YYYY-MM-DDTHH:mm:ss') : warranty.ngayNhan,
        ngayMua: rawValues.ngayMua ? rawValues.ngayMua.format('YYYY-MM-DD') : '',
        ngayHenTra: rawValues.ngayHenTra ? rawValues.ngayHenTra.format('YYYY-MM-DD') : 'none',
      };
      const res = await warrantyService.update(warranty.id, values);
      if (res.data.success) {
        message.success('Cập nhật thành công');
        markChanged();
        setWarranty(res.data.data);
        setEditing(false);
        setEditSection('');
      }
    } catch {
      message.error(t('messages:error.updateError'));
    }
  }

  const handleLogProgress = async (values) => {
    if (!values.note?.trim()) return;
    setLogSubmitting(true);
    try {
      const res = await warrantyService.logProgress(warranty.id, values.note);
      if (res.data.success) {
        message.success('Đã thêm ghi chú tiến trình');
        markChanged();
        setWarranty(res.data.data);
        logForm.resetFields();
      }
    } catch {
      message.error('Lỗi khi thêm ghi chú');
    } finally {
      setLogSubmitting(false);
    }
  };

  const handleExchangeReturn = async (values) => {
    setExchangeSubmitting(true);
    try {
      const payload = exchangeType === 'doi_hang'
        ? {
          type: 'doi_hang',
          tenHangMoi: values.tenHangMoi?.trim(),
          soSeriMoi: values.soSeriMoi?.trim(),
          note: values.note?.trim() || '',
          attachmentsInput: exchangeAttachments.map(({ dataUrl, name, mime }) => ({ dataUrl, name, mime, publicVisible: true })),
        }
        : {
          type: 'tra_hang',
          reason: values.reason?.trim(),
          note: values.note?.trim() || '',
          attachmentsInput: exchangeAttachments.map(({ dataUrl, name, mime }) => ({ dataUrl, name, mime, publicVisible: true })),
        };
      const res = await warrantyService.exchangeReturn(warranty.id, payload);
      if (res.data.success) {
        message.success(exchangeType === 'doi_hang' ? 'Đã xác nhận đổi hàng' : 'Đã xác nhận trả hàng');
        markChanged();
        setWarranty(res.data.data);
        setExchangeAttachments([]);
        exchangeForm.resetFields();
      }
    } catch (err) {
      message.error(err?.response?.data?.error?.message || 'Lỗi khi xử lý đổi/trả hàng');
    } finally {
      setExchangeSubmitting(false);
    }
  };


  const handleSendToSupplier = async () => {
    try {
      if (supplierLogs.length > 0) {
        const ok = await new Promise((resolve) => {
          Modal.confirm({
            title: 'Xác nhận gửi NCC',
            content: 'Đã có sự kiện trong lịch sử gửi / nhận NCC. Xác nhận gửi mới?',
            okText: 'Xác nhận gửi',
            cancelText: 'Hủy',
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });
        if (!ok) return;
      }

      const values = await sendForm.validateFields();
      setSendSubmitting(true);
      const payload = {
        supplierId: values.supplierId,
        sentAt: values.sentAt ? values.sentAt.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        expectedReturnAt: values.expectedReturnAt ? values.expectedReturnAt.format('YYYY-MM-DD') : '',
        note: values.note || '',
      };
      const res = await warrantyService.sendToSupplier(warranty.id, payload);
      if (res.data?.success) {
        message.success('Đã gửi nhà cung cấp');
        markChanged();
        setWarranty(res.data.data);
        sendForm.resetFields();
        const logRes = await warrantyService.getSupplierLogs(warranty.id);
        if (logRes.data?.success) setSupplierLogs(logRes.data.data || []);
      }
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.error?.message || 'Kh?ng th? g?i NCC');
    } finally {
      setSendSubmitting(false);
    }
  };

  const handleAddExchangeAttachments = async (files = []) => {
    const incoming = Array.from(files || []);
    if (!incoming.length) return;
    const remaining = 10 - exchangeAttachments.length;
    if (remaining <= 0) {
      message.warning('Tối đa 10 ảnh đổi/trả hàng');
      return;
    }
    try {
      const mapped = await Promise.all(incoming.slice(0, remaining).map(async (file) => ({
        uid: file.uid || `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        mime: file.type,
        dataUrl: await fileToDataUrl(file),
      })));
      setExchangeAttachments((prev) => [...prev, ...mapped]);
    } catch {
      message.error('Không thể đọc ảnh đính kèm');
    }
  };

  const handleExchangeUploadClick = () => {
    if (exchangeFileInputRef.current) {
      exchangeFileInputRef.current.click();
    }
  };

  const handleExchangeFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []).filter(Boolean);
    if (selectedFiles.length > 0) {
      handleAddExchangeAttachments(selectedFiles);
    }
    e.target.value = '';
  };

  const exchangeAttachmentUpload = (
    <div style={{ display: 'inline-block' }}>
      <input
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        ref={exchangeFileInputRef}
        onChange={handleExchangeFileChange}
        style={{ display: 'none' }}
      />
      <Button
        size="small"
        icon={<UploadOutlined />}
        disabled={exchangeAttachments.length >= 10 || exchangeSubmitting}
        onClick={handleExchangeUploadClick}
      >
        Thêm ảnh
      </Button>
    </div>
  );

  const renderExchangeAttachmentGrid = (items = [], options = {}) => {
    const compact = Boolean(options.compact);
    const removable = Boolean(options.removable);
    if (!items.length) return null;
    return (
      <Image.PreviewGroup>
        <div className={`warranty-exchange-attachment-grid ${compact ? 'is-compact' : ''}`}>
          {items.map((img, index) => (
            <div className="warranty-exchange-attachment" key={img.id || img.uid || img.url || `${img.name}-${index}`}>
              <Image
                src={img.url || img.dataUrl}
                alt={img.name || 'Ảnh đổi/trả hàng'}
                preview={{ mask: 'Xem ảnh' }}
                width="100%"
                height={compact ? 104 : 118}
                wrapperStyle={{ display: 'block', width: '100%' }}
                style={{ display: 'block', width: '100%', height: compact ? 104 : 118, objectFit: 'cover' }}
              />
              {removable && (
                <Button
                  size="small"
                  danger
                  type="primary"
                  icon={<DeleteOutlined />}
                  style={{ position: 'absolute', top: 6, right: 6, zIndex: 2 }}
                  onClick={() => setExchangeAttachments((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                />
              )}
            </div>
          ))}
        </div>
      </Image.PreviewGroup>
    );
  };

  const refreshWarrantyDetail = async () => {
    if (!warrantyId) return null;
    const detailRes = await warrantyService.getById(warrantyId);
    if (detailRes.data?.success) {
      const next = detailRes.data.data;
      lastWarrantyRef.current = next;
      setWarranty(next);
      return next;
    }
    return null;
  };

  const openSupplierLogNoteEdit = (log) => {
    setSupplierLogEditing(log);
    setSupplierLogNote(log?.note || '');
    setSupplierLogSupplierId(log?.supplierId || '');
    setSupplierLogEditOpen(true);
  };

  const submitSupplierLogNote = async () => {
    if (!supplierLogEditing?.id) return;
    setSupplierLogSaving(true);
    try {
      const res = await warrantyService.updateSupplierLogNote(warranty.id, supplierLogEditing.id, {
        supplierId: supplierLogSupplierId,
        note: supplierLogNote,
      });
      if (res.data?.success) {
        markChanged();
        setSupplierLogs((rows) => rows.map((row) => (row.id === supplierLogEditing.id ? { ...row, ...res.data.data } : row)));
        const refreshed = await refreshWarrantyDetail();
        try {
          await Promise.resolve(onSaved?.(refreshed || null));
        } catch (callbackErr) {
          console.error('onSaved after updateSupplierLogNote failed:', callbackErr);
        }
        setSupplierLogEditOpen(false);
        setSupplierLogEditing(null);
        setSupplierLogNote('');
        setSupplierLogSupplierId('');
        message.success('Đã cập nhật NCC');
      }
    } catch (err) {
      message.error(err?.response?.data?.error?.message || 'Không thể cập nhật ghi chú NCC');
    } finally {
      setSupplierLogSaving(false);
    }
  };

  const handleDeleteSupplierLog = async (log) => {
    if (!log?.id) return;
    try {
      const res = await warrantyService.deleteSupplierLog(warranty.id, log.id);
      if (res.data?.success) {
        markChanged();
        setSupplierLogs((rows) => rows.filter((row) => row.id !== log.id));
        message.success('Đã xóa lịch sử NCC');
        try {
          await Promise.resolve(onSaved?.(res.data.data || null));
        } catch (callbackErr) {
          console.error('onSaved after deleteSupplierLog failed:', callbackErr);
        }
      }
    } catch (err) {
      message.error(err?.response?.data?.error?.message || 'Không thể xóa lịch sử NCC');
    }
  };

  const handleDeleteHistory = async (historyIndex) => {
    if (historyIndex == null) return;
    try {
      const res = await warrantyService.deleteHistory(warranty.id, historyIndex);
      if (res.data?.success) {
        markChanged();
        if (res.data.data) {
          setWarranty(res.data.data);
        }
        message.success('Đã xóa dòng lịch sử');
        try {
          await Promise.resolve(onSaved?.(res.data.data || null));
        } catch (callbackErr) {
          console.error('onSaved after deleteHistory failed:', callbackErr);
        }
      }
    } catch (err) {
      message.error(err?.response?.data?.error?.message || 'Không thể xóa dòng lịch sử');
    }
  };

  const getSupplierForPrint = () => {
    const latestSentLog = supplierLogs
      .filter((log) => log.action === 'sent')
      .sort((a, b) => dayjs(b.at).valueOf() - dayjs(a.at).valueOf())[0] || supplierLogs[0];
    const supplier = suppliers.find((item) => item.id === latestSentLog?.supplierId);
    return {
      log: latestSentLog,
      supplier,
      name: supplier?.name || latestSentLog?.supplierName || 'Nhà cung cấp',
      phone: supplier?.phone || '',
      address: supplier?.address || '',
    };
  };

  const printSupplierTicket = () => {
    if (!supplierLogs.length) return;
    const supplierInfo = getSupplierForPrint();
    const printedAt = dayjs().format('DD/MM/YYYY HH:mm');
    const documentCode = warranty.soChungTu || warranty.id || '';
    const companyName = t('print:company');
    const companyAddress = t('print:address');
    const companyPhone = t('print:taxInfo');
    const companyWebsite = t('print:webInfo');
    const companyMark = companyName
      .split(/\s+/)
      .filter(Boolean)
      .slice(-3)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
    const supplierNote = supplierInfo.log?.note || '';
    const productRows = [{
      tenHang: warranty.tenHang || '-',
      soSeri: warranty.soSeri || '-',
      loi: warranty.loiLucNhan || '-',
      ghiChu: supplierNote || warranty.ghiChu || '-',
      soLuong: 1,
    }];
    const minRows = 5;
    const emptyRows = Array.from({ length: Math.max(0, minRows - productRows.length) });
    const totalQuantity = productRows.reduce((sum, item) => sum + Number(item.soLuong || 0), 0);
    const productRowsHtml = [
      ...productRows.map((item, index) => {
        const serial = escapeHtml(item.soSeri);
        return `
      <tr>
        <td class="c">${index + 1}</td>
        <td>${escapeHtml(item.tenHang)}</td>
        <td class="serial-cell"><span class="sn" title="${serial}">${serial}</span></td>
        <td>${escapeHtml(item.loi)}</td>
        <td>${escapeHtml(item.ghiChu)}</td>
        <td class="c">${escapeHtml(item.soLuong)}</td>
      </tr>`;
      }),
      ...emptyRows.map((_, index) => `
      <tr>
        <td class="c">${productRows.length + index + 1}</td>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
      </tr>`),
    ].join('');
    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>PHIẾU GỬI BẢO HÀNH - SỬA CHỮA - ${escapeHtml(documentCode)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #e5e5e5; padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 10px; font-family: Arial, "Segoe UI", Tahoma, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .btn { background: #111; color: #fff; border: none; padding: 6px 16px; font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase; font-weight: 800; cursor: pointer; border-radius: 2px; align-self: flex-end; }
    .slip { width: 560px; background: #fff; padding: 12px 15px 10px; box-shadow: 0 2px 12px rgba(0,0,0,.18); font-size: 11.5px; color: #000; line-height: 1.42; }
    .hd { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 7px; border-bottom: 2px solid #000; margin-bottom: 7px; }
    .hd-l { display: flex; gap: 8px; align-items: flex-start; min-width: 0; }
    .logo { width: 82px; height: 36px; object-fit: contain; flex-shrink: 0; filter: grayscale(1) contrast(1.35); }
    .co-name { font-weight: 900; font-size: 14px; text-transform: uppercase; letter-spacing: .25px; margin-bottom: 2px; color: #000; }
    .co-info { font-size: 8.8px; color: #000; line-height: 1.65; font-weight: 600; }
    .hd-r { text-align: right; font-size: 8.8px; color: #000; flex-shrink: 0; font-weight: 600; }
    .doc-code { font-family: Consolas, "Courier New", monospace; font-size: 12px; color: #000; font-weight: 800; display: block; margin-top: 1px; letter-spacing: .4px; }
    .ttl { text-align: center; margin: 5px 0 6px; }
    .ttl h1 { display: inline-block; font-weight: 900; font-size: 13.5px; text-transform: uppercase; letter-spacing: 1.35px; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 2px 18px; color: #000; }
    .sup { display: grid; grid-template-columns: 1.3fr .8fr 1.7fr; border: 1px solid #000; margin-bottom: 7px; font-size: 11.5px; color: #000; }
    .sf { padding: 5px 7px; border-right: 1px solid #000; min-width: 0; font-weight: 800; line-height: 1.35; overflow-wrap: anywhere; word-break: break-word; }
    .sf:last-child { border-right: none; }
    .sf.w2 { flex: none; }
    .sl { display: block; font-size: 7px; font-weight: 900; color: #000; text-transform: uppercase; letter-spacing: .3px; margin-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 10.2px; table-layout: fixed; color: #000; }
    thead th { background: #fff; color: #000; font-weight: 900; font-size: 8.8px; letter-spacing: .35px; text-transform: uppercase; padding: 4px 4px; text-align: center; border: 1.2px solid #000; }
    tbody td { border: 1px solid #000; padding: 4.2px 5px; vertical-align: top; line-height: 1.42; font-weight: 700; overflow-wrap: anywhere; word-break: break-word; }
    tbody td:nth-child(2) { font-size: 11.4px; font-weight: 850; line-height: 1.35; }
    tbody tr:nth-child(even) td { background: #fff; }
    td.serial-cell { white-space: nowrap; overflow: visible; }
    .sn { font-family: Consolas, "Courier New", monospace; font-size: 8.6px; white-space: nowrap; display: inline-block; overflow: visible; text-overflow: clip; font-weight: 800; transform-origin: left center; }
    .tot td { border-top: 1.8px solid #000 !important; font-weight: 900; font-size: 9.2px; background: #fff !important; }
    .c { text-align: center; }
    .r { text-align: right; }
    .sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 9px; }
    .sig { border: 1px solid #000; padding: 4px 10px 28px; text-align: center; }
    .sig-t { font-weight: 900; font-size: 9.8px; text-transform: uppercase; letter-spacing: .4px; color: #000; }
    .sig-s { font-size: 7.8px; color: #000; font-style: italic; margin-top: 1px; font-weight: 600; }
    @media print {
      body { background: #fff; padding: 0; }
      .btn { display: none; }
      .slip { width: 100%; box-shadow: none; padding: 0; }
      @page { size: 148mm 210mm; margin: 8mm; }
    }
  </style>
</head>
<body>
  <button class="btn no-print" onclick="window.print()">⎙ &nbsp;In Phiếu</button>
  <div class="slip">
    <div class="hd">
      <div class="hd-l">
        <img class="logo" src="/logo.png" alt="Logo">
        <div>
          <div class="co-name">${escapeHtml(companyName)}</div>
          <div class="co-info">${escapeHtml(companyAddress)}<br>ĐT/Zalo: ${escapeHtml(companyPhone)} &nbsp;·&nbsp; ${escapeHtml(companyWebsite)}</div>
        </div>
      </div>
      <div class="hd-r">
        <div>Ngày in: &nbsp;<strong style="color:#111">${escapeHtml(printedAt)}</strong></div>
        <div style="margin-top:5px;color:#999;font-size:7.5px;letter-spacing:.5px;text-transform:uppercase">Số chứng từ</div>
        <span class="doc-code">${escapeHtml(documentCode)}</span>
      </div>
    </div>

    <div class="ttl"><h1>PHIẾU GỬI BẢO HÀNH - SỬA CHỮA</h1></div>

    <div class="sup">
      <div class="sf w2"><span class="sl">Nhà cung cấp</span>${escapeHtml(supplierInfo.name)}</div>
      <div class="sf"><span class="sl">Điện thoại</span>${escapeHtml(supplierInfo.phone || '—')}</div>
      <div class="sf w2"><span class="sl">Địa chỉ</span>${escapeHtml(supplierInfo.address || '—')}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:22px">STT</th>
          <th>Tên Hàng</th>
          <th style="width:150px">Số Seri</th>
          <th>Mô Tả Lỗi</th>
          <th style="width:48px">Ghi Chú</th>
          <th style="width:22px">SL</th>
        </tr>
      </thead>
      <tbody>
        ${productRowsHtml}
        <tr class="tot">
          <td colspan="5" class="r" style="padding-right:10px">Tổng cộng:</td>
          <td class="c">${escapeHtml(totalQuantity)}</td>
        </tr>
      </tbody>
    </table>

    <div class="sigs">
      <div class="sig"><div class="sig-t">Khách Hàng</div><div class="sig-s">(Ký, ghi rõ họ tên)</div></div>
      <div class="sig"><div class="sig-t">Người Lập Phiếu</div><div class="sig-s">(Ký, ghi rõ họ tên)</div></div>
    </div>
  </div>
  <script>
    (function () {
      function fitSerial() {
        document.querySelectorAll('.serial-cell .sn').forEach(function (el) {
          var cell = el.closest('.serial-cell');
          if (!cell) return;
          el.style.transform = '';
          el.style.fontSize = '8.6px';
          var available = cell.clientWidth - 10;
          if (el.scrollWidth > available && el.scrollWidth > 0) {
            el.style.transform = 'scaleX(' + Math.max(0.72, available / el.scrollWidth) + ')';
          }
        });
      }
      window.addEventListener('load', fitSerial);
      window.addEventListener('beforeprint', fitSerial);
      fitSerial();
    })();
  </script>
</body>
</html>`;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      message.error('Không thể mở cửa sổ in. Vui lòng cho phép popup.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        // Browser may block programmatic print; the printable page is still visible.
      }
    }, 500);
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []).filter(Boolean);
    if (selectedFiles.length > 0) {
      handleUploadAttachments(selectedFiles);
    }
    e.target.value = '';
  };

  const uploadAttachmentButton = (
    <div style={{ display: 'inline-block' }}>
      <input
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <Button
        size="small"
        icon={<UploadOutlined />}
        loading={attachmentUploading}
        disabled={attachments.length >= 10 || attachmentUploading}
        onClick={handleUploadClick}
      >
        Thêm ảnh
      </Button>
    </div>
  );

  const renderAttachmentGrid = (compact = false) => (
    <Image.PreviewGroup>
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: compact ? 8 : 10 }}>
        {attachments.map((img) => (
          <div
            key={img.id || img.url}
            style={{
              position: 'relative',
              border: '1px solid var(--ant-color-border-secondary, #e5e7eb)',
              borderRadius: 8,
              overflow: 'hidden',
              background: 'var(--ant-color-bg-container, #fff)',
            }}
          >
            <Image
              src={img.url}
              alt={img.name || 'Ảnh đính kèm'}
              preview={{ mask: 'Xem ảnh' }}
              width="100%"
              height={compact ? 112 : 118}
              wrapperStyle={{ display: 'block', width: '100%' }}
              style={{ display: 'block', width: '100%', height: compact ? 112 : 118, objectFit: 'cover' }}
            />
            <Popconfirm title="Xóa ảnh đính kèm này?" okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }} onConfirm={() => handleDeleteAttachment(img.id)}>
              <Button
                size="small"
                danger
                type="primary"
                icon={<DeleteOutlined />}
                style={{ position: 'absolute', top: 6, right: 6, zIndex: 2 }}
              />
            </Popconfirm>
          </div>
        ))}
      </div>
    </Image.PreviewGroup>
  );

  const renderAttachmentsCard = () => (
    <Card size="small" title={`Hình ảnh đính kèm (${attachments.length}/10)`} extra={uploadAttachmentButton}>
      {attachments.length > 0 ? (
        renderAttachmentGrid(false)
      ) : (
        <Text type="secondary">Chưa có ảnh đính kèm. Ảnh thêm tại đây sẽ hiển thị trên trang tra cứu khách hàng.</Text>
      )}
    </Card>
  );

  const renderExchangeReturn = () => {
    const doiTra = warranty.doiTra;
    const isClosed = warranty.trangThai === 'da_tra' || warranty.trangThai === 'huy';

    if (doiTra) {
      return (
        <Card title={doiTra.type === 'doi_hang' ? 'Thông tin đổi hàng' : 'Thông tin trả hàng'}>
          <Descriptions layout="vertical" column={1}>
            <Descriptions.Item label="Loại xử lý">{doiTra.type === 'doi_hang' ? 'Đổi hàng' : 'Trả hàng'}</Descriptions.Item>
            <Descriptions.Item label="Thời gian">{formatDate(doiTra.at, 'DD/MM/YYYY HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="Nhân viên">{getStaffName(doiTra.by)}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái"><StatusTag status={warranty.trangThai} /></Descriptions.Item>
            <Descriptions.Item label="Sản phẩm cũ">{doiTra.tenHangCu || '-'}</Descriptions.Item>
            <Descriptions.Item label="Serial cũ">{doiTra.soSeriCu || '-'}</Descriptions.Item>
            {doiTra.type === 'doi_hang' ? (
              <>
                <Descriptions.Item label="Sản phẩm đổi sang">{doiTra.tenHangMoi || '-'}</Descriptions.Item>
                <Descriptions.Item label="Serial mới">{doiTra.soSeriMoi || '-'}</Descriptions.Item>
              </>
            ) : (
              <Descriptions.Item label="Lý do trả hàng">{doiTra.reason || '-'}</Descriptions.Item>
            )}
            {doiTra.note && <Descriptions.Item label="Ghi chú">{doiTra.note}</Descriptions.Item>}
            <Descriptions.Item label={`Hình ảnh (${normalizeAttachments(doiTra.attachments).length})`}>
              {normalizeAttachments(doiTra.attachments).length > 0
                ? renderExchangeAttachmentGrid(normalizeAttachments(doiTra.attachments))
                : <Text type="secondary">Chưa có ảnh đính kèm.</Text>}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      );
    }

    if (isClosed) {
      return <Alert type="info" showIcon message="Phiếu đã xong hoặc đã hủy, không thể đổi/trả hàng." />;
    }

    return (
      <Card title="Xác nhận đổi/trả hàng">
        <Form
          form={exchangeForm}
          layout="vertical"
          initialValues={{ type: 'doi_hang' }}
          onFinish={handleExchangeReturn}
        >
          <Form.Item label="Loại xử lý" name="type">
            <Select
              onChange={value => setExchangeType(value)}
              options={[
                { label: 'Đổi hàng', value: 'doi_hang' },
                { label: 'Trả hàng', value: 'tra_hang' },
              ]}
            />
          </Form.Item>

          {exchangeType === 'doi_hang' ? (
            <>
              <Form.Item label="Tên sản phẩm đổi sang" name="tenHangMoi" rules={[{ required: true, message: 'Nhập tên sản phẩm đổi sang' }]}>
                <Input placeholder="VD: SSD Kingston NV2 500GB" />
              </Form.Item>
              <Form.Item label="Số serial mới" name="soSeriMoi" rules={[{ required: true, message: 'Nhập số serial mới' }]}>
                <Input placeholder="VD: SN123456" />
              </Form.Item>
            </>
          ) : (
            <Form.Item label="Lý do trả hàng" name="reason" rules={[{ required: true, message: 'Nhập lý do trả hàng' }]}>
              <TextArea rows={3} placeholder="VD: Không có hàng thay thế, hoàn/trả theo thỏa thuận..." />
            </Form.Item>
          )}

          <Form.Item label="Ghi chú" name="note">
            <TextArea rows={2} placeholder="Ghi chú thêm nếu có" />
          </Form.Item>

          <Form.Item label={`Hình ảnh đính kèm (${exchangeAttachments.length}/10)`}>
            <Space direction="vertical" size={10} style={{ display: 'flex' }}>
              {exchangeAttachmentUpload}
              {exchangeAttachments.length > 0
                ? renderExchangeAttachmentGrid(exchangeAttachments, { removable: true })
                : <Text type="secondary">Có thể đính kèm ảnh sản phẩm đổi/trả.</Text>}
            </Space>
          </Form.Item>

          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Sau khi xác nhận, phiếu sẽ tự chuyển sang Đã xong và không thể đổi/trả lần nữa."
          />

          <Button type="primary" htmlType="submit" loading={exchangeSubmitting}>
            {exchangeType === 'doi_hang' ? 'Xác nhận đổi hàng' : 'Xác nhận trả hàng'}
          </Button>
        </Form>
      </Card>
    );
  };

  const isVisibleHistoryEntry = (entry) => {
    if (!entry || entry.action === 'delete') return false;

    const note = String(entry?.note || '').toLowerCase();
    if (note.includes('supplierlogs:')) return false;
    if (note.includes('xóa 1 dòng lịch sử gửi / nhận ncc')) return false;

    if (entry.action === 'update') {
      const changes = entry?.changes || {};
      const keys = Object.keys(changes).map((k) => String(k).toLowerCase());
      if (keys.length > 0 && keys.every((key) => key.includes('supplierlogs'))) return false;
      const detailText = String(getUpdateHistoryDetail(entry) || '').trim().toLowerCase();
      if (!detailText || detailText === 'supplierlogs:') return false;
    }

    return true;
  };

  const getAttachmentHistoryDetail = (entry) => normalizeHistoryText(entry.note)
    .replaceAll('Xóa ảnh đính kèm', 'Đã xóa ảnh đính kèm');

  const getUpdateHistoryDetail = (entry) => {
    const fieldLabels = {
      tenHang: 'Tên sản phẩm',
      loiLucNhan: 'Lỗi lúc nhận',
      ngayHenTra: 'Ngày hẹn trả',
      ngayNhan: 'Ngày nhận',
      ngayMua: 'Ngày mua',
      ngayTra: 'Ngày trả',
      tenKhach: 'Tên khách hàng',
      khachHang: 'Khách hàng',
      sdt: 'Số điện thoại',
      soDienThoai: 'Số điện thoại',
      diaChi: 'Địa chỉ',
      tenCuaHang: 'Tên cửa hàng',
      tenSanPham: 'Tên sản phẩm',
      soSeri: 'Số seri',
      serial: 'Serial',
      imei: 'IMEI',
      cauHinh: 'Cấu hình',
      phuKien: 'Phụ kiện',
      ghiChu: 'Ghi chú',
      trangThai: 'Trạng thái',
      uuTien: 'Ưu tiên',
      loaiXuLy: 'Loại xử lý',
    };

    const formatFieldValue = (field, raw) => {
      if (raw === null || raw === undefined || raw === '') return '';
      if (field === 'ngayHenTra') {
        if (raw === 'none') return 'Đang cập nhập...';
        const d = dayjs(raw);
        return d.isValid() ? d.format('DD-MM-YYYY') : String(raw);
      }
      if (field === 'loaiXuLy') {
        return LOAI_XU_LY_LABELS?.[raw] || String(raw);
      }
      return String(raw);
    };

    const changes = entry?.changes || {};
    const rows = Object.entries(changes).map(([field, value]) => {
      const label = fieldLabels[field] || field;
      const fromValue = formatFieldValue(field, value?.from);
      const toValue = formatFieldValue(field, value?.to);
      if (field === 'ngayHenTra' && value?.from === 'none') {
        return `${label}: ${toValue}`;
      }
      if (field === 'ngayHenTra' && value?.to === 'none') {
        return `${label}: ${toValue}`;
      }
      if (!fromValue && toValue) return `${label}: ${toValue}`;
      if (fromValue && !toValue) return `${label}: ${fromValue}`;
      if (!fromValue && !toValue) return `${label}:`;
      return `${label}: ${fromValue} → ${toValue}`;
    });
    const note = normalizeHistoryText(entry?.note || '').trim();
    if (rows.length && note) return `${rows.join('\n')}\n${note}`;
    if (rows.length) return rows.join('\n');
    return note;
  };

  const getCustomerHistoryDetail = (entry) => {
    const from = entry?.customer?.from || {};
    const to = entry?.customer?.to || {};
    const fromLabel = [from.khachHang, from.soDienThoai].filter(Boolean).join(' - ') || 'Chưa có khách hàng';
    const toLabel = [to.khachHang, to.soDienThoai].filter(Boolean).join(' - ') || 'Chưa có khách hàng';
    const note = normalizeHistoryText(entry?.note || '').trim();
    if (entry?.action === 'customer_transfer') return `Khách hàng: ${fromLabel} → ${toLabel}${note ? `\n${note}` : ''}`;
    if (entry?.action === 'customer_detached') return `Khách hàng: ${fromLabel} → Chưa có khách hàng${note ? `\n${note}` : ''}`;
    return note;
  };

  const visibleHistory = buildInternalHistoryTimeline(warranty.history || [], warranty)
    .map((item) => ({ ...item, entry: item.entry, index: item.index }));

  const getStaffName = (code) => {
    if (!code) return '-';
    const key = String(code).trim().toLowerCase();
    const staff = staffList.find((item) => String(item.maNV || '').trim().toLowerCase() === key);
    return staff?.tenNV || code;
  };

  const items = [
    {
      key: 'info',
      label: 'Thông tin',
      children: (
        <Form form={form} layout="vertical" component={false}>
          <div>
          <Space direction="vertical" size={12} style={{ display: 'flex' }}>
            <Card size="small" title="Tóm tắt" extra={sectionActions('summary')}>
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="Số chứng từ">{warranty.soChungTu}</Descriptions.Item>
                <Descriptions.Item label="Trạng thái"><StatusTag status={warranty.trangThai} /></Descriptions.Item>
                <Descriptions.Item label="Nhân viên">{getStaffName(warranty.maNhanVien)}</Descriptions.Item>
                <Descriptions.Item label="Ngày nhận">
                  {editing && editSection === 'summary'
                    ? <Form.Item name="ngayNhan" style={{ marginBottom: 0 }}><DatePicker showTime style={{ width: '100%' }} format="DD/MM/YYYY HH:mm" /></Form.Item>
                    : formatDate(warranty.ngayNhan, 'DD/MM/YYYY HH:mm')}
                </Descriptions.Item>
                {warranty?.trangThai !== 'da_tra' && warranty?.trangThai !== 'huy' && <Descriptions.Item label="Ngày hẹn trả">
                  {editing && editSection === 'summary'
                    ? <Form.Item name="ngayHenTra" style={{ marginBottom: 0 }}><DatePicker allowClear style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item>
                    : (warranty.ngayHenTra === 'none'
                        ? <span>Đang cập nhập<span className="loading-dots" /></span>
                        : formatDate(warranty.ngayHenTra))}
                </Descriptions.Item>}
                <Descriptions.Item label="Ngày trả">{warranty.ngayTra ? formatDate(warranty.ngayTra) : '-'}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card
              size="small"
              title="Khách hàng"
              extra={sectionActions('customer')}
            >
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="Khách hàng">
                  {editing && editSection === 'customer'
                    ? <Form.Item name="khachHang" style={{ marginBottom: 0 }}><Input /></Form.Item>
                    : (warranty.khachHang || '-')}
                </Descriptions.Item>
                <Descriptions.Item label="Số điện thoại">
                  {editing && editSection === 'customer'
                    ? <Form.Item name="soDienThoai" style={{ marginBottom: 0 }}><Input /></Form.Item>
                    : (warranty.soDienThoai || '-')}
                </Descriptions.Item>
                <Descriptions.Item label="Địa chỉ">
                  {editing && editSection === 'customer'
                    ? <Form.Item name="diaChi" style={{ marginBottom: 0 }}><TextArea rows={2} /></Form.Item>
                    : (warranty.diaChi || '-')}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="Sản phẩm & xử lý" extra={sectionActions('product')}>
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="Tên hàng">
                  {editing && editSection === 'product'
                    ? <Form.Item name="tenHang" style={{ marginBottom: 0 }}><Input /></Form.Item>
                    : (warranty.tenHang || '-')}
                </Descriptions.Item>
                <Descriptions.Item label="Số seri">
                  {editing && editSection === 'product'
                    ? <Form.Item name="soSeri" style={{ marginBottom: 0 }}><Input /></Form.Item>
                    : (warranty.soSeri || '-')}
                </Descriptions.Item>
                <Descriptions.Item label="Lỗi lúc nhận">
                  {editing && editSection === 'product'
                    ? <Form.Item name="loiLucNhan" style={{ marginBottom: 0 }}><TextArea rows={2} /></Form.Item>
                    : (warranty.loiLucNhan || '-')}
                </Descriptions.Item>
                <Descriptions.Item label="Phụ kiện">
                  {editing && editSection === 'product'
                    ? <Form.Item name="phuKien" style={{ marginBottom: 0 }}><Input /></Form.Item>
                    : (warranty.phuKien || '-')}
                </Descriptions.Item>
                <Descriptions.Item label="Chi phí">
                  {editing && editSection === 'product'
                    ? <Form.Item name="chiPhi" style={{ marginBottom: 0 }}><Input /></Form.Item>
                    : (warranty.chiPhi ? `${warranty.chiPhi.toLocaleString('vi-VN')} đ` : 'Miễn phí')}
                </Descriptions.Item>
                <Descriptions.Item label="Loại xử lý">
                  {editing && editSection === 'product'
                    ? <Form.Item name="loaiXuLy" style={{ marginBottom: 0 }}><Select options={LOAI_XU_LY_OPTIONS} /></Form.Item>
                    : <Tag>{LOAI_XU_LY_LABELS[warranty.loaiXuLy] || warranty.loaiXuLy}</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="Bảo hành">
                  {editing && editSection === 'product'
                    ? <Form.Item name="baoHanh" style={{ marginBottom: 0 }}><Input /></Form.Item>
                    : (warranty.baoHanh || '-')}
                </Descriptions.Item>
                <Descriptions.Item label="Ngày mua">
                  {editing && editSection === 'product'
                    ? <Form.Item name="ngayMua" style={{ marginBottom: 0 }}><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item>
                    : formatDate(warranty.ngayMua)}
                </Descriptions.Item>
              </Descriptions>

              {(editing && editSection === 'product') || warranty.cauHinh || warranty.ghiChu ? (
                <Descriptions size="small" column={1} style={{ marginTop: 8 }}>
                  <Descriptions.Item label="Cấu hình">
                    {editing && editSection === 'product'
                      ? <Form.Item name="cauHinh" style={{ marginBottom: 0 }}><Input /></Form.Item>
                      : (warranty.cauHinh || '-')}
                  </Descriptions.Item>
                  <Descriptions.Item label="Ghi chú">
                    {editing && editSection === 'product'
                      ? <Form.Item name="ghiChu" style={{ marginBottom: 0 }}><TextArea rows={2} /></Form.Item>
                      : (warranty.ghiChu || '-')}
                  </Descriptions.Item>
                </Descriptions>
              ) : null}
            </Card>

            {renderAttachmentsCard()}
          </Space>

          <WarrantyProgress baoHanh={warranty.baoHanh} ngayMua={warranty.ngayMua} />
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">QR Code tra cứu:</Text>
            <div style={{ marginTop: 6 }}>
              <QRCode value={trackingUrl} size={92} />
            </div>
            <Space style={{ marginTop: 6 }}>
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(trackingUrl);
                    message.success('Đã sao chép');
                  } catch {
                    const ta = document.createElement('textarea');
                    ta.value = trackingUrl;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.focus();
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    message.success('Đã sao chép');
                  }
                }}
              >
                Sao chép link
              </Button>
            </Space>
          </div>
          </div>
        </Form>
      ),
    },
    {
      key: 'exchange-return',
      label: 'Đổi - Trả hàng',
      children: renderExchangeReturn(),
    },

    {
      key: 'supplier',
      label: 'Gửi NCC',
      children: (
        <div>
          <Card size="small" title="Gửi nhà cung cấp" style={{ marginBottom: 16 }}>
            <Form form={sendForm} layout="vertical">
              <Form.Item label="Nhà cung cấp" name="supplierId" rules={[{ required: true, message: 'Chọn nhà cung cấp' }]}> 
                <Select
                  showSearch
                  optionFilterProp="searchText"
                  filterOption={(input, option) => String(option?.searchText || '').toLowerCase().includes(input.toLowerCase())}
                  options={supplierSelectOptions}
                  placeholder="Tìm theo mã, tên hoặc SĐT NCC"
                  style={{ width: '100%' }}
                  popupMatchSelectWidth={false}
                  listHeight={280}
                />
              </Form.Item>
              <Form.Item label="Ngày gửi" name="sentAt" rules={[{ required: true, message: 'Chọn ngày gửi' }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
              <Form.Item label="Ngày hẹn nhận" name="expectedReturnAt">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
              <Form.Item label="Ghi chú" name="note">
                <Input.TextArea rows={3} placeholder="Ghi chú gửi NCC" />
              </Form.Item>
              <Button type="primary" loading={sendSubmitting} onClick={handleSendToSupplier}>Xác nhận gửi</Button>
            </Form>
          </Card>

          <Card
            size="small"
            title="Lịch sử gửi / nhận NCC"
            extra={supplierLogs.length > 0 ? <Button size="small" icon={<PrinterOutlined />} onClick={() => navigate(`/admin/phieu/${warranty.id}/in?type=supplier`)}>In phiếu gửi NCC</Button> : null}
          >
            <Table
              size="small"
              tableLayout="fixed"
              rowKey={(r) => `${r.id || 'log'}-${r.action || ''}-${r.at || ''}-${r.sentAt || ''}-${r.returnedAt || ''}`}
              dataSource={supplierLogs}
              locale={{ emptyText: 'Trống' }}
              pagination={false}
              columns={[
                {
                  title: 'Sự kiện',
                  dataIndex: 'action',
                  key: 'action',
                  width: 96,
                  render: (v) => (v === 'sent' ? <Tag color="green">Đã gửi</Tag> : <Tag color="blue">Đã nhận</Tag>),
                },
                {
                  title: 'Nhà cung cấp',
                  dataIndex: 'supplierName',
                  key: 'supplierName',
                  width: 140,
                  ellipsis: true,
                },
                {
                  title: 'Ngày gửi',
                  dataIndex: 'sentAt',
                  key: 'sentAt',
                  width: 96,
                  render: (v) => formatDate(v),
                },
                {
                  title: 'Hẹn nhận',
                  dataIndex: 'expectedReturnAt',
                  key: 'expectedReturnAt',
                  width: 96,
                  render: (v) => formatDate(v),
                },
                {
                  title: 'Ngày nhận',
                  dataIndex: 'returnedAt',
                  key: 'returnedAt',
                  width: 96,
                  render: (v) => formatDate(v),
                },
                {
                  title: 'Ghi chú',
                  dataIndex: 'note',
                  key: 'note',
                  render: (v, record) => (
                    <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                      <div style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {v || ''}
                      </div>
                      <Space size={0}>
                        <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openSupplierLogNoteEdit(record)} aria-label="Sửa ghi chú NCC" />
                        <Popconfirm
                          title="Xóa dòng lịch sử NCC này?"
                          okText="Xóa"
                          cancelText="Hủy"
                          okButtonProps={{ danger: true }}
                          onConfirm={() => handleDeleteSupplierLog(record)}
                        >
                          <Button size="small" type="text" danger icon={<CloseOutlined />} aria-label="Xóa lịch sử NCC" />
                        </Popconfirm>
                      </Space>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      ),
    },

    {
      key: 'history',
      label: 'Tiến trình & Lịch sử',
      children: (
        <div>
          <Card size="small" title="Cập nhật tiến trình" style={{ marginBottom: 16 }}>
            <Form form={logForm} layout="inline" onFinish={handleLogProgress}>
              <Form.Item name="note" style={{ flex: 1, marginBottom: 0 }} rules={[{ required: true, message: 'Nhập ghi chú' }]}>
                <Input.TextArea rows={2} placeholder="VD: Đã gửi lên hãng bảo hành, hãng đang xử lý..." />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={logSubmitting}>Thêm</Button>
              </Form.Item>
            </Form>
          </Card>

          <Timeline reverse items={visibleHistory.map(({ entry: h, index: historyIndex }) => {
            const isLog = h.action === 'log';
            const isStatus = h.action === 'status';
            const isAttachmentUpdate = h.action === 'update' && h.changes?.attachments;
            const isTraHang = h.action === 'tra_hang';
            const isExchange = h.action === 'exchange';
            const isReturn = h.action === 'return';
            const isCreate = h.action === 'create';
            const isPriority = h.action === 'priority';
            const isSupplierSent = h.action === 'supplier_sent';
            const isSupplierReturned = h.action === 'supplier_returned';
            const isSupplierLogDeleted = h.action === 'supplier_log_deleted';
            const isCustomerTransfer = h.action === 'customer_transfer';
            const isCustomerDetached = h.action === 'customer_detached';

            let color = 'gray';
            let title = '';
            let detail = '';

            if (isAttachmentUpdate) {
              color = 'blue';
              title = 'Cập nhật ảnh đính kèm';
              detail = getAttachmentHistoryDetail(h) || 'Cập nhật ảnh đính kèm';
            } else if (isCreate) {
              color = 'blue';
              title = 'Tạo phiếu';
              detail = normalizeHistoryText(h.note) || 'Phiếu đã được tạo';
            } else if (isStatus) {
              color = 'orange';
              const toStatus = h.changes?.trangThai?.to;
              title = `Chuyển sang "${STATUS[toStatus]?.label || toStatus}"`;
              detail = normalizeHistoryText(h.note) || '';
            } else if (isTraHang) {
              color = 'green';
              title = 'Đánh dấu đã xong';
              detail = normalizeHistoryText(h.note) || '';
            } else if (isExchange) {
              color = 'green';
              title = 'Đổi hàng';
              detail = normalizeHistoryText(h.note) || '';
            } else if (isReturn) {
              color = 'green';
              title = 'Trả hàng';
              detail = normalizeHistoryText(h.note) || '';
            } else if (isPriority) {
              color = 'red';
              title = 'Cập nhật ưu tiên';
              detail = normalizeHistoryText(h.note) || '';
            } else if (isSupplierSent) {
              color = 'green';
              title = 'Gửi nhà cung cấp';
              detail = normalizeHistoryText(h.note) || '';
            } else if (isSupplierReturned) {
              color = 'blue';
              title = 'Nhận lại từ nhà cung cấp';
              detail = normalizeHistoryText(h.note) || '';
            } else if (isSupplierLogDeleted) {
              color = 'default';
              title = 'Xóa dòng lịch sử NCC';
              detail = normalizeHistoryText(h.note) || 'Đã xóa 1 dòng lịch sử gửi / nhận NCC';
            } else if (isCustomerTransfer) {
              color = 'blue';
              title = 'Chuyển khách hàng';
              detail = getCustomerHistoryDetail(h);
            } else if (isCustomerDetached) {
              color = 'orange';
              title = 'Tách khỏi khách hàng';
              detail = getCustomerHistoryDetail(h);
            } else if (h.action === 'update') {
              color = 'blue';
              title = 'Cập nhật thông tin';
              detail = getUpdateHistoryDetail(h);
            } else if (isLog) {
              color = 'purple';
              title = 'Cập nhật tiến trình';
              detail = normalizeHistoryText(h.note);
            }

            return {
              color,
              children: (
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <Text strong>{title}</Text>
                    {h.action !== 'create' && (
                      <Popconfirm
                        title="Xóa dòng lịch sử này?"
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => handleDeleteHistory(historyIndex)}
                      >
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined style={{ fontSize: 13 }} />}
                          style={{ height: 'auto', padding: '2px 4px', marginTop: -2 }}
                        />
                      </Popconfirm>
                    )}
                  </div>
                  <div>
                    <ClockCircleOutlined style={{ fontSize: 12, marginRight: 4, color: '#999' }} />
                    <Text type="secondary" style={{ fontSize: 12 }}>{formatDate(h.at, 'DD/MM/YYYY - HH:mm')} · {getStaffName(h.by)}</Text>
                  </div>
                  {detail && <div style={{ marginTop: 4, fontSize: 13, whiteSpace: 'pre-line' }}>{renderHistoryDetail(detail)}</div>}
                </div>
              ),
            };
          })} />
        </div>
      ),
    },
  ];

  const mobileStatusColor = getStatusBadgeColor(warranty.trangThai, 'mobile');
  const mobileHistory = visibleHistory;

  const handleMobileLog = async () => {
    if (!mobileLogNote.trim()) {
      message.warning('Nhập ghi chú tiến trình');
      return;
    }
    await handleLogProgress({ note: mobileLogNote });
    setMobileLogNote('');
  };

  const renderMobileInfo = () => (
    <div className="warranty-mobile-detail-body">
      <MobileCard className="warranty-mobile-card" title="Thông tin phiếu">
        <List>
          <List.Item title="Số chứng từ">{warranty.soChungTu}</List.Item>
          <List.Item title="Trạng thái"><MobileTag color={mobileStatusColor}>{statusConfig?.label || warranty.trangThai}</MobileTag></List.Item>
          <List.Item title="Khách hàng">{warranty.khachHang || '-'}</List.Item>
          <List.Item title="Số điện thoại">{warranty.soDienThoai || '-'}</List.Item>
          <List.Item title="Địa chỉ">{warranty.diaChi || '-'}</List.Item>
          <List.Item title="Ngày nhận">{formatDate(warranty.ngayNhan, 'DD/MM/YYYY HH:mm')}</List.Item>
          {warranty?.trangThai !== 'da_tra' && warranty?.trangThai !== 'huy' && (
            <List.Item title="Ngày hẹn trả">
              {warranty.ngayHenTra === 'none'
                ? <span>Đang cập nhập<span className="loading-dots" /></span>
                : formatDate(warranty.ngayHenTra)}
            </List.Item>
          )}
          <List.Item title="Ngày trả">{warranty.ngayTra ? formatDate(warranty.ngayTra) : '-'}</List.Item>
          <List.Item title="Nhân viên">{getStaffName(warranty.maNhanVien)}</List.Item>
          {warranty.ghiChu && <List.Item title="Ghi chú">{warranty.ghiChu}</List.Item>}
        </List>
      </MobileCard>

      <MobileCard className="warranty-mobile-card" title="Sản phẩm">
        <List>
          <List.Item title="Tên hàng">{warranty.tenHang || '-'}</List.Item>
          <List.Item title="Số seri">{warranty.soSeri || '-'}</List.Item>
          <List.Item title="Cấu hình">{warranty.cauHinh || '-'}</List.Item>
          <List.Item title="Lỗi lúc nhận">{warranty.loiLucNhan || '-'}</List.Item>
          <List.Item title="Phụ kiện">{warranty.phuKien || '-'}</List.Item>
          <List.Item title="Chi phí">{warranty.chiPhi ? `${warranty.chiPhi.toLocaleString('vi-VN')} đ` : 'Miễn phí'}</List.Item>
          <List.Item title="Loại xử lý">{LOAI_XU_LY_LABELS[warranty.loaiXuLy] || warranty.loaiXuLy || '-'}</List.Item>
          <List.Item title="Bảo hành">{warranty.baoHanh || '-'}</List.Item>
          <List.Item title="Ngày mua">{formatDate(warranty.ngayMua)}</List.Item>
        </List>
      </MobileCard>

      <MobileCard className="warranty-mobile-card" title={`Hình ảnh đính kèm (${attachments.length}/10)`}>
        <div style={{ marginBottom: 10 }}>{uploadAttachmentButton}</div>
        {attachments.length > 0 ? (
          renderAttachmentGrid(true)
        ) : (
          <Text type="secondary">Chưa có ảnh đính kèm.</Text>
        )}
      </MobileCard>

      <MobileCard className="warranty-mobile-card" title="QR Code tra cứu">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '10px 0' }}>
          <QRCode value={trackingUrl} size={128} />
          <MobileButton
            size="small"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(trackingUrl);
                message.success('Đã sao chép liên kết');
              } catch {
                const ta = document.createElement('textarea');
                ta.value = trackingUrl;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                message.success('Đã sao chép liên kết');
              }
            }}
          >
            Sao chép liên kết tra cứu
          </MobileButton>
        </div>
      </MobileCard>

      <MobileCard className="warranty-mobile-card" title="Thao tác nhanh">
        <MobileSpace wrap>
          <MobileButton size="small" onClick={() => setEditing(true)}>Sửa</MobileButton>
          <MobileButton size="small" onClick={() => navigate(`/admin/phieu/${warranty.id}/in`)}>In</MobileButton>
          <MobileButton
            size="small"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(trackingUrl);
                message.success('Đã sao chép');
              } catch {
                const ta = document.createElement('textarea');
                ta.value = trackingUrl;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                message.success('Đã sao chép');
              }
            }}
          >
            Copy tra cứu
          </MobileButton>
          {warranty.trangThai !== 'da_tra' && warranty.trangThai !== 'huy' && (
            <>
              <MobileButton size="small" color="primary" onClick={() => Dialog.confirm({ content: 'Đánh dấu bảo hành xong?', confirmText: 'Xong', cancelText: 'Hủy', onConfirm: handleTraHang })}>Xong</MobileButton>
              <MobileButton size="small" color="danger" fill="outline" onClick={() => setCancelModal(true)}>Hủy</MobileButton>
            </>
          )}
        </MobileSpace>
      </MobileCard>

      {editing && (
        <MobileCard className="warranty-mobile-card" title="Sửa thông tin">
          <Form form={form} layout="vertical">
            <Form.Item label="Khách hàng" name="khachHang"><Input /></Form.Item>
            <Form.Item label="Số điện thoại" name="soDienThoai"><Input /></Form.Item>
            <Form.Item label="Địa chỉ" name="diaChi"><TextArea rows={2} /></Form.Item>
            <Form.Item label="Tên hàng" name="tenHang"><Input /></Form.Item>
            <Form.Item label="Số seri" name="soSeri"><Input /></Form.Item>
            <Form.Item label="Lỗi lúc nhận" name="loiLucNhan"><TextArea rows={2} /></Form.Item>
            <Form.Item label="Phụ kiện" name="phuKien"><Input /></Form.Item>
            <Form.Item label="Ngày nhận" name="ngayNhan"><DatePicker showTime style={{ width: '100%' }} format="DD/MM/YYYY HH:mm" /></Form.Item>
            <Form.Item label="Ngày hẹn trả" name="ngayHenTra"><DatePicker allowClear style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item>
            <Form.Item label="Ghi chú" name="ghiChu"><TextArea rows={2} /></Form.Item>
            <MobileSpace>
              <MobileButton color="primary" onClick={handleSave}>Lưu</MobileButton>
              <MobileButton onClick={() => setEditing(false)}>Hủy</MobileButton>
            </MobileSpace>
          </Form>
        </MobileCard>
      )}
    </div>
  );

  const renderMobileExchangeReturn = () => {
    const doiTra = warranty.doiTra;
    const isClosed = warranty.trangThai === 'da_tra' || warranty.trangThai === 'huy';

    if (doiTra) {
      return (
        <div className="warranty-mobile-detail-body">
          <MobileCard className="warranty-mobile-card" title={doiTra.type === 'doi_hang' ? 'Thông tin đổi hàng' : 'Thông tin trả hàng'}>
            <List>
              <List.Item title="Loại xử lý">{doiTra.type === 'doi_hang' ? 'Đổi hàng' : 'Trả hàng'}</List.Item>
              <List.Item title="Thời gian">{formatDate(doiTra.at, 'DD/MM/YYYY HH:mm')}</List.Item>
              <List.Item title="Nhân viên">{getStaffName(doiTra.by)}</List.Item>
              <List.Item title="Sản phẩm cũ">{doiTra.tenHangCu || '-'}</List.Item>
              <List.Item title="Serial cũ">{doiTra.soSeriCu || '-'}</List.Item>
              {doiTra.type === 'doi_hang' ? (
                <>
                  <List.Item title="Sản phẩm đổi sang">{doiTra.tenHangMoi || '-'}</List.Item>
                  <List.Item title="Serial mới">{doiTra.soSeriMoi || '-'}</List.Item>
                </>
              ) : (
                <List.Item title="Lý do trả hàng">{doiTra.reason || '-'}</List.Item>
              )}
              {doiTra.note && <List.Item title="Ghi chú">{doiTra.note}</List.Item>}
            </List>
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 8, fontWeight: 700 }}>Hình ảnh ({normalizeAttachments(doiTra.attachments).length})</div>
              {normalizeAttachments(doiTra.attachments).length > 0
                ? renderExchangeAttachmentGrid(normalizeAttachments(doiTra.attachments), { compact: true })
                : <Text type="secondary">Chưa có ảnh đính kèm.</Text>}
            </div>
          </MobileCard>
        </div>
      );
    }

    if (isClosed) {
      return (
        <div className="warranty-mobile-detail-body">
          <MobileCard className="warranty-mobile-card">Phiếu đã xong hoặc đã hủy, không thể đổi/trả hàng.</MobileCard>
        </div>
      );
    }

    return (
      <div className="warranty-mobile-detail-body">
        <MobileCard className="warranty-mobile-card" title="Xác nhận đổi/trả hàng">
          <Form form={exchangeForm} layout="vertical" initialValues={{ type: 'doi_hang' }} onFinish={handleExchangeReturn}>
            <Form.Item label="Loại xử lý" name="type">
              <Select
                onChange={value => setExchangeType(value)}
                options={[
                  { label: 'Đổi hàng', value: 'doi_hang' },
                  { label: 'Trả hàng', value: 'tra_hang' },
                ]}
              />
            </Form.Item>
            {exchangeType === 'doi_hang' ? (
              <>
                <Form.Item label="Tên sản phẩm đổi sang" name="tenHangMoi" rules={[{ required: true, message: 'Nhập tên sản phẩm đổi sang' }]}>
                  <Input />
                </Form.Item>
                <Form.Item label="Số serial mới" name="soSeriMoi" rules={[{ required: true, message: 'Nhập số serial mới' }]}>
                  <Input />
                </Form.Item>
              </>
            ) : (
              <Form.Item label="Lý do trả hàng" name="reason" rules={[{ required: true, message: 'Nhập lý do trả hàng' }]}>
                <TextArea rows={3} />
              </Form.Item>
            )}
            <Form.Item label="Ghi chú" name="note"><TextArea rows={2} /></Form.Item>
            <Form.Item label={`Hình ảnh đính kèm (${exchangeAttachments.length}/10)`}>
              <Space direction="vertical" size={10} style={{ display: 'flex' }}>
                {exchangeAttachmentUpload}
                {exchangeAttachments.length > 0
                  ? renderExchangeAttachmentGrid(exchangeAttachments, { compact: true, removable: true })
                  : <Text type="secondary">Có thể đính kèm ảnh sản phẩm đổi/trả.</Text>}
              </Space>
            </Form.Item>
            <MobileButton block color="primary" type="submit" loading={exchangeSubmitting}>
              {exchangeType === 'doi_hang' ? 'Xác nhận đổi hàng' : 'Xác nhận trả hàng'}
            </MobileButton>
          </Form>
        </MobileCard>
      </div>
    );
  };

  const renderMobileSupplier = () => (
    <div className="warranty-mobile-detail-body">
      <Card size="small" title="Gửi nhà cung cấp" className="warranty-mobile-supplier-form-card" style={{ marginBottom: 12 }}>
        <Form form={sendForm} layout="vertical">
          <Form.Item label="Nhà cung cấp" name="supplierId" rules={[{ required: true, message: 'Chọn nhà cung cấp' }]}>
            <Select
              showSearch
              optionFilterProp="searchText"
              filterOption={(input, option) => String(option?.searchText || '').toLowerCase().includes(input.toLowerCase())}
              options={supplierSelectOptions}
              placeholder="Tìm theo mã, tên hoặc SĐT NCC"
              style={{ width: '100%' }}
              popupMatchSelectWidth={false}
              listHeight={280}
            />
          </Form.Item>
          <Form.Item label="Ngày gửi" name="sentAt" rules={[{ required: true, message: 'Chọn ngày gửi' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item label="Ngày hẹn nhận" name="expectedReturnAt">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item label="Ghi chú" name="note">
            <Input.TextArea rows={3} placeholder="Ghi chú gửi NCC" />
          </Form.Item>
          <Button type="primary" block loading={sendSubmitting} onClick={handleSendToSupplier}>Xác nhận gửi</Button>
        </Form>
      </Card>

      <MobileCard className="warranty-mobile-card" title={`Lịch sử gửi / nhận NCC (${supplierLogs.length})`}>
        {supplierLogs.length === 0 ? (
          <div style={{ padding: 12, textAlign: 'center', color: 'var(--ant-color-text-secondary, #667085)' }}>Trống</div>
        ) : (
          <div className="warranty-mobile-supplier-log-list">
            <MobileButton block size="small" onClick={() => navigate(`/admin/phieu/${warranty.id}/in?type=supplier`)}>In phiếu gửi NCC</MobileButton>
            {supplierLogs.map((log) => {
              const isSent = log.action === 'sent';
              const key = `${log.id || 'log'}-${log.action || ''}-${log.at || ''}-${log.sentAt || ''}-${log.returnedAt || ''}`;
              return (
                <div
                  key={key}
                  className="warranty-mobile-supplier-log"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="warranty-mobile-supplier-name">
                        {log.supplierName || 'Nhà cung cấp'}
                      </div>
                      <div className="warranty-mobile-supplier-action">
                        {isSent ? 'Gửi nhà cung cấp' : 'Nhận lại từ nhà cung cấp'}
                      </div>
                    </div>
                    <MobileTag color={isSent ? 'success' : 'primary'}>{isSent ? 'Đã gửi' : 'Đã nhận'}</MobileTag>
                  </div>

                  <div className="warranty-mobile-supplier-log-grid">
                    <div>
                      <div>Ngày gửi</div>
                      <b>{formatDate(log.sentAt) || '-'}</b>
                    </div>
                    <div>
                      <div>Hẹn nhận</div>
                      <b>{formatDate(log.expectedReturnAt) || '-'}</b>
                    </div>
                    <div>
                      <div>Ngày nhận</div>
                      <b>{formatDate(log.returnedAt) || '-'}</b>
                    </div>
                    <div>
                      <div>Cập nhật</div>
                      <b>{formatDate(log.at) || '-'}</b>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div className="warranty-mobile-supplier-note">
                      {log.note || 'Chưa có ghi chú'}
                    </div>
                    <MobileSpace wrap>
                      <MobileButton size="mini" onClick={() => openSupplierLogNoteEdit(log)}>Sửa</MobileButton>
                      <MobileButton
                        size="mini"
                        color="danger"
                        fill="outline"
                        onClick={() => Dialog.confirm({
                          content: 'Xóa dòng lịch sử NCC này?',
                          confirmText: 'Xóa',
                          cancelText: 'Hủy',
                          onConfirm: () => handleDeleteSupplierLog(log),
                        })}
                      >
                        Xóa
                      </MobileButton>
                    </MobileSpace>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </MobileCard>
    </div>
  );

  const renderMobileHistory = () => (
    <div className="warranty-mobile-detail-body">
      <MobileCard className="warranty-mobile-card" title="Cập nhật tiến trình">
        <MobileTextArea
          value={mobileLogNote}
          onChange={setMobileLogNote}
          rows={3}
          placeholder="VD: Đã gửi hãng, đang xử lý..."
        />
        <MobileButton block color="primary" loading={logSubmitting} onClick={handleMobileLog} style={{ marginTop: 10 }}>
          Thêm tiến trình
        </MobileButton>
      </MobileCard>

      <MobileCard className="warranty-mobile-card" title="Lịch sử">
        <div className="warranty-mobile-timeline">
          {mobileHistory.map(({ entry: h, index: historyIndex }) => {
            const isCreate = h.action === 'create';
            const isStatus = h.action === 'status';
            const isAttachmentUpdate = h.action === 'update' && h.changes?.attachments;
            const isTraHang = h.action === 'tra_hang';
            const isExchange = h.action === 'exchange';
            const isReturn = h.action === 'return';
            const isPriority = h.action === 'priority';
            const isSupplierSent = h.action === 'supplier_sent';
            const isSupplierReturned = h.action === 'supplier_returned';
            const isSupplierLogDeleted = h.action === 'supplier_log_deleted';
            const isCustomerTransfer = h.action === 'customer_transfer';
            const isCustomerDetached = h.action === 'customer_detached';
            const isLog = h.action === 'log';
            const toStatus = h.changes?.trangThai?.to;
            const title = isAttachmentUpdate
              ? 'Cập nhật ảnh đính kèm'
              : isCreate
              ? 'Tạo phiếu'
              : isStatus
                ? `Chuyển sang "${STATUS[toStatus]?.label || toStatus}"`
                : isTraHang
                  ? 'Đánh dấu đã xong'
                  : isExchange
                    ? 'Đổi hàng'
                    : isReturn
                      ? 'Trả hàng'
                      : isPriority
                        ? 'Cập nhật ưu tiên'
                        : isSupplierSent
                          ? 'Gửi nhà cung cấp'
                          : isSupplierReturned
                            ? 'Nhận lại từ nhà cung cấp'
                            : isCustomerTransfer
                              ? 'Chuyển khách hàng'
                              : isCustomerDetached
                                ? 'Tách khỏi khách hàng'
                                : isLog
                                  ? 'Cập nhật tiến trình'
                                  : h.action === 'update'
                                    ? 'Cập nhật thông tin'
                                    : h.action;
            const detail = isAttachmentUpdate
              ? (getAttachmentHistoryDetail(h) || 'Cập nhật ảnh đính kèm')
              : isCustomerTransfer || isCustomerDetached
                ? getCustomerHistoryDetail(h)
              : h.action === 'update'
                ? getUpdateHistoryDetail(h)
                : normalizeHistoryText(h.note) || (isCreate ? 'Phiếu đã được tạo' : '');
            return (
              <div className="warranty-mobile-timeline-item" key={`${h.at}-${h.action}-${historyIndex}`} style={{ display: 'grid', gap: 2, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b>{title}</b>
                  {h.action !== 'create' && (
                    <span onClick={(e) => {
                      e.stopPropagation();
                      Dialog.confirm({
                        content: 'Xóa dòng lịch sử này?',
                        onConfirm: () => handleDeleteHistory(historyIndex),
                      });
                    }}>
                      <MobileButton size="mini" color="danger" fill="none" style={{ padding: 0 }}>
                        <DeleteOutlined style={{ fontSize: 13 }} />
                      </MobileButton>
                    </span>
                  )}
                </div>
                <span>{formatDate(h.at, 'DD/MM/YYYY - HH:mm')} · {getStaffName(h.by)}</span>
                {detail && <p style={{ whiteSpace: 'pre-line' }}>{renderHistoryDetail(detail)}</p>}
              </div>
            );
          })}
        </div>
      </MobileCard>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <Popup
          visible={open}
          onMaskClick={handleRequestClose}
          position="right"
          bodyStyle={{ width: '100vw', height: '100vh' }}
          className="warranty-mobile-detail-popup"
        >
          <div className="warranty-mobile-detail">
            <NavBar onBack={handleClose} right={<MobileTag color={mobileStatusColor}>{statusConfig?.label || warranty.trangThai}</MobileTag>}>
              {warranty.soChungTu}
            </NavBar>
            {renderHeavy ? (
              <MobileTabs>
                <MobileTabs.Tab title="Thông tin" key="info">
                  {renderMobileInfo()}
                </MobileTabs.Tab>
                <MobileTabs.Tab title="Đổi - Trả" key="exchange-return">
                  {renderMobileExchangeReturn()}
                </MobileTabs.Tab>
                <MobileTabs.Tab title="Gửi NCC" key="supplier">
                  {renderMobileSupplier()}
                </MobileTabs.Tab>
                <MobileTabs.Tab title="Lịch sử" key="history">
                  {renderMobileHistory()}
                </MobileTabs.Tab>
              </MobileTabs>
            ) : (
              <div style={{ padding: 12 }}>
                <Skeleton active paragraph={{ rows: 10 }} />
              </div>
            )}
            <Modal
              title="Hủy phiếu bảo hành"
              open={cancelModal}
              onOk={handleCancel}
              onCancel={() => { setCancelModal(false); setCancelReason(''); }}
              okText="Xác nhận hủy"
              cancelText="Đóng"
              okButtonProps={{ danger: true }}
            >
              <p>Nhập lý do hủy phiếu này:</p>
              <Input.TextArea
                rows={3}
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="VD: Khách không sửa nữa, hết bảo hành..."
              />
            </Modal>
            <Modal
              title="Sửa nhà cung cấp / ghi chú NCC"
              open={supplierLogEditOpen}
              onOk={submitSupplierLogNote}
              onCancel={() => {
                setSupplierLogEditOpen(false);
                setSupplierLogEditing(null);
                setSupplierLogNote('');
                setSupplierLogSupplierId('');
              }}
              okText="Lưu"
              cancelText="Hủy"
              confirmLoading={supplierLogSaving}
              width={720}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Select
                  value={supplierLogSupplierId || undefined}
                  onChange={setSupplierLogSupplierId}
                  showSearch
                  allowClear
                  optionFilterProp="searchText"
                  filterOption={(input, option) => String(option?.searchText || '').toLowerCase().includes(input.toLowerCase())}
                  options={supplierSelectOptions}
                  placeholder="Tìm theo mã, tên hoặc SĐT NCC"
                  style={{ width: '100%' }}
                  popupMatchSelectWidth={false}
                  listHeight={280}
                />
                <Input.TextArea
                  rows={4}
                  value={supplierLogNote}
                  onChange={(e) => setSupplierLogNote(e.target.value)}
                  placeholder="Nhập ghi chú gửi / nhận NCC"
                />
              </Space>
            </Modal>
          </div>
        </Popup>
        <CustomerPickerModal
          open={customerPickerOpen}
          title="Chuyển khách hàng cho CT"
          customers={customerList}
          loading={customerListLoading}
          excludedKey={currentCustomerKey}
          onCancel={() => setCustomerPickerOpen(false)}
          onSelect={handleTransferCustomer}
        />
      </>
    );
  }

  return (
    <Drawer
      title={
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Space wrap>
            <Text strong>{warranty.soChungTu}</Text>
            <StatusTag status={warranty.trangThai} />
            {renderHeavy && (
              <>
                <Button size="small" icon={<PrinterOutlined />} onClick={() => navigate(`/admin/phieu/${warranty.id}/in`)}>In</Button>
                {warranty.trangThai !== 'da_tra' && warranty.trangThai !== 'huy' && (
                  <Space>
                    <Popconfirm title="Đánh dấu bảo hành xong?" onConfirm={handleTraHang}>
                      <Button size="small" type="primary" icon={<CheckCircleOutlined />}>Xong</Button>
                    </Popconfirm>
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setCancelModal(true)}>Hủy</Button>
                  </Space>
                )}
              </>
            )}
          </Space>
        </Space>
      }
      open={open}
      onClose={handleRequestClose}
      width={screens.xl ? 900 : 680}
      loading={loading}
      afterOpenChange={(visible) => {
        if (!visible) handleClose();
      }}
    >
      {renderHeavy ? (
        <Tabs items={items} />
      ) : (
        <div style={{ padding: 16 }}>
          <Skeleton active paragraph={{ rows: 12 }} />
        </div>
      )}

      <Modal
        title="Hủy phiếu bảo hành"
        open={cancelModal}
        onOk={handleCancel}
        onCancel={() => { setCancelModal(false); setCancelReason(''); }}
        okText="Xác nhận hủy"
        cancelText="Đóng"
        okButtonProps={{ danger: true }}
      >
        <p>Nhập lý do hủy phiếu này:</p>
        <Input.TextArea
          rows={3}
          value={cancelReason}
          onChange={e => setCancelReason(e.target.value)}
          placeholder="VD: Khách không sửa nữa, hết bảo hành..."
        />
      </Modal>

      <Modal
        title="Sửa nhà cung cấp / ghi chú NCC"
        open={supplierLogEditOpen}
        onOk={submitSupplierLogNote}
        onCancel={() => {
          setSupplierLogEditOpen(false);
          setSupplierLogEditing(null);
          setSupplierLogNote('');
          setSupplierLogSupplierId('');
        }}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={supplierLogSaving}
        width={720}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select
            value={supplierLogSupplierId || undefined}
            onChange={setSupplierLogSupplierId}
            showSearch
            allowClear
            optionFilterProp="searchText"
            filterOption={(input, option) => String(option?.searchText || '').toLowerCase().includes(input.toLowerCase())}
            options={supplierSelectOptions}
            placeholder="Tìm theo mã, tên hoặc SĐT NCC"
            style={{ width: '100%' }}
            popupMatchSelectWidth={false}
            listHeight={280}
          />
          <Input.TextArea
            rows={4}
            value={supplierLogNote}
            onChange={(e) => setSupplierLogNote(e.target.value)}
            placeholder="Nhập ghi chú gửi / nhận NCC"
          />
        </Space>
      </Modal>

      <CustomerPickerModal
        open={customerPickerOpen}
        title="Chuyển khách hàng cho CT"
        customers={customerList}
        loading={customerListLoading}
        excludedKey={currentCustomerKey}
        onCancel={() => setCustomerPickerOpen(false)}
        onSelect={handleTransferCustomer}
      />
    </Drawer>
  );
}

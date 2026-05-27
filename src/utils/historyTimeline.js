import dayjs from 'dayjs';
import { normalizeVietnameseText } from './vietnameseText.js';
import { mapLoaiXuLyValue } from './historyDisplay.js';
import { getFieldLabel } from './fieldLabels.js';

export const INTERNAL_HISTORY_ACTIONS = new Set([
  'create',
  'status',
  'tra_hang',
  'exchange',
  'return',
  'priority',
  'supplier_sent',
  'supplier_returned',
  'customer_transfer',
  'customer_detached',
  'update',
  'log',
]);

export const PUBLIC_HISTORY_ACTIONS = new Set([
  'create',
  'status',
  'tra_hang',
  'exchange',
  'return',
  'priority',
  'supplier_sent',
  'supplier_returned',
  'customer_transfer',
  'customer_detached',
  'update',
  'log',
]);

const STATUS_LABELS = {
  da_nhan: 'Đã nhận',
  dang_xu_ly: 'Đang xử lý',
  da_tra: 'Đã xong',
  huy: 'Đã hủy',
  cho_xu_ly: 'Đã nhận',
  cho_lien_he: 'Đang xử lý',
};

const PUBLIC_BLOCKED_FIELDS = new Set([
  'chiPhi',
  'uuTien',
  'maNhanVien',
  'supplierLogs',
]);

function normalizeText(text) {
  return normalizeVietnameseText(text || '').trim();
}

function isSupplierNoise(entry) {
  const note = String(entry?.note || '').toLowerCase();
  if (note.includes('supplierlogs:')) return true;
  if (note.includes('xóa 1 dòng lịch sử gửi / nhận ncc')) return true;
  const changes = entry?.changes || {};
  const keys = Object.keys(changes).map((key) => String(key).toLowerCase());
  return keys.length > 0 && keys.every((key) => key.includes('supplierlogs'));
}

function formatDateValue(raw) {
  if (raw === 'none') return 'Đang cập nhập...';
  const d = dayjs(raw);
  return d.isValid() ? d.format('DD-MM-YYYY') : String(raw);
}

function formatFieldValue(field, raw) {
  if (raw === null || raw === undefined || raw === '') return '';
  if (field === 'ngayHenTra' || field === 'ngayNhan' || field === 'ngayTra' || field === 'ngayMua') return formatDateValue(raw);
  if (field === 'loaiXuLy') return mapLoaiXuLyValue(raw);
  if (field === 'trangThai') return STATUS_LABELS[raw] || String(raw);
  if (field === 'uuTien') return raw ? 'Có' : 'Không';
  return String(raw);
}

export function formatHistoryChanges(changes = {}, { publicMode = false } = {}) {
  return Object.entries(changes)
    .filter(([field]) => {
      if (!publicMode) return true;
      return !PUBLIC_BLOCKED_FIELDS.has(field) && !String(field).toLowerCase().includes('supplierlogs');
    })
    .map(([field, value]) => {
      if (field === 'attachments') {
        const fromNum = Number(value?.from ?? 0);
        const toNum = Number(value?.to ?? 0);
        if (Number.isFinite(fromNum) && Number.isFinite(toNum)) {
          if (toNum > fromNum) return `Đã thêm ${toNum - fromNum} ảnh: ${fromNum} → ${toNum}`;
          if (toNum < fromNum) return `Đã xóa ${fromNum - toNum} ảnh: ${fromNum} → ${toNum}`;
          return `Ảnh đính kèm: ${fromNum}`;
        }
      }
      const label = getFieldLabel(field);
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
    })
    .filter(Boolean)
    .join('\n');
}

function customerDetail(entry) {
  const from = entry?.customer?.from || {};
  const to = entry?.customer?.to || {};
  const fromLabel = [from.khachHang, from.soDienThoai].filter(Boolean).join(' - ') || 'Chưa có khách hàng';
  const toLabel = [to.khachHang, to.soDienThoai].filter(Boolean).join(' - ') || 'Chưa có khách hàng';
  const note = normalizeText(entry?.note);
  if (entry?.action === 'customer_transfer') return `Khách hàng: ${fromLabel} → ${toLabel}${note ? `\n${note}` : ''}`;
  if (entry?.action === 'customer_detached') return `Khách hàng: ${fromLabel} → Chưa có khách hàng${note ? `\n${note}` : ''}`;
  return note;
}

function resolveSupplierHistoryNote(entry, warranty = {}, fallbackNote = '') {
  const supplierLogs = Array.isArray(warranty.supplierLogs) ? warranty.supplierLogs : [];
  if (!supplierLogs.length) return fallbackNote;

  const targetAction = entry.action === 'supplier_sent' ? 'sent' : entry.action === 'supplier_returned' ? 'returned' : '';
  if (!targetAction) return fallbackNote;

  const linkedLogId = String(entry?.changes?.supplierLogs?.logId || '').trim();
  if (linkedLogId) {
    const direct = supplierLogs.find((log) => String(log?.id || '') === linkedLogId);
    if (direct) {
      const supplierName = String(direct.supplierName || direct.supplier || '').trim();
      const note = String(direct.note || '').trim();
      const prefix = targetAction === 'sent' ? 'Đã gửi bảo hành nhà cung cấp' : 'Đã nhận lại từ nhà cung cấp';
      return `${prefix}: ${supplierName || '-'}${note ? ` | ${note}` : ''}`;
    }
  }

  const by = String(entry.by || '').trim();
  const atTs = dayjs(entry.at).valueOf();
  const candidates = supplierLogs
    .filter((log) => log?.action === targetAction)
    .map((log) => ({ ...log, ts: dayjs(log.at).valueOf() }))
    .filter((log) => Number.isFinite(log.ts))
    .sort((a, b) => b.ts - a.ts);

  if (!candidates.length) return fallbackNote;

  const byMatch = by ? candidates.filter((log) => String(log.createdBy || log.updatedBy || '').trim() === by) : [];
  const pool = byMatch.length ? byMatch : candidates;
  const picked = Number.isFinite(atTs)
    ? pool.find((log) => log.ts <= atTs) || pool[0]
    : pool[0];

  if (!picked) return fallbackNote;
  const supplierName = String(picked.supplierName || picked.supplier || '').trim();
  const note = String(picked.note || '').trim();
  const prefix = targetAction === 'sent' ? 'Đã gửi bảo hành nhà cung cấp' : 'Đã nhận lại từ nhà cung cấp';
  return `${prefix}: ${supplierName || '-'}${note ? ` | ${note}` : ''}`;
}

function timelineColor(action) {
  if (action === 'tra_hang' || action === 'exchange' || action === 'return' || action === 'supplier_sent') return 'green';
  if (action === 'priority') return 'red';
  if (action === 'status' || action === 'customer_detached') return 'orange';
  if (action === 'log') return 'purple';
  if (action === 'supplier_log_deleted') return 'default';
  return 'blue';
}

export function toHistoryTimelineItem(entry, warranty = {}, { publicMode = false, index = -1 } = {}) {
  if (!entry || entry.action === 'delete') return null;
  if (isSupplierNoise(entry)) return null;
  if (publicMode && !PUBLIC_HISTORY_ACTIONS.has(entry.action)) return null;
  if (!publicMode && !INTERNAL_HISTORY_ACTIONS.has(entry.action)) return null;

  const action = entry.action;
  const note = normalizeText(entry.note)
    .replaceAll('Xóa ảnh đính kèm', 'Đã xóa ảnh đính kèm')
    .replaceAll('loaiXuLy:', 'Loại xử lý:')
    .replaceAll('bao_hanh', 'Bảo hành')
    .replaceAll('sua_dv', 'Sửa dịch vụ')
    .replaceAll('tra_bao_hanh', 'Trả bảo hành')
    .replaceAll('doi_moi', 'Đổi mới');

  let title = '';
  let detail = '';

  if (action === 'create') {
    title = 'Tạo phiếu';
    detail = note || 'Phiếu đã được tạo';
  } else if (action === 'status') {
    const toStatus = entry.changes?.trangThai?.to;
    title = `Chuyển sang "${STATUS_LABELS[toStatus] || toStatus || ''}"`;
    detail = note;
  } else if (action === 'tra_hang') {
    title = 'Đánh dấu đã xong';
    detail = note;
  } else if (action === 'exchange') {
    title = 'Đổi hàng';
    detail = note || formatHistoryChanges(entry.changes, { publicMode });
  } else if (action === 'return') {
    title = 'Trả hàng';
    detail = note;
  } else if (action === 'priority') {
    title = entry.changes?.uuTien?.to ? 'Đánh dấu ưu tiên' : 'Bỏ ưu tiên';
    detail = note;
  } else if (action === 'supplier_sent') {
    title = 'Gửi nhà cung cấp';
    detail = publicMode ? 'Đã gửi bảo hành nhà cung cấp' : resolveSupplierHistoryNote(entry, warranty, note || 'Đã gửi bảo hành nhà cung cấp');
  } else if (action === 'supplier_returned') {
    title = 'Nhận lại từ nhà cung cấp';
    detail = publicMode ? 'Đã nhận lại từ nhà cung cấp' : resolveSupplierHistoryNote(entry, warranty, note || 'Đã nhận lại từ nhà cung cấp');
  } else if (action === 'customer_transfer') {
    title = 'Chuyển khách hàng';
    detail = customerDetail(entry);
  } else if (action === 'customer_detached') {
    title = 'Tách khỏi khách hàng';
    detail = customerDetail(entry);
  } else if (action === 'update') {
    const changesText = formatHistoryChanges(entry.changes, { publicMode });
    const hasAttachmentChange = Boolean(entry.changes?.attachments);
    title = hasAttachmentChange ? 'Cập nhật ảnh đính kèm' : 'Cập nhật thông tin';
    detail = hasAttachmentChange ? (note || changesText || 'Cập nhật ảnh đính kèm') : [changesText, note].filter(Boolean).join('\n');
  } else if (action === 'log') {
    title = 'Cập nhật tiến trình';
    detail = note;
  }

  if (!title) return null;
  if (action === 'update' && !detail) return null;

  return {
    index,
    entry,
    id: warranty.id,
    warrantyId: warranty.id,
    soChungTu: warranty.soChungTu,
    khachHang: warranty.khachHang,
    actionType: action,
    action: title,
    title,
    detail,
    note: detail,
    time: entry.at || warranty.updatedAt || warranty.createdAt,
    at: entry.at || warranty.updatedAt || warranty.createdAt,
    by: entry.by,
    changes: entry.changes || {},
    color: timelineColor(action),
  };
}

export function buildInternalHistoryTimeline(history = [], warranty = {}) {
  return (history || [])
    .map((entry, index) => toHistoryTimelineItem(entry, warranty, { publicMode: false, index }))
    .filter(Boolean)
    .filter((item) => {
      // Ẩn các mục lịch sử chỉ thuần túy là thêm/xóa ảnh đính kèm để tránh loãng timeline
      // Dữ liệu vẫn được lưu đầy đủ trong DB phục vụ audit log khi Admin cần tra cứu
      if (item.actionType === 'update') {
        const changeKeys = Object.keys(item.changes || {});
        const isAttachmentOnly = changeKeys.length === 1 && changeKeys[0] === 'attachments';
        if (isAttachmentOnly) return false;
      }
      return true;
    });
}

export function buildPublicHistoryTimeline(history = [], warranty = {}) {
  return (history || [])
    .map((entry, index) => toHistoryTimelineItem(entry, warranty, { publicMode: true, index }))
    .filter(Boolean)
    .filter((item) => {
      // Ẩn các mục lịch sử chỉ thuần túy là thêm/xóa ảnh đính kèm đối với khách hàng tra cứu công khai
      if (item.actionType === 'update') {
        const changeKeys = Object.keys(item.changes || {});
        const isAttachmentOnly = changeKeys.length === 1 && changeKeys[0] === 'attachments';
        if (isAttachmentOnly) return false;
      }
      return true;
    })
    .map((item) => ({
      actionType: item.actionType,
      action: item.title,
      time: item.time,
      note: item.detail,
    }));
}

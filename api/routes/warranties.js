import express from 'express';
import { readDb, getCollection, setCollection, addToCollection, prisma, syncLocalBackup } from '../lib/db.js';
import { writeAuditLog } from '../lib/audit.js';
import { customerLabel, getCustomerRows, getWarrantyCustomerKey, findCustomerByKey } from '../lib/customers.js';
import { buildCustomerMasterFromWarranties } from '../lib/customerMaster.js';
import { warrantySchema, statusUpdateSchema, traHangSchema, exchangeReturnSchema, supplierSendSchema, supplierReturnSchema } from '../lib/validators.js';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireRole } from '../lib/auth.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'warranties');
const requireAdmin = requireRole('admin');

const STATUS_TRANSITIONS = {
  da_nhan: ['dang_xu_ly', 'huy'],
  dang_xu_ly: ['da_tra', 'huy'],
  da_tra: [],
  huy: [],
  cho_xu_ly: ['dang_xu_ly', 'huy'],
  cho_lien_he: ['da_tra', 'huy'],
};

function ensureUploadDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function extFromMime(mime = '') {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}

function attachmentUrlToPath(url) {
  const pathname = String(url || '').split('?')[0];
  if (!pathname.startsWith('/uploads/warranties/')) return null;
  const relative = pathname.replace(/^\/uploads\//, '');
  const full = path.resolve(path.join(__dirname, '..', 'uploads', relative));
  const root = path.resolve(path.join(__dirname, '..', 'uploads'));
  if (!full.startsWith(root + path.sep)) return null;
  return full;
}

function deleteAttachmentFile(attachment) {
  const full = attachmentUrlToPath(attachment?.url);
  if (!full) return false;
  try {
    if (fs.existsSync(full)) fs.unlinkSync(full);
    return true;
  } catch (err) {
    console.warn('[ATTACHMENT] Không xóa được file:', err.message);
    return false;
  }
}

function saveAttachmentDataUrls(items = [], uploadedBy = 'admin') {
  if (!Array.isArray(items)) return [];
  const safeItems = items.slice(0, 10);
  const now = dayjs().tz('Asia/Ho_Chi_Minh');
  const y = now.format('YYYY');
  const m = now.format('MM');
  const destDir = path.join(UPLOAD_ROOT, y, m);
  ensureUploadDir(destDir);
  const out = [];

  for (const item of safeItems) {
    const dataUrl = String(item?.dataUrl || '');
    const mime = String(item?.mime || '').toLowerCase();
    const name = String(item?.name || 'image');
    const publicVisible = item?.publicVisible !== false;
    const isAllowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mime);
    if (!isAllowed || !dataUrl.startsWith('data:')) continue;
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx < 0) continue;
    const b64 = dataUrl.slice(commaIdx + 1);
    const buf = Buffer.from(b64, 'base64');
    if (!buf.length || buf.length > 5 * 1024 * 1024) continue;
    const id = uuidv4();
    const ext = extFromMime(mime);
    const fileName = `${id}.${ext}`;
    const absPath = path.join(destDir, fileName);
    fs.writeFileSync(absPath, buf);
    out.push({
      id,
      url: `/uploads/warranties/${y}/${m}/${fileName}`,
      name,
      mime,
      size: buf.length,
      uploadedAt: now.format('YYYY-MM-DDTHH:mm:ss'),
      uploadedBy,
      publicVisible,
    });
  }
  return out;
}

function maskName(name) {
  if (!name || name.length <= 2) return name;
  const parts = name.split(' ');
  if (parts.length === 1) return parts[0][0] + '*'.repeat(parts[0].length - 1);
  const last = parts[parts.length - 1];
  return parts.slice(0, -1).join(' ') + ' ' + last[0] + '*';
}

function generateSteps(warranty) {
  const steps = [
    { key: 'da_nhan', label: 'Đã nhận', date: warranty.ngayNhan, current: false },
    { key: 'dang_xu_ly', label: 'Đang xử lý', date: null, current: false },
    { key: 'da_tra', label: 'Đã xong', date: warranty.ngayTra, current: false },
  ];

  const h = warranty.history || [];
  const statusChanges = h.filter(x => x.action === 'status' || x.action === 'tra_hang');

  steps[0].current = true;
  if (warranty.trangThai === 'dang_xu_ly' || warranty.trangThai === 'da_tra' || warranty.trangThai === 'cho_xu_ly' || warranty.trangThai === 'cho_lien_he') {
    steps[1].current = true;
    steps[1].date = warranty.ngayNhan;
  }
  if (warranty.trangThai === 'da_tra') {
    steps[1].current = true;
    steps[2].current = true;
    steps[1].date = warranty.ngayNhan;
    if (statusChanges.length > 0) {
      const lastChange = statusChanges[statusChanges.length - 1];
      steps[2].date = lastChange.at;
    }
  }
  if (warranty.trangThai === 'huy') {
    steps.push({ key: 'huy', label: 'Đã hủy', date: null, current: true });
  }

  return steps;
}

function parseWarrantyDate(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmy) {
      const [, day, month, year] = dmy;
      const parsed = dayjs(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      return parsed.isValid() ? parsed : null;
    }
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
}

function isOpenWarranty(warranty) {
  return warranty.trangThai !== 'da_tra' && warranty.trangThai !== 'huy';
}

function addBusinessDaysSkipSunday(startDate, businessDays = 14) {
  let date = dayjs(startDate);
  let added = 0;

  while (added < businessDays) {
    date = date.add(1, 'day');
    if (date.day() !== 0) added += 1;
  }

  return date.format('YYYY-MM-DD');
}

function withDefaultDueDate(warranty) {
  if (!warranty || warranty.ngayHenTra || !warranty.ngayNhan) return warranty;
  return {
    ...warranty,
    ngayHenTra: addBusinessDaysSkipSunday(warranty.ngayNhan, 14),
    supplierStatus: warranty.supplierStatus || 'none',
    supplierIdCurrent: warranty.supplierIdCurrent || null,
    sentSupplierAt: warranty.sentSupplierAt || '',
    expectedReturnSupplierAt: warranty.expectedReturnSupplierAt || '',
  };
}

function getWarrantyDueDate(warranty) {
  if (warranty?.ngayHenTra) return warranty.ngayHenTra;
  if (warranty?.ngayNhan) return addBusinessDaysSkipSunday(warranty.ngayNhan, 14);
  return '';
}

function statusPriority(status) {
  if (status === 'huy') return 2;
  if (status === 'da_tra') return 1;
  return 0;
}

router.use((req, res, next) => {
  const isAdminOnly =
    (req.method === 'POST' && req.path === '/import') ||
    (req.method === 'GET' && (req.path === '/export' || req.path === '/template'));
  if (isAdminOnly) return requireAdmin(req, res, next);
  return next();
});

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 25, search = '', trangThai = '', maNhanVien = '', from = '', to = '', sortBy = 'trangThaiPriority', sortOrder = 'asc', loaiXuLy = '', dueType = '', uuTien = '' } = req.query;
    const db = await readDb();
    let warranties = (db.warranties || []).filter(w => !w.deletedAt);

    if (search) {
      const s = search.toLowerCase();
      warranties = warranties.filter(w =>
        (w.khachHang || '').toLowerCase().includes(s) ||
        (w.soDienThoai || '').toLowerCase().includes(s) ||
        (w.tenHang || '').toLowerCase().includes(s) ||
        (w.soSeri || '').toLowerCase().includes(s) ||
        (w.soChungTu || '').toLowerCase().includes(s)
      );
    }
    if (trangThai) warranties = warranties.filter(w => w.trangThai === trangThai);
    if (maNhanVien) warranties = warranties.filter(w => w.maNhanVien === maNhanVien);
    if (loaiXuLy) warranties = warranties.filter(w => w.loaiXuLy === loaiXuLy);
    if (uuTien === '1') warranties = warranties.filter(w => Boolean(w.uuTien) && isOpenWarranty(w));
    if (uuTien === '0') warranties = warranties.filter(w => !Boolean(w.uuTien));
    if (dueType === 'today') {
      warranties = warranties.filter(w => {
        const dueDate = parseWarrantyDate(getWarrantyDueDate(w));
        return dueDate && dueDate.isSame(dayjs(), 'day') && isOpenWarranty(w);
      });
    }
    if (dueType === 'overdue') {
      warranties = warranties.filter(w => {
        const dueDate = parseWarrantyDate(getWarrantyDueDate(w));
        return dueDate && dueDate.isBefore(dayjs(), 'day') && isOpenWarranty(w);
      });
    }
    if (from) warranties = warranties.filter(w => dayjs(w.ngayNhan).isAfter(dayjs(from).subtract(1, 'day')));
    if (to) warranties = warranties.filter(w => dayjs(w.ngayNhan).isBefore(dayjs(to).add(1, 'day')));

    warranties.sort((a, b) => {
      if (sortBy === 'trangThaiPriority') {
        const rankDiff = statusPriority(a.trangThai) - statusPriority(b.trangThai);
        if (rankDiff !== 0) return sortOrder === 'desc' ? -rankDiff : rankDiff;

        const aUpdated = dayjs(a.updatedAt || a.createdAt || a.ngayNhan);
        const bUpdated = dayjs(b.updatedAt || b.createdAt || b.ngayNhan);
        if (aUpdated.isValid() && bUpdated.isValid()) {
          const timeDiff = bUpdated.valueOf() - aUpdated.valueOf();
          if (timeDiff !== 0) return timeDiff;
        }

        return (b.stt || 0) - (a.stt || 0);
      }

      if (sortBy === 'trangThai') {
        const rankDiff = statusPriority(a.trangThai) - statusPriority(b.trangThai);
        if (rankDiff !== 0) return sortOrder === 'desc' ? -rankDiff : rankDiff;
      }

      const rawA = a[sortBy];
      const rawB = b[sortBy];
      const dateA = dayjs(rawA);
      const dateB = dayjs(rawB);

      let cmp = 0;
      if (dateA.isValid() && dateB.isValid()) {
        cmp = dateA.valueOf() - dateB.valueOf();
      } else {
        let va = rawA ?? '';
        let vb = rawB ?? '';
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va < vb) cmp = -1;
        else if (va > vb) cmp = 1;
      }

      if (cmp === 0) {
        cmp = (a.stt || 0) - (a.stt || 0);
      }

      return sortOrder === 'asc' ? cmp : -cmp;
    });

    const supplierMap = new Map((db.suppliers || []).map(s => [s.id, s]));
    const logsGroupedByWarranty = {};
    for (const log of (db.supplierLogs || [])) {
      if (!logsGroupedByWarranty[log.warrantyId]) {
        logsGroupedByWarranty[log.warrantyId] = [];
      }
      logsGroupedByWarranty[log.warrantyId].push({
        ...log,
        supplierName: supplierMap.get(log.supplierId)?.name || '-'
      });
    }

    const total = warranties.length;
    const start = (parseInt(page) - 1) * parseInt(limit);
    const rows = warranties.slice(start, start + parseInt(limit)).map(w => {
      const mapped = withDefaultDueDate(w);
      const supplierLogs = logsGroupedByWarranty[w.id] || [];
      return {
        ...mapped,
        supplierLogs: supplierLogs.sort((a, b) => dayjs(b.at).valueOf() - dayjs(a.at).valueOf())
      };
    });

    res.json({ success: true, data: { rows, total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.get('/next-code', async (req, res) => {
  try {
    const warranties = await prisma.warranty.findMany({ where: { deletedAt: '' } });
    const today = dayjs().tz('Asia/Ho_Chi_Minh').format('DDMMYYYY');
    const todayCodes = warranties.filter(w => w.soChungTu && w.soChungTu.startsWith(today));
    const n = todayCodes.length + 1;
    const code = `${today}NTPC${n}`;
    res.json({ success: true, data: { code } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.get('/template', async (req, res) => {
  try {
    const xlsx = await import('xlsx');
    const headers = ['STT', 'Ngay', 'MaNhanVien', 'SoChungTu', 'KhachHang', 'TenHang', 'SoSeri', 'CauHinh', 'LoiLucNhan', 'PhuKien', 'ChiPhi', 'BaoHanh', 'GhiChu', 'NgayMua', 'NgayHenTra', 'NgayTra', 'TrangThai'];
    const example = [1, '14/05/2026', 'admin', '14052026NTPC1', 'Nguyễn Văn A', 'Màn hình MSI 24"', 'ABC123', 'IPS 180Hz', '1 điểm chết', 'Full box', 0, '36 tháng', '', '01/04/2025', '21/05/2026', '', 'dang_xu_ly'];
    const ws = xlsx.utils.aoa_to_sheet([headers, example]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Template');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=ntpc-warranty-template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.get('/export', async (req, res) => {
  try {
    const xlsx = await import('xlsx');
    let warranties = await prisma.warranty.findMany({ where: { deletedAt: '' } });

    const { trangThai, maNhanVien, from, to, loaiXuLy } = req.query;
    if (trangThai) warranties = warranties.filter(w => w.trangThai === trangThai);
    if (maNhanVien) warranties = warranties.filter(w => w.maNhanVien === maNhanVien);
    if (loaiXuLy) warranties = warranties.filter(w => w.loaiXuLy === loaiXuLy);
    if (from) warranties = warranties.filter(w => dayjs(w.ngayNhan).isAfter(dayjs(from).subtract(1, 'day')));
    if (to) warranties = warranties.filter(w => dayjs(w.ngayNhan).isBefore(dayjs(to).add(1, 'day')));

    const headers = ['STT', 'Ngay', 'MaNhanVien', 'SoChungTu', 'KhachHang', 'TenHang', 'SoSeri', 'CauHinh', 'LoiLucNhan', 'PhuKien', 'ChiPhi', 'BaoHanh', 'GhiChu', 'NgayMua', 'NgayHenTra', 'NgayTra', 'TraHang', 'TrangThai'];
    const rows = warranties.map(w => [
      w.stt,
      dayjs(w.ngayNhan).format('DD-MM-YYYY HH:mm'),
      w.maNhanVien,
      w.soChungTu,
      w.khachHang,
      w.tenHang,
      w.soSeri,
      w.cauHinh,
      w.loiLucNhan,
      w.phuKien,
      w.chiPhi,
      w.baoHanh,
      w.ghiChu,
      w.ngayMua ? dayjs(w.ngayMua).format('DD-MM-YYYY') : '',
      (w.ngayHenTra && w.ngayHenTra !== 'none') ? dayjs(w.ngayHenTra).format('DD-MM-YYYY') : '',
      w.ngayTra ? dayjs(w.ngayTra).format('DD-MM-YYYY') : '',
      w.doiTra ? (w.doiTra.type === 'doi_hang' ? 'Đổi hàng' : 'Trả hàng') : '',
      w.trangThai,
    ]);

    const ws = xlsx.utils.aoa_to_sheet([headers, ...rows]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Warranties');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=ntpc-warranties-export.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const w = await prisma.warranty.findFirst({ where: { id: req.params.id, deletedAt: '' } });
    if (!w) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });
    const supplierLogs = await prisma.supplierLog.findMany({
      where: { warrantyId: req.params.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: { ...withDefaultDueDate(w), supplierLogs } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = {
      ...req.body,
      ngayHenTra: req.body.ngayHenTra || addBusinessDaysSkipSunday(dayjs(), 14),
    };
    const validation = warrantySchema.safeParse(body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: validation.error.errors[0].message } });
    }

    const today = dayjs().tz('Asia/Ho_Chi_Minh').format('DDMMYYYY');
    const countToday = await prisma.warranty.count({
      where: { soChungTu: { startsWith: today } }
    });
    let n = countToday + 1;
    let soChungTu = `${today}NTPC${n}`;

    for (let retry = 0; retry < 5; retry++) {
      const exists = await prisma.warranty.findUnique({ where: { soChungTu } });
      if (!exists) break;
      n++;
      soChungTu = `${today}NTPC${n}`;
    }

    const maxAggregate = await prisma.warranty.aggregate({
      _max: { stt: true }
    });
    const maxStt = maxAggregate._max.stt || 0;
    const now = dayjs().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss');
    const attachments = saveAttachmentDataUrls(body.attachmentsInput || [], body.maNhanVien);

    // Xác thực mã nhân viên tồn tại trong hệ thống, tránh lỗi khóa ngoại
    const maNhanVien = String(body.maNhanVien).trim();
    const employeeExists = await prisma.nhanVien.findUnique({ where: { maNV: maNhanVien } });
    const finalMaNhanVien = employeeExists ? maNhanVien : 'admin';

    const initialHistory = [{ at: now, by: finalMaNhanVien, action: 'create', changes: {}, note: '' }];
    if (body.ngayHenTra === 'none' || !body.ngayHenTra) {
      initialHistory.push({
        at: now,
        by: finalMaNhanVien,
        action: 'update',
        changes: { ngayHenTra: { from: '', to: 'none' } },
        note: ''
      });
    }

    const newWarranty = {
      id: uuidv4(),
      stt: maxStt + 1,
      soChungTu,
      ngayNhan: now,
      maNhanVien: finalMaNhanVien,
      khachHang: body.khachHang,
      soDienThoai: body.soDienThoai || '',
      diaChi: body.diaChi || '',
      tenHang: body.tenHang,
      soSeri: body.soSeri,
      cauHinh: body.cauHinh || '',
      loiLucNhan: body.loiLucNhan,
      phuKien: body.phuKien || '',
      chiPhi: body.chiPhi || 0,
      baoHanh: body.baoHanh,
      loaiPhieu: body.loaiPhieu || 'nhan_bao_hanh',
      baoGiaSau: Boolean(body.baoGiaSau),
      loaiXuLy: body.loaiXuLy || 'bao_hanh',
      loaiXuLyKhac: body.loaiXuLy === 'khac' ? String(body.loaiXuLyKhac || '').trim() : '',
      ghiChu: body.ghiChu || '',
      ngayMua: body.ngayMua || '',
      ngayHenTra: body.ngayHenTra,
      ngayTra: '',
      trangThai: body.trangThai || 'dang_xu_ly',
      uuTien: Boolean(body.uuTien) || false,
      supplierStatus: 'none',
      supplierIdCurrent: null,
      sentSupplierAt: '',
      expectedReturnSupplierAt: '',
      history: initialHistory,
      createdAt: now,
      updatedAt: now,
      deletedAt: '',
      attachments,
    };

    const created = await prisma.warranty.create({ data: newWarranty });
    await writeAuditLog(req, { action: 'create', entity: 'warranty', entityId: created.id, summary: `Tạo phiếu ${created.soChungTu}`, after: created });

    const allWarranties = await prisma.warranty.findMany();
    const currentCustomers = await getCollection('customers');
    const customers = buildCustomerMasterFromWarranties(allWarranties, currentCustomers);
    await setCollection('customers', customers);
    syncLocalBackup();

    res.status(201).json({ success: true, data: withDefaultDueDate(created) });
  } catch (err) {
    console.error('[ROUTE] Lỗi POST /warranties:', err.message);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const old = await prisma.warranty.findFirst({ where: { id: req.params.id, deletedAt: '' } });
    if (!old) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });

    const changes = {};
    const fields = ['khachHang', 'soDienThoai', 'diaChi', 'tenHang', 'soSeri', 'cauHinh', 'loiLucNhan', 'phuKien', 'chiPhi', 'baoGiaSau', 'loaiPhieu', 'baoHanh', 'loaiXuLy', 'loaiXuLyKhac', 'ghiChu', 'ngayNhan', 'ngayMua', 'ngayHenTra', 'maNhanVien'];

    fields.forEach(f => {
      if (req.body[f] !== undefined && req.body[f] !== old[f]) {
        changes[f] = { from: old[f], to: req.body[f] };
      }
    });

    const now = dayjs().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss');
    const nextBody = { ...req.body };
    if (nextBody.loaiXuLy && nextBody.loaiXuLy !== 'khac') {
      nextBody.loaiXuLyKhac = '';
    }

    let history = Array.isArray(old.history) ? old.history : [];
    if (Object.keys(changes).length > 0) {
      history = [...history, { at: now, by: req.body.maNhanVien || old.maNhanVien, action: 'update', changes, note: req.body.note || '' }];
    }

    const updated = await prisma.warranty.update({
      where: { id: old.id },
      data: {
        khachHang: nextBody.khachHang !== undefined ? String(nextBody.khachHang) : old.khachHang,
        soDienThoai: nextBody.soDienThoai !== undefined ? String(nextBody.soDienThoai) : old.soDienThoai,
        diaChi: nextBody.diaChi !== undefined ? String(nextBody.diaChi) : old.diaChi,
        tenHang: nextBody.tenHang !== undefined ? String(nextBody.tenHang) : old.tenHang,
        soSeri: nextBody.soSeri !== undefined ? String(nextBody.soSeri) : old.soSeri,
        cauHinh: nextBody.cauHinh !== undefined ? String(nextBody.cauHinh) : old.cauHinh,
        loiLucNhan: nextBody.loiLucNhan !== undefined ? String(nextBody.loiLucNhan) : old.loiLucNhan,
        phuKien: nextBody.phuKien !== undefined ? String(nextBody.phuKien) : old.phuKien,
        chiPhi: nextBody.chiPhi !== undefined ? Number(nextBody.chiPhi) : old.chiPhi,
        baoGiaSau: nextBody.baoGiaSau !== undefined ? Boolean(nextBody.baoGiaSau) : old.baoGiaSau,
        loaiPhieu: nextBody.loaiPhieu !== undefined ? String(nextBody.loaiPhieu) : old.loaiPhieu,
        baoHanh: nextBody.baoHanh !== undefined ? String(nextBody.baoHanh) : old.baoHanh,
        loaiXuLy: nextBody.loaiXuLy !== undefined ? String(nextBody.loaiXuLy) : old.loaiXuLy,
        loaiXuLyKhac: nextBody.loaiXuLy !== undefined
          ? (nextBody.loaiXuLy === 'khac' ? String(nextBody.loaiXuLyKhac || '').trim() : '')
          : old.loaiXuLyKhac,
        ghiChu: nextBody.ghiChu !== undefined ? String(nextBody.ghiChu) : old.ghiChu,
        ngayMua: nextBody.ngayMua !== undefined ? String(nextBody.ngayMua) : old.ngayMua,
        ngayNhan: nextBody.ngayNhan !== undefined ? String(nextBody.ngayNhan) : old.ngayNhan,
        ngayHenTra: nextBody.ngayHenTra !== undefined ? String(nextBody.ngayHenTra) : old.ngayHenTra,
        maNhanVien: nextBody.maNhanVien !== undefined ? String(nextBody.maNhanVien) : old.maNhanVien,
        uuTien: nextBody.uuTien !== undefined ? Boolean(nextBody.uuTien) : old.uuTien,
        history,
        updatedAt: now,
      }
    });

    await writeAuditLog(req, { action: 'update', entity: 'warranty', entityId: updated.id, summary: `Cập nhật phiếu ${updated.soChungTu}`, before: old, after: updated });

    const allWarranties = await prisma.warranty.findMany();
    const currentCustomers = await getCollection('customers');
    const customers = buildCustomerMasterFromWarranties(allWarranties, currentCustomers);
    await setCollection('customers', customers);
    syncLocalBackup();

    res.json({ success: true, data: withDefaultDueDate(updated) });
  } catch (err) {
    console.error('[ROUTE] Lỗi PUT /warranties/:id:', err.message);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.patch('/:id/customer', async (req, res) => {
  try {
    const { customerKey } = req.body || {};
    if (!customerKey || !String(customerKey).trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Thiếu khóa khách hàng.' } });
    }

    const old = await prisma.warranty.findFirst({ where: { id: req.params.id, deletedAt: '' } });
    if (!old) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });

    const targetKey = String(customerKey).trim();
    const customers = await getCollection('customers');
    const customer = findCustomerByKey(customers, targetKey);
    if (!customer) {
      return res.status(404).json({ success: false, error: { code: 'CUSTOMER_NOT_FOUND', message: 'Không tìm thấy khách hàng trong danh sách.' } });
    }

    const oldCustomer = {
      key: getWarrantyCustomerKey(old),
      khachHang: old.khachHang || '',
      soDienThoai: old.soDienThoai || '',
      diaChi: old.diaChi || '',
    };
    const now = dayjs().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss');
    const by = req.headers['x-nhan-vien'] || old.maNhanVien || 'admin';
    const changes = {
      khachHang: { from: old.khachHang || '', to: customer.khachHang || '' },
      soDienThoai: { from: old.soDienThoai || '', to: customer.soDienThoai || '' },
      diaChi: { from: old.diaChi || '', to: customer.diaChi || '' },
    };

    const updated = await prisma.warranty.update({
      where: { id: old.id },
      data: {
        khachHang: customer.khachHang || '',
        soDienThoai: customer.soDienThoai || '',
        diaChi: customer.diaChi || '',
        updatedAt: now,
        history: [
          ...(Array.isArray(old.history) ? old.history : []),
          {
            at: now,
            by,
            action: 'customer_transfer',
            changes,
            customer: { from: oldCustomer, to: customer },
            note: `Chuyển khách hàng: ${customerLabel(oldCustomer)} → ${customerLabel(customer)}`,
          },
        ],
      }
    });

    await writeAuditLog(req, { action: 'customer_transfer', entity: 'warranty', entityId: updated.id, summary: `Chuyển khách hàng phiếu ${updated.soChungTu}`, before: old, after: updated });

    const allWarranties = await prisma.warranty.findMany();
    const nextCustomers = buildCustomerMasterFromWarranties(allWarranties, customers);
    await setCollection('customers', nextCustomers);
    syncLocalBackup();

    res.json({ success: true, data: withDefaultDueDate(updated) });
  } catch (err) {
    console.error('[ROUTE] Lỗi PATCH /warranties/:id/customer:', err.message);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const validation = statusUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: validation.error.errors[0].message } });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const old = await tx.warranty.findFirst({ where: { id: req.params.id, deletedAt: '' } });
      if (!old) {
        const err = new Error('Không tìm thấy phiếu.');
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
      const validNext = STATUS_TRANSITIONS[old.trangThai] || [];
      if (!validNext.includes(req.body.trangThai)) {
        const err = new Error(`Không thể chuyển từ "${old.trangThai}" sang "${req.body.trangThai}".`);
        err.status = 400;
        err.code = 'INVALID_TRANSITION';
        throw err;
      }

      const now = dayjs().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss');
      const history = [
        ...(Array.isArray(old.history) ? old.history : []),
        { at: now, by: req.headers['x-nhan-vien'] || old.maNhanVien, action: 'status', changes: { trangThai: { from: old.trangThai, to: req.body.trangThai } }, note: req.body.note || '' },
      ];
      const next = await tx.warranty.update({
        where: { id: old.id },
        data: {
          trangThai: req.body.trangThai,
          uuTien: req.body.trangThai === 'da_tra' || req.body.trangThai === 'huy' ? false : Boolean(old.uuTien),
          updatedAt: now,
          history,
        },
      });
      await writeAuditLog(req, { action: 'update_status', entity: 'warranty', entityId: next.id, summary: `Đổi trạng thái phiếu ${next.soChungTu}`, before: old, after: next }, tx);
      return next;
    });

    syncLocalBackup();
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.patch('/:id/tra-hang', async (req, res) => {
  try {
    const validation = traHangSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: validation.error.errors[0].message } });
    }

    const old = await prisma.warranty.findFirst({ where: { id: req.params.id, deletedAt: '' } });
    if (!old) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });

    const now = dayjs().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss');
    const ngayTra = req.body.ngayTra || now.slice(0, 10);
    const by = req.headers['x-nhan-vien'] || old.maNhanVien || 'admin';

    const updated = await prisma.warranty.update({
      where: { id: old.id },
      data: {
        trangThai: 'da_tra',
        uuTien: false,
        ngayTra,
        updatedAt: now,
        history: [
          ...(Array.isArray(old.history) ? old.history : []),
          {
            at: now,
            by,
            action: 'tra_hang',
            changes: {
              trangThai: { from: old.trangThai, to: 'da_tra' },
              ngayTra: { from: old.ngayTra, to: ngayTra }
            },
            note: req.body.note || ''
          }
        ]
      }
    });

    await writeAuditLog(req, { action: 'tra_hang', entity: 'warranty', entityId: updated.id, summary: `Trả hàng phiếu ${updated.soChungTu}`, before: old, after: updated });
    syncLocalBackup();

    res.json({ success: true, data: withDefaultDueDate(updated) });
  } catch (err) {
    console.error('[ROUTE] Lỗi PATCH /warranties/:id/tra-hang:', err.message);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.patch('/:id/exchange-return', async (req, res) => {
  try {
    const validation = exchangeReturnSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: validation.error.errors[0].message } });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const old = await tx.warranty.findFirst({ where: { id: req.params.id, deletedAt: '' } });
      if (!old) {
        const err = new Error('Không tìm thấy phiếu.');
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
      if (!isOpenWarranty(old)) {
        const err = new Error('Phiếu đã xong hoặc đã hủy, không thể đổi/trả hàng.');
        err.status = 400;
        err.code = 'CLOSED_WARRANTY';
        throw err;
      }
      if (old.doiTra) {
        const err = new Error('Phiếu đã có thông tin đổi/trả hàng.');
        err.status = 400;
        err.code = 'ALREADY_PROCESSED';
        throw err;
      }

      const body = validation.data;
      const now = dayjs().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss');
      const ngayTra = now.slice(0, 10);
      const by = req.headers['x-nhan-vien'] || old.maNhanVien || 'admin';
      const isExchange = body.type === 'doi_hang';
      const exchangeAttachments = saveAttachmentDataUrls(body.attachmentsInput || [], by);
      
      const doiTra = {
        type: body.type,
        tenHangCu: old.tenHang || '',
        soSeriCu: old.soSeri || '',
        tenHangMoi: isExchange ? body.tenHangMoi : '',
        soSeriMoi: isExchange ? body.soSeriMoi : '',
        reason: isExchange ? '' : body.reason,
        note: body.note || '',
        attachments: exchangeAttachments,
        at: now,
        by,
      };

      const note = isExchange
        ? `Đã đổi hàng: ${body.tenHangMoi} - Serial: ${body.soSeriMoi}${body.note ? ` | ${body.note}` : ''}`
        : `Đã trả hàng: ${body.reason}${body.note ? ` | ${body.note}` : ''}`;

      const history = [
        ...(Array.isArray(old.history) ? old.history : []),
        {
          at: now,
          by,
          action: isExchange ? 'exchange' : 'return',
          changes: {
            trangThai: { from: old.trangThai, to: 'da_tra' },
            ngayTra: { from: old.ngayTra, to: ngayTra },
            ...(isExchange ? {
              tenHang: { from: old.tenHang || '', to: body.tenHangMoi },
              soSeri: { from: old.soSeri || '', to: body.soSeriMoi },
            } : {}),
            ...(exchangeAttachments.length ? {
              exchangeAttachments: { from: 0, to: exchangeAttachments.length },
            } : {}),
          },
          note,
        },
      ];

      const next = await tx.warranty.update({
        where: { id: old.id },
        data: {
          doiTra,
          trangThai: 'da_tra',
          uuTien: false,
          ngayTra,
          updatedAt: now,
          history,
          ...(isExchange ? {
            tenHang: body.tenHangMoi,
            soSeri: body.soSeriMoi,
          } : {})
        }
      });

      await writeAuditLog(req, { action: isExchange ? 'exchange' : 'return', entity: 'warranty', entityId: next.id, summary: `Đổi/trả hàng phiếu ${next.soChungTu}`, before: old, after: next }, tx);
      return next;
    });

    syncLocalBackup();
    res.json({ success: true, data: withDefaultDueDate(updated) });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.patch('/:id/log', async (req, res) => {
  try {
    const { note } = req.body;
    if (!note || !note.trim()) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Thiếu ghi chú.' } });

    const old = await prisma.warranty.findFirst({ where: { id: req.params.id, deletedAt: '' } });
    if (!old) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });

    const now = dayjs().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss');
    const by = req.headers['x-nhan-vien'] || old.maNhanVien || 'admin';

    const updated = await prisma.warranty.update({
      where: { id: old.id },
      data: {
        updatedAt: now,
        history: [
          ...(Array.isArray(old.history) ? old.history : []),
          { at: now, by, action: 'log', changes: {}, note: note.trim() }
        ]
      }
    });

    await writeAuditLog(req, { action: 'add_log', entity: 'warranty', entityId: updated.id, summary: `Thêm ghi chú phiếu ${updated.soChungTu}`, before: old, after: updated });
    syncLocalBackup();

    res.json({ success: true, data: withDefaultDueDate(updated) });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.patch('/:id/priority', async (req, res) => {
  try {
    const old = await prisma.warranty.findFirst({ where: { id: req.params.id, deletedAt: '' } });
    if (!old) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });

    const now = dayjs().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss');
    const nextPriority = Boolean(req.body?.uuTien);
    if (nextPriority && !isOpenWarranty(old)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PRIORITY', message: 'Không thể ưu tiên phiếu đã xong hoặc đã hủy.' } });
    }

    const by = req.headers['x-nhan-vien'] || old.maNhanVien || 'admin';
    const updated = await prisma.warranty.update({
      where: { id: old.id },
      data: {
        uuTien: nextPriority,
        updatedAt: now,
        history: [
          ...(Array.isArray(old.history) ? old.history : []),
          {
            at: now,
            by,
            action: 'priority',
            changes: { uuTien: { from: Boolean(old.uuTien), to: nextPriority } },
            note: nextPriority ? 'Đánh dấu ưu tiên' : 'Bỏ ưu tiên'
          }
        ]
      }
    });

    await writeAuditLog(req, { action: 'update_priority', entity: 'warranty', entityId: updated.id, summary: `Cập nhật ưu tiên phiếu ${updated.soChungTu}`, before: old, after: updated });
    syncLocalBackup();

    res.json({ success: true, data: withDefaultDueDate(updated) });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.post('/:id/attachments', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.attachmentsInput) ? req.body.attachmentsInput : [];
    if (!items.length) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Thiếu ảnh đính kèm.' } });
    }

    const old = await prisma.warranty.findFirst({ where: { id: req.params.id, deletedAt: '' } });
    if (!old) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });

    const current = Array.isArray(old.attachments) ? old.attachments : [];
    const remaining = Math.max(0, 10 - current.length);
    if (remaining <= 0) {
      return res.status(400).json({ success: false, error: { code: 'LIMIT_REACHED', message: 'Tối đa 10 ảnh đính kèm.' } });
    }

    const now = dayjs().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss');
    const by = req.headers['x-nhan-vien'] || old.maNhanVien || 'admin';
    const uploaded = saveAttachmentDataUrls(items.slice(0, remaining), by);
    if (!uploaded.length) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_DATA', message: 'Không có ảnh hợp lệ để tải lên.' } });
    }

    // Lọc bỏ những ảnh đã tồn tại ở bản ghi cũ (trùng tên và kích thước) để tránh bị lặp khi có request retry gửi lại
    const uniqueUploaded = uploaded.filter(newFile => {
      const isDuplicate = current.some(oldFile => oldFile.name === newFile.name && oldFile.size === newFile.size);
      if (isDuplicate) {
        deleteAttachmentFile(newFile); // Xóa file vật lý vừa tạo để tránh rác đĩa
        return false;
      }
      return true;
    });

    // Nếu tất cả ảnh đều đã tồn tại (do trình duyệt retry lại yêu cầu cũ)
    if (!uniqueUploaded.length) {
      return res.json({ success: true, data: withDefaultDueDate(old) });
    }

    const updated = await prisma.warranty.update({
      where: { id: old.id },
      data: {
        attachments: [...current, ...uniqueUploaded],
        updatedAt: now,
        history: [
          ...(Array.isArray(old.history) ? old.history : []),
          {
            at: now,
            by,
            action: 'update',
            changes: { attachments: { from: current.length, to: current.length + uniqueUploaded.length } },
            note: `Thêm ${uniqueUploaded.length} ảnh đính kèm`
          }
        ]
      }
    });

    await writeAuditLog(req, { action: 'add_attachments', entity: 'warranty', entityId: updated.id, summary: `Thêm ảnh đính kèm phiếu ${updated.soChungTu}`, before: old, after: updated });
    syncLocalBackup();

    res.json({ success: true, data: withDefaultDueDate(updated) });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.delete('/:id/attachments/:attachmentId', async (req, res) => {
  try {
    const old = await prisma.warranty.findFirst({ where: { id: req.params.id, deletedAt: '' } });
    if (!old) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });

    const current = Array.isArray(old.attachments) ? old.attachments : [];
    const removed = current.find((a) => a.id === req.params.attachmentId);
    const next = current.filter((a) => a.id !== req.params.attachmentId);
    if (next.length === current.length) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy ảnh đính kèm.' } });
    }
    deleteAttachmentFile(removed);

    const now = dayjs().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss');
    const by = req.headers['x-nhan-vien'] || old.maNhanVien || 'admin';
    const updated = await prisma.warranty.update({
      where: { id: old.id },
      data: {
        attachments: next,
        updatedAt: now,
        history: [
          ...(Array.isArray(old.history) ? old.history : []),
          { at: now, by, action: 'update', changes: { attachments: { from: current.length, to: next.length } }, note: 'Xóa ảnh đính kèm' }
        ]
      }
    });

    await writeAuditLog(req, { action: 'delete_attachments', entity: 'warranty', entityId: updated.id, summary: `Xóa ảnh đính kèm phiếu ${updated.soChungTu}`, before: old, after: updated });
    syncLocalBackup();

    res.json({ success: true, data: withDefaultDueDate(updated) });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.delete('/:id/history/:historyIndex', async (req, res) => {
  try {
    const by = String(req.headers['x-nhan-vien'] || '').trim();
    if (!by) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Chỉ nhân viên hoặc admin mới được xóa lịch sử.' } });
    }

    const old = await prisma.warranty.findFirst({ where: { id: req.params.id, deletedAt: '' } });
    if (!old) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });

    const historyIndex = Number(req.params.historyIndex);
    const history = Array.isArray(old.history) ? old.history : [];
    if (!Number.isInteger(historyIndex) || historyIndex < 0 || historyIndex >= history.length) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy dòng lịch sử.' } });
    }

    const now = dayjs().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss');
    const updated = await prisma.warranty.update({
      where: { id: old.id },
      data: {
        history: history.filter((_, index) => index !== historyIndex),
        updatedAt: now
      }
    });

    await writeAuditLog(req, { action: 'delete_history', entity: 'warranty', entityId: updated.id, summary: `Xóa dòng lịch sử phiếu ${updated.soChungTu}`, before: old, after: updated });
    syncLocalBackup();

    res.json({ success: true, data: withDefaultDueDate(updated) });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.get('/:id/supplier-logs', async (req, res) => {
  try {
    const w = await prisma.warranty.findFirst({ where: { id: req.params.id, deletedAt: '' } });
    if (!w) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });
    const suppliers = await prisma.supplier.findMany();
    const supplierMap = new Map(suppliers.map(s => [s.id, s]));
    
    const logs = await prisma.supplierLog.findMany({
      where: { warrantyId: req.params.id },
      orderBy: { createdAt: 'desc' }
    });
    
    const mappedLogs = logs.map(x => ({
      ...x,
      supplierName: supplierMap.get(x.supplierId)?.name || '-'
    }));

    res.json({ success: true, data: mappedLogs });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.patch('/:id/supplier-logs/:logId', async (req, res) => {
  try {
    const by = String(req.headers['x-nhan-vien'] || '').trim();
    if (!by) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Chỉ nhân viên hoặc admin mới được sửa NCC.' } });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const old = await tx.warranty.findFirst({ where: { id: req.params.id, deletedAt: '' } });
      if (!old) {
        const err = new Error('Không tìm thấy phiếu.');
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }

      const oldLog = await tx.supplierLog.findFirst({ where: { id: req.params.logId, warrantyId: old.id } });
      if (!oldLog) {
        const err = new Error('Không tìm thấy lịch sử NCC.');
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }

      const newSupplierId = String(req.body?.supplierId || oldLog.supplierId || '').trim();
      const supplier = await tx.supplier.findFirst({ where: { id: newSupplierId } });
      if (!supplier) {
        const err = new Error('Không tìm thấy nhà cung cấp.');
        err.status = 404;
        err.code = 'SUPPLIER_NOT_FOUND';
        throw err;
      }
      if (supplier.isActive === false) {
        const err = new Error('Nhà cung cấp đang ngừng hoạt động.');
        err.status = 400;
        err.code = 'SUPPLIER_INACTIVE';
        throw err;
      }

      const now = dayjs().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss');
      const nextNote = String(req.body?.note || '');
      const updatedLog = await tx.supplierLog.update({
        where: { id: oldLog.id },
        data: {
          supplierId: newSupplierId,
          supplierName: supplier.name,
          note: nextNote,
        }
      });

      const historyAction = updatedLog.action === 'returned' ? 'supplier_returned' : 'supplier_sent';
      const historyPrefix = updatedLog.action === 'returned' ? 'Đã nhận lại từ nhà cung cấp' : 'Đã gửi bảo hành nhà cung cấp';
      const rebuiltNote = `${historyPrefix}: ${supplier.name}${nextNote ? ` | ${nextNote}` : ''}`;

      const historyRows = Array.isArray(old.history) ? old.history : [];
      let linkedHistoryIndex = historyRows.findIndex((h) =>
        h?.action === historyAction && String(h?.changes?.supplierLogs?.logId || '') === String(updatedLog.id || '')
      );

      if (linkedHistoryIndex < 0) {
        const supplierName = String(supplier.name).trim();
        const legacyPrefix = `${historyPrefix}: ${supplierName}`;
        for (let i = historyRows.length - 1; i >= 0; i -= 1) {
          const row = historyRows[i];
          if (row?.action !== historyAction) continue;
          const rowNote = String(row?.note || '');
          if (!supplierName || rowNote.startsWith(legacyPrefix)) {
            linkedHistoryIndex = i;
            break;
          }
        }
      }

      if (linkedHistoryIndex >= 0) {
        historyRows[linkedHistoryIndex] = {
          ...historyRows[linkedHistoryIndex],
          note: rebuiltNote,
          changes: {
            ...(historyRows[linkedHistoryIndex]?.changes || {}),
            supplierLogs: {
              ...(historyRows[linkedHistoryIndex]?.changes?.supplierLogs || {}),
              logId: updatedLog.id,
              action: updatedLog.action,
            },
          },
        };
      }

      const sentLogs = await tx.supplierLog.findMany({
        where: { warrantyId: old.id, action: 'sent' },
        orderBy: { createdAt: 'desc' }
      });

      let extraData = {};
      if (sentLogs[0]?.id === updatedLog.id) {
        extraData = {
          supplierIdCurrent: newSupplierId,
          history: [
            ...historyRows,
            {
              at: now,
              by,
              action: 'supplier_log_updated',
              changes: { supplierLogs: { logId: updatedLog.id, supplierId: newSupplierId } },
              note: 'Cập nhật nhà cung cấp đã gửi',
            }
          ]
        };
      } else {
        extraData = {
          history: historyRows
        };
      }

      const next = await tx.warranty.update({
        where: { id: old.id },
        data: {
          ...extraData,
          updatedAt: now
        }
      });

      await writeAuditLog(req, { action: 'supplier_log_updated', entity: 'supplier_log', entityId: updatedLog.id, summary: `Sửa nhật ký NCC phiếu ${next.soChungTu}`, before: oldLog, after: updatedLog }, tx);
      return { next, updatedLog, supplier };
    });

    syncLocalBackup();
    res.json({ success: true, data: { ...updated.updatedLog, supplierName: updated.supplier.name } });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.delete('/:id/supplier-logs/:logId', async (req, res) => {
  try {
    const by = String(req.headers['x-nhan-vien'] || '').trim();
    if (!by) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Chỉ nhân viên hoặc admin mới được xóa lịch sử NCC.' } });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const old = await tx.warranty.findFirst({ where: { id: req.params.id, deletedAt: '' } });
      if (!old) {
        const err = new Error('Không tìm thấy phiếu.');
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }

      const oldLog = await tx.supplierLog.findFirst({ where: { id: req.params.logId, warrantyId: old.id } });
      if (!oldLog) {
        const err = new Error('Không tìm thấy lịch sử NCC.');
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }

      await tx.supplierLog.delete({ where: { id: oldLog.id } });
      const now = dayjs().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss');
      const next = await tx.warranty.update({
        where: { id: old.id },
        data: {
          updatedAt: now,
          history: [
            ...(Array.isArray(old.history) ? old.history : []),
            {
              at: now,
              by,
              action: 'supplier_log_deleted',
              changes: { supplierLogs: { deletedLogId: req.params.logId } },
              note: 'Xóa 1 dòng lịch sử gửi / nhận NCC',
            }
          ]
        }
      });

      await writeAuditLog(req, { action: 'supplier_log_deleted', entity: 'supplier_log', entityId: oldLog.id, summary: `Xóa nhật ký NCC phiếu ${next.soChungTu}`, before: oldLog, after: null }, tx);
      return next;
    });

    syncLocalBackup();
    res.json({ success: true, data: withDefaultDueDate(updated) });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.post('/:id/supplier-send', async (req, res) => {
  try {
    const parsed = supplierSendSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } });

    const updated = await prisma.$transaction(async (tx) => {
      const old = await tx.warranty.findFirst({ where: { id: req.params.id, deletedAt: '' } });
      if (!old) {
        const err = new Error('Không tìm thấy phiếu.');
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }

      const supplier = await tx.supplier.findFirst({ where: { id: parsed.data.supplierId } });
      if (!supplier) {
        const err = new Error('Không tìm thấy nhà cung cấp.');
        err.status = 404;
        err.code = 'SUPPLIER_NOT_FOUND';
        throw err;
      }
      if (supplier.isActive === false) {
        const err = new Error('Nhà cung cấp đang ngừng hoạt động.');
        err.status = 400;
        err.code = 'SUPPLIER_INACTIVE';
        throw err;
      }
      if (parsed.data.expectedReturnAt && dayjs(parsed.data.expectedReturnAt).isBefore(dayjs(parsed.data.sentAt))) {
        const err = new Error('Ngày hẹn nhận lại phải sau ngày gửi.');
        err.status = 400;
        err.code = 'INVALID_DATE';
        throw err;
      }

      const now = dayjs().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss');
      const by = req.headers['x-nhan-vien'] || old.maNhanVien || 'admin';
      const log = await tx.supplierLog.create({
        data: {
          id: uuidv4(),
          warrantyId: old.id,
          supplierId: supplier.id,
          supplierName: supplier.name,
          action: 'sent',
          sentAt: parsed.data.sentAt,
          expectedReturnAt: parsed.data.expectedReturnAt || '',
          returnedAt: '',
          note: parsed.data.note || '',
          createdBy: by,
        }
      });

      const next = await tx.warranty.update({
        where: { id: old.id },
        data: {
          supplierStatus: 'sent',
          supplierIdCurrent: supplier.id,
          sentSupplierAt: parsed.data.sentAt,
          expectedReturnSupplierAt: parsed.data.expectedReturnAt || '',
          updatedAt: now,
          history: [
            ...(Array.isArray(old.history) ? old.history : []),
            {
              at: now,
              by,
              action: 'supplier_sent',
              changes: {
                supplierIdCurrent: { from: old.supplierIdCurrent || null, to: supplier.id },
                supplierLogs: { logId: log.id, action: 'sent' },
              },
              note: `Đã gửi bảo hành nhà cung cấp: ${supplier.name}${parsed.data.note ? ` | ${parsed.data.note}` : ''}`,
            }
          ]
        }
      });

      await writeAuditLog(req, { action: 'supplier_sent', entity: 'warranty', entityId: next.id, summary: `Gửi bảo hành NCC phiếu ${next.soChungTu}`, before: old, after: next }, tx);
      return next;
    });

    syncLocalBackup();
    res.json({ success: true, data: withDefaultDueDate(updated) });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.post('/:id/supplier-return', async (req, res) => {
  try {
    const parsed = supplierReturnSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } });

    const updated = await prisma.$transaction(async (tx) => {
      const old = await tx.warranty.findFirst({ where: { id: req.params.id, deletedAt: '' } });
      if (!old) {
        const err = new Error('Không tìm thấy phiếu.');
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
      if (old.supplierStatus !== 'sent' || !old.supplierIdCurrent) {
        const err = new Error('Phiếu không ở trạng thái đang gửi NCC.');
        err.status = 400;
        err.code = 'INVALID_STATE';
        throw err;
      }
      if (old.sentSupplierAt && dayjs(parsed.data.returnedAt).isBefore(dayjs(old.sentSupplierAt))) {
        const err = new Error('Ngày nhận lại phải sau ngày gửi.');
        err.status = 400;
        err.code = 'INVALID_DATE';
        throw err;
      }

      const supplier = await tx.supplier.findFirst({ where: { id: old.supplierIdCurrent } });
      const now = dayjs().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss');
      const by = req.headers['x-nhan-vien'] || old.maNhanVien || 'admin';
      const log = await tx.supplierLog.create({
        data: {
          id: uuidv4(),
          warrantyId: old.id,
          supplierId: old.supplierIdCurrent,
          supplierName: supplier?.name || '-',
          action: 'returned',
          sentAt: old.sentSupplierAt || '',
          expectedReturnAt: old.expectedReturnSupplierAt || '',
          returnedAt: parsed.data.returnedAt,
          note: parsed.data.note || '',
          createdBy: by,
        }
      });

      const next = await tx.warranty.update({
        where: { id: old.id },
        data: {
          supplierStatus: 'returned',
          uuTien: false,
          updatedAt: now,
          history: [
            ...(Array.isArray(old.history) ? old.history : []),
            {
              at: now,
              by,
              action: 'supplier_returned',
              changes: {
                supplierStatus: { from: 'sent', to: 'returned' },
                supplierLogs: { logId: log.id, action: 'returned' },
              },
              note: `Đã nhận lại từ nhà cung cấp: ${supplier?.name || '-'}${parsed.data.note ? ` | ${parsed.data.note}` : ''}`,
            }
          ]
        }
      });

      await writeAuditLog(req, { action: 'supplier_returned', entity: 'warranty', entityId: next.id, summary: `Nhận lại từ NCC phiếu ${next.soChungTu}`, before: old, after: next }, tx);
      return next;
    });

    syncLocalBackup();
    res.json({ success: true, data: withDefaultDueDate(updated) });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.delete('/', requireAdmin, async (req, res) => {
  try {
    const now = dayjs().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss');
    const result = await prisma.warranty.updateMany({
      where: { deletedAt: '' },
      data: { deletedAt: now, updatedAt: now }
    });

    await writeAuditLog(req, { action: 'delete_all', entity: 'warranty', summary: `Xóa mềm toàn bộ phiếu (${result.count} phiếu)`, after: result });
    syncLocalBackup();

    res.json({ success: true, data: { deleted: result.count } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const old = await prisma.warranty.findFirst({ where: { id: req.params.id, deletedAt: '' } });
    if (!old) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });

    const now = dayjs().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss');
    const by = req.headers['x-nhan-vien'] || old.maNhanVien || 'admin';
    const updated = await prisma.warranty.update({
      where: { id: old.id },
      data: {
        deletedAt: now,
        updatedAt: now,
        history: [
          ...(Array.isArray(old.history) ? old.history : []),
          { at: now, by, action: 'delete', changes: {}, note: 'Xóa mềm' }
        ]
      }
    });

    await writeAuditLog(req, { action: 'delete', entity: 'warranty', entityId: updated.id, summary: `Xóa mềm phiếu ${updated.soChungTu}`, before: old, after: updated });
    syncLocalBackup();

    res.json({ success: true, data: withDefaultDueDate(updated) });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.post('/import', async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ success: false, error: { code: 'INVALID_DATA', message: 'Dữ liệu không hợp lệ.' } });

    const existingWarranties = await prisma.warranty.findMany({ select: { soChungTu: true } });
    const existingCodes = new Set(existingWarranties.map(w => w.soChungTu).filter(Boolean));
    const inserted = [];
    const skipped = [];
    const errors = [];
    const now = dayjs().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss');
    const maxAggregate = await prisma.warranty.aggregate({ _max: { stt: true } });
    const maxStt = maxAggregate._max.stt || 0;

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          if (!row.soChungTu) { errors.push({ row: i + 1, reason: 'Thiếu số chứng từ' }); continue; }
          if (existingCodes.has(row.soChungTu)) { skipped.push({ row: i + 1, soChungTu: row.soChungTu }); continue; }
          if (!row.khachHang) { errors.push({ row: i + 1, reason: 'Thiếu khách hàng' }); continue; }

          const trangThaiMap = {
            da_tra: 'da_tra',
            da_nhan: 'da_nhan',
            dang_xu_ly: 'dang_xu_ly',
            huy: 'huy',
            cho_xu_ly: 'da_nhan',
            cho_lien_he: 'dang_xu_ly',
          };
          const trangThai = trangThaiMap[row.trangThai] || (row.trangThai || 'dang_xu_ly');
          const maNhanVien = String(row.maNhanVien || 'admin').trim();
          
          const employeeExists = await tx.nhanVien.findUnique({ where: { maNV: maNhanVien } });
          const finalMaNhanVien = employeeExists ? maNhanVien : 'admin';

          const newW = {
            id: uuidv4(),
            stt: maxStt + inserted.length + skipped.length + errors.length + 1,
            soChungTu: row.soChungTu,
            ngayNhan: row.ngayNhan || now,
            maNhanVien: finalMaNhanVien,
            khachHang: row.khachHang,
            soDienThoai: row.soDienThoai || '',
            diaChi: row.diaChi || '',
            tenHang: (row.tenHang && row.tenHang !== 'Không rõ') ? row.tenHang : 'Chưa có',
            soSeri: (row.soSeri && row.soSeri !== 'Không rõ') ? row.soSeri : 'Chưa có',
            cauHinh: row.cauHinh || '',
            loiLucNhan: (row.loiLucNhan && row.loiLucNhan !== 'Không rõ') ? row.loiLucNhan : 'Chưa mô tả',
            phuKien: row.phuKien || '',
            chiPhi: parseInt(row.chiPhi) || 0,
            baoHanh: row.baoHanh || '12 tháng',
            loaiPhieu: row.loaiPhieu || 'nhan_bao_hanh',
            baoGiaSau: Boolean(row.baoGiaSau),
            loaiXuLy: row.loaiXuLy || 'bao_hanh',
            ghiChu: row.ghiChu || '',
            ngayMua: row.ngayMua || '',
            ngayHenTra: row.ngayHenTra || '',
            ngayTra: row.ngayTra || '',
            trangThai,
            uuTien: Boolean(row.uuTien) || false,
            supplierStatus: 'none',
            supplierIdCurrent: null,
            sentSupplierAt: '',
            expectedReturnSupplierAt: '',
            history: [{ at: now, by: finalMaNhanVien, action: 'create', changes: {}, note: 'Import từ Excel' }],
            createdAt: now,
            updatedAt: now,
            deletedAt: '',
          };

          await tx.warranty.create({ data: newW });
          inserted.push(newW);
          existingCodes.add(row.soChungTu);
        } catch (e) {
          errors.push({ row: i + 1, reason: e.message });
        }
      }
    });

    const allWarranties = await prisma.warranty.findMany();
    const currentCustomers = await getCollection('customers');
    const nextCustomers = buildCustomerMasterFromWarranties(allWarranties, currentCustomers);
    await setCollection('customers', nextCustomers);
    syncLocalBackup();

    await writeAuditLog(req, { action: 'import', entity: 'warranty', summary: `Import từ Excel thành công: Thêm mới ${inserted.length} phiếu, bỏ qua ${skipped.length} phiếu, lỗi ${errors.length} phiếu`, after: { insertedCount: inserted.length } });

    res.json({ success: true, data: { inserted: inserted.length, skipped: skipped.length, errors } });
  } catch (err) {
    console.error('[ROUTE] Lỗi POST /import:', err.message);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

export default router;

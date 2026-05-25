import express from 'express';
import { readDb, getCollection, setCollection, addToCollection } from '../lib/db.js';
import { customerLabel, getCustomerRows, getWarrantyCustomerKey, findCustomerByKey } from '../lib/customers.js';
import { buildCustomerMasterFromWarranties, upsertCustomer } from '../lib/customerMaster.js';
import { warrantySchema, statusUpdateSchema, traHangSchema, exchangeReturnSchema, supplierSendSchema, supplierReturnSchema } from '../lib/validators.js';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
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
  const now = dayjs();
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
    req.method === 'DELETE' ||
    (req.method === 'POST' && req.path === '/import') ||
    (req.method === 'GET' && (req.path === '/export' || req.path === '/template'));
  if (isAdminOnly) return requireAdmin(req, res, next);
  return next();
});

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 25, search = '', trangThai = '', maNhanVien = '', from = '', to = '', sortBy = 'trangThaiPriority', sortOrder = 'asc', loaiXuLy = '', dueType = '', uuTien = '' } = req.query;
    let warranties = await getCollection('warranties');
    warranties = warranties.filter(w => !w.deletedAt);

    if (search) {
      const s = search.toLowerCase();
      warranties = warranties.filter(w =>
        (w.khachHang || '').toLowerCase().includes(s) ||
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
        cmp = (a.stt || 0) - (b.stt || 0);
      }

      return sortOrder === 'asc' ? cmp : -cmp;
    });

    const total = warranties.length;
    const start = (parseInt(page) - 1) * parseInt(limit);
    const rows = warranties.slice(start, start + parseInt(limit)).map(withDefaultDueDate);

    res.json({ success: true, data: { rows, total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.get('/next-code', async (req, res) => {
  try {
    const warranties = await getCollection('warranties');
    const today = dayjs().format('DDMMYYYY');
    const todayCodes = warranties.filter(w => !w.deletedAt && w.soChungTu && w.soChungTu.startsWith(today));
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
    let warranties = await getCollection('warranties');
    warranties = warranties.filter(w => !w.deletedAt);

    const { trangThai, maNhanVien, from, to, loaiXuLy } = req.query;
    if (trangThai) warranties = warranties.filter(w => w.trangThai === trangThai);
    if (maNhanVien) warranties = warranties.filter(w => w.maNhanVien === maNhanVien);
    if (loaiXuLy) warranties = warranties.filter(w => w.loaiXuLy === loaiXuLy);
    if (from) warranties = warranties.filter(w => dayjs(w.ngayNhan).isAfter(dayjs(from).subtract(1, 'day')));
    if (to) warranties = warranties.filter(w => dayjs(w.ngayNhan).isBefore(dayjs(to).add(1, 'day')));

    const headers = ['STT', 'Ngay', 'MaNhanVien', 'SoChungTu', 'KhachHang', 'TenHang', 'SoSeri', 'CauHinh', 'LoiLucNhan', 'PhuKien', 'ChiPhi', 'BaoHanh', 'GhiChu', 'NgayMua', 'NgayHenTra', 'NgayTra', 'TraHang', 'TrangThai'];
    const rows = warranties.map(w => [
      w.stt,
      dayjs(w.ngayNhan).format('DD/MM/YYYY HH:mm'),
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
      w.ngayMua ? dayjs(w.ngayMua).format('DD/MM/YYYY') : '',
      w.ngayHenTra ? dayjs(w.ngayHenTra).format('DD/MM/YYYY') : '',
      w.ngayTra ? dayjs(w.ngayTra).format('DD/MM/YYYY') : '',
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
    const db = await readDb();
    const w = (db.warranties || []).find(x => x.id === req.params.id && !x.deletedAt);
    if (!w) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });
    const supplierLogs = (db.supplierLogs || [])
      .filter((x) => x.warrantyId === req.params.id)
      .sort((a, b) => dayjs(b.at).valueOf() - dayjs(a.at).valueOf());
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

    const warranties = await getCollection('warranties');
    const today = dayjs().format('DDMMYYYY');
    const todayCodes = warranties.filter(w => !w.deletedAt && w.soChungTu && w.soChungTu.startsWith(today));
    let n = todayCodes.length + 1;
    let soChungTu = `${today}NTPC${n}`;

    for (let retry = 0; retry < 5; retry++) {
      if (!warranties.some(w => w.soChungTu === soChungTu)) break;
      n++;
      soChungTu = `${today}NTPC${n}`;
    }

    const maxStt = warranties.reduce((max, w) => Math.max(max, w.stt || 0), 0);
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const attachments = saveAttachmentDataUrls(body.attachmentsInput || [], body.maNhanVien);

    const newWarranty = {
      id: uuidv4(),
      stt: maxStt + 1,
      soChungTu,
      ngayNhan: now,
      maNhanVien: body.maNhanVien,
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
      ngayTra: null,
      trangThai: body.trangThai || 'dang_xu_ly',
      uuTien: Boolean(body.uuTien) || false,
      supplierStatus: 'none',
      supplierIdCurrent: null,
      sentSupplierAt: '',
      expectedReturnSupplierAt: '',
      history: [{ at: now, by: body.maNhanVien, action: 'create', changes: {}, note: '' }],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      attachments,
        };

    await addToCollection('warranties', newWarranty);
    const warrantiesAfterCreate = await getCollection('warranties');
    const customersAfterCreate = buildCustomerMasterFromWarranties(warrantiesAfterCreate, await getCollection('customers'));
    await setCollection('customers', customersAfterCreate);
    res.status(201).json({ success: true, data: newWarranty });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.put('/:id', async (req, res) => {
  try {
    let warranties = await getCollection('warranties');
    const idx = warranties.findIndex(w => w.id === req.params.id && !w.deletedAt);
    if (idx === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });

    const old = warranties[idx];
    const changes = {};
    const fields = ['khachHang', 'soDienThoai', 'diaChi', 'tenHang', 'soSeri', 'cauHinh', 'loiLucNhan', 'phuKien', 'chiPhi', 'baoGiaSau', 'loaiPhieu', 'baoHanh', 'loaiXuLy', 'loaiXuLyKhac', 'ghiChu', 'ngayNhan', 'ngayMua', 'ngayHenTra', 'maNhanVien'];

    fields.forEach(f => {
      if (req.body[f] !== undefined && req.body[f] !== old[f]) {
        changes[f] = { from: old[f], to: req.body[f] };
      }
    });

    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const nextBody = { ...req.body };
    if (nextBody.loaiXuLy && nextBody.loaiXuLy !== 'khac') {
      nextBody.loaiXuLyKhac = '';
    }
    warranties[idx] = { ...old, ...nextBody, updatedAt: now };
    if (Object.keys(changes).length > 0) {
      warranties[idx].history = [...(old.history || []), { at: now, by: req.body.maNhanVien || old.maNhanVien, action: 'update', changes, note: req.body.note || '' }];
    }

    await setCollection('warranties', warranties);
    const customersAfterUpdate = buildCustomerMasterFromWarranties(warranties, await getCollection('customers'));
    await setCollection('customers', customersAfterUpdate);
    res.json({ success: true, data: warranties[idx] });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.patch('/:id/customer', async (req, res) => {
  try {
    const { customerKey } = req.body || {};
    if (!customerKey || !String(customerKey).trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Thiáº¿u khÃ³a khÃ¡ch hÃ ng.' } });
    }

    let warranties = await getCollection('warranties');
    const idx = warranties.findIndex(w => w.id === req.params.id && !w.deletedAt);
    if (idx === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'KhÃ´ng tÃ¬m tháº¥y phiáº¿u.' } });

    const targetKey = String(customerKey).trim();
    const customers = await getCollection('customers');
    const customer = findCustomerByKey(customers, targetKey);
    if (!customer) {
      return res.status(404).json({ success: false, error: { code: 'CUSTOMER_NOT_FOUND', message: 'KhÃ´ng tÃ¬m tháº¥y khÃ¡ch hÃ ng trong danh sÃ¡ch.' } });
    }

    const old = warranties[idx];
    const oldCustomer = {
      key: getWarrantyCustomerKey(old),
      khachHang: old.khachHang || '',
      soDienThoai: old.soDienThoai || '',
      diaChi: old.diaChi || '',
    };
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const by = req.headers['x-nhan-vien'] || old.maNhanVien || 'admin';
    const changes = {
      khachHang: { from: old.khachHang || '', to: customer.khachHang || '' },
      soDienThoai: { from: old.soDienThoai || '', to: customer.soDienThoai || '' },
      diaChi: { from: old.diaChi || '', to: customer.diaChi || '' },
    };

    warranties[idx] = {
      ...old,
      khachHang: customer.khachHang || '',
      soDienThoai: customer.soDienThoai || '',
      diaChi: customer.diaChi || '',
      updatedAt: now,
      history: [
        ...(old.history || []),
        {
          at: now,
          by,
          action: 'customer_transfer',
          changes,
          customer: { from: oldCustomer, to: customer },
          note: `Chuyển khách hàng: ${customerLabel(oldCustomer)} → ${customerLabel(customer)}`,
        },
      ],
    };

    await setCollection('warranties', warranties);
    const customersAfterTransfer = buildCustomerMasterFromWarranties(warranties, await getCollection('customers'));
    await setCollection('customers', customersAfterTransfer);
    res.json({ success: true, data: withDefaultDueDate(warranties[idx]) });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lá»—i mÃ¡y chá»§, thá»­ láº¡i sau.' } });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const validation = statusUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: validation.error.errors[0].message } });
    }

    let warranties = await getCollection('warranties');
    const idx = warranties.findIndex(w => w.id === req.params.id && !w.deletedAt);
    if (idx === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });

    const old = warranties[idx];
    const validNext = STATUS_TRANSITIONS[old.trangThai] || [];
    if (!validNext.includes(req.body.trangThai)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_TRANSITION', message: `Không thể chuyển từ "${old.trangThai}" sang "${req.body.trangThai}".` } });
    }

    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    warranties[idx] = {
      ...old,
      trangThai: req.body.trangThai,
      uuTien: req.body.trangThai === 'da_tra' || req.body.trangThai === 'huy' ? false : Boolean(old.uuTien),
      updatedAt: now,
      history: [...(old.history || []), { at: now, by: req.headers['x-nhan-vien'] || old.maNhanVien, action: 'status', changes: { trangThai: { from: old.trangThai, to: req.body.trangThai } }, note: req.body.note || '' }],
    };

    await setCollection('warranties', warranties);
    res.json({ success: true, data: warranties[idx] });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.patch('/:id/tra-hang', async (req, res) => {
  try {
    const validation = traHangSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: validation.error.errors[0].message } });
    }

    let warranties = await getCollection('warranties');
    const idx = warranties.findIndex(w => w.id === req.params.id && !w.deletedAt);
    if (idx === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });

    const old = warranties[idx];
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    warranties[idx] = {
      ...old,
      trangThai: 'da_tra',
      uuTien: false,
      ngayTra: req.body.ngayTra || now.slice(0, 10),
      updatedAt: now,
      history: [...(old.history || []), { at: now, by: req.headers['x-nhan-vien'] || old.maNhanVien, action: 'tra_hang', changes: { trangThai: { from: old.trangThai, to: 'da_tra' }, ngayTra: { from: old.ngayTra, to: req.body.ngayTra || now.slice(0, 10) } }, note: req.body.note || '' }],
    };

    await setCollection('warranties', warranties);
    res.json({ success: true, data: warranties[idx] });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.patch('/:id/exchange-return', async (req, res) => {
  try {
    const validation = exchangeReturnSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: validation.error.errors[0].message } });
    }

    let warranties = await getCollection('warranties');
    const idx = warranties.findIndex(w => w.id === req.params.id && !w.deletedAt);
    if (idx === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });

    const old = warranties[idx];
    if (!isOpenWarranty(old)) {
      return res.status(400).json({ success: false, error: { code: 'CLOSED_WARRANTY', message: 'Phiếu đã xong hoặc đã hủy, không thể đổi/trả hàng.' } });
    }
    if (old.doiTra) {
      return res.status(400).json({ success: false, error: { code: 'ALREADY_PROCESSED', message: 'Phiếu đã có thông tin đổi/trả hàng.' } });
    }

    const body = validation.data;
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
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

    warranties[idx] = {
      ...old,
      doiTra,
      trangThai: 'da_tra',
      uuTien: false,
      ngayTra,
      updatedAt: now,
      history: [
        ...(old.history || []),
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
      ],
    };

    await setCollection('warranties', warranties);
    res.json({ success: true, data: warranties[idx] });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.patch('/:id/log', async (req, res) => {
  try {
    const { note } = req.body;
    if (!note || !note.trim()) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Thiếu ghi chú.' } });

    let warranties = await getCollection('warranties');
    const idx = warranties.findIndex(w => w.id === req.params.id && !w.deletedAt);
    if (idx === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });

    const old = warranties[idx];
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    warranties[idx] = {
      ...old,
      updatedAt: now,
      history: [...(old.history || []), { at: now, by: req.headers['x-nhan-vien'] || old.maNhanVien, action: 'log', changes: {}, note: note.trim() }],
    };

    await setCollection('warranties', warranties);
    res.json({ success: true, data: warranties[idx] });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.patch('/:id/priority', async (req, res) => {
  try {
    let warranties = await getCollection('warranties');
    const idx = warranties.findIndex(w => w.id === req.params.id && !w.deletedAt);
    if (idx === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });

    const old = warranties[idx];
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const nextPriority = Boolean(req.body?.uuTien);
    if (nextPriority && !isOpenWarranty(old)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PRIORITY', message: 'Không thể ưu tiên phiếu đã xong hoặc đã hủy.' } });
    }

    warranties[idx] = {
      ...old,
      uuTien: nextPriority,
      updatedAt: now,
      history: [
        ...(old.history || []),
        {
          at: now,
          by: req.headers['x-nhan-vien'] || old.maNhanVien,
          action: 'priority',
          changes: { uuTien: { from: Boolean(old.uuTien), to: nextPriority } },
          note: nextPriority ? 'Đánh dấu ưu tiên' : 'Bỏ ưu tiên',
        },
      ],
    };

    await setCollection('warranties', warranties);
    res.json({ success: true, data: warranties[idx] });
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

    let warranties = await getCollection('warranties');
    const idx = warranties.findIndex((w) => w.id === req.params.id && !w.deletedAt);
    if (idx === -1) {
      if (idx === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy ảnh đính kèm.' } });
    }

    const old = warranties[idx];
    const current = Array.isArray(old.attachments) ? old.attachments : [];
    const remaining = Math.max(0, 10 - current.length);
    if (remaining <= 0) {
      return res.status(400).json({ success: false, error: { code: 'LIMIT_REACHED', message: 'Tối đa 10 ảnh đính kèm.' } });
    }

    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const by = req.headers['x-nhan-vien'] || old.maNhanVien || 'admin';
    const uploaded = saveAttachmentDataUrls(items.slice(0, remaining), by);
    if (!uploaded.length) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_DATA', message: 'Không có ảnh hợp lệ để tải lên.' } });
    }

    warranties[idx] = {
      ...old,
      attachments: [...current, ...uploaded],
      updatedAt: now,
      history: [
        ...(old.history || []),
        {
          at: now,
          by,
          action: 'update',
          changes: { attachments: { from: current.length, to: current.length + uploaded.length } },
          note: `Thêm ${uploaded.length} ảnh đính kèm`,
        },
      ],
    };

    await setCollection('warranties', warranties);
    return res.json({ success: true, data: warranties[idx] });
  } catch {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.delete('/:id/attachments/:attachmentId', async (req, res) => {
  try {
    let warranties = await getCollection('warranties');
    const idx = warranties.findIndex((w) => w.id === req.params.id && !w.deletedAt);
    if (idx === -1) {
      if (idx === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy ảnh đính kèm.' } });
    }
    const old = warranties[idx];
    const current = Array.isArray(old.attachments) ? old.attachments : [];
    const removed = current.find((a) => a.id === req.params.attachmentId);
    const next = current.filter((a) => a.id !== req.params.attachmentId);
    if (next.length === current.length) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy ảnh đính kèm.' } });
    }
    deleteAttachmentFile(removed);
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const by = req.headers['x-nhan-vien'] || old.maNhanVien || 'admin';
    warranties[idx] = {
      ...old,
      attachments: next,
      updatedAt: now,
      history: [
        ...(old.history || []),
        { at: now, by, action: 'update', changes: { attachments: { from: current.length, to: next.length } }, note: 'Xóa ảnh đính kèm' },
      ],
    };
    await setCollection('warranties', warranties);
    return res.json({ success: true, data: warranties[idx] });
  } catch {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.delete('/:id/history/:historyIndex', async (req, res) => {
  try {
    const by = String(req.headers['x-nhan-vien'] || '').trim();
    if (!by) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Chỉ nhân viên hoặc admin mới được xóa lịch sử.' } });
    }

    let warranties = await getCollection('warranties');
    const idx = warranties.findIndex((w) => w.id === req.params.id && !w.deletedAt);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });
    }

    const historyIndex = Number(req.params.historyIndex);
    const history = Array.isArray(warranties[idx].history) ? warranties[idx].history : [];
    if (!Number.isInteger(historyIndex) || historyIndex < 0 || historyIndex >= history.length) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy dòng lịch sử.' } });
    }

    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    warranties[idx] = {
      ...warranties[idx],
      history: history.filter((_, index) => index !== historyIndex),
      updatedAt: now,
    };

    await setCollection('warranties', warranties);
    return res.json({ success: true, data: withDefaultDueDate(warranties[idx]) });
  } catch {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.get('/:id/supplier-logs', async (req, res) => {
  try {
    const db = await readDb();
    const w = (db.warranties || []).find(x => x.id === req.params.id && !x.deletedAt);
    if (!w) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });
    const supplierMap = new Map((db.suppliers || []).map(s => [s.id, s]));
    const logs = (db.supplierLogs || [])
      .filter(x => x.warrantyId === req.params.id)
      .sort((a, b) => dayjs(b.at).valueOf() - dayjs(a.at).valueOf())
      .map(x => ({ ...x, supplierName: supplierMap.get(x.supplierId)?.name || '-' }));
    res.json({ success: true, data: logs });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.patch('/:id/supplier-logs/:logId', async (req, res) => {
  try {
    const by = String(req.headers['x-nhan-vien'] || '').trim();
    if (!by) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Chỉ nhân viên hoặc admin mới được sửa NCC.' } });
    }

    const db = await readDb();
    const wIdx = (db.warranties || []).findIndex(x => x.id === req.params.id && !x.deletedAt);
    if (wIdx < 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });

    const logIdx = (db.supplierLogs || []).findIndex(x => x.id === req.params.logId && x.warrantyId === req.params.id);
    if (logIdx < 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy lịch sử NCC.' } });

    const oldLog = db.supplierLogs[logIdx];
    const newSupplierId = String(req.body?.supplierId || oldLog.supplierId || '').trim();
    const supplier = (db.suppliers || []).find(s => s.id === newSupplierId && !s.deletedAt);
    if (!supplier) return res.status(404).json({ success: false, error: { code: 'SUPPLIER_NOT_FOUND', message: 'Không tìm thấy nhà cung cấp' } });
    if (supplier.isActive === false) return res.status(400).json({ success: false, error: { code: 'SUPPLIER_INACTIVE', message: 'Nhà cung cấp đang ngừng hoạt động' } });

    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const nextNote = String(req.body?.note || '');
    db.supplierLogs[logIdx] = {
      ...oldLog,
      supplierId: newSupplierId,
      note: nextNote,
      updatedAt: now,
      updatedBy: by,
    };

    const updatedLog = db.supplierLogs[logIdx];
    const historyAction = updatedLog.action === 'returned' ? 'supplier_returned' : 'supplier_sent';
    const historyPrefix = updatedLog.action === 'returned' ? 'Đã nhận lại từ nhà cung cấp' : 'Đã gửi bảo hành nhà cung cấp';
    const rebuiltNote = `${historyPrefix}: ${supplier?.name || '-'}${nextNote ? ` | ${nextNote}` : ''}`;

    const historyRows = Array.isArray(db.warranties[wIdx]?.history) ? db.warranties[wIdx].history : [];
    let linkedHistoryIndex = historyRows.findIndex((h) =>
      h?.action === historyAction && String(h?.changes?.supplierLogs?.logId || '') === String(updatedLog.id || '')
    );

    // Backward-compatible fallback for old history rows that do not store supplierLogs.logId.
    if (linkedHistoryIndex < 0) {
      const supplierName = String(supplier?.name || '').trim();
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
      db.warranties[wIdx].history = historyRows;
    }

    const sentLogs = (db.supplierLogs || [])
      .filter(x => x.warrantyId === req.params.id && x.action === 'sent')
      .sort((a, b) => dayjs(b.at).valueOf() - dayjs(a.at).valueOf());
    if (sentLogs[0]?.id === req.params.logId) {
      db.warranties[wIdx] = {
        ...db.warranties[wIdx],
        supplierIdCurrent: newSupplierId,
        updatedAt: now,
        history: [
          ...(db.warranties[wIdx].history || []),
          {
            at: now,
            by,
            action: 'supplier_log_updated',
            changes: { supplierLogs: { logId: req.params.logId, supplierId: newSupplierId } },
            note: 'Cập nhật nhà cung cấp đã gửi',
          },
        ],
      };
    }

    await setCollection('warranties', db.warranties);
    await setCollection('supplierLogs', db.supplierLogs);
    res.json({ success: true, data: { ...db.supplierLogs[logIdx], supplierName: supplier?.name || '-' } });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.delete('/:id/supplier-logs/:logId', async (req, res) => {
  try {
    const by = String(req.headers['x-nhan-vien'] || '').trim();
    if (!by) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Chỉ nhân viên hoặc admin mới được xóa lịch sử NCC.' } });
    }

    const db = await readDb();
    const wIdx = (db.warranties || []).findIndex(x => x.id === req.params.id && !x.deletedAt);
    if (wIdx < 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });

    const logs = Array.isArray(db.supplierLogs) ? db.supplierLogs : [];
    const logIdx = logs.findIndex(x => x.id === req.params.logId && x.warrantyId === req.params.id);
    if (logIdx < 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy lịch sử NCC.' } });

    db.supplierLogs = logs.filter((_, index) => index !== logIdx);
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    db.warranties[wIdx] = {
      ...db.warranties[wIdx],
      updatedAt: now,
      history: [
        ...(db.warranties[wIdx].history || []),
        {
          at: now,
          by,
          action: 'supplier_log_deleted',
          changes: { supplierLogs: { deletedLogId: req.params.logId } },
          note: 'Xóa 1 dòng lịch sử gửi / nhận NCC',
        },
      ],
    };

    await setCollection('supplierLogs', db.supplierLogs);
    await setCollection('warranties', db.warranties);
    return res.json({ success: true, data: withDefaultDueDate(db.warranties[wIdx]) });
  } catch {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.post('/:id/supplier-send', async (req, res) => {
  try {
    const parsed = supplierSendSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } });
    const db = await readDb();
    const wIdx = (db.warranties || []).findIndex(x => x.id === req.params.id && !x.deletedAt);
    if (wIdx < 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });
    const supplier = (db.suppliers || []).find(x => x.id === parsed.data.supplierId && !x.deletedAt);
    if (!supplier) return res.status(404).json({ success: false, error: { code: 'SUPPLIER_NOT_FOUND', message: 'Không tìm thấy nhà cung cấp' } });
    if (supplier.isActive === false) return res.status(400).json({ success: false, error: { code: 'SUPPLIER_INACTIVE', message: 'Nhà cung cấp đang ngừng hoạt động' } });
    if (parsed.data.expectedReturnAt && dayjs(parsed.data.expectedReturnAt).isBefore(dayjs(parsed.data.sentAt))) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_DATE', message: 'Ngày hẹn nhận lại phải sau ngày gửi' } });
    }
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const by = req.headers['x-nhan-vien'] || db.warranties[wIdx].maNhanVien || 'admin';
    const log = {
      id: uuidv4(),
      warrantyId: req.params.id,
      supplierId: supplier.id,
      action: 'sent',
      at: now,
      sentAt: parsed.data.sentAt,
      expectedReturnAt: parsed.data.expectedReturnAt || '',
      returnedAt: '',
      note: parsed.data.note || '',
      createdBy: by,
    };
    db.supplierLogs = [...(db.supplierLogs || []), log];
    db.warranties[wIdx] = {
      ...db.warranties[wIdx],
      supplierStatus: 'sent',
      supplierIdCurrent: supplier.id,
      sentSupplierAt: parsed.data.sentAt,
      expectedReturnSupplierAt: parsed.data.expectedReturnAt || '',
      updatedAt: now,
      history: [
        ...(db.warranties[wIdx].history || []),
        {
          at: now,
          by,
          action: 'supplier_sent',
          changes: {
            supplierIdCurrent: { from: db.warranties[wIdx].supplierIdCurrent || null, to: supplier.id },
            supplierLogs: { logId: log.id, action: 'sent' },
          },
          note: `Đã gửi bảo hành nhà cung cấp: ${supplier.name}${parsed.data.note ? ` | ${parsed.data.note}` : ''}`,
        },
      ],
    };
    await setCollection('warranties', db.warranties);
    await setCollection('supplierLogs', db.supplierLogs);
    res.json({ success: true, data: withDefaultDueDate(db.warranties[wIdx]) });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.post('/:id/supplier-return', async (req, res) => {
  try {
    const parsed = supplierReturnSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } });
    const db = await readDb();
    const wIdx = (db.warranties || []).findIndex(x => x.id === req.params.id && !x.deletedAt);
    if (wIdx < 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });
    const warranty = db.warranties[wIdx];
    if (warranty.supplierStatus !== 'sent' || !warranty.supplierIdCurrent) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: 'Phiếu không ở trạng thái đang gửi NCC' } });
    }
    if (warranty.sentSupplierAt && dayjs(parsed.data.returnedAt).isBefore(dayjs(warranty.sentSupplierAt))) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_DATE', message: 'Ngày nhận lại phải sau ngày gửi' } });
    }
    const supplier = (db.suppliers || []).find(x => x.id === warranty.supplierIdCurrent);
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const by = req.headers['x-nhan-vien'] || warranty.maNhanVien || 'admin';
    const log = {
      id: uuidv4(),
      warrantyId: req.params.id,
      supplierId: warranty.supplierIdCurrent,
      action: 'returned',
      at: now,
      sentAt: warranty.sentSupplierAt || '',
      expectedReturnAt: warranty.expectedReturnSupplierAt || '',
      returnedAt: parsed.data.returnedAt,
      note: parsed.data.note || '',
      createdBy: by,
    };
    db.supplierLogs = [...(db.supplierLogs || []), log];
    db.warranties[wIdx] = {
      ...warranty,
      supplierStatus: 'returned',
      uuTien: false,
      updatedAt: now,
      history: [
        ...(warranty.history || []),
        {
          at: now,
          by,
          action: 'supplier_returned',
          changes: {
            supplierStatus: { from: 'sent', to: 'returned' },
            supplierLogs: { logId: log.id, action: 'returned' },
          },
          note: `Đã nhận lại từ nhà cung cấp: ${supplier?.name || '-'}${parsed.data.note ? ` | ${parsed.data.note}` : ''}`,
        },
      ],
    };
    await setCollection('warranties', db.warranties);
    await setCollection('supplierLogs', db.supplierLogs);
    res.json({ success: true, data: withDefaultDueDate(db.warranties[wIdx]) });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.delete('/', async (req, res) => {
  try {
    let warranties = await getCollection('warranties');
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const count = warranties.filter(w => !w.deletedAt).length;
    warranties = warranties.map(w => {
      if (!w.deletedAt) {
        return { ...w, deletedAt: now, updatedAt: now };
      }
      return w;
    });
    await setCollection('warranties', warranties);
    res.json({ success: true, data: { deleted: count } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    let warranties = await getCollection('warranties');
    const idx = warranties.findIndex(w => w.id === req.params.id && !w.deletedAt);
    if (idx === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' } });

    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    warranties[idx].deletedAt = now;
    warranties[idx].updatedAt = now;
    warranties[idx].history = [...(warranties[idx].history || []), { at: now, by: req.headers['x-nhan-vien'] || warranties[idx].maNhanVien, action: 'delete', changes: {}, note: 'Xóa mềm' }];

    await setCollection('warranties', warranties);
    res.json({ success: true, data: warranties[idx] });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.post('/import', async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ success: false, error: { code: 'INVALID_DATA', message: 'Dữ liệu không hợp lệ.' } });

    const warranties = await getCollection('warranties');
    const existingCodes = new Set(warranties.filter(w => !w.deletedAt).map(w => w.soChungTu).filter(Boolean));
    const inserted = [];
    const skipped = [];
    const errors = [];
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const maxStt = warranties.reduce((max, w) => Math.max(max, w.stt || 0), 0);

    rows.forEach((row, i) => {
      try {
        if (!row.soChungTu) { errors.push({ row: i + 1, reason: 'Thiếu số chứng từ' }); return; }
        if (existingCodes.has(row.soChungTu)) { skipped.push({ row: i + 1, soChungTu: row.soChungTu }); return; }
        if (!row.khachHang) { errors.push({ row: i + 1, reason: 'Thiếu khách hàng' }); return; }

        const trangThaiMap = {
          da_tra: 'da_tra',
          da_nhan: 'da_nhan',
          dang_xu_ly: 'dang_xu_ly',
          huy: 'huy',
          cho_xu_ly: 'da_nhan',
          cho_lien_he: 'dang_xu_ly',
        };
        const trangThai = trangThaiMap[row.trangThai] || (row.trangThai || 'dang_xu_ly');
        const newW = {
          id: uuidv4(),
          stt: maxStt + inserted.length + skipped.length + errors.length + 1,
          soChungTu: row.soChungTu,
          ngayNhan: row.ngayNhan || now,
          maNhanVien: row.maNhanVien || 'admin',
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
          ngayTra: row.ngayTra || null,
          trangThai,
          uuTien: Boolean(row.uuTien) || false,
          supplierStatus: 'none',
          supplierIdCurrent: null,
          sentSupplierAt: '',
          expectedReturnSupplierAt: '',
          history: [{ at: now, by: row.maNhanVien || 'admin', action: 'create', changes: {}, note: 'Import từ Excel' }],
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };

        inserted.push(newW);
        existingCodes.add(row.soChungTu);
      } catch (e) {
        errors.push({ row: i + 1, reason: e.message });
      }
    });

    const allWarranties = [...warranties, ...inserted];
    await setCollection('warranties', allWarranties);
    const customersAfterImport = buildCustomerMasterFromWarranties(allWarranties, await getCollection('customers'));
    await setCollection('customers', customersAfterImport);
    res.json({ success: true, data: { inserted: inserted.length, skipped: skipped.length, errors } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

export default router;








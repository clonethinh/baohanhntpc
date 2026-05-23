import express from 'express';
import { getCollection } from '../lib/db.js';
import dayjs from 'dayjs';
import { buildPublicHistoryTimeline } from '../../src/utils/historyTimeline.js';

const router = express.Router();

const legacy = (escaped) => JSON.parse(`"${escaped}"`);

const VIETNAMESE_REPLACEMENTS = [
  [legacy('Import t\\u00e1\\u00bb\\u00ab Excel'), 'Import từ Excel'],
  ['Import t? Excel', 'Import từ Excel'],
  [legacy('Import t\\ufffd Excel'), 'Import từ Excel'],
  ['Xoa mem', 'Xóa mềm'],
  ['Xóa m?m', 'Xóa mềm'],
  ['Ðánh d?u uu tiên', 'Đánh dấu ưu tiên'],
  ['Ðánh dấu uu tiên', 'Đánh dấu ưu tiên'],
  ['Dánh d?u uu tiên', 'Đánh dấu ưu tiên'],
  ['Danh dau uu tien', 'Đánh dấu ưu tiên'],
  ['B? uu tiên', 'Bỏ ưu tiên'],
  ['Bo uu tien', 'Bỏ ưu tiên'],
  ['Da gui bao hanh NCC:', 'Đã gửi bảo hành nhà cung cấp:'],
  ['Da nhan lai tu NCC:', 'Đã nhận lại từ nhà cung cấp:'],
  ['Da gui bao hanh nha cung cap:', 'Đã gửi bảo hành nhà cung cấp:'],
  ['Da nhan lai tu nha cung cap:', 'Đã nhận lại từ nhà cung cấp:'],
  ['Ðã g?i b?o hành nhà cung c?p:', 'Đã gửi bảo hành nhà cung cấp:'],
  ['Ðã nh?n l?i t? nhà cung c?p:', 'Đã nhận lại từ nhà cung cấp:'],
  [legacy('\\ufffd\\ufffd g?i b?o h\\ufffdnh nh\\ufffd cung c?p:'), 'Đã gửi bảo hành nhà cung cấp:'],
  [legacy('\\ufffd\\ufffd nh?n l?i t? nh\\ufffd cung c?p:'), 'Đã nhận lại từ nhà cung cấp:'],
];

const rateLimitMap = new Map();

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 30;

  if (!rateLimitMap.has(ip)) rateLimitMap.set(ip, []);
  const requests = rateLimitMap.get(ip).filter((t) => now - t < windowMs);
  rateLimitMap.set(ip, requests);

  if (requests.length >= maxRequests) {
    return res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' },
    });
  }

  requests.push(now);
  next();
}

function safeDate(val, fmt = 'DD/MM/YYYY HH:mm') {
  if (!val) return fmt.includes('HH') ? '' : null;
  const d = dayjs(val);
  return d.isValid() ? d.format(fmt) : (fmt.includes('HH') ? '' : null);
}

function normalizeText(text) {
  if (!text) return '';
  return VIETNAMESE_REPLACEMENTS.reduce((out, [oldText, newText]) => out.replaceAll(oldText, newText), String(text));
}

function formatPublicDoiTra(doiTra) {
  if (!doiTra) return null;
  return {
    type: doiTra.type || '',
    tenHangCu: normalizeText(doiTra.tenHangCu || ''),
    soSeriCu: normalizeText(doiTra.soSeriCu || ''),
    tenHangMoi: normalizeText(doiTra.tenHangMoi || ''),
    soSeriMoi: normalizeText(doiTra.soSeriMoi || ''),
    reason: normalizeText(doiTra.reason || ''),
    note: normalizeText(doiTra.note || ''),
    attachments: Array.isArray(doiTra.attachments) ? doiTra.attachments : [],
    at: safeDate(doiTra.at),
    by: String(doiTra.by || ''),
  };
}

function generateSteps(warranty) {
  const history = warranty.history || [];
  const statusChanges = history.filter((h) => h.action === 'status' || h.action === 'tra_hang' || h.action === 'exchange' || h.action === 'return');
  const createEntry = history.find((h) => h.action === 'create');
  const createDate = createEntry ? createEntry.at : warranty.ngayNhan || warranty.createdAt;

  const getDateForStatus = (statusKey) => {
    const change = statusChanges.find((h) => h.changes?.trangThai?.to === statusKey);
    if (change) return safeDate(change.at);
    if (statusKey === 'da_nhan') return safeDate(warranty.ngayNhan);
    if (statusKey === 'dang_xu_ly') return safeDate(createDate);
    return null;
  };

  const isHuy = warranty.trangThai === 'huy';
  const isDone = warranty.trangThai === 'da_tra';
  const isProcessing = warranty.trangThai === 'dang_xu_ly' || warranty.trangThai === 'cho_xu_ly' || warranty.trangThai === 'cho_lien_he';

  return [
    { key: 'da_nhan', label: 'Đã nhận', date: getDateForStatus('da_nhan'), current: true },
    { key: 'dang_xu_ly', label: 'Đang xử lý', date: getDateForStatus('dang_xu_ly'), current: isProcessing || isDone },
    { key: 'da_tra', label: isHuy ? 'Đã hủy' : 'Đã xong', date: getDateForStatus('da_tra'), current: isDone || isHuy },
  ];
}

function generateStatusLog(warranty) {
  return buildPublicHistoryTimeline(warranty.history || [], warranty);
}

router.use(rateLimit);

function normalizePhone(raw) {
  const text = String(raw || '').trim();
  const only = text.replace(/[^\d+]/g, '');
  if (only.startsWith('+84')) return `0${only.slice(3)}`;
  if (only.startsWith('84')) return `0${only.slice(2)}`;
  return only;
}

function isPhoneQuery(raw) {
  const n = normalizePhone(raw).replace(/\D/g, '');
  return /^\d{9,11}$/.test(n);
}

router.get('/track', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ success: false, error: { code: 'INVALID_QUERY', message: 'Thiếu từ khóa tra cứu.' } });

    const warranties = await getCollection('warranties');
    if (isPhoneQuery(q)) {
      const phone = normalizePhone(q);
      const items = warranties
        .filter((w) => !w.deletedAt && normalizePhone(w.soDienThoai || '') === phone)
        .sort((a, b) => dayjs(b.updatedAt || b.createdAt || b.ngayNhan).valueOf() - dayjs(a.updatedAt || a.createdAt || a.ngayNhan).valueOf())
        .slice(0, 50)
        .map((w) => ({
          id: w.id,
          soChungTu: String(w.soChungTu || ''),
          trangThai: String(w.trangThai || 'da_nhan'),
          tenHang: normalizeText(w.tenHang || ''),
          ngayNhan: safeDate(w.ngayNhan, 'DD/MM/YYYY'),
          ngayHenTra: safeDate(w.ngayHenTra, 'DD/MM/YYYY'),
          ngayTra: safeDate(w.ngayTra, 'DD/MM/YYYY'),
        }));

      return res.json({ success: true, mode: 'phone', data: { phone, total: items.length, items } });
    }

    const soChungTu = String(q).toUpperCase().replace(/\s/g, '');
    const matches = warranties
      .filter((x) => !x.deletedAt && String(x.soChungTu || '').toUpperCase() === soChungTu)
      .sort((a, b) => dayjs(b.updatedAt || b.createdAt || b.ngayNhan).valueOf() - dayjs(a.updatedAt || a.createdAt || a.ngayNhan).valueOf());
    if (!matches.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy thông tin.' } });
    return res.json({ success: true, mode: 'single', data: { soChungTu } });
  } catch {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.get('/track/:soChungTu', async (req, res) => {
  try {
    const warranties = await getCollection('warranties');
    const matches = warranties
      .filter((x) => x.soChungTu === req.params.soChungTu && !x.deletedAt)
      .sort((a, b) => {
        const timeA = dayjs(a.updatedAt || a.createdAt || a.ngayNhan);
        const timeB = dayjs(b.updatedAt || b.createdAt || b.ngayNhan);
        const diff = (timeB.isValid() ? timeB.valueOf() : 0) - (timeA.isValid() ? timeA.valueOf() : 0);
        if (diff !== 0) return diff;
        return (b.stt || 0) - (a.stt || 0);
      });

    const w = matches[0];
    if (!w) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy mã bảo hành.' } });
    }

    const result = {
      soChungTu: String(w.soChungTu || ''),
      ghiChu: normalizeText(w.ghiChu || ''),
      ngayNhan: safeDate(w.ngayNhan),
      ngayNhanRaw: w.ngayNhan || '',
      khachHang: String(w.khachHang || ''),
      soDienThoai: String(w.soDienThoai || ''),
      tenHang: String(w.tenHang || ''),
      soSeri: String(w.soSeri || ''),
      loiLucNhan: String(w.loiLucNhan || ''),
      phuKien: String(w.phuKien || ''),
      baoHanh: String(w.baoHanh || ''),
      ngayMua: safeDate(w.ngayMua, 'DD/MM/YYYY'),
      ngayHenTra: safeDate(w.ngayHenTra, 'DD/MM/YYYY'),
      ngayHenTraRaw: w.ngayHenTra || '',
      ngayTra: safeDate(w.ngayTra, 'DD/MM/YYYY'),
      ngayTraRaw: w.ngayTra || '',
      trangThai: String(w.trangThai || 'da_nhan'),
      doiTra: formatPublicDoiTra(w.doiTra),
      steps: generateSteps(w),
      statusLog: generateStatusLog(w),
      attachmentsPublic: (Array.isArray(w.attachments) ? w.attachments : [])
        .filter((a) => a && a.publicVisible !== false)
        .map((a) => ({ id: a.id, url: a.url, name: a.name || 'image' })),
      supportInfo: {
        company: 'CÔNG TY TNHH MÁY TÍNH NGUYỄN TÂN',
        warrantyPhone: '0937 63 2000',
        hotline: '0903 602 240',
        workingHours: '08h30 - 18h',
        website: 'https://nguyentanpc.com/',
        fanpage: 'https://www.facebook.com/vitinhnguyentan.vn',
        taxCode: '3603797285',
        policyUrl: 'https://nguyentanpc.com/pages/dieu-kien-bao-hanh',
        address: '1/29, đường Vũ Hồng Phô, khu phố 30, Phường Tam Hiệp, TP Đồng Nai, Việt Nam',
      },
    };

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[PUBLIC TRACK ERROR]', err.message, err.stack);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

export default router;

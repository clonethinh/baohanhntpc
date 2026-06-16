import express from 'express';
import { readDb, writeDb } from '../lib/db.js';
import { customerLabel, getCustomerRows, getWarrantyCustomerKey, hasCustomer, buildCustomerNameSuggestions, findCustomerByQuery, findCustomerByKey } from '../lib/customers.js';
import { buildCustomerMasterFromWarranties } from '../lib/customerMaster.js';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { requireRole } from '../lib/auth.js';

const router = express.Router();
const requireAdmin = requireRole('admin');

function ensureCustomers(db) {
  if (!Array.isArray(db.customers)) db.customers = [];
}

// Snapshot TTL cho undo xóa khách hàng (mặc định 7 ngày)
const CUSTOMER_DELETE_UNDO_TTL_DAYS = 7;

function cleanupExpiredCustomerSnapshots(db, nowStr) {
  if (!Array.isArray(db._deletedCustomers)) return;
  db._deletedCustomers = db._deletedCustomers.filter(
    (s) => s && s.expiresAt && s.expiresAt > nowStr
  );
}

router.get('/list', async (req, res) => {
  try {
    const db = await readDb();
    ensureCustomers(db);

    // Phân trang: mặc định 25/trang; client có thể truyền page/limit
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const search = String(req.query.search || '').trim().toLowerCase();
    const sortBy = ['lastNgayNhan', 'maKhachHang', 'khachHang', 'soDienThoai', 'totalWarranties'].includes(String(req.query.sortBy))
      ? String(req.query.sortBy)
      : 'lastNgayNhan';
    const sortOrder = String(req.query.sortOrder) === 'asc' ? 'asc' : 'desc';

    // Lấy danh sách khách hàng được tổng hợp từ dữ liệu hiện tại
    const rows = getCustomerRows(db.warranties || [], db.customers || []);

    let needsSave = false;
    let maxNum = 0;

    // Tìm mã khách hàng số lớn nhất đã được lưu trong DB
    (db.customers || []).forEach(c => {
      if (c.maKhachHang && c.maKhachHang.startsWith('KH')) {
        const num = parseInt(c.maKhachHang.substring(2), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });

    const updatedCustomers = [...(db.customers || [])];

    // Quét qua toàn bộ danh sách để đảm bảo tất cả khách hàng đều có mã cố định trong DB
    rows.forEach(r => {
      let c = updatedCustomers.find(x => x.key === r.key);
      if (!c) {
        maxNum += 1;
        const newCode = `KH${String(maxNum).padStart(5, '0')}`;
        updatedCustomers.push({
          key: r.key,
          maKhachHang: newCode,
          khachHang: r.khachHang,
          soDienThoai: r.soDienThoai,
          diaChi: r.diaChi,
          createdAt: r.lastNgayNhan || dayjs().format('YYYY-MM-DDTHH:mm:ss'),
          updatedAt: r.lastNgayNhan || dayjs().format('YYYY-MM-DDTHH:mm:ss'),
          lastSeenAt: r.lastNgayNhan || dayjs().format('YYYY-MM-DDTHH:mm:ss'),
          isActive: true
        });
        needsSave = true;
      } else if (!c.maKhachHang) {
        maxNum += 1;
        c.maKhachHang = `KH${String(maxNum).padStart(5, '0')}`;
        needsSave = true;
      }
    });

    if (needsSave) {
      db.customers = updatedCustomers;
      await writeDb(db);
    }

    // Trả về danh sách đã được cập nhật mã cố định
    const finalRows = getCustomerRows(db.warranties || [], updatedCustomers);

    // Lọc theo search (text contains trên 4 trường — đồng bộ với filter cũ ở frontend)
    let filtered = finalRows;
    if (search) {
      filtered = filtered.filter((r) => (
        String(r.maKhachHang || '').toLowerCase().includes(search) ||
        String(r.khachHang || '').toLowerCase().includes(search) ||
        String(r.soDienThoai || '').toLowerCase().includes(search) ||
        String(r.diaChi || '').toLowerCase().includes(search)
      ));
    }

    // Sắp xếp
    const dir = sortOrder === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      let av = a[sortBy];
      let bv = b[sortBy];
      if (sortBy === 'lastNgayNhan') {
        av = av ? new Date(av).getTime() : 0;
        bv = bv ? new Date(bv).getTime() : 0;
      } else if (sortBy === 'totalWarranties') {
        av = Number(av) || 0;
        bv = Number(bv) || 0;
      } else {
        av = String(av || '').toLowerCase();
        bv = String(bv || '').toLowerCase();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });

    const total = filtered.length;
    const start = (page - 1) * limit;
    const pagedRows = filtered.slice(start, start + limit);

    // Tổng hợp trên TOÀN BỘ filtered set (không chỉ trang hiện tại) để hiển thị ở header
    const aggregate = filtered.reduce(
      (acc, row) => {
        acc.warrantyCount += Number(row.totalWarranties) || 0;
        acc.activeCount += Number(row.dangXuLyCount) || 0;
        acc.doneCount += Number(row.daTraCount) || 0;
        return acc;
      },
      { warrantyCount: 0, activeCount: 0, doneCount: 0 }
    );

    return res.json({
      success: true,
      data: pagedRows,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      summary: { total, ...aggregate }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.get('/unassigned', async (req, res) => {
  try {
    const db = await readDb();
    const rows = (db.warranties || [])
      .filter((w) => !w.deletedAt && !hasCustomer(w))
      .sort((a, b) => new Date(b.ngayNhan || b.updatedAt || b.createdAt || 0).getTime() - new Date(a.ngayNhan || a.updatedAt || a.createdAt || 0).getTime())
      .map((w) => ({ id: w.id, soChungTu: w.soChungTu, ngayNhan: w.ngayNhan, tenHang: w.tenHang, soSeri: w.soSeri, loiLucNhan: w.loiLucNhan, trangThai: w.trangThai, ngayHenTra: w.ngayHenTra, ngayTra: w.ngayTra, loaiXuLy: w.loaiXuLy, chiPhi: w.chiPhi, baoHanh: w.baoHanh }));
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.get('/suggest', async (req, res) => {
  try {
    const q = String(req.query?.q || '');
    if (!q) return res.json({ success: true, data: [] });
    const db = await readDb();
    ensureCustomers(db);
    const rows = getCustomerRows(db.warranties || [], db.customers || []);
    res.json({ success: true, data: buildCustomerNameSuggestions(rows, q) });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.get('/lookup', async (req, res) => {
  try {
    const q = String(req.query?.q || '');
    const key = String(req.query?.key || '').trim();
    if (!q && !key) return res.json({ success: true, data: null });
    const db = await readDb();
    ensureCustomers(db);
    const rows = getCustomerRows(db.warranties || [], db.customers || []);
    const customer = key
      ? rows.find((row) => String(row.key || '') === key)
      : (
        rows.find((row) => String(row.maKhachHang || '').toLowerCase() === q.toLowerCase()) ||
        rows.find((row) => String(row.soDienThoai || '').includes(q)) ||
        findCustomerByQuery(rows, q)
      );
    if (!customer) return res.json({ success: true, data: null });

    const matched = (db.warranties || []).filter((w) => !w.deletedAt && getWarrantyCustomerKey(w) === customer.key);
    const latest = matched[0] || {};
    const history = matched
      .sort((a, b) => new Date(b.ngayNhan || 0) - new Date(a.ngayNhan || 0))
      .map((w) => ({ id: w.id, soChungTu: w.soChungTu, ngayNhan: w.ngayNhan, tenHang: w.tenHang, soSeri: w.soSeri, loiLucNhan: w.loiLucNhan, trangThai: w.trangThai, ngayHenTra: w.ngayHenTra, ngayTra: w.ngayTra, loaiXuLy: w.loaiXuLy, chiPhi: w.chiPhi, baoHanh: w.baoHanh }));

    res.json({ success: true, data: { key: customer.key, maKhachHang: customer.maKhachHang || '', khachHang: customer.khachHang, soDienThoai: customer.soDienThoai || '', diaChi: customer.diaChi || latest.diaChi || '', totalWarranties: matched.length, history } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.put('/update', async (req, res) => {
  try {
    const { key, khachHang, soDienThoai, diaChi } = req.body || {};
    if (!key || !String(key).trim()) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Thiếu khóa khách hàng.' } });
    if (!khachHang || !String(khachHang).trim()) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Tên khách hàng không được để trống.' } });

    const db = await readDb();
    ensureCustomers(db);
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const targetKey = String(key).trim();

    db.customers = (db.customers || []).map((c) => c.key === targetKey ? { ...c, khachHang: String(khachHang).trim(), soDienThoai: String(soDienThoai || '').trim(), diaChi: String(diaChi || '').trim(), updatedAt: now, lastSeenAt: now, isActive: true } : c);

    let changed = 0;
    db.warranties = (db.warranties || []).map((w) => {
      if (w.deletedAt || getWarrantyCustomerKey(w) !== targetKey) return w;
      changed += 1;
      return { ...w, khachHang: String(khachHang).trim(), soDienThoai: String(soDienThoai || '').trim(), diaChi: String(diaChi || '').trim(), updatedAt: now };
    });

    await writeDb(db);
    return res.json({ success: true, data: { updated: changed } });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.post('/delete', requireAdmin, async (req, res) => {
  try {
    const { key } = req.body || {};
    if (!key || !String(key).trim()) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Thiếu khóa khách hàng.' } });

    const targetKey = String(key).trim();
    const db = await readDb();
    ensureCustomers(db);
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const by = req.headers['x-nhan-vien'] || 'admin';
    let changed = 0;

    // Snapshot toàn bộ khách hàng trước khi xóa (để undo khôi phục)
    const customerSnapshot = (db.customers || []).find((c) => c.key === targetKey);
    const detachedSnapshots = [];
    db.warranties = (db.warranties || []).map((w) => {
      if (w.deletedAt || getWarrantyCustomerKey(w) !== targetKey) return w;
      changed += 1;
      const oldCustomer = { key: targetKey, khachHang: w.khachHang || '', soDienThoai: w.soDienThoai || '', diaChi: w.diaChi || '' };
      detachedSnapshots.push({
        warrantyId: w.id,
        soChungTu: w.soChungTu || '',
        khachHang: w.khachHang || '',
        soDienThoai: w.soDienThoai || '',
        diaChi: w.diaChi || '',
      });
      return {
        ...w,
        khachHang: '', soDienThoai: '', diaChi: '', updatedAt: now,
        history: [...(w.history || []), { at: now, by, action: 'customer_detached', changes: { khachHang: { from: w.khachHang || '', to: '' }, soDienThoai: { from: w.soDienThoai || '', to: '' }, diaChi: { from: w.diaChi || '', to: '' } }, customer: { from: oldCustomer, to: null }, note: `Đã xóa khách hàng ${customerLabel(oldCustomer)} khỏi danh sách, CT chuyển vào Chưa có khách hàng` }],
      };
    });

    const beforeCount = (db.customers || []).length;
    db.customers = (db.customers || []).filter((c) => c.key !== targetKey);
    const removedCustomer = beforeCount !== db.customers.length;
    if (!removedCustomer && !changed) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy khách hàng để xóa.' } });
    }

    // Lưu snapshot cho undo (nếu đã xóa customer record hoặc có phiếu bị tách)
    let undoToken = null;
    if (customerSnapshot && (removedCustomer || changed > 0)) {
      if (!Array.isArray(db._deletedCustomers)) db._deletedCustomers = [];
      undoToken = uuidv4();
      db._deletedCustomers.push({
        undoToken,
        customer: { ...customerSnapshot },
        detachedWarranties: detachedSnapshots,
        deletedAt: now,
        deletedBy: by,
        expiresAt: dayjs().add(CUSTOMER_DELETE_UNDO_TTL_DAYS, 'day').format('YYYY-MM-DDTHH:mm:ss'),
      });
      cleanupExpiredCustomerSnapshots(db, now);
    }

    await writeDb(db);
    return res.json({
      success: true,
      data: {
        detached: changed,
        removed: removedCustomer,
        undoToken,
        undoExpiresAt: undoToken
          ? dayjs().add(CUSTOMER_DELETE_UNDO_TTL_DAYS, 'day').format('YYYY-MM-DDTHH:mm:ss')
          : null,
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.post('/restore', requireAdmin, async (req, res) => {
  try {
    const { undoToken } = req.body || {};
    if (!undoToken || !String(undoToken).trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Thiếu mã khôi phục.' } });
    }
    const token = String(undoToken).trim();

    const db = await readDb();
    ensureCustomers(db);
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const by = req.headers['x-nhan-vien'] || 'admin';
    cleanupExpiredCustomerSnapshots(db, now);

    if (!Array.isArray(db._deletedCustomers)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy bản sao khách hàng để khôi phục.' } });
    }
    const snapshotIndex = db._deletedCustomers.findIndex((s) => s && s.undoToken === token);
    if (snapshotIndex < 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Mã khôi phục đã hết hạn hoặc không tồn tại.' } });
    }
    const snapshot = db._deletedCustomers[snapshotIndex];

    // Tránh trùng key (ví dụ: người dùng đã tạo lại KH mới trùng key trong lúc chờ undo)
    if ((db.customers || []).some((c) => c.key === snapshot.customer.key)) {
      return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Khách hàng với khóa này đã tồn tại trong hệ thống.' } });
    }

    // Khôi phục record khách hàng
    db.customers = [...(db.customers || []), { ...snapshot.customer, isActive: true, updatedAt: now }];

    // Gắn lại thông tin khách hàng vào các phiếu đã bị tách
    let reattached = 0;
    const detachedIndex = new Map((snapshot.detachedWarranties || []).map((d) => [d.warrantyId, d]));
    db.warranties = (db.warranties || []).map((w) => {
      const det = detachedIndex.get(w.id);
      if (!det) return w;
      reattached += 1;
      return {
        ...w,
        khachHang: det.khachHang,
        soDienThoai: det.soDienThoai,
        diaChi: det.diaChi,
        updatedAt: now,
        history: [
          ...(w.history || []),
          {
            at: now, by, action: 'customer_restored', changes: {
              khachHang: { from: '', to: det.khachHang },
              soDienThoai: { from: '', to: det.soDienThoai },
              diaChi: { from: '', to: det.diaChi },
            },
            customer: { from: null, to: { key: snapshot.customer.key, khachHang: det.khachHang, soDienThoai: det.soDienThoai, diaChi: det.diaChi } },
            note: `Khôi phục khách hàng ${det.khachHang || snapshot.customer.maKhachHang || snapshot.customer.key}`,
          }
        ],
      };
    });

    // Xóa snapshot đã dùng (chỉ dùng được 1 lần)
    db._deletedCustomers.splice(snapshotIndex, 1);

    await writeDb(db);
    return res.json({
      success: true,
      data: { restoredCustomer: 1, reattachedWarranties: reattached }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.post('/backfill', requireAdmin, async (req, res) => {
  try {
    const db = await readDb();
    ensureCustomers(db);
    db.customers = buildCustomerMasterFromWarranties(db.warranties || [], db.customers || []);
    await writeDb(db);
    return res.json({ success: true, data: { customers: db.customers.length } });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

export default router;

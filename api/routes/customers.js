import express from 'express';
import { readDb, writeDb } from '../lib/db.js';
import { customerLabel, getCustomerRows, getWarrantyCustomerKey, hasCustomer, buildCustomerNameSuggestions, findCustomerByQuery, findCustomerByKey } from '../lib/customers.js';
import { buildCustomerMasterFromWarranties } from '../lib/customerMaster.js';
import dayjs from 'dayjs';
import { requireRole } from '../lib/auth.js';

const router = express.Router();
const requireAdmin = requireRole('admin');

function ensureCustomers(db) {
  if (!Array.isArray(db.customers)) db.customers = [];
}

router.get('/list', async (req, res) => {
  try {
    const db = await readDb();
    ensureCustomers(db);
    
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
    res.json({ success: true, data: finalRows });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
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

    db.warranties = (db.warranties || []).map((w) => {
      if (w.deletedAt || getWarrantyCustomerKey(w) !== targetKey) return w;
      changed += 1;
      const oldCustomer = { key: targetKey, khachHang: w.khachHang || '', soDienThoai: w.soDienThoai || '', diaChi: w.diaChi || '' };
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

    await writeDb(db);
    return res.json({ success: true, data: { detached: changed, removed: removedCustomer } });
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

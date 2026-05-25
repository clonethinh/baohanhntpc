import express from 'express';
import { readDb, writeDb } from '../lib/db.js';
import { v4 as uuidv4 } from 'uuid';
import { authenticateStaff, getStaffRole, hashPassword, sanitizeStaff } from '../lib/auth.js';

const router = express.Router();

function sanitizeList(list = []) {
  return list.filter((nv) => nv.active !== false).map(sanitizeStaff);
}

router.get('/', async (req, res) => {
  try {
    const db = await readDb();
    res.json({ success: true, data: sanitizeList(db.nhanVien || []) });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { maNV, matKhau = '' } = req.body || {};
    const result = await authenticateStaff(req, res, maNV, matKhau);
    if (!result.ok) {
      return res.status(result.status || 401).json({ success: false, error: { code: 'UNAUTHORIZED', message: result.message } });
    }
    return res.json({ success: true, data: result.staff });
  } catch {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ khi xác thực.' } });
  }
});

router.post('/', async (req, res) => {
  try {
    const { maNV, tenNV, role = 'staff', matKhau = '' } = req.body || {};
    if (!maNV || !tenNV) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Thiếu mã hoặc tên nhân viên.' } });
    }
    if (String(matKhau).length < 8) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Mật khẩu nhân viên tối thiểu 8 ký tự.' } });
    }

    const db = await readDb();
    if (!db.nhanVien) db.nhanVien = [];

    const exists = db.nhanVien.some((nv) => String(nv.maNV).toLowerCase() === String(maNV).toLowerCase() && nv.active !== false);
    if (exists) {
      return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Mã nhân viên đã tồn tại.' } });
    }

    const normalizedRole = role === 'admin' ? 'admin' : 'staff';
    const newStaff = {
      id: uuidv4(),
      maNV: String(maNV).trim(),
      tenNV: String(tenNV).trim(),
      role: normalizedRole,
      quyen: normalizedRole,
      matKhau: hashPassword(matKhau),
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.nhanVien.push(newStaff);
    await writeDb(db);
    return res.json({ success: true, data: sanitizeStaff(newStaff) });
  } catch {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ.' } });
  }
});

router.patch('/:maNV/password', async (req, res) => {
  try {
    const target = String(req.params.maNV || '').toLowerCase();
    const { newPassword } = req.body || {};
    if (!target || !newPassword) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Thiếu dữ liệu đặt lại mật khẩu.' } });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Mật khẩu mới tối thiểu 8 ký tự.' } });
    }

    const db = await readDb();
    const list = db.nhanVien || [];
    const idx = list.findIndex((nv) => String(nv.maNV).toLowerCase() === target && nv.active !== false);
    if (idx < 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy nhân viên.' } });
    }

    if (getStaffRole(list[idx]) === 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Khong dat lai mat khau tai khoan admin tai man hinh nhan vien.' },
      });
    }

    list[idx] = {
      ...list[idx],
      role: getStaffRole(list[idx]),
      quyen: getStaffRole(list[idx]),
      matKhau: hashPassword(newPassword),
      passwordBootstrappedAt: null,
      updatedAt: new Date().toISOString(),
    };
    db.nhanVien = list;
    await writeDb(db);
    return res.json({ success: true, data: sanitizeStaff(list[idx]) });
  } catch {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ.' } });
  }
});

router.delete('/:maNV', async (req, res) => {
  try {
    const target = String(req.params.maNV || '').toLowerCase();
    if (!target) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Thiếu mã nhân viên.' } });
    }

    const db = await readDb();
    const list = db.nhanVien || [];
    const idx = list.findIndex((nv) => String(nv.maNV).toLowerCase() === target && nv.active !== false);
    if (idx < 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy nhân viên.' } });
    }

    const activeCount = list.filter((nv) => nv.active !== false).length;
    if (activeCount <= 1) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Phải còn ít nhất 1 nhân viên hoạt động.' } });
    }

    if (String(req.user?.maNV || '').toLowerCase() === target) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Không thể xóa chính tài khoản đang đăng nhập.' } });
    }

    list[idx] = { ...list[idx], active: false, deletedAt: new Date().toISOString() };
    db.nhanVien = list;
    await writeDb(db);

    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ.' } });
  }
});

export default router;

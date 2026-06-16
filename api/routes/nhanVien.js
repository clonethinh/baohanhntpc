import express from 'express';
import { prisma } from '../lib/db.js';
import { authenticateStaff, getStaffRole, hashPassword, sanitizeStaff, requireRole } from '../lib/auth.js';
import { writeAuditLog } from '../lib/audit.js';

const router = express.Router();

function rowToStaff(row = {}) {
  return { ...row, role: row.quyen || row.role || 'staff' };
}

function sanitizeList(list = []) {
  return list.filter((nv) => nv.active !== false).map((nv) => sanitizeStaff(rowToStaff(nv)));
}

router.get('/', async (req, res) => {
  try {
    const rows = await prisma.nhanVien.findMany({ where: { active: true }, orderBy: { maNV: 'asc' } });
    res.json({ success: true, data: sanitizeList(rows) });
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

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { maNV, tenNV, role = 'staff', matKhau = '' } = req.body || {};
    if (!maNV || !tenNV) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Thiếu mã hoặc tên nhân viên.' } });
    }
    if (String(matKhau).length < 8) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Mật khẩu nhân viên tối thiểu 8 ký tự.' } });
    }

    const newStaff = await prisma.$transaction(async (tx) => {
      const normalizedMaNV = String(maNV).trim();
      const exists = await tx.nhanVien.findFirst({ where: { maNV: { equals: normalizedMaNV, mode: 'insensitive' }, active: true } });
      if (exists) {
        const err = new Error('Mã nhân viên đã tồn tại.');
        err.status = 409;
        err.code = 'DUPLICATE';
        throw err;
      }
      const normalizedRole = role === 'admin' ? 'admin' : 'staff';
      const created = await tx.nhanVien.create({
        data: {
          maNV: normalizedMaNV,
          tenNV: String(tenNV).trim(),
          quyen: normalizedRole,
          matKhau: hashPassword(matKhau),
          active: true,
        },
      });
      await writeAuditLog(req, { action: 'create', entity: 'staff', entityId: created.maNV, summary: `Tạo nhân viên ${created.maNV}`, after: sanitizeStaff(rowToStaff(created)) }, tx);
      return rowToStaff(created);
    });
    return res.json({ success: true, data: sanitizeStaff(newStaff) });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Lỗi máy chủ.' } });
  }
});

router.patch('/:maNV/password', requireRole('admin'), async (req, res) => {
  try {
    const target = String(req.params.maNV || '').trim();
    const { newPassword } = req.body || {};
    if (!target || !newPassword) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Thiếu dữ liệu đặt lại mật khẩu.' } });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Mật khẩu mới tối thiểu 8 ký tự.' } });
    }

    const updatedStaff = await prisma.$transaction(async (tx) => {
      const current = await tx.nhanVien.findFirst({ where: { maNV: { equals: target, mode: 'insensitive' }, active: true } });
      if (!current) {
        const err = new Error('Không tìm thấy nhân viên.');
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
      if (getStaffRole(rowToStaff(current)) === 'admin') {
        const err = new Error('Khong dat lai mat khau tai khoan admin tai man hinh nhan vien.');
        err.status = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
      const updated = await tx.nhanVien.update({ where: { maNV: current.maNV }, data: { matKhau: hashPassword(newPassword) } });
      await writeAuditLog(req, { action: 'reset_password', entity: 'staff', entityId: updated.maNV, summary: `Đặt lại mật khẩu nhân viên ${updated.maNV}`, before: sanitizeStaff(rowToStaff(current)), after: sanitizeStaff(rowToStaff(updated)) }, tx);
      return rowToStaff(updated);
    });
    return res.json({ success: true, data: sanitizeStaff(updatedStaff) });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Lỗi máy chủ.' } });
  }
});

router.delete('/:maNV', requireRole('admin'), async (req, res) => {
  try {
    const target = String(req.params.maNV || '').trim();
    if (!target) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Thiếu mã nhân viên.' } });
    }

    await prisma.$transaction(async (tx) => {
      const current = await tx.nhanVien.findFirst({ where: { maNV: { equals: target, mode: 'insensitive' }, active: true } });
      if (!current) {
        const err = new Error('Không tìm thấy nhân viên.');
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
      const activeCount = await tx.nhanVien.count({ where: { active: true } });
      if (activeCount <= 1) {
        const err = new Error('Phải còn ít nhất 1 nhân viên hoạt động.');
        err.status = 400;
        err.code = 'BAD_REQUEST';
        throw err;
      }
      if (String(req.user?.maNV || '').toLowerCase() === current.maNV.toLowerCase()) {
        const err = new Error('Không thể xóa chính tài khoản đang đăng nhập.');
        err.status = 400;
        err.code = 'BAD_REQUEST';
        throw err;
      }
      const updated = await tx.nhanVien.update({ where: { maNV: current.maNV }, data: { active: false } });
      await writeAuditLog(req, { action: 'delete', entity: 'staff', entityId: updated.maNV, summary: `Vô hiệu hóa nhân viên ${updated.maNV}`, before: sanitizeStaff(rowToStaff(current)), after: sanitizeStaff(rowToStaff(updated)) }, tx);
    });

    return res.json({ success: true });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Lỗi máy chủ, thử lại sau.' } });
  }
});

// Khôi phục nhân viên đã bị vô hiệu hóa (POST /api/nhan-vien/:maNV/restore)
router.post('/:maNV/restore', requireRole('admin'), async (req, res) => {
  try {
    const target = String(req.params.maNV || '').trim();
    if (!target) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Thiếu mã nhân viên.' } });
    }

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.nhanVien.findFirst({ where: { maNV: { equals: target, mode: 'insensitive' } } });
      if (!current) {
        const err = new Error('Không tìm thấy nhân viên.');
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
      if (current.active) {
        const err = new Error('Nhân viên đang hoạt động, không cần khôi phục.');
        err.status = 409;
        err.code = 'CONFLICT';
        throw err;
      }
      const updated = await tx.nhanVien.update({ where: { maNV: current.maNV }, data: { active: true } });
      await writeAuditLog(req, { action: 'restore', entity: 'staff', entityId: updated.maNV, summary: `Khôi phục nhân viên ${updated.maNV}`, before: sanitizeStaff(rowToStaff(current)), after: sanitizeStaff(rowToStaff(updated)) }, tx);
      return updated;
    });

    return res.json({ success: true, data: sanitizeStaff(rowToStaff(result)) });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Lỗi máy chủ, thử lại sau.' } });
  }
});

export default router;

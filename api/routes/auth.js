import express from 'express';
import { authenticateStaff, clearSessionCookie, hashPassword, requireAuth, sanitizeStaff } from '../lib/auth.js';
import { readDb, writeDb } from '../lib/db.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { maNV, matKhau, password } = req.body || {};
    const result = await authenticateStaff(req, res, maNV, matKhau ?? password);
    if (!result.ok) {
      return res.status(result.status || 401).json({
        success: false,
        error: { code: result.status === 429 ? 'RATE_LIMITED' : 'UNAUTHORIZED', message: result.message },
      });
    }
    return res.json({ success: true, data: result.staff });
  } catch {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ khi đăng nhập.' } });
  }
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  return res.json({ success: true });
});

router.get('/me', requireAuth, (req, res) => {
  return res.json({ success: true, data: req.user });
});

router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Thiếu dữ liệu đổi mật khẩu.' } });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Mật khẩu mới tối thiểu 8 ký tự.' } });
    }

    const result = await authenticateStaff(req, res, req.user.maNV, currentPassword);
    if (!result.ok) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Mật khẩu hiện tại không đúng.' } });
    }

    const db = await readDb();
    const idx = (db.nhanVien || []).findIndex((x) => String(x.maNV).toLowerCase() === String(req.user.maNV).toLowerCase());
    if (idx < 0) {
      clearSessionCookie(res);
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy nhân viên.' } });
    }

    db.nhanVien[idx] = {
      ...db.nhanVien[idx],
      matKhau: hashPassword(newPassword),
      passwordBootstrappedAt: null,
      updatedAt: new Date().toISOString(),
    };
    await writeDb(db);
    return res.json({ success: true, data: sanitizeStaff(db.nhanVien[idx]) });
  } catch {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ.' } });
  }
});

export default router;

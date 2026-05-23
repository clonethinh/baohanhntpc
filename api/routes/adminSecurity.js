import express from 'express';
import { readDb, writeDb } from '../lib/db.js';

const router = express.Router();
const DEFAULT_PASSWORD = 'NguyenTan123@';

function getPassword(db) {
  return db?.adminConfig?.password || DEFAULT_PASSWORD;
}

router.post('/verify', async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Thiếu mật khẩu.' } });
    }
    const db = await readDb();
    const ok = password === getPassword(db);
    if (!ok) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Mật khẩu không đúng.' } });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ.' } });
  }
});

router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Thiếu dữ liệu đổi mật khẩu.' } });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Mật khẩu mới tối thiểu 8 ký tự.' } });
    }

    const db = await readDb();
    if (currentPassword !== getPassword(db)) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Mật khẩu hiện tại không đúng.' } });
    }

    db.adminConfig = {
      ...(db.adminConfig || {}),
      password: newPassword,
      updatedAt: new Date().toISOString(),
    };
    await writeDb(db);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ.' } });
  }
});

export default router;

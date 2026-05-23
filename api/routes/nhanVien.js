import express from 'express';
import { readDb } from '../lib/db.js';
import { writeDb } from '../lib/db.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const db = await readDb();
    const nhanVien = db.nhanVien || [];
    res.json({ success: true, data: nhanVien.filter(nv => nv.active) });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.post('/', async (req, res) => {
  try {
    const { maNV, tenNV, role = 'staff' } = req.body || {};
    if (!maNV || !tenNV) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Thiếu mã hoặc tên nhân viên.' } });
    }

    const db = await readDb();
    if (!db.nhanVien) db.nhanVien = [];

    const exists = db.nhanVien.some(nv => String(nv.maNV).toLowerCase() === String(maNV).toLowerCase() && nv.active);
    if (exists) {
      return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Mã nhân viên đã tồn tại.' } });
    }

    const newStaff = {
      id: uuidv4(),
      maNV: String(maNV).trim(),
      tenNV: String(tenNV).trim(),
      role: role === 'admin' ? 'admin' : 'staff',
      active: true,
    };

    db.nhanVien.push(newStaff);
    await writeDb(db);
    return res.json({ success: true, data: newStaff });
  } catch (err) {
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
    const idx = list.findIndex(nv => String(nv.maNV).toLowerCase() === target && nv.active);
    if (idx < 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy nhân viên.' } });
    }

    const activeCount = list.filter(nv => nv.active).length;
    if (activeCount <= 1) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Phải còn ít nhất 1 nhân viên hoạt động.' } });
    }

    list[idx] = { ...list[idx], active: false, deletedAt: new Date().toISOString() };
    db.nhanVien = list;
    await writeDb(db);

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ.' } });
  }
});

export default router;

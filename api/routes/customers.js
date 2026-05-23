import express from 'express';
import { getCollection, setCollection } from '../lib/db.js';
import { customerLabel, getCustomerRows, getWarrantyCustomerKey, hasCustomer } from '../lib/customers.js';
import dayjs from 'dayjs';

const router = express.Router();

router.get('/list', async (req, res) => {
  try {
    const warranties = await getCollection('warranties');
    res.json({ success: true, data: getCustomerRows(warranties) });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.get('/unassigned', async (req, res) => {
  try {
    const warranties = await getCollection('warranties');
    const rows = warranties
      .filter((w) => !w.deletedAt && !hasCustomer(w))
      .sort((a, b) => new Date(b.ngayNhan || b.updatedAt || b.createdAt || 0).getTime() - new Date(a.ngayNhan || a.updatedAt || a.createdAt || 0).getTime())
      .map((w) => ({
        id: w.id,
        soChungTu: w.soChungTu,
        ngayNhan: w.ngayNhan,
        tenHang: w.tenHang,
        soSeri: w.soSeri,
        loiLucNhan: w.loiLucNhan,
        trangThai: w.trangThai,
        ngayHenTra: w.ngayHenTra,
        ngayTra: w.ngayTra,
        loaiXuLy: w.loaiXuLy,
        chiPhi: w.chiPhi,
        baoHanh: w.baoHanh,
      }));

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lá»—i mÃ¡y chá»§, thá»­ láº¡i sau.' } });
  }
});

router.get('/suggest', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 1) return res.json({ success: true, data: [] });

    const warranties = await getCollection('warranties');
    const names = new Set();
    warranties.forEach(w => {
      if (w.khachHang && w.khachHang.toLowerCase().includes(q.toLowerCase()) && !w.deletedAt) {
        names.add(w.khachHang);
      }
    });

    res.json({ success: true, data: [...names].slice(0, 10) });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.get('/lookup', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 1) return res.json({ success: true, data: null });

    const warranties = await getCollection('warranties');
    const active = warranties.filter(w => !w.deletedAt);

    const matched = active.filter(w =>
      (w.khachHang && w.khachHang.toLowerCase().includes(q.toLowerCase())) ||
      (w.soDienThoai && w.soDienThoai.includes(q))
    );

    if (matched.length === 0) return res.json({ success: true, data: null });

    const latest = matched.reduce((a, b) =>
      (new Date(a.ngayNhan) > new Date(b.ngayNhan)) ? a : b
    );

    const history = matched
      .sort((a, b) => new Date(b.ngayNhan) - new Date(a.ngayNhan))
      .map(w => ({
        id: w.id,
        soChungTu: w.soChungTu,
        ngayNhan: w.ngayNhan,
        tenHang: w.tenHang,
        soSeri: w.soSeri,
        loiLucNhan: w.loiLucNhan,
        trangThai: w.trangThai,
        ngayHenTra: w.ngayHenTra,
        ngayTra: w.ngayTra,
        loaiXuLy: w.loaiXuLy,
        chiPhi: w.chiPhi,
        baoHanh: w.baoHanh,
      }));

    res.json({
      success: true,
      data: {
        khachHang: latest.khachHang,
        soDienThoai: latest.soDienThoai || '',
        diaChi: latest.diaChi || '',
        totalWarranties: matched.length,
        history,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.put('/update', async (req, res) => {
  try {
    const { key, khachHang, soDienThoai, diaChi } = req.body || {};
    if (!key || !String(key).trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Thiếu khóa khách hàng.' } });
    }
    if (!khachHang || !String(khachHang).trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Tên khách hàng không được để trống.' } });
    }

    const warranties = await getCollection('warranties');
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const targetKey = String(key).trim();
    let changed = 0;

    const next = warranties.map((w) => {
      if (w.deletedAt) return w;
      const rowKey = getWarrantyCustomerKey(w);
      if (rowKey !== targetKey) return w;
      changed += 1;
      return {
        ...w,
        khachHang: String(khachHang).trim(),
        soDienThoai: String(soDienThoai || '').trim(),
        diaChi: String(diaChi || '').trim(),
        updatedAt: now,
      };
    });

    if (!changed) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy khách hàng để cập nhật.' } });
    }

    await setCollection('warranties', next);
    return res.json({ success: true, data: { updated: changed } });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.post('/delete', async (req, res) => {
  try {
    const { key } = req.body || {};
    if (!key || !String(key).trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Thiáº¿u khÃ³a khÃ¡ch hÃ ng.' } });
    }

    const targetKey = String(key).trim();
    const warranties = await getCollection('warranties');
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const by = req.headers['x-nhan-vien'] || 'admin';
    let changed = 0;

    const next = warranties.map((w) => {
      if (w.deletedAt || getWarrantyCustomerKey(w) !== targetKey) return w;
      changed += 1;
      const oldCustomer = {
        key: targetKey,
        khachHang: w.khachHang || '',
        soDienThoai: w.soDienThoai || '',
        diaChi: w.diaChi || '',
      };

      return {
        ...w,
        khachHang: '',
        soDienThoai: '',
        diaChi: '',
        updatedAt: now,
        history: [
          ...(w.history || []),
          {
            at: now,
            by,
            action: 'customer_detached',
            changes: {
              khachHang: { from: w.khachHang || '', to: '' },
              soDienThoai: { from: w.soDienThoai || '', to: '' },
              diaChi: { from: w.diaChi || '', to: '' },
            },
            customer: { from: oldCustomer, to: null },
            note: `Đã xóa khách hàng ${customerLabel(oldCustomer)} khỏi danh sách, CT chuyển vào Chưa có khách hàng`,
          },
        ],
      };
    });

    if (!changed) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'KhÃ´ng tÃ¬m tháº¥y khÃ¡ch hÃ ng Ä‘á»ƒ xÃ³a.' } });
    }

    await setCollection('warranties', next);
    return res.json({ success: true, data: { detached: changed } });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lá»—i mÃ¡y chá»§, thá»­ láº¡i sau.' } });
  }
});

export default router;

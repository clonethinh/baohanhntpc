import express from 'express';
import { getCollection } from '../lib/db.js';
import dayjs from 'dayjs';

const router = express.Router();

router.get('/summary', async (req, res) => {
  try {
    let warranties = await getCollection('warranties');
    warranties = warranties.filter(w => !w.deletedAt);

    const today = dayjs();
    const yesterday = today.subtract(1, 'day');
    const todayStr = today.format('YYYY-MM-DD');
    const yesterdayStr = yesterday.format('YYYY-MM-DD');

    const tongPhieu = warranties.length;
    const dangXuLy = warranties.filter(w => w.trangThai === 'dang_xu_ly' || w.trangThai === 'cho_xu_ly' || w.trangThai === 'cho_lien_he').length;
    const daTraHomNay = warranties.filter(w => w.trangThai === 'da_tra' && w.ngayTra && dayjs(w.ngayTra).format('YYYY-MM-DD') === todayStr).length;
    const sapHan = warranties.filter(w => {
      if (w.trangThai === 'da_tra' || w.trangThai === 'huy' || !w.ngayHenTra) return false;
      const diff = dayjs(w.ngayHenTra).diff(today, 'day');
      return diff <= 3;
    }).length;

    const yesterdayWarranties = warranties.filter(w => dayjs(w.ngayNhan).format('YYYY-MM-DD') === yesterdayStr);
    const yesterdayDangXuLy = yesterdayWarranties.filter(w => w.trangThai === 'dang_xu_ly' || w.trangThai === 'cho_xu_ly' || w.trangThai === 'cho_lien_he').length;

    res.json({
      success: true,
      data: {
        tongPhieu,
        dangXuLy,
        daTraHomNay,
        sapHan,
        soWithYesterday: { tongPhieu: yesterdayWarranties.length, dangXuLy: yesterdayDangXuLy },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.get('/by-date', async (req, res) => {
  try {
    let warranties = await getCollection('warranties');
    warranties = warranties.filter(w => !w.deletedAt);

    const { from, to, groupBy = 'day' } = req.query;
    let filtered = warranties;
    if (from) filtered = filtered.filter(w => dayjs(w.ngayNhan).isAfter(dayjs(from).subtract(1, 'day')));
    if (to) filtered = filtered.filter(w => dayjs(w.ngayNhan).isBefore(dayjs(to).add(1, 'day')));

    const grouped = {};
    filtered.forEach(w => {
      let key;
      const d = dayjs(w.ngayNhan);
      if (groupBy === 'week') key = d.startOf('week').format('YYYY-MM-DD');
      else if (groupBy === 'month') key = d.format('YYYY-MM');
      else key = d.format('YYYY-MM-DD');

      if (!grouped[key]) grouped[key] = { date: key, count: 0, totalProcessDays: 0, completedCount: 0, totalCost: 0 };
      grouped[key].count++;
      grouped[key].totalCost += w.chiPhi || 0;
      if (w.trangThai === 'da_tra' && w.ngayTra) {
        const days = dayjs(w.ngayTra).diff(dayjs(w.ngayNhan), 'day');
        grouped[key].totalProcessDays += days;
        grouped[key].completedCount++;
      }
    });

    const result = Object.values(grouped)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(g => ({ ...g, avgProcessDays: g.completedCount > 0 ? Math.round(g.totalProcessDays / g.completedCount * 10) / 10 : 0 }));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.get('/top-products', async (req, res) => {
  try {
    let warranties = await getCollection('warranties');
    warranties = warranties.filter(w => !w.deletedAt);
    const { limit = 10 } = req.query;

    const counts = {};
    warranties.forEach(w => {
      const name = w.tenHang || 'Không rõ';
      counts[name] = (counts[name] || 0) + 1;
    });

    const result = Object.entries(counts)
      .map(([tenHang, count]) => ({ tenHang, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, parseInt(limit));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

router.get('/top-customers', async (req, res) => {
  try {
    let warranties = await getCollection('warranties');
    warranties = warranties.filter(w => !w.deletedAt);
    const { limit = 10 } = req.query;

    const counts = {};
    warranties.forEach(w => {
      const name = w.khachHang || 'Không rõ';
      counts[name] = (counts[name] || 0) + 1;
    });

    const result = Object.entries(counts)
      .map(([khachHang, count]) => ({ khachHang, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, parseInt(limit));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ, thử lại sau.' } });
  }
});

export default router;

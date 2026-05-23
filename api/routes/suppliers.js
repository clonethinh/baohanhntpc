import express from 'express';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { readDb, writeDb } from '../lib/db.js';
import { supplierSchema } from '../lib/validators.js';

const router = express.Router();

function normalizeSupplier(item) {
  return {
    ...item,
    isActive: item.isActive !== false,
    deletedAt: item.deletedAt || null,
  };
}

function generateSupplierCode(suppliers = []) {
  const max = suppliers.reduce((acc, s) => {
    const m = String(s.code || '').match(/^NCC(\d{5})$/i);
    if (!m) return acc;
    return Math.max(acc, Number(m[1]));
  }, 0);
  return `NCC${String(max + 1).padStart(5, '0')}`;
}

router.get('/', async (req, res) => {
  try {
    const { q = '', isActive = '', page = 1, limit = 50 } = req.query;
    const db = await readDb();
    let rows = (db.suppliers || []).map(normalizeSupplier).filter(x => !x.deletedAt);
    if (q) {
      const s = String(q).toLowerCase();
      rows = rows.filter(x =>
        (x.code || '').toLowerCase().includes(s) ||
        (x.name || '').toLowerCase().includes(s) ||
        (x.phone || '').toLowerCase().includes(s)
      );
    }
    if (isActive === '1') rows = rows.filter(x => x.isActive);
    if (isActive === '0') rows = rows.filter(x => !x.isActive);
    rows.sort((a, b) => dayjs(b.updatedAt || b.createdAt).valueOf() - dayjs(a.updatedAt || a.createdAt).valueOf());
    const total = rows.length;
    const p = Number(page) || 1;
    const l = Number(limit) || 50;
    const start = (p - 1) * l;
    res.json({ success: true, data: { rows: rows.slice(start, start + l), total, page: p, limit: l } });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Loi may chu' } });
  }
});

router.post('/', async (req, res) => {
  try {
    const parsed = supplierSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } });
    const db = await readDb();
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const code = parsed.data.code?.trim() ? parsed.data.code.trim().toUpperCase() : generateSupplierCode(db.suppliers || []);
    const exists = (db.suppliers || []).some(x => !x.deletedAt && (x.code || '').toLowerCase() === code.toLowerCase());
    if (exists) return res.status(400).json({ success: false, error: { code: 'DUPLICATE_CODE', message: 'Ma nha cung cap da ton tai' } });
    const item = {
      id: uuidv4(),
      ...parsed.data,
      code,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    db.suppliers = [...(db.suppliers || []), item];
    await writeDb(db);
    res.status(201).json({ success: true, data: item });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Loi may chu' } });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const parsed = supplierSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } });
    const db = await readDb();
    const idx = (db.suppliers || []).findIndex(x => x.id === req.params.id && !x.deletedAt);
    if (idx < 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Khong tim thay NCC' } });
    const nextCode = parsed.data.code?.trim() ? parsed.data.code.trim().toUpperCase() : (db.suppliers[idx].code || '');
    const exists = (db.suppliers || []).some(x => x.id !== req.params.id && !x.deletedAt && (x.code || '').toLowerCase() === nextCode.toLowerCase());
    if (exists) return res.status(400).json({ success: false, error: { code: 'DUPLICATE_CODE', message: 'Ma nha cung cap da ton tai' } });
    db.suppliers[idx] = { ...db.suppliers[idx], ...parsed.data, code: nextCode, updatedAt: dayjs().format('YYYY-MM-DDTHH:mm:ss') };
    await writeDb(db);
    res.json({ success: true, data: db.suppliers[idx] });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Loi may chu' } });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const db = await readDb();
    const idx = (db.suppliers || []).findIndex(x => x.id === req.params.id && !x.deletedAt);
    if (idx < 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Khong tim thay NCC' } });
    db.suppliers[idx] = { ...db.suppliers[idx], isActive: Boolean(req.body?.isActive), updatedAt: dayjs().format('YYYY-MM-DDTHH:mm:ss') };
    await writeDb(db);
    res.json({ success: true, data: db.suppliers[idx] });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Loi may chu' } });
  }
});

router.get('/:id/warranties', async (req, res) => {
  try {
    const db = await readDb();
    const supplier = (db.suppliers || []).find(x => x.id === req.params.id && !x.deletedAt);
    if (!supplier) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Khong tim thay NCC' } });
    const logs = (db.supplierLogs || []).filter(x => x.supplierId === req.params.id);
    const ids = new Set(logs.map(x => x.warrantyId));
    const rows = (db.warranties || []).filter(x => !x.deletedAt && ids.has(x.id)).map(w => {
      const warrantyLogs = logs.filter(l => l.warrantyId === w.id);
      const latest = warrantyLogs.sort((a, b) => dayjs(b.at).valueOf() - dayjs(a.at).valueOf())[0];
      const sentLogs = warrantyLogs.filter(l => l.action === 'sent');
      return {
        id: w.id,
        soChungTu: w.soChungTu,
        khachHang: w.khachHang,
        tenHang: w.tenHang,
        trangThai: w.trangThai,
        supplierStatus: w.supplierStatus || 'none',
        latestSupplierAction: latest?.action || '',
        latestSupplierAt: latest?.at || '',
        sentCount: sentLogs.length,
        hasSentHistory: sentLogs.length > 0,
        lastSentAt: sentLogs.length > 0 ? sentLogs.sort((a, b) => dayjs(b.at).valueOf() - dayjs(a.at).valueOf())[0].at : '',
        supplierHistory: warrantyLogs
          .sort((a, b) => dayjs(b.at).valueOf() - dayjs(a.at).valueOf())
          .map((l) => ({
            action: l.action,
            at: l.at,
            sentAt: l.sentAt || '',
            expectedReturnAt: l.expectedReturnAt || '',
            returnedAt: l.returnedAt || '',
            note: l.note || '',
            createdBy: l.createdBy || '',
          })),
      };
    });
    res.json({ success: true, data: rows });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Loi may chu' } });
  }
});

export default router;

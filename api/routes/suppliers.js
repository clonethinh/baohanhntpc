import express from 'express';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/db.js';
import { supplierSchema } from '../lib/validators.js';
import { writeAuditLog } from '../lib/audit.js';

const router = express.Router();

function normalizeSupplier(item) {
  return {
    ...item,
    isActive: item.isActive !== false,
    deletedAt: item.deletedAt || null,
  };
}

async function generateSupplierCode(tx = prisma) {
  const suppliers = await tx.supplier.findMany({ select: { code: true } });
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
    const where = {};
    if (isActive === '1') where.isActive = true;
    if (isActive === '0') where.isActive = false;
    if (q) {
      const s = String(q);
      where.OR = [
        { code: { contains: s, mode: 'insensitive' } },
        { name: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s, mode: 'insensitive' } },
      ];
    }
    const p = Number(page) || 1;
    const l = Number(limit) || 50;
    const [rows, total] = await Promise.all([
      prisma.supplier.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (p - 1) * l, take: l }),
      prisma.supplier.count({ where }),
    ]);

    // Tổng hợp số phiếu đang ở NCC / đã nhận lại theo từng nhà cung cấp
    const supplierWarranties = await prisma.warranty.findMany({
      where: { deletedAt: '' },
      select: { supplierIdCurrent: true, supplierStatus: true },
    });
    const statsMap = {};
    supplierWarranties.forEach((w) => {
      const sid = w.supplierIdCurrent;
      if (!sid) return;
      if (!statsMap[sid]) statsMap[sid] = { pendingCount: 0, returnedCount: 0, totalRelated: 0 };
      statsMap[sid].totalRelated += 1;
      if (w.supplierStatus === 'sent') statsMap[sid].pendingCount += 1;
      else if (w.supplierStatus === 'returned') statsMap[sid].returnedCount += 1;
    });
    const rowsWithStats = rows.map((r) => {
      const s = statsMap[r.id] || { pendingCount: 0, returnedCount: 0, totalRelated: 0 };
      return { ...normalizeSupplier(r), ...s };
    });

    res.json({ success: true, data: { rows: rowsWithStats, total, page: p, limit: l } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Loi may chu' } });
  }
});

router.post('/', async (req, res) => {
  try {
    const parsed = supplierSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } });
    const item = await prisma.$transaction(async (tx) => {
      const code = parsed.data.code?.trim() ? parsed.data.code.trim().toUpperCase() : await generateSupplierCode(tx);
      const exists = await tx.supplier.findFirst({ where: { code: { equals: code, mode: 'insensitive' } } });
      if (exists) {
        const err = new Error('Ma nha cung cap da ton tai');
        err.status = 400;
        err.code = 'DUPLICATE_CODE';
        throw err;
      }
      const created = await tx.supplier.create({
        data: {
          id: uuidv4(),
          code,
          name: parsed.data.name,
          phone: parsed.data.phone || '',
          email: parsed.data.email || '',
          address: parsed.data.address || '',
          contactPerson: parsed.data.contactPerson || '',
          note: parsed.data.note || '',
          isActive: parsed.data.isActive !== false,
        },
      });
      await writeAuditLog(req, { action: 'create', entity: 'supplier', entityId: created.id, summary: `Tạo NCC ${created.code}`, after: created }, tx);
      return created;
    });
    res.status(201).json({ success: true, data: normalizeSupplier(item) });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Loi may chu' } });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const parsed = supplierSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } });
    const item = await prisma.$transaction(async (tx) => {
      const current = await tx.supplier.findUnique({ where: { id: req.params.id } });
      if (!current) {
        const err = new Error('Khong tim thay NCC');
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
      const nextCode = parsed.data.code?.trim() ? parsed.data.code.trim().toUpperCase() : current.code;
      const exists = await tx.supplier.findFirst({ where: { id: { not: req.params.id }, code: { equals: nextCode, mode: 'insensitive' } } });
      if (exists) {
        const err = new Error('Ma nha cung cap da ton tai');
        err.status = 400;
        err.code = 'DUPLICATE_CODE';
        throw err;
      }
      const updated = await tx.supplier.update({
        where: { id: req.params.id },
        data: {
          code: nextCode,
          name: parsed.data.name,
          phone: parsed.data.phone || '',
          email: parsed.data.email || '',
          address: parsed.data.address || '',
          contactPerson: parsed.data.contactPerson || '',
          note: parsed.data.note || '',
          isActive: parsed.data.isActive !== false,
        },
      });
      await writeAuditLog(req, { action: 'update', entity: 'supplier', entityId: updated.id, summary: `Cập nhật NCC ${updated.code}`, before: current, after: updated }, tx);
      return updated;
    });
    res.json({ success: true, data: normalizeSupplier(item) });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Loi may chu' } });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const item = await prisma.$transaction(async (tx) => {
      const current = await tx.supplier.findUnique({ where: { id: req.params.id } });
      if (!current) {
        const err = new Error('Khong tim thay NCC');
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
      const updated = await tx.supplier.update({ where: { id: req.params.id }, data: { isActive: Boolean(req.body?.isActive) } });
      await writeAuditLog(req, { action: 'update_status', entity: 'supplier', entityId: updated.id, summary: `Đổi trạng thái NCC ${updated.code}`, before: current, after: updated }, tx);
      return updated;
    });
    res.json({ success: true, data: normalizeSupplier(item) });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Loi may chu' } });
  }
});

router.get('/:id/warranties', async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id } });
    if (!supplier) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Khong tim thay NCC' } });
    const logs = await prisma.supplierLog.findMany({ where: { supplierId: req.params.id }, orderBy: { createdAt: 'desc' } });
    const ids = [...new Set(logs.map(x => x.warrantyId))];
    const warranties = await prisma.warranty.findMany({ where: { id: { in: ids }, deletedAt: '' } });
    const rows = warranties.map(w => {
      const warrantyLogs = logs.filter(l => l.warrantyId === w.id);
      const latest = warrantyLogs[0];
      const sentLogs = warrantyLogs.filter(l => l.action === 'sent');
      return {
        id: w.id,
        soChungTu: w.soChungTu,
        khachHang: w.khachHang,
        tenHang: w.tenHang,
        trangThai: w.trangThai,
        supplierStatus: w.supplierStatus || 'none',
        latestSupplierAction: latest?.action || '',
        latestSupplierAt: latest?.createdAt ? dayjs(latest.createdAt).format('YYYY-MM-DDTHH:mm:ss') : '',
        sentCount: sentLogs.length,
        hasSentHistory: sentLogs.length > 0,
        lastSentAt: sentLogs[0]?.sentAt || '',
        supplierHistory: warrantyLogs.map((l) => ({
          action: l.action,
          at: l.createdAt ? dayjs(l.createdAt).format('YYYY-MM-DDTHH:mm:ss') : '',
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

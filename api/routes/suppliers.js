import express from 'express';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { prisma, readDb, writeDb } from '../lib/db.js';
import { supplierSchema } from '../lib/validators.js';
import { writeAuditLog } from '../lib/audit.js';
import { requireRole } from '../lib/auth.js';

const router = express.Router();
const requireAdmin = requireRole('admin');

function normalizeSupplier(item) {
  return {
    ...item,
    isActive: item.isActive !== false,
    deletedAt: item.deletedAt || null,
  };
}

// Snapshot TTL cho undo xóa NCC (mặc định 7 ngày)
const SUPPLIER_DELETE_UNDO_TTL_DAYS = 7;

function cleanupExpiredSupplierSnapshots(db, nowStr) {
  if (!Array.isArray(db._deletedSuppliers)) return;
  db._deletedSuppliers = db._deletedSuppliers.filter(
    (s) => s && s.expiresAt && s.expiresAt > nowStr
  );
}

async function generateSupplierCode(tx = prisma) {
  // Chỉ generate code dựa trên NCC chưa bị xóa mềm (deletedAt=null) — tránh tái sửung mã cũ
  const suppliers = await tx.supplier.findMany({
    where: { deletedAt: null },
    select: { code: true },
  });
  const max = suppliers.reduce((acc, s) => {
    const m = String(s.code || '').match(/^NCC(\d{5})$/i);
    if (!m) return acc;
    return Math.max(acc, Number(m[1]));
  }, 0);
  return `NCC${String(max + 1).padStart(5, '0')}`;
}

router.get('/', async (req, res) => {
  try {
    const { q = '', isActive = '', page = 1, limit = 50, includeDeleted = '' } = req.query;
    const where = {};
    // Mặc định ẩN NCC đã bị xóa mềm (deletedAt != null). Admin có thể truyền includeDeleted=true để xem.
    if (includeDeleted !== 'true' && includeDeleted !== '1') {
      where.deletedAt = null;
    }
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
      // Check trùng tên (case-insensitive, đã trim) — tránh tạo 2 NCC cùng tên khác hoa/thường
      const nameNormalized = String(parsed.data.name || '').trim().replace(/\s+/g, ' ');
      if (nameNormalized) {
        const nameExists = await tx.supplier.findFirst({
          where: {
            isActive: true,
            name: { equals: nameNormalized, mode: 'insensitive' },
          },
          select: { id: true, code: true, name: true },
        });
        if (nameExists) {
          const err = new Error(`Tên nhà cung cấp "${nameExists.name}" (mã ${nameExists.code}) đã tồn tại. Vui lòng dùng NCC đó hoặc chọn tên khác.`);
          err.status = 400;
          err.code = 'DUPLICATE_NAME';
          err.existing = { id: nameExists.id, code: nameExists.code, name: nameExists.name };
          throw err;
        }
      }
      const created = await tx.supplier.create({
        data: {
          id: uuidv4(),
          code,
          name: nameNormalized || parsed.data.name, // 4A-2: lưu dạng đã chuẩn hoá (trim + collapse space)
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
    // 4A-1: pass existing field (for DUPLICATE_NAME) + any other structured details
    res.status(err.status || 500).json({
      success: false,
      error: {
        code: err.code || 'SERVER_ERROR',
        message: err.message || 'Loi may chu',
        existing: err.existing || null,
      },
    });
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
      // Check trùng tên khi UPDATE (case-insensitive, loại trừ chính nó)
      const nameNormalized = String(parsed.data.name || '').trim().replace(/\s+/g, ' ');
      if (nameNormalized) {
        const nameExists = await tx.supplier.findFirst({
          where: {
            id: { not: req.params.id },
            isActive: true,
            name: { equals: nameNormalized, mode: 'insensitive' },
          },
          select: { id: true, code: true, name: true },
        });
        if (nameExists) {
          const err = new Error(`Tên nhà cung cấp "${nameExists.name}" (mã ${nameExists.code}) đã tồn tại. Vui lòng dùng NCC đó hoặc chọn tên khác.`);
          err.status = 400;
          err.code = 'DUPLICATE_NAME';
          err.existing = { id: nameExists.id, code: nameExists.code, name: nameExists.name };
          throw err;
        }
      }
      const updated = await tx.supplier.update({
        where: { id: req.params.id },
        data: {
          code: nextCode,
          name: nameNormalized || parsed.data.name, // 4A-2: lưu dạng đã chuẩn hoá
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
    // 4A-1: pass existing field (for DUPLICATE_NAME) + any other structured details
    res.status(err.status || 500).json({
      success: false,
      error: {
        code: err.code || 'SERVER_ERROR',
        message: err.message || 'Loi may chu',
        existing: err.existing || null,
      },
    });
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
    // 4A-1: pass existing field (for DUPLICATE_NAME) + any other structured details
    res.status(err.status || 500).json({
      success: false,
      error: {
        code: err.code || 'SERVER_ERROR',
        message: err.message || 'Loi may chu',
        existing: err.existing || null,
      },
    });
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

// Xóa mềm NCC (admin only) — soft delete + detach tất cả phiếu liên kết
// + lưu snapshot để có thể undo trong 7 ngày
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const targetId = String(req.params.id || '').trim();
    if (!targetId) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Thiếu mã nhà cung cấp.' } });
    }

    const existing = await prisma.supplier.findUnique({ where: { id: targetId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy nhà cung cấp.' } });
    }
    if (existing.deletedAt) {
      return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Nhà cung cấp đã bị xóa trước đó.' } });
    }

    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const by = req.headers['x-nhan-vien'] || req.user?.maNV || 'admin';
    const supplierNameSnapshot = existing.name || '';
    const supplierCodeSnapshot = existing.code || '';

    // Tìm tất cả phiếu đang link tới NCC này (chưa xóa mềm) để detach + snapshot
    const linkedWarranties = await prisma.warranty.findMany({
      where: { supplierIdCurrent: targetId, deletedAt: '' },
      select: { id: true, soChungTu: true, khachHang: true, trangThai: true, history: true },
    });

    // Detach từng phiếu: set supplierIdCurrent=null, ghi history 'supplier_detached' kèm tên NCC cũ
    for (const w of linkedWarranties) {
      const oldHistory = Array.isArray(w.history) ? w.history : [];
      const newHistory = [
        ...oldHistory,
        {
          at: now, by, action: 'supplier_detached',
          changes: { supplierIdCurrent: { from: targetId, to: null } },
          supplier: { from: { id: targetId, name: supplierNameSnapshot, code: supplierCodeSnapshot }, to: null },
          note: `Đã xóa NCC ${supplierCodeSnapshot} - ${supplierNameSnapshot}, phiếu tách khỏi NCC`,
        },
      ];
      await prisma.warranty.update({
        where: { id: w.id },
        data: {
          supplierIdCurrent: null,
          history: newHistory,
        },
      });
      w.supplierIdCurrent = null;
      w.history = newHistory;
    }

    // Soft delete NCC — updatedAt tự động nhờ @updatedAt
    const updated = await prisma.supplier.update({
      where: { id: targetId },
      data: { deletedAt: new Date(), isActive: false },
    });
    // Đồng bộ in-memory db.suppliers để writeDb không overwrite deletedAt
    const db = await readDb();
    const supIdx = (db.suppliers || []).findIndex((s) => s.id === targetId);
    if (supIdx >= 0) {
      db.suppliers[supIdx] = {
        ...db.suppliers[supIdx],
        deletedAt: updated.deletedAt,
        isActive: false,
      };
    }

    // Lưu snapshot vào db._deletedSuppliers (db.json) để có thể undo trong 7 ngày
    const undoToken = uuidv4();
    if (!Array.isArray(db._deletedSuppliers)) db._deletedSuppliers = [];
    db._deletedSuppliers.push({
      undoToken,
      supplier: { ...existing, deletedAt: updated.deletedAt, isActive: false },
      detachedWarranties: linkedWarranties.map((w) => ({
        warrantyId: w.id,
        soChungTu: w.soChungTu || '',
        khachHang: w.khachHang || '',
        trangThai: w.trangThai || '',
        supplierNameSnapshot,
        supplierCodeSnapshot,
      })),
      deletedAt: now,
      deletedBy: by,
      expiresAt: dayjs().add(SUPPLIER_DELETE_UNDO_TTL_DAYS, 'day').format('YYYY-MM-DDTHH:mm:ss'),
    });
    cleanupExpiredSupplierSnapshots(db, now);
    await writeDb(db);

    // Ghi audit log
    await writeAuditLog(req, {
      action: 'delete', entity: 'supplier', entityId: targetId,
      summary: `Xóa mềm NCC ${supplierCodeSnapshot} - ${supplierNameSnapshot} (detach ${linkedWarranties.length} phiếu)`,
      before: existing, after: updated,
    }).catch(() => {});

    return res.json({
      success: true,
      data: {
        deleted: 1,
        detachedWarranties: linkedWarranties.length,
        undoToken,
        undoExpiresAt: dayjs().add(SUPPLIER_DELETE_UNDO_TTL_DAYS, 'day').format('YYYY-MM-DDTHH:mm:ss'),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message || 'Lỗi máy chủ.' } });
  }
});

// Khôi phục NCC đã bị xóa mềm (admin only) — gắn lại tất cả phiếu đã tách
router.post('/restore', requireAdmin, async (req, res) => {
  try {
    const { undoToken } = req.body || {};
    if (!undoToken || !String(undoToken).trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Thiếu mã khôi phục.' } });
    }
    const token = String(undoToken).trim();

    const db = await readDb();
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const by = req.headers['x-nhan-vien'] || req.user?.maNV || 'admin';
    cleanupExpiredSupplierSnapshots(db, now);

    if (!Array.isArray(db._deletedSuppliers)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy bản sao nhà cung cấp để khôi phục.' } });
    }
    const snapshotIndex = db._deletedSuppliers.findIndex((s) => s && s.undoToken === token);
    if (snapshotIndex < 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Mã khôi phục đã hết hạn hoặc không tồn tại.' } });
    }
    const snapshot = db._deletedSuppliers[snapshotIndex];

    // Kiểm tra conflict: nếu NCC đã được tạo lại với cùng id
    const currentSupplier = await prisma.supplier.findUnique({ where: { id: snapshot.supplier.id } });
    if (currentSupplier && !currentSupplier.deletedAt) {
      return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Nhà cung cấp với mã này đã tồn tại trong hệ thống.' } });
    }

    // Khôi phục record NCC (clear deletedAt, isActive=true) — updatedAt tự động nhờ @updatedAt
    await prisma.supplier.update({
      where: { id: snapshot.supplier.id },
      data: { deletedAt: null, isActive: true },
    });

    // Gắn lại tất cả phiếu đã tách
    let reattached = 0;
    for (const det of snapshot.detachedWarranties || []) {
      const w = await prisma.warranty.findUnique({ where: { id: det.warrantyId } });
      if (!w) continue;
      const oldHistory = Array.isArray(w.history) ? w.history : [];
      const newHistory = [
        ...oldHistory,
        {
          at: now, by, action: 'supplier_restored',
          changes: { supplierIdCurrent: { from: null, to: snapshot.supplier.id } },
          supplier: { from: null, to: { id: snapshot.supplier.id, name: snapshot.supplier.name, code: snapshot.supplier.code } },
          note: `Khôi phục NCC ${snapshot.supplier.code} - ${snapshot.supplier.name}, phiếu gắn lại`,
        },
      ];
      await prisma.warranty.update({
        where: { id: det.warrantyId },
        data: {
          supplierIdCurrent: snapshot.supplier.id,
          history: newHistory,
        },
      });
      // Đồng bộ in-memory db.warranties để writeDb không overwrite
      const wIdx = (db.warranties || []).findIndex((x) => x.id === det.warrantyId);
      if (wIdx >= 0) {
        db.warranties[wIdx] = { ...db.warranties[wIdx], supplierIdCurrent: snapshot.supplier.id, history: newHistory };
      }
      reattached += 1;
    }

    // Đồng bộ in-memory db.suppliers để writeDb không overwrite
    const supIdx = (db.suppliers || []).findIndex((s) => s.id === snapshot.supplier.id);
    if (supIdx >= 0) {
      db.suppliers[supIdx] = { ...db.suppliers[supIdx], deletedAt: null, isActive: true };
    } else {
      // NCC có thể đã bị writeDb xóa mất khi isActive=false (do filter deletedAt); tìm lại bằng cách fetch từ Prisma
      const fetched = await prisma.supplier.findUnique({ where: { id: snapshot.supplier.id } });
      if (fetched) db.suppliers.push({ ...fetched, deletedAt: null, isActive: true });
    }

    // Xóa snapshot (chỉ dùng 1 lần)
    db._deletedSuppliers.splice(snapshotIndex, 1);
    await writeDb(db);

    await writeAuditLog(req, {
      action: 'restore', entity: 'supplier', entityId: snapshot.supplier.id,
      summary: `Khôi phục NCC ${snapshot.supplier.code} - ${snapshot.supplier.name} (gắn lại ${reattached} phiếu)`,
    }).catch(() => {});

    return res.json({
      success: true,
      data: { restoredSupplier: 1, reattachedWarranties: reattached },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message || 'Lỗi máy chủ.' } });
  }
});

export default router;

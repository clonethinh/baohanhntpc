import express from 'express';
import dayjs from 'dayjs';
import { customerNotificationSchema } from '../lib/validators.js';
import { prisma } from '../lib/db.js';
import { writeAuditLog } from '../lib/audit.js';

const router = express.Router();

function parseDate(value) {
  if (!value) return null;
  const date = dayjs(value);
  return date.isValid() ? date.toDate() : null;
}

function normalizeNotification(item) {
  return {
    ...item,
    startAt: item.startAt ? dayjs(item.startAt).toISOString() : null,
    endAt: item.endAt ? dayjs(item.endAt).toISOString() : null,
    createdAt: item.createdAt ? dayjs(item.createdAt).toISOString() : '',
    updatedAt: item.updatedAt ? dayjs(item.updatedAt).toISOString() : '',
    isCurrentlyVisible: isNotificationVisible(item),
    effectiveStatus: getEffectiveStatus(item),
  };
}

function isNotificationVisible(item, now = dayjs()) {
  if (!item || item.isActive === false) return false;
  if (item.scheduleType !== 'range') return true;
  const start = item.startAt ? dayjs(item.startAt) : null;
  const end = item.endAt ? dayjs(item.endAt) : null;
  if (start && start.isValid() && now.isBefore(start)) return false;
  if (end && end.isValid() && now.isAfter(end)) return false;
  return true;
}

function getEffectiveStatus(item, now = dayjs()) {
  if (!item || item.isActive === false) return 'inactive';
  if (item.scheduleType !== 'range') return 'visible';
  const start = item.startAt ? dayjs(item.startAt) : null;
  const end = item.endAt ? dayjs(item.endAt) : null;
  if (start && start.isValid() && now.isBefore(start)) return 'scheduled';
  if (end && end.isValid() && now.isAfter(end)) return 'expired';
  return 'visible';
}

function buildOrderBy() {
  return [
    { priority: 'desc' },
    { startAt: 'desc' },
    { createdAt: 'desc' },
  ];
}

function toPublicPayload(item) {
  return {
    id: item.id,
    title: item.title,
    content: item.content,
    displayType: item.displayType,
    priority: item.priority,
    scheduleType: item.scheduleType,
    startAt: item.startAt ? dayjs(item.startAt).toISOString() : null,
    endAt: item.endAt ? dayjs(item.endAt).toISOString() : null,
    updatedAt: item.updatedAt ? dayjs(item.updatedAt).toISOString() : '',
  };
}

function buildWhere({ q = '', displayType = '', isActive = '' }) {
  const where = {};
  const search = String(q || '').trim();

  if (displayType === 'banner' || displayType === 'popup') where.displayType = displayType;
  if (isActive === '1') where.isActive = true;
  if (isActive === '0') where.isActive = false;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ];
  }

  return where;
}

function buildEffectiveStatusWhere(effectiveStatus, now = new Date()) {
  if (!effectiveStatus) return {};

  if (effectiveStatus === 'inactive') {
    return { isActive: false };
  }

  if (effectiveStatus === 'visible') {
    return {
      isActive: true,
      OR: [
        { scheduleType: 'manual' },
        {
          scheduleType: 'range',
          AND: [
            { OR: [{ startAt: null }, { startAt: { lte: now } }] },
            { OR: [{ endAt: null }, { endAt: { gte: now } }] },
          ],
        },
      ],
    };
  }

  if (effectiveStatus === 'scheduled') {
    return {
      isActive: true,
      scheduleType: 'range',
      startAt: { gt: now },
    };
  }

  if (effectiveStatus === 'expired') {
    return {
      isActive: true,
      scheduleType: 'range',
      endAt: { lt: now },
    };
  }

  return {};
}

function mergeWhere(baseWhere, extraWhere) {
  if (!extraWhere || !Object.keys(extraWhere).length) return baseWhere;
  if (!baseWhere || !Object.keys(baseWhere).length) return extraWhere;
  return { AND: [baseWhere, extraWhere] };
}

async function fetchListRows({ where, page, limit }) {
  const [total, rows] = await prisma.$transaction([
    prisma.customerNotification.count({ where }),
    prisma.customerNotification.findMany({
      where,
      orderBy: buildOrderBy(),
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { rows: rows.map(normalizeNotification), total };
}

async function buildSummary(baseWhere) {
  const now = new Date();
  const [total, visible, banner, popup, scheduled, expired, inactive] = await prisma.$transaction([
    prisma.customerNotification.count({ where: baseWhere }),
    prisma.customerNotification.count({ where: mergeWhere(baseWhere, buildEffectiveStatusWhere('visible', now)) }),
    prisma.customerNotification.count({ where: mergeWhere(baseWhere, { displayType: 'banner' }) }),
    prisma.customerNotification.count({ where: mergeWhere(baseWhere, { displayType: 'popup' }) }),
    prisma.customerNotification.count({ where: mergeWhere(baseWhere, buildEffectiveStatusWhere('scheduled', now)) }),
    prisma.customerNotification.count({ where: mergeWhere(baseWhere, buildEffectiveStatusWhere('expired', now)) }),
    prisma.customerNotification.count({ where: mergeWhere(baseWhere, buildEffectiveStatusWhere('inactive', now)) }),
  ]);

  return { total, visible, banner, popup, scheduled, expired, inactive };
}

router.get('/', async (req, res) => {
  try {
    const { q = '', displayType = '', isActive = '', effectiveStatus = '', page = 1, limit = 10 } = req.query;
    const baseWhere = buildWhere({ q, displayType, isActive });
    const effectiveWhere = buildEffectiveStatusWhere(String(effectiveStatus || ''));
    const where = mergeWhere(baseWhere, effectiveWhere);
    const p = Math.max(1, Number(page) || 1);
    const l = Math.max(1, Math.min(100, Number(limit) || 10));
    const { rows, total } = await fetchListRows({ where, page: p, limit: l });

    res.json({ success: true, data: { rows, total, page: p, limit: l } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message || 'Lỗi máy chủ' } });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const { q = '', displayType = '', isActive = '' } = req.query;
    const baseWhere = buildWhere({ q, displayType, isActive });
    const summary = await buildSummary(baseWhere);
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message || 'Lỗi máy chủ' } });
  }
});

router.post('/', async (req, res) => {
  try {
    const parsed = customerNotificationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } });
    }

    const actor = String(req.user?.maNV || '').trim();
    const payload = parsed.data;
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.customerNotification.create({
        data: {
          title: payload.title,
          content: payload.content,
          displayType: payload.displayType,
          priority: payload.priority,
          isActive: payload.isActive !== false,
          scheduleType: payload.scheduleType,
          startAt: payload.scheduleType === 'range' ? parseDate(payload.startAt) : null,
          endAt: payload.scheduleType === 'range' ? parseDate(payload.endAt) : null,
          createdBy: actor,
          updatedBy: actor,
        },
      });
      await writeAuditLog(req, { action: 'create', entity: 'customer_notification', entityId: row.id, summary: `Tạo thông báo khách hàng ${row.title}`, after: row }, tx);
      return row;
    });

    res.status(201).json({ success: true, data: normalizeNotification(created) });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Lỗi máy chủ' } });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const parsed = customerNotificationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } });
    }

    const actor = String(req.user?.maNV || '').trim();
    const payload = parsed.data;
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.customerNotification.findUnique({ where: { id: req.params.id } });
      if (!current) {
        const err = new Error('Không tìm thấy thông báo');
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
      const next = await tx.customerNotification.update({
        where: { id: req.params.id },
        data: {
          title: payload.title,
          content: payload.content,
          displayType: payload.displayType,
          priority: payload.priority,
          isActive: payload.isActive !== false,
          scheduleType: payload.scheduleType,
          startAt: payload.scheduleType === 'range' ? parseDate(payload.startAt) : null,
          endAt: payload.scheduleType === 'range' ? parseDate(payload.endAt) : null,
          updatedBy: actor,
        },
      });
      await writeAuditLog(req, { action: 'update', entity: 'customer_notification', entityId: next.id, summary: `Cập nhật thông báo khách hàng ${next.title}`, before: current, after: next }, tx);
      return next;
    });

    res.json({ success: true, data: normalizeNotification(updated) });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Lỗi máy chủ' } });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const actor = String(req.user?.maNV || '').trim();
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.customerNotification.findUnique({ where: { id: req.params.id } });
      if (!current) {
        const err = new Error('Không tìm thấy thông báo');
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
      const next = await tx.customerNotification.update({
        where: { id: req.params.id },
        data: {
          isActive: Boolean(req.body?.isActive),
          updatedBy: actor,
        },
      });
      await writeAuditLog(req, { action: 'update_status', entity: 'customer_notification', entityId: next.id, summary: `Đổi trạng thái thông báo khách hàng ${next.title}`, before: current, after: next }, tx);
      return next;
    });

    res.json({ success: true, data: normalizeNotification(updated) });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Lỗi máy chủ' } });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.customerNotification.findUnique({ where: { id: req.params.id } });
      if (!current) {
        const err = new Error('Không tìm thấy thông báo');
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
      await tx.customerNotification.delete({ where: { id: req.params.id } });
      await writeAuditLog(req, { action: 'delete', entity: 'customer_notification', entityId: current.id, summary: `Xóa thông báo khách hàng ${current.title}`, before: current }, tx);
    });

    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Lỗi máy chủ' } });
  }
});

router.get('/public/active', async (_req, res) => {
  try {
    const rows = await prisma.customerNotification.findMany({
      where: mergeWhere({ isActive: true }, buildEffectiveStatusWhere('visible')),
      orderBy: buildOrderBy(),
    });
    const banners = rows
      .filter((item) => item.displayType === 'banner')
      .map(toPublicPayload);
    const popup = rows.filter((item) => item.displayType === 'popup')[0] || null;

    res.json({ success: true, data: { banners, popup: popup ? toPublicPayload(popup) : null } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message || 'Lỗi máy chủ' } });
  }
});

export default router;

import { prisma } from './db.js';

function actorFromReq(req) {
  return {
    actorId: String(req?.user?.maNV || ''),
    actorName: String(req?.user?.tenNV || ''),
    ip: String(req?.ip || req?.socket?.remoteAddress || ''),
    userAgent: String(req?.headers?.['user-agent'] || ''),
  };
}

async function writeAuditLog(req, { action, entity, entityId = '', summary = '', before = null, after = null } = {}, tx = prisma) {
  try {
    if (!action || !entity) return null;
    const actor = actorFromReq(req);
    return await tx.auditLog.create({
      data: {
        ...actor,
        action: String(action),
        entity: String(entity),
        entityId: String(entityId || ''),
        summary: String(summary || '').slice(0, 500),
        before: before ?? null,
        after: after ?? null,
      },
    });
  } catch (err) {
    console.warn('[AUDIT] Không ghi được audit log:', err.message);
    return null;
  }
}

export { writeAuditLog };

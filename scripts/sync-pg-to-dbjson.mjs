// scripts/sync-pg-to-dbjson.mjs
// Đồng bộ PostgreSQL (authoritative) ra api/db.json dạng local backup.
// Mặc định GIỮ NGUYÊN `customers` + `adminConfig` từ file backup được chỉ định
// (PG không lưu 2 collection này). Không ghi đè lên PostgreSQL.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT = path.join(ROOT, 'api', 'db.json');
const OUTPUT = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUTPUT;
const PRESERVE_FROM = process.argv[3] ? path.resolve(process.argv[3]) : null; // optional: file nguồn customers/adminConfig

// 1. Đọc customers + adminConfig từ file preserve (hoặc từ OUTPUT nếu không chỉ định)
let customers = [];
let adminConfig = null;
let fallbackCustomerNotifications = [];
const sourcePath = PRESERVE_FROM || OUTPUT;
if (fs.existsSync(sourcePath)) {
  try {
    const old = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));
    customers = old.customers || [];
    adminConfig = old.adminConfig || null;
    fallbackCustomerNotifications = old.customerNotifications || [];
    console.log(`[SYNC] Giữ từ ${path.basename(sourcePath)}: ${customers.length} customers, adminConfig=${adminConfig ? 'có' : 'không'}`);
  } catch (err) {
    console.warn('[SYNC] Không đọc được file nguồn, bỏ qua:', err.message);
  }
} else {
  console.log(`[SYNC] Không có file nguồn ${sourcePath}, bỏ qua bước giữ customers/adminConfig.`);
}

// 2. Đọc PostgreSQL
const prisma = new PrismaClient();
try {
  const [warranties, nhanVien, suppliers, supplierLogs, customerNotifications] = await Promise.all([
    prisma.warranty.findMany({ orderBy: { stt: 'asc' } }),
    prisma.nhanVien.findMany({ orderBy: { maNV: 'asc' } }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
    prisma.supplierLog.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.customerNotification.findMany({ orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }] }),
  ]);

  const data = {
    warranties,
    nhanVien: nhanVien.map((nv) => {
      const role = nv.role || nv.quyen || 'staff';
      return { ...nv, role, quyen: role };
    }),
    suppliers,
    supplierLogs: supplierLogs.map((log) => {
      if (log.at) return log;
      let atVal = '';
      const dateVal = log.createdAt || log.at;
      if (dateVal) {
        try {
          const d = new Date(dateVal);
          if (!isNaN(d.getTime())) {
            atVal = d.toISOString().slice(0, 19);
          }
        } catch { atVal = String(dateVal); }
      }
      return { ...log, at: atVal };
    }),
    customerNotifications: customerNotifications.length ? customerNotifications : fallbackCustomerNotifications,
    adminConfig,
    customers,
  };

  // 3. Ghi ra file (atomic: ghi temp rồi rename)
  const tmp = OUTPUT + '.sync-tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, OUTPUT);

  console.log('[SYNC] Đã đồng bộ PostgreSQL → ' + OUTPUT);
  console.log(`[SYNC] warranties: ${warranties.length} | nhanVien: ${nhanVien.length} | suppliers: ${suppliers.length} | supplierLogs: ${supplierLogs.length} | customerNotifications: ${customerNotifications.length} | customers: ${customers.length} (giữ từ file nguồn)`);
} catch (err) {
  console.error('[SYNC] Lỗi:', err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBackup } from '../api/lib/backup.js';
import { DB_PATH, atomicWriteJsonFile } from '../api/lib/db.js';

const KEEP_WARRANTIES = new Set([
  '20052026NTPC1',
  '20052026NTPC2',
  '21052026NTPC1',
  '21052026NTPC2',
  '21052026NTPC3',
  '21052026NTPC4',
  '21052026NTPC5',
  '21052026NTPC6',
  '21052026NTPC7',
  '21052026NTPC8',
  '21052026NTPC9',
  '21052026NTPC10',
]);

const KEEP_STAFF = new Set([
  'admin',
  'minhtrung',
  'hoangthy',
  'phamthinh',
  'thaibao',
  'trungtran',
]);

const KEEP_SUPPLIERS = new Set([
  'NCC00009',
  'NCC00003',
  'NCC00008',
  'NCC00007',
  'NCC00006',
  'NCC00005',
  'NCC00001',
  'NCC00004',
  'NCC00002',
]);

const before = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
const safety = await createBackup('manual');

const warrantiesBefore = before.warranties || [];
const staffBefore = before.nhanVien || [];
const suppliersBefore = before.suppliers || [];
const logsBefore = before.supplierLogs || [];

const warranties = warrantiesBefore.filter(w => KEEP_WARRANTIES.has(String(w.soChungTu || '').trim()));
const warrantyIds = new Set(warranties.map(w => w.id));

const nhanVien = staffBefore.filter(nv => KEEP_STAFF.has(String(nv.maNV || '').trim().toLowerCase()));

const suppliers = suppliersBefore.filter(s => KEEP_SUPPLIERS.has(String(s.code || '').trim().toUpperCase()));
const supplierIds = new Set(suppliers.map(s => s.id));

const supplierLogs = logsBefore.filter(l =>
  (!l.warrantyId || warrantyIds.has(l.warrantyId)) &&
  (!l.supplierId || supplierIds.has(l.supplierId))
);

const next = {
  ...before,
  warranties,
  nhanVien,
  suppliers,
  supplierLogs,
};

await atomicWriteJsonFile(DB_PATH, next);
const clean = await createBackup('manual');

const missingWarranties = [...KEEP_WARRANTIES].filter(code => !warranties.some(w => w.soChungTu === code));
const missingStaff = [...KEEP_STAFF].filter(code => !nhanVien.some(nv => String(nv.maNV || '').toLowerCase() === code));
const missingSuppliers = [...KEEP_SUPPLIERS].filter(code => !suppliers.some(s => String(s.code || '').toUpperCase() === code));

console.log(JSON.stringify({
  safetyBackup: safety.relativePath,
  cleanBackup: clean.relativePath,
  before: {
    warranties: warrantiesBefore.length,
    nhanVien: staffBefore.length,
    suppliers: suppliersBefore.length,
    supplierLogs: logsBefore.length,
  },
  after: {
    warranties: warranties.length,
    nhanVien: nhanVien.length,
    suppliers: suppliers.length,
    supplierLogs: supplierLogs.length,
  },
  removed: {
    warranties: warrantiesBefore.length - warranties.length,
    nhanVien: staffBefore.length - nhanVien.length,
    suppliers: suppliersBefore.length - suppliers.length,
    supplierLogs: logsBefore.length - supplierLogs.length,
  },
  missing: {
    warranties: missingWarranties,
    nhanVien: missingStaff,
    suppliers: missingSuppliers,
  },
}, null, 2));

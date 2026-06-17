// Integration test cho refactored writeDb() — chạy trực tiếp trên host (KHÔNG qua Docker)
// Yêu cầu: API container đã stop, host có @prisma/client + DATABASE_URL
// Chạy: node tests/test-writeDb-integration.mjs
//
// Backup phương án: nếu test fail, restore từ /tmp/ntpc_pg_backup_20260617_155405.sql

import { readDb, writeDb, prisma } from '../api/lib/db.js';
import fs from 'fs';

const BACKUP_FILE = '/tmp/ntpc_pg_backup_20260617_155405.sql';
const SNAPSHOT_FILE = '/tmp/db_pre_test_20260617_155405.json';

// Load snapshot for cross-check
const preTest = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf-8'));

// Snapshot DB qua Prisma (camelCase, giống production shape)
async function snap() {
  const [warranties, suppliers, nhanVien, supplierLogs, customerNotifications, auditCount] = await Promise.all([
    prisma.warranty.findMany({ orderBy: { stt: 'asc' } }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
    prisma.nhanVien.findMany({ orderBy: { maNV: 'asc' } }),
    prisma.supplierLog.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.customerNotification.count(),
    prisma.auditLog.count(),
  ]);
  return { warranties, suppliers, nhanVien, supplierLogs, customerNotifications, auditCount };
}

// Normalize to comparable form: convert Date → ISO string, trim strings
function norm(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(norm);
  if (typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = norm(v[k]);
    return out;
  }
  if (typeof v === 'string') return v.trim();
  return v;
}

function snapshotKey(state) {
  // For comparison: only the fields writeDb could change
  return {
    warranties: state.warranties.map(w => ({
      id: w.id, soChungTu: w.soChungTu, khachHang: w.khachHang, soDienThoai: w.soDienThoai,
      diaChi: w.diaChi, tenHang: w.tenHang, soSeri: w.soSeri, cauHinh: w.cauHinh,
      loiLucNhan: w.loiLucNhan, phuKien: w.phuKien, chiPhi: w.chiPhi, baoGiaSau: w.baoGiaSau,
      loaiPhieu: w.loaiPhieu, baoHanh: w.baoHanh, loaiXuLy: w.loaiXuLy, loaiXuLyKhac: w.loaiXuLyKhac,
      ghiChu: w.ghiChu, ngayMua: w.ngayMua, ngayNhan: w.ngayNhan, ngayHenTra: w.ngayHenTra,
      ngayTra: w.ngayTra, maNhanVien: w.maNhanVien, trangThai: w.trangThai, uuTien: w.uuTien,
      createdAt: w.createdAt, updatedAt: w.updatedAt, deletedAt: w.deletedAt,
      supplierStatus: w.supplierStatus, supplierIdCurrent: w.supplierIdCurrent,
      sentSupplierAt: w.sentSupplierAt, expectedReturnSupplierAt: w.expectedReturnSupplierAt,
    })),
    suppliers: state.suppliers.map(s => ({
      id: s.id, code: s.code, name: s.name, phone: s.phone, email: s.email,
      address: s.address, contactPerson: s.contactPerson, note: s.note,
      isActive: s.isActive, deletedAt: s.deletedAt ? s.deletedAt.toISOString() : null,
    })),
    nhanVien: state.nhanVien.map(n => ({
      maNV: n.maNV, tenNV: n.tenNV, matKhau: n.matKhau, quyen: n.quyen, active: n.active,
    })),
    supplierLogs: state.supplierLogs.map(l => ({
      id: l.id, supplierId: l.supplierId, supplierName: l.supplierName,
      warrantyId: l.warrantyId, action: l.action, sentAt: l.sentAt,
      expectedReturnAt: l.expectedReturnAt, returnedAt: l.returnedAt,
      note: l.note, createdBy: l.createdBy,
    })),
  };
}

function diffStates(a, b) {
  const ka = snapshotKey(a);
  const kb = snapshotKey(b);
  const issues = [];
  for (const table of ['warranties', 'suppliers', 'nhanVien', 'supplierLogs']) {
    const aIds = new Set(ka[table].map(r => r.id || r.maNV));
    const bIds = new Set(kb[table].map(r => r.id || r.maNV));
    const aArr = ka[table], bArr = kb[table];
    if (aArr.length !== bArr.length) {
      issues.push(`${table}: count ${aArr.length} → ${bArr.length}`);
    }
    for (const x of aArr) {
      const k = x.id || x.maNV;
      const y = bArr.find(r => (r.id || r.maNV) === k);
      if (!y) { issues.push(`${table}: ${k} MISSING in after`); continue; }
      const nx = norm(x), ny = norm(y);
      if (JSON.stringify(nx) !== JSON.stringify(ny)) {
        // Find first diff field
        const xk = Object.keys(nx), yk = Object.keys(ny);
        for (const f of new Set([...xk, ...yk])) {
          if (JSON.stringify(nx[f]) !== JSON.stringify(ny[f])) {
            issues.push(`${table}:${k} field "${f}" diff: ${JSON.stringify(nx[f])} → ${JSON.stringify(ny[f])}`);
            break;
          }
        }
      }
    }
  }
  return issues;
}

// =================== TEST 1: IDEMPOTENT ===================
async function test1_idempotent() {
  console.log('\n=== TEST 1: IDEMPOTENT writeDb ===');
  const before = await snap();
  console.log(`Before: warranties=${before.warranties.length}, suppliers=${before.suppliers.length}, nv=${before.nhanVien.length}, logs=${before.supplierLogs.length}, customerNotifs=${before.customerNotifications}, auditLogs=${before.auditCount}`);

  // readDb() mimics what routes do
  const data = await readDb();

  const start = Date.now();
  await writeDb(data);
  const elapsed = Date.now() - start;
  console.log(`writeDb took ${elapsed}ms`);

  const after = await snap();
  console.log(`After:  warranties=${after.warranties.length}, suppliers=${after.suppliers.length}, nv=${after.nhanVien.length}, logs=${after.supplierLogs.length}, customerNotifs=${after.customerNotifications}, auditLogs=${after.auditCount}`);

  const issues = diffStates(before, after);
  if (issues.length === 0) {
    console.log('✅ TEST 1 PASS: DB state IDENTICAL after idempotent writeDb');
    return { ok: true, elapsed };
  } else {
    console.log(`❌ TEST 1 FAIL: ${issues.length} differences:`);
    issues.slice(0, 10).forEach(i => console.log(`   - ${i}`));
    return { ok: false, elapsed, issues };
  }
}

// =================== TEST 2: SOFT-DELETE GUARD ===================
async function test2_softdelete_guard() {
  console.log('\n=== TEST 2: SOFT-DELETE GUARD ===');
  const before = await snap();
  const softBefore = before.suppliers.filter(s => s.deletedAt != null);
  const activeBefore = before.suppliers.filter(s => s.deletedAt == null);
  console.log(`Before: ${activeBefore.length} active + ${softBefore.length} soft-deleted suppliers`);
  console.log(`Soft-deleted IDs: ${softBefore.map(s => s.id.slice(0, 8)).join(', ')}`);

  // readDb + FILTER OUT soft-deleted (simulating routes/suppliers.js:489 bug)
  const data = await readDb();
  const dataActiveOnly = {
    ...data,
    suppliers: data.suppliers.filter(s => !s.deletedAt),
  };
  console.log(`Filtered input: ${dataActiveOnly.suppliers.length} suppliers (only active, soft-deleted DROPPED)`);

  const start = Date.now();
  await writeDb(dataActiveOnly);
  const elapsed = Date.now() - start;
  console.log(`writeDb took ${elapsed}ms`);

  const after = await snap();
  const softAfter = after.suppliers.filter(s => s.deletedAt != null);
  const activeAfter = after.suppliers.filter(s => s.deletedAt == null);
  console.log(`After:  ${activeAfter.length} active + ${softAfter.length} soft-deleted suppliers`);

  if (softAfter.length === softBefore.length) {
    console.log(`✅ TEST 2 PASS: All ${softBefore.length} soft-deleted suppliers PRESERVED in DB`);
    console.log(`   (Root-cause fix for bug at routes/suppliers.js:489 verified on real DB)`);
    return { ok: true, elapsed };
  } else {
    const lost = softBefore.length - softAfter.length;
    const lostIds = softBefore.filter(s => !softAfter.find(x => x.id === s.id)).map(s => s.id);
    console.log(`❌ TEST 2 FAIL: ${lost} soft-deleted suppliers LOST!`);
    console.log(`   Lost IDs: ${lostIds.map(s => s.slice(0, 8)).join(', ')}`);
    return { ok: false, elapsed, lost, lostIds };
  }
}

async function main() {
  console.log('Backup file:', BACKUP_FILE, fs.existsSync(BACKUP_FILE) ? '(EXISTS)' : '(MISSING!)');
  console.log('Snapshot file:', SNAPSHOT_FILE, fs.existsSync(SNAPSHOT_FILE) ? '(EXISTS)' : '(MISSING!)');

  const r1 = await test1_idempotent();
  const r2 = await test2_softdelete_guard();

  await prisma.$disconnect();

  console.log('\n=== SUMMARY ===');
  console.log(`Test 1 (Idempotent):    ${r1.ok ? '✅ PASS' : '❌ FAIL'} (${r1.elapsed}ms)`);
  console.log(`Test 2 (Soft-delete):   ${r2.ok ? '✅ PASS' : '❌ FAIL'} (${r2.elapsed}ms)`);

  if (!r1.ok || !r2.ok) {
    console.log('\n⚠️  RECOMMEND: restore from backup');
    console.log(`   psql -h localhost -U ntpc_user -d ntpc_warranty -f ${BACKUP_FILE}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch(async (e) => {
  console.error('FATAL:', e);
  await prisma.$disconnect();
  process.exit(2);
});

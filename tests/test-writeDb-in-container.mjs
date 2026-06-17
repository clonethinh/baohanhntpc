// Integration test self-contained — chạy BÊN TRONG container ntpc-backend-api
// Test NEW writeDb (diff-sync) trên DB thật, verify data intact + soft-delete guard
// Import db.js NEW từ path tạm /tmp/db.new.js (mount vào)
//
// An toàn: idempotent test (0 ops) + soft-delete guard. Có pg_dump backup ngoài.

import { readDb, writeDb, prisma } from '/app/api/lib/db.new.js';

async function snap() {
  const [warranties, suppliers, nhanVien, supplierLogs, auditCount] = await Promise.all([
    prisma.warranty.findMany({ orderBy: { stt: 'asc' } }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
    prisma.nhanVien.findMany({ orderBy: { maNV: 'asc' } }),
    prisma.supplierLog.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.auditLog.count(),
  ]);
  return { warranties, suppliers, nhanVien, supplierLogs, auditCount };
}

function keyView(state) {
  return {
    warranties: state.warranties.map(w => ({
      id: w.id, soChungTu: w.soChungTu, khachHang: w.khachHang, soDienThoai: w.soDienThoai,
      diaChi: w.diaChi, tenHang: w.tenHang, soSeri: w.soSeri, trangThai: w.trangThai,
      deletedAt: w.deletedAt, maNhanVien: w.maNhanVien, chiPhi: w.chiPhi,
      supplierStatus: w.supplierStatus, supplierIdCurrent: w.supplierIdCurrent,
      history: JSON.stringify(w.history), attachments: JSON.stringify(w.attachments),
      doiTra: JSON.stringify(w.doiTra),
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
      id: l.id, supplierId: l.supplierId, supplierName: l.supplierName, warrantyId: l.warrantyId,
      action: l.action, sentAt: l.sentAt, expectedReturnAt: l.expectedReturnAt,
      returnedAt: l.returnedAt, note: l.note, createdBy: l.createdBy,
    })),
  };
}

function diffStates(before, after) {
  const a = keyView(before), b = keyView(after);
  const issues = [];
  for (const table of ['warranties', 'suppliers', 'nhanVien', 'supplierLogs']) {
    if (a[table].length !== b[table].length) {
      issues.push(`${table}: COUNT ${a[table].length} → ${b[table].length}`);
    }
    for (const x of a[table]) {
      const k = x.id || x.maNV;
      const y = b[table].find(r => (r.id || r.maNV) === k);
      if (!y) { issues.push(`${table}:${k} MISSING after`); continue; }
      for (const f of Object.keys(x)) {
        if (JSON.stringify(x[f]) !== JSON.stringify(y[f])) {
          issues.push(`${table}:${(k||'').slice(0,8)} field "${f}": ${JSON.stringify(x[f])} → ${JSON.stringify(y[f])}`);
        }
      }
    }
  }
  return issues;
}

let exitCode = 0;

async function test1_idempotent() {
  console.log('\n=== TEST 1: IDEMPOTENT writeDb (diff-sync) ===');
  const before = await snap();
  console.log(`Before: w=${before.warranties.length} s=${before.suppliers.length} nv=${before.nhanVien.length} sl=${before.supplierLogs.length} audit=${before.auditCount}`);

  const data = await readDb();
  const start = Date.now();
  await writeDb(data);
  const elapsed = Date.now() - start;
  console.log(`writeDb(readDb()) took ${elapsed}ms`);

  const after = await snap();
  console.log(`After:  w=${after.warranties.length} s=${after.suppliers.length} nv=${after.nhanVien.length} sl=${after.supplierLogs.length} audit=${after.auditCount}`);

  const issues = diffStates(before, after);
  if (issues.length === 0) {
    console.log(`✅ TEST 1 PASS: DB content IDENTICAL after idempotent writeDb (${elapsed}ms)`);
  } else {
    console.log(`❌ TEST 1 FAIL: ${issues.length} diffs:`);
    issues.slice(0, 15).forEach(i => console.log(`   - ${i}`));
    exitCode = 1;
  }
}

async function test2_softdelete_guard() {
  console.log('\n=== TEST 2: SOFT-DELETE GUARD ===');
  const before = await snap();
  const softBefore = before.suppliers.filter(s => s.deletedAt != null);
  console.log(`Before: ${before.suppliers.length - softBefore.length} active + ${softBefore.length} soft-deleted suppliers`);

  // Mô phỏng bug suppliers.js:489: input chỉ chứa active suppliers
  const data = await readDb();
  const dataActiveOnly = { ...data, suppliers: data.suppliers.filter(s => !s.deletedAt) };
  console.log(`Input filtered: ${dataActiveOnly.suppliers.length} suppliers (soft-deleted DROPPED khỏi input)`);

  const start = Date.now();
  await writeDb(dataActiveOnly);
  const elapsed = Date.now() - start;

  const after = await snap();
  const softAfter = after.suppliers.filter(s => s.deletedAt != null);
  console.log(`After:  ${after.suppliers.length - softAfter.length} active + ${softAfter.length} soft-deleted (${elapsed}ms)`);

  if (softAfter.length === softBefore.length) {
    console.log(`✅ TEST 2 PASS: ${softBefore.length} soft-deleted suppliers PRESERVED (root-cause fix verified trên DB thật)`);
  } else {
    const lost = softBefore.length - softAfter.length;
    console.log(`❌ TEST 2 FAIL: ${lost} soft-deleted suppliers LOST!`);
    exitCode = 1;
  }
}

async function main() {
  await test1_idempotent();
  await test2_softdelete_guard();
  // Restore active suppliers' deletedAt by re-running writeDb with full data
  // (test 2 dropped them from input but guard preserved them — no restore needed)
  await prisma.$disconnect();
  console.log(`\n=== ${exitCode === 0 ? '✅ ALL PASS' : '❌ FAILURES'} ===`);
  process.exit(exitCode);
}

main().catch(async (e) => {
  console.error('FATAL:', e.message);
  await prisma.$disconnect();
  process.exit(2);
});

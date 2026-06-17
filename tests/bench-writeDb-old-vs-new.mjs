// Benchmark: so sánh tốc độ writeDb() cũ (DELETE+INSERT) vs mới (diff-sync)
// Chạy trong container, dùng DB thật, 49 warranties + 25 suppliers + 6 nv + 84 logs

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const prisma = new PrismaClient();

async function snap() {
  const [warranties, suppliers, nhanVien, supplierLogs] = await Promise.all([
    prisma.warranty.findMany({ orderBy: { stt: 'asc' } }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
    prisma.nhanVien.findMany({ orderBy: { maNV: 'asc' } }),
    prisma.supplierLog.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);
  return { warranties, suppliers, nhanVien, supplierLogs,
    adminConfig: null, customers: [], _deletedCustomers: [], _deletedSuppliers: [] };
}

async function bench(label, writeDbFn, runs = 3) {
  // Warmup
  const data = await snap();
  await writeDbFn(data);

  // Timed runs
  const times = [];
  for (let i = 0; i < runs; i++) {
    const d = await snap();
    const start = Date.now();
    await writeDbFn(d);
    times.push(Date.now() - start);
  }
  const sorted = [...times].sort((a, b) => a - b);
  return { label, runs, times, min: sorted[0], median: sorted[Math.floor(sorted.length / 2)], max: sorted[sorted.length - 1] };
}

async function main() {
  console.log('=== Loading both writeDb implementations ===');
  const oldDbUrl = pathToFileURL('/app/api/lib/db.old.js').href;
  const newDbUrl = pathToFileURL('/app/api/lib/db.new.js').href;
  const oldMod = await import(oldDbUrl);
  const newMod = await import(newDbUrl);
  console.log('  Loaded db.old.js (DELETE+INSERT) + db.new.js (diff-sync)');

  // Snapshot DB to verify content unchanged after benchmarks
  const beforeSnap = await snap();
  console.log(`\nDB state: w=${beforeSnap.warranties.length} s=${beforeSnap.suppliers.length} nv=${beforeSnap.nhanVien.length} sl=${beforeSnap.supplierLogs.length}`);

  // === SCENARIO 1: IDEMPOTENT (writeDb with current state, no changes) ===
  console.log('\n=== SCENARIO 1: IDEMPOTENT (writeDb(readDb())) ===');
  const r1Old = await bench('OLD (DELETE+INSERT)', oldMod.writeDb, 3);
  console.log(`  OLD: min=${r1Old.min}ms median=${r1Old.median}ms max=${r1Old.max}ms [${r1Old.times.join(', ')}]`);
  const r1New = await bench('NEW (diff-sync)', newMod.writeDb, 3);
  console.log(`  NEW: min=${r1New.min}ms median=${r1New.median}ms max=${r1New.max}ms [${r1New.times.join(', ')}]`);
  console.log(`  Speedup: ${(r1Old.median / r1New.median).toFixed(1)}x`);

  // === SCENARIO 2: SINGLE RECORD EDIT ===
  console.log('\n=== SCENARIO 2: SINGLE EDIT (1 warranty modified) ===');
  const editBench = async (writeDbFn, label) => {
    const data = await snap();
    // Modify 1 warranty's khachHang
    const target = data.warranties[0];
    const original = target.khachHang;
    target.khachHang = original + ' [BENCH-EDIT]';
    target.updatedAt = new Date().toISOString().replace('T', ' ').replace(/\..*/, '').replace(' ', 'T');
    const start = Date.now();
    await writeDbFn(data);
    const elapsed = Date.now() - start;
    // Revert
    target.khachHang = original;
    const fresh = await prisma.warranty.findUnique({ where: { id: target.id } });
    target.updatedAt = String(fresh.updatedAt);
    await writeDbFn(data);
    return elapsed;
  };
  const t2Old = await editBench(oldMod.writeDb, 'OLD');
  console.log(`  OLD: ${t2Old}ms`);
  const t2New = await editBench(newMod.writeDb, 'NEW');
  console.log(`  NEW: ${t2New}ms`);
  console.log(`  Speedup: ${(t2Old / t2New).toFixed(1)}x`);

  // === SCENARIO 3: SOFT-DELETE MISSING FROM INPUT ===
  console.log('\n=== SCENARIO 3: SOFT-DELETE GUARD (active-only input) ===');
  const guardBench = async (writeDbFn) => {
    const data = await snap();
    const before = data.suppliers.length;
    data.suppliers = data.suppliers.filter(s => !s.deletedAt);
    const start = Date.now();
    await writeDbFn(data);
    return Date.now() - start;
  };
  const t3Old = await guardBench(oldMod.writeDb);
  console.log(`  OLD: ${t3Old}ms (WARNING: sẽ xóa cứng soft-deleted!)`);
  const t3New = await guardBench(newMod.writeDb);
  console.log(`  NEW: ${t3New}ms (guard: giữ soft-deleted)`);

  // === FINAL VERIFY: DB unchanged ===
  const afterSnap = await snap();
  const changed = (beforeSnap.warranties.length !== afterSnap.warranties.length) ||
                  (beforeSnap.suppliers.length !== afterSnap.suppliers.length);
  console.log(`\n=== DB STATE AFTER ALL BENCHMARKS ===`);
  console.log(`  w=${afterSnap.warranties.length} s=${afterSnap.suppliers.length} nv=${afterSnap.nhanVien.length} sl=${afterSnap.supplierLogs.length}`);
  console.log(`  ${changed ? '❌ DB STATE CHANGED!' : '✅ DB state identical (idempotent operations)'}`);

  // Restore soft-deleted (bench 3 may have lost them in OLD branch)
  if (beforeSnap.suppliers.length !== afterSnap.suppliers.length) {
    console.log('  ⚠ Restoring soft-deleted suppliers...');
    for (const s of beforeSnap.suppliers) {
      if (!afterSnap.suppliers.find(x => x.id === s.id)) {
        await prisma.supplier.create({ data: s });
      }
    }
    console.log('  ✅ Restored');
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error('FATAL:', e); await prisma.$disconnect(); process.exit(1); });

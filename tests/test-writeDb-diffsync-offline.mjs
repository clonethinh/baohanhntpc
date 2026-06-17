// Offline test cho diff-sync logic — KHÔNG chạm DB, chỉ test pure functions
// Chạy: node tests/test-writeDb-diffsync-offline.mjs

import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = '/tmp/db_snapshot_before.json';

// --- Replicate hasRecordDiff từ db.js (giữ nguyên logic để test) ---
function hasRecordDiff(dbRow, memRow, fields) {
  for (const f of fields) {
    const a = dbRow[f];
    const b = memRow[f];
    if (a == null && b == null) continue;
    if (a == null || b == null) return true;
    if (typeof a === 'object' || typeof b === 'object') {
      if (JSON.stringify(a) !== JSON.stringify(b)) return true;
    } else if (a !== b) {
      return true;
    }
  }
  return false;
}

// --- Replicate diff classification (logic trong syncSuppliers) ---
function classifySupplierDiff(current, input) {
  const currentMap = new Map(current.map(r => [r.id, r]));
  const inputIds = new Set();
  const SUPPLIER_FIELDS = ['code', 'name', 'phone', 'email', 'address', 'contactPerson', 'note', 'isActive', 'deletedAt'];

  const toCreate = [];
  const toUpdate = [];
  const toDelete = [];

  for (const s of input) {
    if (!s.id) continue;
    inputIds.add(s.id);
    const existing = currentMap.get(s.id);
    if (!existing) {
      toCreate.push(s);
    } else if (hasRecordDiff(existing, s, SUPPLIER_FIELDS)) {
      toUpdate.push(s);
    }
  }
  for (const row of current) {
    if (inputIds.has(row.id)) continue;
    if (row.deletedAt != null) continue; // SOFT-DELETE GUARD
    toDelete.push(row);
  }
  return { toCreate, toUpdate, toDelete };
}

// --- Replicate diff classification (logic trong syncWarranties) ---
function classifyWarrantyDiff(current, input) {
  const seenIds = new Set();
  const seenSo = new Set();
  const deduped = [];
  for (const w of input) {
    if (!w.id) continue;
    if (seenIds.has(w.id)) continue;
    const so = String(w.soChungTu || '').trim();
    if (so && seenSo.has(so)) continue;
    seenIds.add(w.id);
    if (so) seenSo.add(so);
    deduped.push(w);
  }

  const currentMap = new Map(current.map(r => [r.id, r]));
  const inputIds = new Set();
  const W_FIELDS = ['khachHang', 'soDienThoai', 'trangThai', 'chiPhi'];

  const toCreate = [];
  const toUpdate = [];
  const toDelete = [];

  for (const w of deduped) {
    inputIds.add(w.id);
    const existing = currentMap.get(w.id);
    if (!existing) toCreate.push(w);
    else if (hasRecordDiff(existing, w, W_FIELDS)) toUpdate.push(w);
  }
  for (const row of current) {
    if (inputIds.has(row.id)) continue;
    if (row.deletedAt && String(row.deletedAt) !== '') continue; // SOFT-DELETE GUARD
    toDelete.push(row);
  }
  return { toCreate, toUpdate, toDelete, deduped };
}

// ====================== TEST CASES ======================

let pass = 0, fail = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    pass++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    fail++;
  }
}

console.log('\n=== Test 1: hasRecordDiff ===');
test('identical strings → no diff', () => {
  assert.equal(hasRecordDiff({ a: 'x' }, { a: 'x' }, ['a']), false);
});
test('different strings → has diff', () => {
  assert.equal(hasRecordDiff({ a: 'x' }, { a: 'y' }, ['a']), true);
});
test('both null → no diff', () => {
  assert.equal(hasRecordDiff({ a: null }, { a: null }, ['a']), false);
});
test('one null → has diff', () => {
  assert.equal(hasRecordDiff({ a: null }, { a: 'x' }, ['a']), true);
});
test('nested objects: same JSON → no diff', () => {
  assert.equal(hasRecordDiff({ h: [{ a: 1 }] }, { h: [{ a: 1 }] }, ['h']), false);
});
test('nested objects: different JSON → has diff', () => {
  assert.equal(hasRecordDiff({ h: [{ a: 1 }] }, { h: [{ a: 2 }] }, ['h']), true);
});
test('Date object vs string → has diff (mismatch types)', () => {
  assert.equal(hasRecordDiff({ d: new Date() }, { d: '2026-01-01' }, ['d']), true);
});

console.log('\n=== Test 2: classifySupplierDiff — soft-delete guard ===');
const sActive = { id: 's1', code: 'NCC01', name: 'A', isActive: true, deletedAt: null };
const sDeleted = { id: 's2', code: 'NCC02', name: 'B', isActive: false, deletedAt: '2026-06-01' };
const sModified = { id: 's3', code: 'NCC03', name: 'C-NEW', isActive: true, deletedAt: null };

test('1) Soft-deleted missing from input → preserved (not in toDelete)', () => {
  const r = classifySupplierDiff([sActive, sDeleted], [sActive]);
  assert.equal(r.toDelete.length, 0, 'soft-deleted should NOT be in toDelete');
  assert.equal(r.toCreate.length, 0);
  assert.equal(r.toUpdate.length, 0);
});
test('2) Active missing from input → deleted', () => {
  const r = classifySupplierDiff([sActive, sDeleted], [sDeleted]);
  assert.equal(r.toDelete.length, 1);
  assert.equal(r.toDelete[0].id, 's1');
});
test('3) Modified record → updated (not created/deleted)', () => {
  const sOld = { ...sModified, name: 'C-OLD' };
  const r = classifySupplierDiff([sOld, sActive], [sModified, sActive]);
  assert.equal(r.toUpdate.length, 1);
  assert.equal(r.toUpdate[0].id, 's3');
  assert.equal(r.toDelete.length, 0);
  assert.equal(r.toCreate.length, 0);
});
test('4) Brand new supplier → created', () => {
  const sNew = { id: 's4', code: 'NCC04', name: 'D', isActive: true, deletedAt: null };
  const r = classifySupplierDiff([sActive], [sActive, sNew]);
  assert.equal(r.toCreate.length, 1);
  assert.equal(r.toCreate[0].id, 's4');
  assert.equal(r.toUpdate.length, 0);
  assert.equal(r.toDelete.length, 0);
});
test('5) Idempotent: same input as current → 0 ops', () => {
  const r = classifySupplierDiff([sActive, sDeleted], [sActive, sDeleted]);
  assert.equal(r.toCreate.length, 0);
  assert.equal(r.toUpdate.length, 0);
  assert.equal(r.toDelete.length, 0);
});

console.log('\n=== Test 3: classifyWarrantyDiff — dedupe + soft-delete guard ===');
const w1 = { id: 'w1', soChungTu: 'PHIEU001', khachHang: 'KH1', trangThai: 'dang_xu_ly' };
const w2 = { id: 'w2', soChungTu: 'PHIEU002', khachHang: 'KH2', trangThai: 'da_tra', deletedAt: '2026-06-10' };
const w3Dup = { id: 'w1-dup', soChungTu: 'PHIEU001', khachHang: 'KH1-dup', trangThai: 'dang_xu_ly' };

test('1) Duplicate soChungTu → bỏ row thứ 2 (giữ id đầu tiên)', () => {
  const r = classifyWarrantyDiff([], [w1, w3Dup]);
  assert.equal(r.toCreate.length, 1);
  assert.equal(r.toCreate[0].id, 'w1');
});
test('2) Soft-deleted missing from input → preserved', () => {
  const r = classifyWarrantyDiff([w1, w2], [w1]);
  assert.equal(r.toDelete.length, 0, 'soft-deleted warranty should NOT be in toDelete');
});
test('3) Active missing from input → deleted', () => {
  const r = classifyWarrantyDiff([w1, w2], [w2]);
  assert.equal(r.toDelete.length, 1);
  assert.equal(r.toDelete[0].id, 'w1');
});
test('4) Modified warranty → updated', () => {
  const w1Old = { ...w1, khachHang: 'KH1-OLD' };
  const r = classifyWarrantyDiff([w1Old], [w1]);
  assert.equal(r.toUpdate.length, 1);
  assert.equal(r.toUpdate[0].id, 'w1');
});
test('5) Empty id → bỏ qua', () => {
  const wNoId = { id: '', soChungTu: 'X', khachHang: 'KH' };
  const r = classifyWarrantyDiff([], [wNoId]);
  assert.equal(r.toCreate.length, 0);
});

console.log('\n=== Test 4: Real snapshot from production DB ===');
if (fs.existsSync(SNAPSHOT)) {
  const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf-8'));
  console.log(`  Loaded: warranties=${snap.warranties.length}, nhanVien=${snap.nhanVien.length}, suppliers=${snap.suppliers.length}, supplierLogs=${snap.supplierLogs.length}`);

  test('A) Diff snapshot vs itself → 0 ops (idempotent)', () => {
    const r = classifySupplierDiff(snap.suppliers, snap.suppliers);
    assert.equal(r.toCreate.length, 0);
    assert.equal(r.toUpdate.length, 0);
    assert.equal(r.toDelete.length, 0);
  });

  test('B) With only ACTIVE suppliers in input → soft-deleted preserved', () => {
    // Giả lập route filter: chỉ lấy active
    const activeOnly = snap.suppliers.filter(s => !s.deletedAt);
    const r = classifySupplierDiff(snap.suppliers, activeOnly);
    assert.equal(r.toDelete.length, 0, 'this is the root-cause fix — no supplier should be hard-deleted');
    const softDeletedInDb = snap.suppliers.filter(s => s.deletedAt).length;
    console.log(`    → ${softDeletedInDb} soft-deleted suppliers PRESERVED in DB (was being WIPED by old code)`);
  });

  test('C) Modify 1 warranty in snapshot → exactly 1 update', () => {
    const modified = JSON.parse(JSON.stringify(snap.warranties));
    if (modified.length === 0) return;
    modified[0].khachHang = 'TEST-EDITED-NAME';
    const r = classifyWarrantyDiff(snap.warranties, modified);
    assert.equal(r.toUpdate.length, 1, `expected 1 update, got ${r.toUpdate.length}`);
    assert.equal(r.toUpdate[0].id, modified[0].id);
    assert.equal(r.toCreate.length, 0);
    assert.equal(r.toDelete.length, 0);
  });

  test('D) Add 1 new warranty → 1 create, 0 updates, 0 deletes', () => {
    const extended = JSON.parse(JSON.stringify(snap.warranties));
    const newId = `test-new-${Date.now()}`;
    extended.push({
      id: newId,
      soChungTu: `TEST${newId.slice(-6)}`,
      khachHang: 'NEW CUSTOMER',
      soDienThoai: '0900000000',
      diaChi: '',
      tenHang: 'Test product',
      soSeri: 'SN-TEST',
      cauHinh: '',
      loiLucNhan: '',
      phuKien: '',
      chiPhi: 0,
      baoGiaSau: false,
      loaiPhieu: 'nhan_bao_hanh',
      baoHanh: '12 tháng',
      loaiXuLy: 'bao_hanh',
      loaiXuLyKhac: '',
      ghiChu: '',
      ngayMua: '',
      ngayNhan: '17-06-2026',
      ngayHenTra: '',
      ngayTra: '',
      maNhanVien: 'admin',
      trangThai: 'dang_xu_ly',
      uuTien: false,
      createdAt: '2026-06-17T00:00:00',
      updatedAt: '2026-06-17T00:00:00',
      deletedAt: '',
      supplierStatus: 'none',
      supplierIdCurrent: null,
      sentSupplierAt: '',
      expectedReturnSupplierAt: '',
    });
    const r = classifyWarrantyDiff(snap.warranties, extended);
    assert.equal(r.toCreate.length, 1);
    assert.equal(r.toUpdate.length, 0);
    assert.equal(r.toDelete.length, 0);
  });

  // Convert snake_case keys (from PG row_to_json dump) → camelCase (production shape)
  const snake = snap.warranties;
  const camel = snake.map(w => ({
    id: w.id,
    soChungTu: w.so_chung_tu,
    khachHang: w.khach_hang,
    soDienThoai: w.so_dien_thoai,
    trangThai: w.trang_thai,
    chiPhi: w.chi_phi,
    deletedAt: w.deleted_at,
    // ... other fields not relevant for the dedup test
  }));
  snap.warranties = camel; // override for tests below

  test('E) Duplicate soChungTu trong input → chỉ giữ 1', () => {
    const extended = JSON.parse(JSON.stringify(snap.warranties));
    const dup = JSON.parse(JSON.stringify(extended[0]));
    dup.id = `${dup.id}-dup`;
    extended.push(dup);
    const r = classifyWarrantyDiff(snap.warranties, extended);
    assert.equal(r.toCreate.length, 0, 'duplicate id collision should be silently deduped');
    assert.equal(r.deduped.length, snap.warranties.length, 'deduped count should match original');
  });
} else {
  console.log('  ⚠ Snapshot not found, skipping real-data tests');
}

console.log(`\n=== RESULT: ${pass} pass, ${fail} fail ===\n`);
process.exit(fail > 0 ? 1 : 0);

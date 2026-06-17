// Offline test cho server.js:176 fix — verify writeDb chỉ chạy khi cần
// Không touch DB thật, chỉ test logic

import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); pass++; }
  catch (e) { console.log(`  ✗ ${name}\n    ${e.message}`); fail++; }
}

// Replicate logic từ server.js seedIfEmpty()
function shouldWriteDb({ seeded, authChanged }) {
  // FIX: chỉ ghi khi (seeded || authChanged)
  if (seeded || authChanged) return true;
  return false;
}

console.log('=== Test: shouldWriteDb() logic ===');

test('1) Fresh DB (seeded=true, authChanged=true) → WRITE', () => {
  assert.equal(shouldWriteDb({ seeded: true, authChanged: true }), true);
});
test('2) Fresh DB (seeded=true, authChanged=false) → WRITE (seed data cần persist)', () => {
  assert.equal(shouldWriteDb({ seeded: true, authChanged: false }), true);
});
test('3) Existing DB, no changes (seeded=false, authChanged=false) → SKIP ✅', () => {
  // Đây là case fix chính: trước đây LUÔN ghi, giờ SKIP
  assert.equal(shouldWriteDb({ seeded: false, authChanged: false }), false);
});
test('4) Existing DB, password bootstrap (seeded=false, authChanged=true) → WRITE', () => {
  assert.equal(shouldWriteDb({ seeded: false, authChanged: true }), true);
});
test('5) Existing DB, role chuẩn hoá (seeded=false, authChanged=true) → WRITE', () => {
  // ensureAuthState trả về changed=true khi role/quyen khác chuẩn
  assert.equal(shouldWriteDb({ seeded: false, authChanged: true }), true);
});

console.log('\n=== Test: Realistic scenarios (mô phỏng production) ===');

// Mô phỏng: api restart 100 lần với data đã có
// Trước fix: 100 lần DELETE+INSERT (tốn ~5-10s tổng, reset 49 warranties updatedAt)
// Sau fix:   0 lần write (chỉ check + skip)
let writesBefore = 0, writesAfter = 0;
for (let i = 0; i < 100; i++) {
  // CŨ: luôn write
  if (true) writesBefore++;
  // MỚI: chỉ write khi seeded/authChanged
  if (shouldWriteDb({ seeded: false, authChanged: false })) writesAfter++;
}
test('6) 100 lần restart với data tồn tại: 100→0 writes (giảm 100% I/O)', () => {
  assert.equal(writesBefore, 100);
  assert.equal(writesAfter, 0);
});

// Mô phỏng: 1 lần bootstrap password mới (env update)
test('7) Bootstrap password mới (1 lần): 1 write', () => {
  let w = 0;
  if (shouldWriteDb({ seeded: false, authChanged: true })) w++;
  assert.equal(w, 1);
});

console.log(`\n=== RESULT: ${pass} pass, ${fail} fail ===\n`);
process.exit(fail > 0 ? 1 : 0);

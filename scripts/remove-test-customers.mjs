// scripts/remove-test-customers.mjs
// Xóa các khách hàng TEST khỏi mảng `customers` trong api/db.json.
// `customers` chỉ sống trong db.json (không có trong PostgreSQL) nên phải sửa file này.
// An toàn: parse JSON, lọc theo key CHÍNH XÁC, in trước/sau, ghi atomic (tmp + rename).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '..', 'api', 'db.json');

// Key chính xác (khachHang.toLowerCase()|soDienThoai) của các KH test cần xóa.
const REMOVE_KEYS = new Set([
  'test e2e exchange fix|0900000000', // KH00018
  'khách test|099999999',             // KH00019
  'test e2e tra hang|',               // KH00017
]);

const raw = fs.readFileSync(DB_PATH, 'utf-8');
const db = JSON.parse(raw);
const before = Array.isArray(db.customers) ? db.customers.length : 0;

const removed = [];
db.customers = (db.customers || []).filter((c) => {
  if (REMOVE_KEYS.has(c.key)) {
    removed.push(`${c.maKhachHang || '?'} ${c.khachHang || ''} (key=${c.key})`);
    return false;
  }
  return true;
});

const after = db.customers.length;

console.log(`customers trước: ${before} | sau: ${after} | đã xóa: ${removed.length}`);
removed.forEach((r) => console.log('  - ' + r));

if (removed.length === 0) {
  console.log('Không có KH test nào để xóa (đã sạch).');
  process.exit(0);
}

const tmp = DB_PATH + '.remove-tmp';
fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf-8');
fs.renameSync(tmp, DB_PATH);
console.log('Đã ghi lại db.json (atomic).');

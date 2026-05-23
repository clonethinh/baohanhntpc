import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(PROJECT_ROOT, 'api', 'db.json');
const UPLOAD_ROOT = path.join(PROJECT_ROOT, 'api', 'uploads');
const WARRANTY_UPLOAD_ROOT = path.join(UPLOAD_ROOT, 'warranties');
const shouldDelete = process.argv.includes('--delete');

function safeUploadPathFromUrl(url) {
  const pathname = String(url || '').split('?')[0];
  if (!pathname.startsWith('/uploads/warranties/')) return null;
  const relative = pathname.replace(/^\/uploads\//, '');
  const full = path.resolve(path.join(UPLOAD_ROOT, relative));
  const root = path.resolve(UPLOAD_ROOT);
  if (!full.startsWith(root + path.sep)) return null;
  return full;
}

function collectAttachmentUrlsFromWarranty(warranty, urls) {
  for (const item of Array.isArray(warranty.attachments) ? warranty.attachments : []) {
    const full = safeUploadPathFromUrl(item?.url);
    if (full) urls.add(full);
  }
  const doiTra = warranty.doiTra;
  if (doiTra && typeof doiTra === 'object') {
    for (const item of Array.isArray(doiTra.attachments) ? doiTra.attachments : []) {
      const full = safeUploadPathFromUrl(item?.url);
      if (full) urls.add(full);
    }
  }
}

function walkFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walkFiles(full, files);
    else files.push({ full, size: stat.size, mtimeMs: stat.mtimeMs });
  }
  return files;
}

function fmtMb(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

if (!fs.existsSync(DB_PATH)) {
  console.error(`Không tìm thấy DB: ${DB_PATH}`);
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
const referenced = new Set();
for (const warranty of Array.isArray(db.warranties) ? db.warranties : []) {
  collectAttachmentUrlsFromWarranty(warranty, referenced);
}

const uploadFiles = walkFiles(WARRANTY_UPLOAD_ROOT)
  .filter((item) => /\.(jpg|jpeg|png|webp)$/i.test(item.full));
const orphanFiles = uploadFiles.filter((item) => !referenced.has(path.resolve(item.full)));
const orphanBytes = orphanFiles.reduce((sum, item) => sum + item.size, 0);

console.log(`Mode: ${shouldDelete ? 'DELETE' : 'DRY-RUN'}`);
console.log(`Upload files: ${uploadFiles.length}`);
console.log(`Referenced files: ${referenced.size}`);
console.log(`Orphan files: ${orphanFiles.length}`);
console.log(`Orphan size: ${fmtMb(orphanBytes)} MB`);

if (orphanFiles.length) {
  const sorted = [...orphanFiles].sort((a, b) => a.mtimeMs - b.mtimeMs);
  console.log('Oldest orphan files:');
  for (const item of sorted.slice(0, 10)) console.log(`- ${path.relative(PROJECT_ROOT, item.full)} (${item.size} bytes)`);
  console.log('Newest orphan files:');
  for (const item of sorted.slice(-10).reverse()) console.log(`- ${path.relative(PROJECT_ROOT, item.full)} (${item.size} bytes)`);
}

if (!shouldDelete) {
  console.log('Không xóa file nào. Chạy với --delete để xóa sau khi đã kiểm tra dry-run.');
  process.exit(0);
}

let deleted = 0;
let failed = 0;
for (const item of orphanFiles) {
  try {
    fs.unlinkSync(item.full);
    deleted += 1;
  } catch (err) {
    failed += 1;
    console.warn(`Không xóa được ${path.relative(PROJECT_ROOT, item.full)}: ${err.message}`);
  }
}

console.log(`Deleted: ${deleted}`);
console.log(`Failed: ${failed}`);

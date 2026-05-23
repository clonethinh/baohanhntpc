import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { DB_PATH, readDb, atomicWriteJsonFile } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BACKUP_ROOT = path.join(__dirname, '..', 'backups');
const HISTORY_PATH = path.join(BACKUP_ROOT, 'history.json');
const METADATA_PATH = path.join(BACKUP_ROOT, 'metadata.json');
const TYPES = ['minute', 'hourly', 'daily', 'monthly', 'manual', 'restore-safety', 'uploaded'];
const RETENTION_MS = {
  minute: 6 * 60 * 60 * 1000,
  hourly: 7 * 24 * 60 * 60 * 1000,
  daily: 365 * 24 * 60 * 60 * 1000,
  monthly: 5 * 365 * 24 * 60 * 60 * 1000,
  manual: 5 * 365 * 24 * 60 * 60 * 1000,
  'restore-safety': 30 * 24 * 60 * 60 * 1000,
  uploaded: 7 * 24 * 60 * 60 * 1000,
};
const MAX_FILES = { minute: 360, hourly: 168, daily: 365, monthly: 60, manual: 100, 'restore-safety': 100, uploaded: 20 };

let lastMinuteHash = null;
let schedulerStarted = false;
let schedulerState = {
  enabled: false,
  lastMinuteBackupAt: null,
  lastHourlyBackupAt: null,
  lastDailyBackupAt: null,
  lastMonthlyBackupAt: null,
};

function ensureDirs() {
  fs.mkdirSync(BACKUP_ROOT, { recursive: true });
  for (const type of TYPES) fs.mkdirSync(path.join(BACKUP_ROOT, type), { recursive: true });
}

function stamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function safeRelativePath(relativePath) {
  const normalized = path.normalize(String(relativePath || '')).replace(/^([/\\])+/, '');
  if (!normalized || normalized.includes('..')) throw new Error('Đường dẫn backup không hợp lệ');
  const full = path.resolve(BACKUP_ROOT, normalized);
  const root = path.resolve(BACKUP_ROOT);
  if (!full.startsWith(root + path.sep)) throw new Error('Đường dẫn backup không hợp lệ');
  return { relativePath: normalized.replace(/\\/g, '/'), full };
}

function validateDbShape(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Backup không phải object JSON hợp lệ');
  if (!Array.isArray(data.warranties)) throw new Error('Backup thiếu warranties dạng mảng');
  if (!Array.isArray(data.nhanVien)) data.nhanVien = [];
  if (!Array.isArray(data.suppliers)) data.suppliers = [];
  if (!Array.isArray(data.supplierLogs)) data.supplierLogs = [];
  return data;
}

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function customerKey(w = {}) {
  const name = String(w.khachHang || '').trim().toLowerCase();
  const phone = String(w.soDienThoai || '').trim();
  const address = String(w.diaChi || '').trim().toLowerCase();
  return `${name}|${phone}|${address}`;
}

function buildCustomerRows(warranties = []) {
  const map = new Map();
  for (const w of warranties) {
    if (w.deletedAt) continue;
    if (!String(w.khachHang || '').trim() && !String(w.soDienThoai || '').trim()) continue;
    const key = customerKey(w);
    const current = map.get(key) || {
      key,
      khachHang: w.khachHang || '',
      soDienThoai: w.soDienThoai || '',
      diaChi: w.diaChi || '',
      totalWarranties: 0,
      latestAt: '',
      warranties: [],
    };
    current.totalWarranties += 1;
    current.warranties.push(w.id);
    const at = w.updatedAt || w.ngayNhan || w.createdAt || '';
    if (!current.latestAt || new Date(at).getTime() > new Date(current.latestAt).getTime()) current.latestAt = at;
    map.set(key, current);
  }
  return [...map.values()]
    .sort((a, b) => new Date(b.latestAt || 0) - new Date(a.latestAt || 0))
    .map((row, index) => ({
      ...row,
      maKhachHang: row.maKhachHang || `KH${String(index + 1).padStart(5, '0')}`,
    }));
}

function createApplicationSnapshot(db) {
  const phieu = (Array.isArray(db.warranties) ? db.warranties : []).filter(w => !w.deletedAt);
  const nhanVien = (Array.isArray(db.nhanVien) ? db.nhanVien : []).filter(nv => nv.active !== false && !nv.deletedAt);
  const nhaCungCap = (Array.isArray(db.suppliers) ? db.suppliers : []).filter(s => !s.deletedAt);
  const supplierIds = new Set(nhaCungCap.map(s => s.id));
  const phieuIds = new Set(phieu.map(w => w.id));
  const supplierLogs = (Array.isArray(db.supplierLogs) ? db.supplierLogs : []).filter(l => (!l.supplierId || supplierIds.has(l.supplierId)) && (!l.warrantyId || phieuIds.has(l.warrantyId)));
  const khachHang = buildCustomerRows(phieu);
  return {
    backupVersion: 3,
    createdAt: new Date().toISOString(),
    source: 'baohanh3ant5',
    appData: { phieu, khachHang, nhaCungCap, nhanVien, supplierLogs },
  };
}

function normalizeBackupPayload(payload) {
  if (payload?.backupVersion >= 3 && payload.appData) {
    return validateDbShape({
      warranties: payload.appData.phieu || [],
      nhanVien: payload.appData.nhanVien || [],
      suppliers: payload.appData.nhaCungCap || [],
      supplierLogs: payload.appData.supplierLogs || [],
    });
  }
  if (payload?.backupVersion >= 2 && payload.rawDb) return validateDbShape(payload.rawDb);
  return validateDbShape(payload);
}

function addCustomerCodes(rows = []) {
  return rows.map((row, index) => ({
    ...row,
    maKhachHang: row.maKhachHang || `KH${String(index + 1).padStart(5, '0')}`,
  }));
}

function getSnapshotParts(payload) {
  if (payload?.backupVersion >= 2 && payload.appData) {
    const customers = payload.appData.khachHang?.length ? addCustomerCodes(payload.appData.khachHang) : buildCustomerRows(payload.appData.phieu || []);
    return {
      phieu: payload.appData.phieu || [],
      khachHang: customers,
      nhaCungCap: payload.appData.nhaCungCap || [],
      nhanVien: payload.appData.nhanVien || [],
      supplierLogs: payload.appData.supplierLogs || [],
      rawDb: payload.rawDb || null,
      backupVersion: payload.backupVersion,
      createdAt: payload.createdAt,
    };
  }
  const db = validateDbShape(payload);
  return {
    phieu: db.warranties || [],
    khachHang: buildCustomerRows(db.warranties || []),
    nhaCungCap: db.suppliers || [],
    nhanVien: db.nhanVien || [],
    supplierLogs: db.supplierLogs || [],
    rawDb: db,
    backupVersion: 1,
    createdAt: null,
  };
}

function readMetadata() {
  ensureDirs();
  if (!fs.existsSync(METADATA_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8')); } catch { return {}; }
}

async function writeMetadata(metadata) {
  await atomicWriteJsonFile(METADATA_PATH, metadata);
}

function enrichWithMetadata(item, metadata = readMetadata()) {
  const meta = metadata[item.relativePath] || {};
  return { ...item, pinned: !!meta.pinned, note: meta.note || '' };
}

async function appendHistory(entry) {
  try {
    ensureDirs();
    let history = [];
    if (fs.existsSync(HISTORY_PATH)) {
      try { history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8')); } catch { history = []; }
    }
    history.unshift({
      id: `hist_${stamp()}_${crypto.randomBytes(3).toString('hex')}`,
      createdAt: new Date().toISOString(),
      ...entry,
    });
    const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
    history = history.filter(item => new Date(item.createdAt).getTime() >= cutoff).slice(0, 10000);
    await atomicWriteJsonFile(HISTORY_PATH, history);
  } catch (err) {
    console.error('[BACKUP] Không ghi được history:', err.message);
  }
}

export async function createBackup(type = 'manual', options = {}) {
  ensureDirs();
  if (!TYPES.includes(type)) throw new Error('Loại backup không hợp lệ');
  try {
    const db = validateDbShape(await readDb());
    const snapshot = createApplicationSnapshot(db);
    const content = Buffer.from(JSON.stringify(snapshot, null, 2), 'utf-8');
    const hash = sha256Buffer(content);
    if (options.onlyIfChanged && hash === lastMinuteHash) return null;

    const prefix = type === 'restore-safety' ? 'db-before-restore' : 'db';
    let filename = `${prefix}-${stamp()}.json`;
    let full = path.join(BACKUP_ROOT, type, filename);
    if (fs.existsSync(full)) {
      const suffix = crypto.randomBytes(2).toString('hex');
      filename = `${prefix}-${stamp()}-${suffix}.json`;
      full = path.join(BACKUP_ROOT, type, filename);
    }
    fs.writeFileSync(full, content);
    const sha = sha256File(full);
    fs.writeFileSync(`${full}.sha256`, `${sha}  ${filename}\n`, 'utf-8');
    const stat = fs.statSync(full);
    const item = {
      type,
      filename,
      relativePath: `${type}/${filename}`,
      size: stat.size,
      sha256: sha,
      createdAt: stat.mtime.toISOString(),
    };
    if (type === 'minute') lastMinuteHash = hash;
    await appendHistory({ action: 'backup', type, status: 'success', ...item, message: `Tạo backup ${type} thành công` });
    return item;
  } catch (err) {
    await appendHistory({ action: 'backup', type, status: 'failed', message: err.message });
    throw err;
  }
}

export function listBackups() {
  ensureDirs();
  const rows = [];
  for (const type of TYPES) {
    const dir = path.join(BACKUP_ROOT, type);
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const full = path.join(dir, file);
      const stat = fs.statSync(full);
      let sha256 = null;
      const shaPath = `${full}.sha256`;
      if (fs.existsSync(shaPath)) sha256 = fs.readFileSync(shaPath, 'utf-8').trim().split(/\s+/)[0];
      rows.push(enrichWithMetadata({ type, filename: file, relativePath: `${type}/${file}`, size: stat.size, sha256, createdAt: stat.mtime.toISOString() }));
    }
  }
  return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getBackupFile(relativePath) {
  const { full } = safeRelativePath(relativePath);
  if (!fs.existsSync(full) || !full.endsWith('.json')) throw new Error('Không tìm thấy backup');
  return full;
}

function verifyChecksum(filePath) {
  const shaPath = `${filePath}.sha256`;
  if (!fs.existsSync(shaPath)) return null;
  const expected = fs.readFileSync(shaPath, 'utf-8').trim().split(/\s+/)[0];
  const actual = sha256File(filePath);
  if (expected !== actual) throw new Error('Checksum backup không khớp');
  return actual;
}

export async function restoreBackup(relativePath, confirm) {
  if (confirm !== 'RESTORE') throw new Error('Cần nhập RESTORE để xác nhận');
  try {
    const full = getBackupFile(relativePath);
    const checksum = verifyChecksum(full);
    const data = normalizeBackupPayload(readJsonFile(full));
    const safety = await createBackup('restore-safety');
    await atomicWriteJsonFile(DB_PATH, data);
    const result = { restoredFrom: relativePath, safetyBackup: safety.relativePath, sha256: checksum || sha256File(full), restoredAt: new Date().toISOString() };
    await appendHistory({ action: 'restore', type: 'existing', status: 'success', sourcePath: relativePath, safetyBackupPath: safety.relativePath, message: 'Khôi phục dữ liệu thành công' });
    return result;
  } catch (err) {
    await appendHistory({ action: 'restore', type: 'existing', status: 'failed', sourcePath: relativePath, message: err.message });
    throw err;
  }
}

export async function restoreUploadedBackup(data, confirm, originalName = 'uploaded.json') {
  if (confirm !== 'RESTORE') throw new Error('Cần nhập RESTORE để xác nhận');
  try {
    const normalized = normalizeBackupPayload(data);
    ensureDirs();
    const safeName = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_') || 'uploaded.json';
    const filename = `uploaded-${stamp()}-${safeName.endsWith('.json') ? safeName : `${safeName}.json`}`;
    const full = path.join(BACKUP_ROOT, 'uploaded', filename);
    await atomicWriteJsonFile(full, normalized);
    const sha = sha256File(full);
    fs.writeFileSync(`${full}.sha256`, `${sha}  ${filename}\n`, 'utf-8');
    const safety = await createBackup('restore-safety');
    await atomicWriteJsonFile(DB_PATH, normalized);
    const result = { restoredFrom: `uploaded/${filename}`, safetyBackup: safety.relativePath, sha256: sha, restoredAt: new Date().toISOString() };
    await appendHistory({ action: 'upload_restore', type: 'uploaded', status: 'success', sourcePath: result.restoredFrom, safetyBackupPath: safety.relativePath, message: 'Upload và khôi phục dữ liệu thành công' });
    return result;
  } catch (err) {
    await appendHistory({ action: 'upload_restore', type: 'uploaded', status: 'failed', message: err.message });
    throw err;
  }
}

export async function deleteBackup(relativePath) {
  const { relativePath: safePath, full } = safeRelativePath(relativePath);
  const type = safePath.split('/')[0];
  const metadata = readMetadata();
  if (metadata[safePath]?.pinned) throw new Error('Backup đang được giữ lại, hãy bỏ giữ lại trước khi xóa');
  if (type === 'restore-safety') throw new Error('Không cho xóa restore-safety từ UI');
  if (!fs.existsSync(full)) throw new Error('Không tìm thấy backup');
  fs.unlinkSync(full);
  if (fs.existsSync(`${full}.sha256`)) fs.unlinkSync(`${full}.sha256`);
  delete metadata[safePath];
  await writeMetadata(metadata);
  await appendHistory({ action: 'delete_backup', type, status: 'success', deletedPath: safePath, message: 'Xóa backup thành công' });
}

export async function updateBackupMetadata(relativePath, { pinned, note } = {}) {
  const { relativePath: safePath } = safeRelativePath(relativePath);
  getBackupFile(safePath);
  const metadata = readMetadata();
  metadata[safePath] = {
    ...(metadata[safePath] || {}),
    pinned: !!pinned,
    note: String(note || '').slice(0, 500),
    updatedAt: new Date().toISOString(),
  };
  await writeMetadata(metadata);
  await appendHistory({ action: 'metadata', status: 'success', sourcePath: safePath, message: metadata[safePath].pinned ? 'Đã giữ lại backup' : 'Đã cập nhật ghi chú backup' });
  return enrichWithMetadata(listBackups().find(x => x.relativePath === safePath) || { relativePath: safePath });
}

export function viewBackup(relativePath, limit = 50) {
  const full = getBackupFile(relativePath);
  verifyChecksum(full);
  const payload = readJsonFile(full);
  const parts = getSnapshotParts(payload);
  const n = Math.max(1, Math.min(Number(limit) || 50, 200));
  const sortByNew = rows => [...rows].sort((a, b) => new Date(b.updatedAt || b.ngayNhan || b.createdAt || b.latestAt || 0) - new Date(a.updatedAt || a.ngayNhan || a.createdAt || a.latestAt || 0));
  return {
    backupVersion: parts.backupVersion,
    createdAt: parts.createdAt,
    summary: { warranties: parts.phieu.length, customers: parts.khachHang.length, suppliers: parts.nhaCungCap.length, nhanVien: parts.nhanVien.length, supplierLogs: parts.supplierLogs.length },
    preview: {
      warranties: sortByNew(parts.phieu).slice(0, n),
      customers: sortByNew(parts.khachHang).slice(0, n),
      suppliers: sortByNew(parts.nhaCungCap).slice(0, n),
      nhanVien: sortByNew(parts.nhanVien).slice(0, n),
    },
  };
}

export function getHistory(limit = 200) {
  ensureDirs();
  if (!fs.existsSync(HISTORY_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8')).slice(0, Number(limit) || 200); } catch { return []; }
}

export async function cleanupOldBackups() {
  ensureDirs();
  let deletedCount = 0;
  const now = Date.now();
  const metadata = readMetadata();
  for (const [type, age] of Object.entries(RETENTION_MS)) {
    const dir = path.join(BACKUP_ROOT, type);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir)
      .filter(file => file.endsWith('.json'))
      .map(file => ({ file, full: path.join(dir, file), relativePath: `${type}/${file}`, mtimeMs: fs.statSync(path.join(dir, file)).mtimeMs }))
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    for (const item of files) {
      const overAge = now - item.mtimeMs > age;
      const overCount = files.filter(x => !metadata[x.relativePath]?.pinned).indexOf(item) >= (MAX_FILES[type] || Infinity);
      if (!metadata[item.relativePath]?.pinned && (overAge || overCount)) {
        fs.unlinkSync(item.full);
        if (fs.existsSync(`${item.full}.sha256`)) fs.unlinkSync(`${item.full}.sha256`);
        delete metadata[item.relativePath];
        deletedCount++;
      }
    }
  }
  if (deletedCount) await writeMetadata(metadata);
  if (deletedCount) await appendHistory({ action: 'cleanup', status: 'success', deletedCount, message: `Đã xóa ${deletedCount} backup cũ` });
  return deletedCount;
}

export function getBackupStatus() {
  ensureDirs();
  const dbStat = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH) : null;
  return {
    dbPath: 'api/db.json',
    dbSize: dbStat?.size || 0,
    dbUpdatedAt: dbStat?.mtime?.toISOString() || null,
    latestBackup: listBackups()[0] || null,
    scheduler: schedulerState,
  };
}

export function startBackupScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  schedulerState.enabled = true;
  ensureDirs();

  setTimeout(() => createBackup('minute', { onlyIfChanged: true }).then(r => { if (r) schedulerState.lastMinuteBackupAt = r.createdAt; }).catch(err => console.error('[BACKUP] minute:', err.message)), 5000);

  setInterval(() => createBackup('minute', { onlyIfChanged: true }).then(r => { if (r) schedulerState.lastMinuteBackupAt = r.createdAt; }).catch(err => console.error('[BACKUP] minute:', err.message)), 60 * 1000);
  setInterval(() => createBackup('hourly').then(r => { schedulerState.lastHourlyBackupAt = r.createdAt; }).catch(err => console.error('[BACKUP] hourly:', err.message)), 60 * 60 * 1000);
  setInterval(() => createBackup('daily').then(r => { schedulerState.lastDailyBackupAt = r.createdAt; }).catch(err => console.error('[BACKUP] daily:', err.message)), 24 * 60 * 60 * 1000);
  setInterval(() => {
    const d = new Date();
    if (d.getDate() === 1) createBackup('monthly').then(r => { schedulerState.lastMonthlyBackupAt = r.createdAt; }).catch(err => console.error('[BACKUP] monthly:', err.message));
  }, 24 * 60 * 60 * 1000);
  setInterval(() => cleanupOldBackups().catch(err => console.error('[BACKUP] cleanup:', err.message)), 6 * 60 * 60 * 1000);
}

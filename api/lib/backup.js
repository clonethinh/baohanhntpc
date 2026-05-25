import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { DB_PATH, readDb, atomicWriteJsonFile } from './db.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Ho_Chi_Minh');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BACKUP_ROOT = path.join(__dirname, '..', 'backups');
const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');
const HISTORY_PATH = path.join(BACKUP_ROOT, 'history.json');
const METADATA_PATH = path.join(BACKUP_ROOT, 'metadata.json');
const ASSET_EXTENSION = '.assets.tgz';
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
const MAX_FILES = { minute: 10, hourly: 10, daily: 10, monthly: 10, manual: 10, 'restore-safety': 10, uploaded: 10 };

let lastMinuteHash = null;
let schedulerStarted = false;
let backupsCache = null;
const shaCache = new Map();
let schedulerState = {
  enabled: false,
  lastMinuteBackupAt: null,
  lastHourlyBackupAt: null,
  lastDailyBackupAt: null,
  lastMonthlyBackupAt: null,
};

function ensureDirs() {
  fs.mkdirSync(BACKUP_ROOT, { recursive: true });
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
  for (const type of TYPES) fs.mkdirSync(path.join(BACKUP_ROOT, type), { recursive: true });
}

function stamp() {
  return dayjs().tz('Asia/Ho_Chi_Minh').format('YYYYMMDD-HHmmss');
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

function assetRelativePathForBackup(relativePath) {
  if (!String(relativePath || '').endsWith('.json')) throw new Error('Backup khong phai file JSON');
  return String(relativePath).replace(/\.json$/i, ASSET_EXTENSION);
}

function assetFullPathForBackup(full) {
  if (!String(full || '').endsWith('.json')) throw new Error('Backup khong phai file JSON');
  return String(full).replace(/\.json$/i, ASSET_EXTENSION);
}

function safeUploadEntry(entry) {
  const raw = String(entry || '').trim().replace(/\\/g, '/').replace(/^\.\/+/, '');
  if (!raw || raw.includes('\0') || /^[a-zA-Z]:/.test(raw)) return null;
  const stripped = raw.replace(/^\/+/, '');
  const normalized = path.posix.normalize(stripped);
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../') || normalized.startsWith('/')) return null;
  if (normalized !== 'warranties' && !normalized.startsWith('warranties/')) return null;
  return normalized;
}

function uploadUrlToRelative(value) {
  let text = String(value || '').trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) {
    try { text = new URL(text).pathname; } catch { return null; }
  }
  text = text.split('?')[0].split('#')[0];
  if (!text.startsWith('/uploads/')) return null;
  return safeUploadEntry(text.replace(/^\/uploads\//, ''));
}

function collectUploadReferences(value, out = new Set(), depth = 0) {
  if (depth > 8 || value == null) return out;
  if (typeof value === 'string') {
    const rel = uploadUrlToRelative(value);
    if (rel && rel !== 'warranties') out.add(rel);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectUploadReferences(item, out, depth + 1));
    return out;
  }
  if (typeof value === 'object') {
    Object.values(value).forEach(item => collectUploadReferences(item, out, depth + 1));
  }
  return out;
}

function uploadEntryFullPath(relativePath) {
  const safe = safeUploadEntry(relativePath);
  if (!safe || safe === 'warranties') throw new Error('Duong dan anh khong hop le');
  const full = path.resolve(UPLOADS_ROOT, safe);
  const root = path.resolve(UPLOADS_ROOT);
  if (!full.startsWith(root + path.sep)) throw new Error('Duong dan anh khong hop le');
  return full;
}

function collectExistingAssetFiles(snapshot) {
  const refs = [...collectUploadReferences(snapshot?.appData?.phieu || [])].sort();
  const files = [];
  for (const rel of refs) {
    const full = uploadEntryFullPath(rel);
    if (!fs.existsSync(full)) continue;
    const stat = fs.lstatSync(full);
    if (!stat.isFile()) continue;
    files.push({ rel, full, size: stat.size, mtimeMs: Math.trunc(stat.mtimeMs) });
  }
  return files;
}

function assetKey(files) {
  return sha256Buffer(Buffer.from(JSON.stringify(files.map(({ rel, size, mtimeMs }) => ({ rel, size, mtimeMs }))), 'utf-8'));
}

function readAssetManifest(assetFull) {
  const manifestPath = `${assetFull}.json`;
  if (!fs.existsSync(manifestPath)) return null;
  try { return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')); } catch { return null; }
}

function writeAssetManifest(assetFull, manifest) {
  fs.writeFileSync(`${assetFull}.json`, JSON.stringify(manifest, null, 2), 'utf-8');
}

function assetInfoForBackup(full, relativePath) {
  const assetFull = assetFullPathForBackup(full);
  const assetRelativePath = assetRelativePathForBackup(relativePath);
  if (!fs.existsSync(assetFull)) return { exists: false, count: 0, size: 0 };
  const stat = fs.statSync(assetFull);
  const manifest = readAssetManifest(assetFull) || {};
  let sha256 = manifest.sha256 || null;
  const shaPath = `${assetFull}.sha256`;
  if (!sha256 && fs.existsSync(shaPath)) {
    sha256 = fs.readFileSync(shaPath, 'utf-8').trim().split(/\s+/)[0] || null;
  }
  return {
    exists: true,
    filename: path.basename(assetFull),
    relativePath: assetRelativePath,
    size: stat.size,
    count: Number.isFinite(Number(manifest.count)) ? Number(manifest.count) : null,
    sha256,
    createdAt: dayjs(stat.mtime).tz('Asia/Ho_Chi_Minh').format(),
    format: 'tgz',
  };
}

function findReusableAssetBundle(key) {
  if (!key) return null;
  for (const type of TYPES) {
    const dir = path.join(BACKUP_ROOT, type);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(`${ASSET_EXTENSION}.json`)) continue;
      const manifestFull = path.join(dir, file);
      let manifest = null;
      try { manifest = JSON.parse(fs.readFileSync(manifestFull, 'utf-8')); } catch { continue; }
      if (manifest?.assetKey !== key || !manifest.relativePath) continue;
      const candidateFull = path.resolve(BACKUP_ROOT, manifest.relativePath.replace(/\\/g, '/'));
      const root = path.resolve(BACKUP_ROOT);
      if (!candidateFull.startsWith(root + path.sep) || !fs.existsSync(candidateFull)) continue;
      return { full: candidateFull, manifest };
    }
  }
  return null;
}

function createAssetBundle(snapshot, backupFull, backupRelativePath) {
  const files = collectExistingAssetFiles(snapshot);
  if (!files.length) return { exists: false, count: 0, size: 0 };

  const assetFull = assetFullPathForBackup(backupFull);
  const assetRelativePath = assetRelativePathForBackup(backupRelativePath);
  const key = assetKey(files);
  const reused = findReusableAssetBundle(key);

  if (reused) {
    try {
      fs.linkSync(reused.full, assetFull);
    } catch {
      fs.copyFileSync(reused.full, assetFull);
    }
  } else {
    const listPath = `${assetFull}.list`;
    fs.writeFileSync(listPath, `${files.map(x => x.rel).join('\n')}\n`, 'utf-8');
    try {
      execFileSync('tar', ['-czf', assetFull, '-T', listPath], { cwd: UPLOADS_ROOT, stdio: 'pipe' });
    } finally {
      try { fs.unlinkSync(listPath); } catch { /* ignore */ }
    }
  }

  const sha = sha256File(assetFull);
  fs.writeFileSync(`${assetFull}.sha256`, `${sha}  ${path.basename(assetFull)}\n`, 'utf-8');
  const stat = fs.statSync(assetFull);
  const manifest = {
    exists: true,
    format: 'tgz',
    filename: path.basename(assetFull),
    relativePath: assetRelativePath,
    count: files.length,
    size: stat.size,
    sha256: sha,
    assetKey: key,
    reusedFrom: reused?.manifest?.relativePath || null,
    createdAt: dayjs(stat.mtime).tz('Asia/Ho_Chi_Minh').format(),
  };
  writeAssetManifest(assetFull, manifest);
  return manifest;
}

function verifyAssetChecksum(assetFull) {
  const shaPath = `${assetFull}.sha256`;
  if (!fs.existsSync(shaPath)) return null;
  const expected = fs.readFileSync(shaPath, 'utf-8').trim().split(/\s+/)[0];
  const actual = sha256File(assetFull);
  if (expected !== actual) throw new Error('Checksum goi anh backup khong khop');
  return actual;
}

function listAssetEntries(assetFull) {
  const output = execFileSync('tar', ['-tzf', assetFull], { encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024 });
  return output.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

function extractAssetBundle(assetFull) {
  if (!fs.existsSync(assetFull)) return { restored: false, exists: false, count: 0, size: 0 };
  verifyAssetChecksum(assetFull);
  const entries = listAssetEntries(assetFull);
  for (const entry of entries) {
    if (!safeUploadEntry(entry)) throw new Error('Goi anh backup co duong dan khong hop le');
  }
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
  execFileSync('tar', ['-xzf', assetFull, '-C', UPLOADS_ROOT], { stdio: 'pipe' });
  const stat = fs.statSync(assetFull);
  return {
    restored: true,
    exists: true,
    count: entries.filter(entry => !entry.endsWith('/')).length,
    size: stat.size,
    filename: path.basename(assetFull),
    restoredAt: dayjs().tz('Asia/Ho_Chi_Minh').format(),
  };
}

function deleteAssetFilesForBackup(full) {
  const assetFull = assetFullPathForBackup(full);
  for (const suffix of ['', '.sha256', '.json', '.list']) {
    const target = `${assetFull}${suffix}`;
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
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
    createdAt: dayjs().tz('Asia/Ho_Chi_Minh').format(),
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
      createdAt: dayjs().tz('Asia/Ho_Chi_Minh').format(),
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
    let assets = { exists: false, count: 0, size: 0 };
    const shouldSkipAssets = type === 'minute' || type === 'hourly';
    if (!shouldSkipAssets) {
      try {
        assets = createAssetBundle(snapshot, full, `${type}/${filename}`);
      } catch (assetErr) {
        try { fs.unlinkSync(full); } catch { /* ignore */ }
        try { fs.unlinkSync(`${full}.sha256`); } catch { /* ignore */ }
        deleteAssetFilesForBackup(full);
        throw new Error(`Tao goi anh backup that bai: ${assetErr.message}`);
      }
    }
    const item = {
      type,
      filename,
      relativePath: `${type}/${filename}`,
      size: stat.size,
      sha256: sha,
      assets,
      createdAt: dayjs(stat.mtime).tz('Asia/Ho_Chi_Minh').format(),
    };
    if (type === 'minute') lastMinuteHash = hash;
    await appendHistory({ action: 'backup', type, status: 'success', ...item, message: `Tạo backup ${type} thành công` });
    backupsCache = null;
    return item;
  } catch (err) {
    await appendHistory({ action: 'backup', type, status: 'failed', message: err.message });
    throw err;
  }
}

export function listBackups() {
  if (backupsCache) return backupsCache;
  ensureDirs();
  const rows = [];
  const metadata = readMetadata();
  for (const type of TYPES) {
    const dir = path.join(BACKUP_ROOT, type);
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json') || file.endsWith(`${ASSET_EXTENSION}.json`)) continue;
      const full = path.join(dir, file);
      const stat = fs.statSync(full);
      let sha256 = null;
      const cacheKey = `${type}/${file}-${stat.mtimeMs}`;
      if (shaCache.has(cacheKey)) {
        sha256 = shaCache.get(cacheKey);
      } else {
        const shaPath = `${full}.sha256`;
        if (fs.existsSync(shaPath)) {
          sha256 = fs.readFileSync(shaPath, 'utf-8').trim().split(/\s+/)[0];
          shaCache.set(cacheKey, sha256);
        }
      }
      const relativePath = `${type}/${file}`;
      rows.push(enrichWithMetadata({
        type,
        filename: file,
        relativePath,
        size: stat.size,
        sha256,
        assets: assetInfoForBackup(full, relativePath),
        createdAt: dayjs(stat.mtime).tz('Asia/Ho_Chi_Minh').format(),
      }, metadata));
    }
  }
  backupsCache = rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return backupsCache;
}

export function getBackupFile(relativePath) {
  const { full } = safeRelativePath(relativePath);
  if (!fs.existsSync(full) || !full.endsWith('.json')) throw new Error('Không tìm thấy backup');
  return full;
}

export function getBackupAssetFile(relativePath) {
  const { relativePath: safePath, full } = safeRelativePath(relativePath);
  if (!full.endsWith('.json')) throw new Error('Backup khong phai file JSON');
  const assetFull = assetFullPathForBackup(full);
  if (!fs.existsSync(assetFull)) throw new Error('Khong tim thay goi anh cua backup');
  return { full: assetFull, info: assetInfoForBackup(full, safePath) };
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
    const { relativePath: safePath } = safeRelativePath(relativePath);
    const full = getBackupFile(safePath);
    const checksum = verifyChecksum(full);
    const data = normalizeBackupPayload(readJsonFile(full));
    const safety = await createBackup('restore-safety');
    await atomicWriteJsonFile(DB_PATH, data);
    const assets = extractAssetBundle(assetFullPathForBackup(full));
    const result = { restoredFrom: safePath, safetyBackup: safety.relativePath, sha256: checksum || sha256File(full), assets, restoredAt: dayjs().tz('Asia/Ho_Chi_Minh').format() };
    await appendHistory({
      action: 'restore',
      type: 'existing',
      status: 'success',
      sourcePath: safePath,
      safetyBackupPath: safety.relativePath,
      assetCount: assets.count || 0,
      message: assets.restored ? 'Khoi phuc du lieu va anh thanh cong' : 'Khoi phuc du lieu thanh cong, backup khong co goi anh',
    });
    backupsCache = null;
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
    const result = { restoredFrom: `uploaded/${filename}`, safetyBackup: safety.relativePath, sha256: sha, restoredAt: dayjs().tz('Asia/Ho_Chi_Minh').format() };
    await appendHistory({ action: 'upload_restore', type: 'uploaded', status: 'success', sourcePath: result.restoredFrom, safetyBackupPath: safety.relativePath, message: 'Upload và khôi phục dữ liệu thành công' });
    backupsCache = null;
    return result;
  } catch (err) {
    await appendHistory({ action: 'upload_restore', type: 'uploaded', status: 'failed', message: err.message });
    throw err;
  }
}

export async function restoreUploadedAssets(buffer, confirm, originalName = 'assets.tgz') {
  if (confirm !== 'RESTORE') throw new Error('Can nhap RESTORE de xac nhan');
  let full = null;
  try {
    ensureDirs();
    const content = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');
    if (!content.length) throw new Error('Goi anh backup rong');

    const safeName = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_') || 'assets.tgz';
    const baseName = (safeName.replace(/\.assets\.tgz$/i, '').replace(/\.tgz$/i, '') || 'assets').slice(0, 120);
    const filename = `uploaded-assets-${stamp()}-${baseName}${ASSET_EXTENSION}`;
    const relativePath = `uploaded/${filename}`;
    full = path.join(BACKUP_ROOT, 'uploaded', filename);

    fs.writeFileSync(full, content);
    const sha = sha256File(full);
    fs.writeFileSync(`${full}.sha256`, `${sha}  ${filename}\n`, 'utf-8');
    const assets = extractAssetBundle(full);
    const manifest = {
      exists: true,
      format: 'tgz',
      filename,
      relativePath,
      count: assets.count || 0,
      size: assets.size || fs.statSync(full).size,
      sha256: sha,
      assetKey: null,
      reusedFrom: null,
      createdAt: dayjs().tz('Asia/Ho_Chi_Minh').format(),
    };
    writeAssetManifest(full, manifest);

    await appendHistory({
      action: 'upload_assets_restore',
      type: 'uploaded',
      status: 'success',
      sourcePath: relativePath,
      assetCount: manifest.count,
      message: 'Upload va khoi phuc goi anh thanh cong',
    });
    backupsCache = null;
    return { restoredFrom: relativePath, sha256: sha, assets: { ...assets, relativePath }, restoredAt: dayjs().tz('Asia/Ho_Chi_Minh').format() };
  } catch (err) {
    if (full) {
      try { fs.unlinkSync(full); } catch { /* ignore */ }
      try { fs.unlinkSync(`${full}.sha256`); } catch { /* ignore */ }
      try { fs.unlinkSync(`${full}.json`); } catch { /* ignore */ }
    }
    await appendHistory({ action: 'upload_assets_restore', type: 'uploaded', status: 'failed', message: err.message });
    throw err;
  }
}

export async function deleteBackup(relativePath) {
  const { relativePath: safePath, full } = safeRelativePath(relativePath);
  const type = safePath.split('/')[0];
  const metadata = readMetadata();
  if (!full.endsWith('.json')) throw new Error('Backup khong phai file JSON');
  if (metadata[safePath]?.pinned) throw new Error('Backup đang được giữ lại, hãy bỏ giữ lại trước khi xóa');
  if (type === 'restore-safety') throw new Error('Không cho xóa restore-safety từ UI');
  if (!fs.existsSync(full)) throw new Error('Không tìm thấy backup');
  try {
    const file = path.basename(full);
    const stat = fs.statSync(full);
    shaCache.delete(`${type}/${file}-${stat.mtimeMs}`);
  } catch { /* ignore */ }
  fs.unlinkSync(full);
  if (fs.existsSync(`${full}.sha256`)) fs.unlinkSync(`${full}.sha256`);
  deleteAssetFilesForBackup(full);
  delete metadata[safePath];
  await writeMetadata(metadata);
  await appendHistory({ action: 'delete_backup', type, status: 'success', deletedPath: safePath, message: 'Xóa backup thành công' });
  backupsCache = null;
}

export async function updateBackupMetadata(relativePath, { pinned, note } = {}) {
  const { relativePath: safePath } = safeRelativePath(relativePath);
  getBackupFile(safePath);
  const metadata = readMetadata();
  metadata[safePath] = {
    ...(metadata[safePath] || {}),
    pinned: !!pinned,
    note: String(note || '').slice(0, 500),
    updatedAt: dayjs().tz('Asia/Ho_Chi_Minh').format(),
  };
  await writeMetadata(metadata);
  await appendHistory({ action: 'metadata', status: 'success', sourcePath: safePath, message: metadata[safePath].pinned ? 'Đã giữ lại backup' : 'Đã cập nhật ghi chú backup' });
  backupsCache = null;
  return enrichWithMetadata(listBackups().find(x => x.relativePath === safePath) || { relativePath: safePath });
}

export function viewBackup(relativePath, limit = 50) {
  const { relativePath: safePath } = safeRelativePath(relativePath);
  const full = getBackupFile(safePath);
  verifyChecksum(full);
  const payload = readJsonFile(full);
  const parts = getSnapshotParts(payload);
  const n = Math.max(1, Math.min(Number(limit) || 50, 200));
  const sortByNew = rows => [...rows].sort((a, b) => new Date(b.updatedAt || b.ngayNhan || b.createdAt || b.latestAt || 0) - new Date(a.updatedAt || a.ngayNhan || a.createdAt || a.latestAt || 0));
  return {
    backupVersion: parts.backupVersion,
    createdAt: parts.createdAt,
    summary: { warranties: parts.phieu.length, customers: parts.khachHang.length, suppliers: parts.nhaCungCap.length, nhanVien: parts.nhanVien.length, supplierLogs: parts.supplierLogs.length, assets: assetInfoForBackup(full, safePath) },
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
      .filter(file => file.endsWith('.json') && !file.endsWith(`${ASSET_EXTENSION}.json`))
      .map(file => ({ file, full: path.join(dir, file), relativePath: `${type}/${file}`, mtimeMs: fs.statSync(path.join(dir, file)).mtimeMs }))
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    for (const item of files) {
      const overAge = now - item.mtimeMs > age;
      const overCount = files.filter(x => !metadata[x.relativePath]?.pinned).indexOf(item) >= (MAX_FILES[type] || Infinity);
      if (!metadata[item.relativePath]?.pinned && (overAge || overCount)) {
        try {
          shaCache.delete(`${type}/${item.file}-${item.mtimeMs}`);
        } catch { /* ignore */ }
        fs.unlinkSync(item.full);
        if (fs.existsSync(`${item.full}.sha256`)) fs.unlinkSync(`${item.full}.sha256`);
        deleteAssetFilesForBackup(item.full);
        delete metadata[item.relativePath];
        deletedCount++;
      }
    }
  }
  if (deletedCount) await writeMetadata(metadata);
  if (deletedCount) await appendHistory({ action: 'cleanup', status: 'success', deletedCount, message: `Đã xóa ${deletedCount} backup cũ` });
  if (deletedCount) backupsCache = null;
  return deletedCount;
}

export function getBackupStatus() {
  ensureDirs();
  const dbStat = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH) : null;
  return {
    dbPath: 'api/db.json',
    dbSize: dbStat?.size || 0,
    dbUpdatedAt: dbStat?.mtime ? dayjs(dbStat.mtime).tz('Asia/Ho_Chi_Minh').format() : null,
    latestBackup: listBackups()[0] || null,
    scheduler: schedulerState,
  };
}

export function startBackupScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  schedulerState.enabled = true;
  ensureDirs();

  // Chỉ chạy backup tự động ở mức hourly, daily, monthly để tránh đầy dung lượng ổ cứng. Bỏ qua backup tự động mỗi phút.
  setInterval(() => createBackup('hourly').then(r => { schedulerState.lastHourlyBackupAt = r.createdAt; }).catch(err => console.error('[BACKUP] hourly:', err.message)), 60 * 60 * 1000);
  setInterval(() => createBackup('daily').then(r => { schedulerState.lastDailyBackupAt = r.createdAt; }).catch(err => console.error('[BACKUP] daily:', err.message)), 24 * 60 * 60 * 1000);
  setInterval(() => {
    const d = new Date();
    if (d.getDate() === 1) createBackup('monthly').then(r => { schedulerState.lastMonthlyBackupAt = r.createdAt; }).catch(err => console.error('[BACKUP] monthly:', err.message));
  }, 24 * 60 * 60 * 1000);
  setInterval(() => cleanupOldBackups().catch(err => console.error('[BACKUP] cleanup:', err.message)), 6 * 60 * 60 * 1000);
}

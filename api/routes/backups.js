import express from 'express';
import {
  createBackup,
  listBackups,
  getBackupFile,
  getBackupAssetFile,
  restoreBackup,
  restoreUploadedBackup,
  restoreUploadedAssets,
  deleteBackup,
  getHistory,
  getBackupStatus,
  updateBackupMetadata,
  viewBackup,
} from '../lib/backup.js';

const router = express.Router();

function ok(res, data) { res.json({ success: true, data }); }
function fail(res, err, status = 400) { res.status(status).json({ success: false, message: err.message || String(err) }); }

router.get('/status', (req, res) => {
  try { ok(res, getBackupStatus()); } catch (err) { fail(res, err); }
});

router.get('/history', (req, res) => {
  try { ok(res, getHistory(req.query.limit)); } catch (err) { fail(res, err); }
});

router.get('/', (req, res) => {
  try { ok(res, listBackups()); } catch (err) { fail(res, err); }
});

router.post('/', async (req, res) => {
  try { ok(res, await createBackup(req.body?.type || 'manual')); } catch (err) { fail(res, err); }
});

router.get('/download', (req, res) => {
  try {
    const file = getBackupFile(req.query.path);
    res.download(file);
  } catch (err) { fail(res, err); }
});

router.get('/download-assets', (req, res) => {
  try {
    const asset = getBackupAssetFile(req.query.path);
    res.download(asset.full);
  } catch (err) { fail(res, err); }
});

router.get('/view', (req, res) => {
  try { ok(res, viewBackup(req.query.path, req.query.limit)); } catch (err) { fail(res, err); }
});

router.patch('/metadata', async (req, res) => {
  try { ok(res, await updateBackupMetadata(req.body?.path, req.body || {})); } catch (err) { fail(res, err); }
});

router.post('/restore', async (req, res) => {
  try { ok(res, await restoreBackup(req.body?.path, req.body?.confirm)); } catch (err) { fail(res, err); }
});

router.post('/upload-restore', async (req, res) => {
  try {
    const { data, confirm, filename } = req.body || {};
    ok(res, await restoreUploadedBackup(data, confirm, filename));
  } catch (err) { fail(res, err); }
});

router.post('/upload-assets', express.raw({ type: '*/*', limit: process.env.BACKUP_ASSET_UPLOAD_LIMIT || '500mb' }), async (req, res) => {
  try {
    ok(res, await restoreUploadedAssets(req.body, req.query.confirm, req.query.filename));
  } catch (err) { fail(res, err); }
});

router.delete('/', async (req, res) => {
  try {
    await deleteBackup(req.body?.path);
    ok(res, { deleted: req.body?.path });
  } catch (err) { fail(res, err); }
});

export default router;

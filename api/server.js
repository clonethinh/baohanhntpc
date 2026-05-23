import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { readDb, writeDb } = await import('./lib/db.js');
const { warranties: seedWarranties, nhanVien: seedNhanVien } = await import('./seedData.js');

const app = express();
const PORT = process.env.API_PORT || 3003;
const allowedOrigins = [
  'http://localhost:5175',
  'http://127.0.0.1:5175',
  'http://192.168.1.146:5175',
];

app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : allowedOrigins,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));


app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return originalJson(data);
  };
  next();
});

async function seedIfEmpty() {
  const db = await readDb();
  if (!Array.isArray(db.suppliers)) db.suppliers = [];
  if (!Array.isArray(db.supplierLogs)) db.supplierLogs = [];

  const seeded = !db.warranties || db.warranties.length === 0;
  if (seeded) {
    db.warranties = seedWarranties;
    db.nhanVien = seedNhanVien;
  }

  await writeDb(db);
  if (process.env.NODE_ENV !== 'production' && seeded) {
    console.log(`[SEED] Da tao ${seedWarranties.length} phieu bao hanh va ${seedNhanVien.length} nhan vien.`);
  }
}

const warrantiesRoutes = (await import('./routes/warranties.js')).default;
const nhanVienRoutes = (await import('./routes/nhanVien.js')).default;
const adminSecurityRoutes = (await import('./routes/adminSecurity.js')).default;
const statsRoutes = (await import('./routes/stats.js')).default;
const customersRoutes = (await import('./routes/customers.js')).default;
const publicRoutes = (await import('./routes/public.js')).default;
const suppliersRoutes = (await import('./routes/suppliers.js')).default;
const backupsRoutes = (await import('./routes/backups.js')).default;
const { startBackupScheduler } = await import('./lib/backup.js');

app.use('/api/warranties', warrantiesRoutes);
app.use('/api/nhan-vien', nhanVienRoutes);
app.use('/api/admin-security', adminSecurityRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/admin/backups', backupsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() } });
});

seedIfEmpty().then(() => {
  startBackupScheduler();
  app.listen(PORT, () => {
    console.log(`[API] Server chay tai http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('[API] Loi seed data:', err);
  process.exit(1);
});


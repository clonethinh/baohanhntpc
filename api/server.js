import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        if (key) process.env[key] = value;
      }
    });
  }
} catch (err) {
  console.warn('[ENV] Khong doc duoc file .env:', err.message);
}

const { readDb, writeDb, prisma } = await import('./lib/db.js');
const { attachUser, ensureAuthState, requireAuth, requireRole } = await import('./lib/auth.js');
const { warranties: seedWarranties, nhanVien: seedNhanVien } = await import('./seedData.js');

const warrantiesRoutes = (await import('./routes/warranties.js')).default;
const nhanVienRoutes = (await import('./routes/nhanVien.js')).default;
const authRoutes = (await import('./routes/auth.js')).default;
const statsRoutes = (await import('./routes/stats.js')).default;
const customersRoutes = (await import('./routes/customers.js')).default;
const publicRoutes = (await import('./routes/public.js')).default;
const suppliersRoutes = (await import('./routes/suppliers.js')).default;
const backupsRoutes = (await import('./routes/backups.js')).default;
const { startBackupScheduler } = await import('./lib/backup.js');

const app = express();
const PORT = process.env.API_PORT || 3004;
app.set('trust proxy', 1);
const allowedOrigins = [
  'http://localhost:5175',
  'http://127.0.0.1:5175',
  'http://192.168.1.146:5175',
  'http://localhost:8888',
  'http://127.0.0.1:8888',
];

app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : allowedOrigins,
  credentials: true,
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
  const maxRetries = 5;
  const delayMs = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log(`[DB] Kết nối PostgreSQL thành công (Lần thứ ${attempt})`);
      break;
    } catch (err) {
      if (attempt === maxRetries) {
        console.warn(`[DB] Không thể kết nối PostgreSQL sau ${maxRetries} lần thử. Tự động chuyển sang sử dụng file dự phòng db.json.`);
      } else {
        console.log(`[DB] Đang chờ database khởi động... Thử lại sau ${delayMs / 1000} giây (Lần thứ ${attempt}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  const db = await readDb();
  if (!Array.isArray(db.suppliers)) db.suppliers = [];
  if (!Array.isArray(db.supplierLogs)) db.supplierLogs = [];

  const seeded = !db.warranties || db.warranties.length === 0;
  if (seeded) {
    db.warranties = seedWarranties;
    db.nhanVien = seedNhanVien;
  }

  ensureAuthState(db);
  await writeDb(db);
  if (process.env.NODE_ENV !== 'production' && seeded) {
    console.log(`[SEED] Da tao ${seedWarranties.length} phieu bao hanh va ${seedNhanVien.length} nhan vien.`);
  }
}

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() } });
});

app.use('/api/public', publicRoutes);
app.use(attachUser);
app.use('/api/auth', authRoutes);
app.use(requireAuth);
app.use('/api/warranties', warrantiesRoutes);
app.use('/api/nhan-vien', requireRole('admin'), nhanVienRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/admin/backups', requireRole('admin'), backupsRoutes);

app.listen(PORT, () => {
  console.log(`[API] Server chay tai http://localhost:${PORT}`);
  seedIfEmpty()
    .then(() => {
      startBackupScheduler();
    })
    .catch((err) => {
      console.error('[API] Loi seed data bat dong bo:', err.message);
    });
});

import fs from 'fs';
import { readDb, writeDb, prisma } from '../api/lib/db.js';
import { ensureAuthState } from '../api/lib/auth.js';

function loadEnv() {
  if (!fs.existsSync('.env')) return;
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key) process.env[key] = value;
  }
}

loadEnv();

const db = await readDb();
ensureAuthState(db);
await writeDb(db);

const rows = (db.nhanVien || []).map((nv) => ({
  maNV: nv.maNV,
  role: nv.role || nv.quyen,
  active: nv.active !== false,
  hasPassword: Boolean(nv.matKhau),
  hashType: String(nv.matKhau || '').split('$')[0] || '',
}));

console.log(JSON.stringify(rows, null, 2));
await prisma.$disconnect();

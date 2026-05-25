import crypto from 'crypto';
import { readDb, writeDb } from './db.js';

const COOKIE_NAME = 'ntpc_session';
const SCRYPT_KEYLEN = 64;
const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 8 * 60 * 60);
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const loginAttempts = new Map();

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlJson(data) {
  return base64Url(JSON.stringify(data));
}

function decodeBase64Url(value) {
  const padded = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf-8');
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET || '';
  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error('AUTH_SECRET must be set to at least 32 characters in production.');
  }
  return secret || 'dev-only-auth-secret-change-before-production';
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function signJwtPayload(payload) {
  const header = base64UrlJson({ alg: 'HS256', typ: 'JWT' });
  const body = base64UrlJson(payload);
  const unsigned = `${header}.${body}`;
  const signature = crypto.createHmac('sha256', getAuthSecret()).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

function verifyJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expected = crypto.createHmac('sha256', getAuthSecret()).update(`${header}.${body}`).digest('base64url');
  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(body));
    if (!payload?.sub || !payload?.exp || Number(payload.exp) < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, part) => {
    const idx = part.indexOf('=');
    if (idx < 0) return acc;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function cookieOptions() {
  const secure = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS * 1000,
  };
}

function normalizeRole(value) {
  return value === 'admin' ? 'admin' : 'staff';
}

function getStaffRole(staff = {}) {
  return normalizeRole(staff.role || staff.quyen || 'staff');
}

function sanitizeStaff(staff = {}) {
  return {
    maNV: staff.maNV,
    tenNV: staff.tenNV,
    role: getStaffRole(staff),
    active: staff.active !== false,
  };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('base64url');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  const stored = String(storedHash || '');
  if (!stored) return { ok: false, needsRehash: false };

  if (stored.startsWith('scrypt$')) {
    const [, salt, expectedHash] = stored.split('$');
    if (!salt || !expectedHash) return { ok: false, needsRehash: false };
    const actualHash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('base64url');
    return { ok: safeEqual(actualHash, expectedHash), needsRehash: false };
  }

  const sha256 = crypto.createHash('sha256').update(String(password)).digest('hex');
  if (/^[a-f0-9]{64}$/i.test(stored)) {
    return { ok: safeEqual(sha256, stored), needsRehash: true };
  }

  return { ok: safeEqual(String(password), stored), needsRehash: true };
}

function setSessionCookie(res, staff) {
  const now = Math.floor(Date.now() / 1000);
  const safeStaff = sanitizeStaff(staff);
  const token = signJwtPayload({
    sub: safeStaff.maNV,
    tenNV: safeStaff.tenNV,
    role: safeStaff.role,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  });
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: 0 });
}

function loginKey(req, maNV) {
  return `${req.ip || req.socket?.remoteAddress || 'unknown'}:${String(maNV || '').toLowerCase()}`;
}

function isLoginLimited(req, maNV) {
  const key = loginKey(req, maNV);
  const now = Date.now();
  const recent = (loginAttempts.get(key) || []).filter((t) => now - t < LOGIN_WINDOW_MS);
  loginAttempts.set(key, recent);
  return recent.length >= LOGIN_MAX_ATTEMPTS;
}

function recordLoginFailure(req, maNV) {
  const key = loginKey(req, maNV);
  const now = Date.now();
  const recent = (loginAttempts.get(key) || []).filter((t) => now - t < LOGIN_WINDOW_MS);
  recent.push(now);
  loginAttempts.set(key, recent);
}

function clearLoginFailures(req, maNV) {
  loginAttempts.delete(loginKey(req, maNV));
}

async function findActiveStaff(maNV) {
  const db = await readDb();
  const list = db.nhanVien || [];
  const staff = list.find((x) => String(x.maNV).toLowerCase() === String(maNV).toLowerCase() && x.active !== false);
  return { db, staff };
}

async function authenticateStaff(req, res, maNV, password) {
  if (!maNV || !password) {
    return { ok: false, status: 400, message: 'Thiếu mã nhân viên hoặc mật khẩu.' };
  }
  if (isLoginLimited(req, maNV)) {
    return { ok: false, status: 429, message: 'Đăng nhập sai quá nhiều lần. Thử lại sau.' };
  }

  const { db, staff } = await findActiveStaff(maNV);
  const result = verifyPassword(password, staff?.matKhau);
  if (!staff || !result.ok) {
    recordLoginFailure(req, maNV);
    return { ok: false, status: 401, message: 'Mã nhân viên hoặc mật khẩu không đúng.' };
  }

  clearLoginFailures(req, maNV);
  if (result.needsRehash) {
    const idx = (db.nhanVien || []).findIndex((x) => String(x.maNV).toLowerCase() === String(maNV).toLowerCase());
    if (idx >= 0) {
      db.nhanVien[idx] = { ...db.nhanVien[idx], matKhau: hashPassword(password), updatedAt: new Date().toISOString() };
      await writeDb(db);
    }
  }

  setSessionCookie(res, staff);
  return { ok: true, staff: sanitizeStaff(staff) };
}

async function attachUser(req, res, next) {
  const token = parseCookies(req)[COOKIE_NAME];
  const payload = verifyJwt(token);
  if (!payload) return next();

  try {
    const { staff } = await findActiveStaff(payload.sub);
    if (!staff) return next();
    req.user = sanitizeStaff(staff);
    req.headers['x-nhan-vien'] = req.user.maNV;
  } catch {
    return next();
  }
  return next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Chưa đăng nhập.' } });
  }
  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Chưa đăng nhập.' } });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Không đủ quyền.' } });
    }
    return next();
  };
}

function ensureAuthState(db) {
  let changed = false;
  const bootstrapPassword = process.env.INITIAL_STAFF_PASSWORD || '';
  if (!Array.isArray(db.nhanVien)) db.nhanVien = [];

  db.nhanVien = db.nhanVien.map((staff, index) => {
    const role = getStaffRole(staff);
    const next = {
      ...staff,
      role,
      quyen: role,
      active: staff.active !== false,
    };
    if (!next.maNV) return next;
    if (next.maNV === 'admin' && bootstrapPassword) {
      const targetHash = hashPassword(bootstrapPassword);
      if (next.matKhau !== targetHash) {
        next.matKhau = targetHash;
        next.passwordBootstrappedAt = new Date().toISOString();
        changed = true;
      }
    } else if (!next.matKhau && bootstrapPassword) {
      next.matKhau = hashPassword(bootstrapPassword);
      next.passwordBootstrappedAt = new Date().toISOString();
      changed = true;
    }
    if ((staff.role || staff.quyen || 'staff') !== role || staff.quyen !== role || staff.role !== role) changed = true;
    if (index === 0 && !db.nhanVien.some((x) => getStaffRole(x) === 'admin' && x.active !== false)) {
      next.role = 'admin';
      next.quyen = 'admin';
      changed = true;
    }
    return next;
  });

  if (process.env.NODE_ENV === 'production') getAuthSecret();
  return changed;
}

export {
  COOKIE_NAME,
  authenticateStaff,
  attachUser,
  clearSessionCookie,
  ensureAuthState,
  getStaffRole,
  hashPassword,
  requireAuth,
  requireRole,
  sanitizeStaff,
  verifyPassword,
};

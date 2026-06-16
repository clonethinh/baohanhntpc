// Smoke test cho 3 endpoint mới (P0 verification).
// Chạy: node scripts/smoke-p0-endpoints.mjs
// Yêu cầu: server đang chạy, có admin credentials, PG online.
const BASE = process.env.API_BASE || 'http://localhost:8888/api';
const PWD = process.env.ADMIN_PASSWORD || 'NguyenTan123@';
const MA = process.env.ADMIN_USERNAME || 'admin';

const pass = { c: 0 };
const fail = { c: 0 };
function check(name, ok, detail = '') {
  if (ok) { pass.c++; console.log(`  ✓ ${name}`); }
  else { fail.c++; console.log(`  ✗ ${name} — ${detail}`); }
}

// Cookie jar for session auth (login uses httpOnly cookie)
let cookieJar = '';
async function call(path, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookieJar) headers.Cookie = cookieJar;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookieJar = setCookie.split(';')[0];
  let data;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, body: data };
}

async function main() {
  console.log(`P0 smoke test against ${BASE}\n`);

  // 1. Login
  let r = await call('/auth/login', 'POST', { maNV: MA, matKhau: PWD });
  check('login admin', r.status === 200 && r.body?.success,
    `status=${r.status} body=${JSON.stringify(r.body).slice(0, 200)}`);

  // 2. Pagination
  r = await call('/customers/list?page=1&limit=3');
  check('GET /customers/list paginated', r.body?.success && Array.isArray(r.body.data),
    `status=${r.status} body=${JSON.stringify(r.body).slice(0, 200)}`);
  if (r.body?.success) {
    const p = r.body.pagination;
    const s = r.body.summary;
    check('  pagination has {page, limit, total, totalPages}',
      p && ['page','limit','total','totalPages'].every(k => k in p));
    check('  summary has {total, warrantyCount, activeCount, doneCount}',
      s && ['total','warrantyCount','activeCount','doneCount'].every(k => k in s));
    check('  data.length <= limit', r.body.data.length <= p.limit);
    check('  first row maKhachHang starts with KH',
      r.body.data[0]?.maKhachHang?.startsWith('KH') ?? false);
    console.log(`    → ${s.total} customers, ${p.totalPages} pages, ${s.warrantyCount} warranties`);
  }

  // 3. Search + sort
  r = await call('/customers/list?page=1&limit=5&search=ng&sortBy=khachHang&sortOrder=asc');
  check('GET /customers/list search+sort', r.body?.success, `err=${r.body?.error?.message}`);

  // 4. Sort by totalWarranties desc
  r = await call('/customers/list?page=1&limit=5&sortBy=totalWarranties&sortOrder=desc');
  if (r.body?.success) {
    const counts = r.body.data.map(c => c.totalWarranties || 0);
    const isDesc = counts.every((v, i) => i === 0 || v <= counts[i - 1]);
    check('sort totalWarranties desc → giảm dần', isDesc, `counts=${counts}`);
  }

  console.log('\n=== ERROR CASES ===');
  r = await call('/customers/delete', 'POST', { key: '__nonexistent__' });
  check('DELETE non-existent → 404', r.status === 404);
  r = await call('/customers/restore', 'POST', { undoToken: 'fake-token' });
  check('RESTORE fake token → 404', r.status === 404);
  r = await call('/customers/restore', 'POST', {});
  check('RESTORE missing token → 400', r.status === 400);
  r = await call('/warranties/00000000-0000-0000-0000-000000000000/restore', 'POST');
  check('WARRANTY restore non-existent → 404', r.status === 404);
  r = await call('/nhan-vien/__nonexistent__/restore', 'POST');
  check('STAFF restore non-existent → 404', r.status === 404);

  console.log('\n=== CUSTOMER (full delete + restore cycle) ===');
  r = await call('/customers/list?page=1&limit=1');
  if (r.body?.success && r.body.data.length > 0) {
    const target = r.body.data[0];
    const targetKey = target.key;
    const targetName = target.khachHang || targetKey;
    console.log(`  Target: ${targetName}`);

    // Delete
    r = await call('/customers/delete', 'POST', { key: targetKey });
    check(`DELETE ${targetName}`, r.status === 200 && r.body?.success,
      `status=${r.status} body=${JSON.stringify(r.body).slice(0, 200)}`);
    const undoToken = r.body?.data?.undoToken;
    check('  undoToken is 36-char UUID',
      typeof undoToken === 'string' && undoToken.length === 36);

    // Verify gone
    r = await call('/customers/list?page=1&limit=100');
    check('  customer removed from list',
      !r.body.data.some(c => c.key === targetKey));

    // Restore
    r = await call('/customers/restore', 'POST', { undoToken });
    check('RESTORE → 200 (BUG FIX VERIFIED)', r.status === 200 && r.body?.success,
      `status=${r.status} body=${JSON.stringify(r.body).slice(0, 200)}`);
    if (r.body?.success) {
      check('  restoredCustomer=1', r.body.data.restoredCustomer === 1);
      check('  reattachedWarranties is number',
        typeof r.body.data.reattachedWarranties === 'number');
      r = await call('/customers/list?page=1&limit=100');
      check('  customer back in list',
        r.body.data.some(c => c.key === targetKey));
    }

    // Single-use
    r = await call('/customers/restore', 'POST', { undoToken });
    check('  reuse same token → 404 (single-use)', r.status === 404);
  }

  console.log('\n=== WARRANTY (soft delete + restore) ===');
  r = await call('/warranties?page=1&limit=2');
  const wRow = r.body?.data?.rows?.[0];
  if (wRow) {
    const wid = wRow.id;
    const soct = wRow.soChungTu || wid;
    r = await call(`/warranties/${wid}`, 'DELETE');
    check(`DELETE phiếu ${soct} → 200`, r.status === 200);
    r = await call(`/warranties/${wid}/restore`, 'POST');
    check(`RESTORE phiếu ${soct} → 200`, r.status === 200);
    if (r.body?.success) {
      const lastAction = r.body.data?.history?.slice(-1)?.[0]?.action;
      check('  history[-1].action = restore', lastAction === 'restore', `got: ${lastAction}`);
    }
  }

  console.log('\n=== STAFF (soft delete + restore) ===');
  r = await call('/nhan-vien');
  const staff = r.body?.data?.find(s => s.role !== 'admin' && s.active);
  if (staff) {
    const ma = staff.maNV;
    r = await call(`/nhan-vien/${ma}`, 'DELETE');
    check(`DELETE staff ${ma} → 200`, r.status === 200);
    r = await call(`/nhan-vien/${ma}/restore`, 'POST');
    check(`RESTORE staff ${ma} → 200`, r.status === 200);
    if (r.body?.success) {
      check('  staff active=True', r.body.data.active === true);
      r = await call(`/nhan-vien/${ma}/restore`, 'POST');
      check('  restore again → 409', r.status === 409);
    }
  }

  console.log(`\n${pass.c} pass, ${fail.c} fail`);
  process.exit(fail.c > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });

import dayjs from 'dayjs';

function makeCustomerKey(khachHang = '', soDienThoai = '') {
  return `${String(khachHang || '').trim().toLowerCase()}|${String(soDienThoai || '').trim()}`;
}

function buildCustomerMasterFromWarranties(warranties = [], existing = []) {
  const map = new Map((existing || []).map((c) => [c.key, c]));
  for (const w of warranties || []) {
    const name = String(w.khachHang || '').trim();
    const phone = String(w.soDienThoai || '').trim();
    if (!name) continue;
    const key = makeCustomerKey(name, phone);
    const nowAt = w.updatedAt || w.ngayNhan || w.createdAt || dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        key,
        khachHang: name,
        soDienThoai: phone,
        diaChi: String(w.diaChi || '').trim(),
        createdAt: nowAt,
        updatedAt: nowAt,
        lastSeenAt: nowAt,
        isActive: true,
      });
      continue;
    }
    const prevSeen = new Date(prev.lastSeenAt || 0).getTime();
    const nextSeen = new Date(nowAt).getTime();
    map.set(key, {
      ...prev,
      khachHang: name || prev.khachHang,
      soDienThoai: phone,
      diaChi: String(w.diaChi || '').trim() || prev.diaChi,
      updatedAt: nowAt,
      lastSeenAt: Number.isFinite(nextSeen) && nextSeen >= prevSeen ? nowAt : prev.lastSeenAt,
      isActive: true,
    });
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0));
}

function upsertCustomer(customers = [], payload = {}) {
  const name = String(payload.khachHang || '').trim();
  if (!name) return customers;
  const phone = String(payload.soDienThoai || '').trim();
  const key = makeCustomerKey(name, phone);
  const now = payload.updatedAt || dayjs().format('YYYY-MM-DDTHH:mm:ss');
  const idx = (customers || []).findIndex((c) => c.key === key);
  if (idx < 0) {
    return [...(customers || []), {
      key,
      khachHang: name,
      soDienThoai: phone,
      diaChi: String(payload.diaChi || '').trim(),
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
      isActive: true,
    }];
  }
  const next = [...customers];
  next[idx] = {
    ...next[idx],
    khachHang: name,
    soDienThoai: phone,
    diaChi: String(payload.diaChi || '').trim() || next[idx].diaChi,
    updatedAt: now,
    lastSeenAt: now,
    isActive: true,
  };
  return next;
}

export { makeCustomerKey, buildCustomerMasterFromWarranties, upsertCustomer };

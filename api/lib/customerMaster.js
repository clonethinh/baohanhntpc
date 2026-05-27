import dayjs from 'dayjs';

function makeCustomerKey(khachHang = '', soDienThoai = '') {
  return `${String(khachHang || '').trim().toLowerCase()}|${String(soDienThoai || '').trim()}`;
}

function buildCustomerMasterFromWarranties(warranties = [], existing = []) {
  const map = new Map((existing || []).map((c) => [c.key, c]));
  
  // Tìm mã số lớn nhất trong danh sách khách hàng hiện tại
  let maxNum = 0;
  map.forEach((c) => {
    if (c.maKhachHang && c.maKhachHang.startsWith('KH')) {
      const num = parseInt(c.maKhachHang.substring(2), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });

  for (const w of warranties || []) {
    const name = String(w.khachHang || '').trim();
    const phone = String(w.soDienThoai || '').trim();
    if (!name) continue;
    const key = makeCustomerKey(name, phone);
    const nowAt = w.updatedAt || w.ngayNhan || w.createdAt || dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const prev = map.get(key);
    
    if (!prev) {
      maxNum += 1;
      const nextCode = `KH${String(maxNum).padStart(5, '0')}`;
      map.set(key, {
        key,
        maKhachHang: nextCode,
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
    
    let existingCode = prev.maKhachHang;
    if (!existingCode) {
      maxNum += 1;
      existingCode = `KH${String(maxNum).padStart(5, '0')}`;
    }

    map.set(key, {
      ...prev,
      maKhachHang: existingCode,
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
  
  // Tìm mã số lớn nhất trong danh sách khách hàng hiện có
  let maxNum = 0;
  (customers || []).forEach((c) => {
    if (c.maKhachHang && c.maKhachHang.startsWith('KH')) {
      const num = parseInt(c.maKhachHang.substring(2), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });

  if (idx < 0) {
    const nextCode = `KH${String(maxNum + 1).padStart(5, '0')}`;
    return [...(customers || []), {
      key,
      maKhachHang: nextCode,
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
  let existingCode = next[idx].maKhachHang;
  if (!existingCode) {
    existingCode = `KH${String(maxNum + 1).padStart(5, '0')}`;
  }
  
  next[idx] = {
    ...next[idx],
    maKhachHang: existingCode,
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

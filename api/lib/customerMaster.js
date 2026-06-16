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

  // 3C-2 sanity check: phát hiện mã KH trùng giữa 2 KH khác nhau (vi phạm khoaMa)
  const codeToKey = new Map();
  for (const c of map.values()) {
    if (c.maKhachHang && c.khoaMa) {
      const existingKey = codeToKey.get(c.maKhachHang);
      if (existingKey && existingKey !== c.key) {
        console.warn(
          `[CUSTOMER-MASTER] Phát hiện mã KH "${c.maKhachHang}" bị gán cho 2 KH khác nhau: "${existingKey}" và "${c.key}". Cần review thủ công.`
        );
      } else {
        codeToKey.set(c.maKhachHang, c.key);
      }
    }
  }

  // Bonus 2 (3C-2 enforce): helper sinh mã KH mới, skip nếu đã bị chiếm bởi KH khác với khoaMa
  // Map được key theo customer key (name|phone), KHÔNG phải maKhachHang
  // → cần iterate values() để tìm entry có maKhachHang trùng với candidate
  function isCodeTakenByDifferentKey(currentMap, candidate, ownerKey) {
    for (const c of currentMap.values()) {
      if (c.maKhachHang === candidate && c.key !== ownerKey) return c;
    }
    return null;
  }
  function nextUniqueCode(currentMap, usedMaxNum, ownerKey) {
    let n = usedMaxNum + 1;
    while (n < 100000) { // safety cap 100k
      const candidate = `KH${String(n).padStart(5, '0')}`;
      const holder = isCodeTakenByDifferentKey(currentMap, candidate, ownerKey);
      if (!holder) {
        return { code: candidate, num: n };
      }
      console.warn(
        `[CUSTOMER-MASTER] Mã "${candidate}" bị chiếm bởi KH khác (key="${holder.key}"), skip sang mã tiếp theo.`
      );
      n++;
    }
    // fallback: không nên xảy ra
    throw new Error(`Không thể sinh mã KH mới (đã thử tới ${n})`);
  }

  for (const w of warranties || []) {
    const name = String(w.khachHang || '').trim();
    const phone = String(w.soDienThoai || '').trim();
    if (!name) continue;
    const key = makeCustomerKey(name, phone);
    const nowAt = w.updatedAt || w.ngayNhan || w.createdAt || dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const prev = map.get(key);

    if (!prev) {
      const { code: nextCode, num: usedNum } = nextUniqueCode(map, maxNum, key);
      maxNum = usedNum;
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
        khoaMa: true, // KHÓA mã KH vĩnh viễn sau khi được cấp (không reuse khi xoá)
      });
      continue;
    }

    const prevSeen = new Date(prev.lastSeenAt || 0).getTime();
    const nextSeen = new Date(nowAt).getTime();

    // Nếu KH đã có mã nhưng chưa khoá (legacy data), khoá luôn để đồng bộ
    let existingCode = prev.maKhachHang;
    if (!existingCode) {
      const { code: newCode, num: usedNum } = nextUniqueCode(map, maxNum, key);
      maxNum = usedNum;
      existingCode = newCode;
    }

    map.set(key, {
      ...prev,
      maKhachHang: existingCode,
      khoaMa: true, // đảm bảo legacy data đã có mã cũng được khoá khi rebuild master
      khachHang: name || prev.khachHang,
      soDienThoai: phone,
      diaChi: String(w.diaChi || '').trim() || prev.diaChi,
      updatedAt: nowAt,
      lastSeenAt: Number.isFinite(nextSeen) && nextSeen >= prevSeen ? nowAt : prev.lastSeenAt,
      isActive: prev.isActive !== false, // Bonus 4: preserve isActive từ prev (không force true)
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
      khoaMa: true, // KHÓA mã KH vĩnh viễn
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
    khoaMa: true, // đảm bảo legacy data cũng được khoá
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

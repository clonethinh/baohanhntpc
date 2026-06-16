function makeCustomerKey(khachHang = '', soDienThoai = '') {
  return `${String(khachHang || '').trim().toLowerCase()}|${String(soDienThoai || '').trim()}`;
}

function getWarrantyCustomerKey(warranty) {
  return makeCustomerKey(warranty?.khachHang, warranty?.soDienThoai);
}

function hasCustomer(warranty) {
  return Boolean(String(warranty?.khachHang || '').trim());
}

function aggregateCustomerStats(warranties = []) {
  const active = warranties.filter((w) => !w.deletedAt && hasCustomer(w));
  const map = new Map();

  active.forEach((w) => {
    const key = getWarrantyCustomerKey(w);
    const existing = map.get(key);
    const row = {
      key,
      khachHang: w.khachHang || '',
      soDienThoai: w.soDienThoai || '',
      diaChi: w.diaChi || '',
      lastNgayNhan: w.ngayNhan || w.updatedAt || w.createdAt || '',
      totalWarranties: 1,
      dangXuLyCount: ['dang_xu_ly', 'cho_xu_ly', 'cho_lien_he'].includes(w.trangThai) ? 1 : 0,
      daTraCount: w.trangThai === 'da_tra' ? 1 : 0,
      huyCount: w.trangThai === 'huy' ? 1 : 0,
    };

    if (!existing) {
      map.set(key, row);
      return;
    }

    existing.totalWarranties += 1;
    existing.dangXuLyCount += row.dangXuLyCount;
    existing.daTraCount += row.daTraCount;
    existing.huyCount += row.huyCount;
    const exTime = new Date(existing.lastNgayNhan || 0).getTime();
    const newTime = new Date(row.lastNgayNhan || 0).getTime();
    if (newTime >= exTime) {
      existing.lastNgayNhan = row.lastNgayNhan;
      existing.diaChi = row.diaChi || existing.diaChi;
      existing.khachHang = row.khachHang || existing.khachHang;
      existing.soDienThoai = row.soDienThoai || existing.soDienThoai;
    }
  });

  return map;
}

function getCustomerRows(warranties = [], customers = []) {
  const statsMap = aggregateCustomerStats(warranties);
  const rows = [];

  (customers || []).forEach((c) => {
    if (!c || !c.key || !String(c.khachHang || '').trim()) return;
    const stat = statsMap.get(c.key);
    rows.push({
      key: c.key,
      maKhachHang: c.maKhachHang || '',
      khachHang: c.khachHang || '',
      soDienThoai: c.soDienThoai || '',
      diaChi: c.diaChi || '',
      khoaMa: c.khoaMa === true, // expose khoaMa flag cho frontend
      isActive: c.isActive !== false, // Bonus 3: expose isActive (frontend hiển thị "(inactive)" nếu false)
      lastNgayNhan: stat?.lastNgayNhan || c.lastSeenAt || c.updatedAt || c.createdAt || '',
      totalWarranties: stat?.totalWarranties || 0,
      dangXuLyCount: stat?.dangXuLyCount || 0,
      daTraCount: stat?.daTraCount || 0,
      huyCount: stat?.huyCount || 0,
    });
  });

  statsMap.forEach((stat, key) => {
    if (!rows.some((r) => r.key === key)) {
      rows.push({ ...stat, khoaMa: false, isActive: true }); // KH mới từ aggregate (chưa được cấp mã) — mặc định active
    }
  });

  // Tìm mã khách hàng số lớn nhất hiện tại
  let maxNum = 0;
  rows.forEach((r) => {
    if (r.maKhachHang && r.maKhachHang.startsWith('KH')) {
      const num = parseInt(r.maKhachHang.substring(2), 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  // Gán mã tuần tự tăng dần ổn định cho những khách hàng chưa có mã
  // Đồng thời khoá luôn (khoaMa=true) vì mã đã được cấp — không reuse nếu sau này bị xoá
  rows.forEach((r) => {
    if (!r.maKhachHang) {
      maxNum += 1;
      r.maKhachHang = `KH${String(maxNum).padStart(5, '0')}`;
    }
    if (r.maKhachHang) {
      r.khoaMa = true; // mọi KH có mã đều khoá (khoaMa = true)
    }
  });

  return rows.sort((a, b) => new Date(b.lastNgayNhan || 0).getTime() - new Date(a.lastNgayNhan || 0).getTime());
}

function buildCustomerNameSuggestions(customers = [], q = '') {
  const query = String(q || '').toLowerCase();
  const names = new Set();
  (customers || []).forEach((c) => {
    const name = String(c?.khachHang || '').trim();
    if (!name) return;
    if (!query || name.toLowerCase().includes(query)) names.add(name);
  });
  return [...names].slice(0, 10);
}

function findCustomerByQuery(customers = [], q = '') {
  const query = String(q || '').trim().toLowerCase();
  if (!query) return null;
  const byName = (customers || []).filter((c) => String(c?.khachHang || '').toLowerCase().includes(query));
  if (byName.length) return byName[0];
  const byPhone = (customers || []).filter((c) => String(c?.soDienThoai || '').includes(q));
  return byPhone[0] || null;
}

function findCustomerByKey(customers = [], key = '') {
  const target = String(key || '').trim();
  return (customers || []).find((c) => String(c?.key || '') === target) || null;
}

function customerLabel(customer = {}) {
  const name = String(customer.khachHang || '').trim() || 'Chưa có khách hàng';
  const phone = String(customer.soDienThoai || '').trim();
  return phone ? `${name} - ${phone}` : name;
}

export {
  makeCustomerKey,
  getWarrantyCustomerKey,
  hasCustomer,
  getCustomerRows,
  buildCustomerNameSuggestions,
  findCustomerByQuery,
  findCustomerByKey,
  customerLabel,
};

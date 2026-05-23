function makeCustomerKey(khachHang = '', soDienThoai = '') {
  return `${String(khachHang || '').trim().toLowerCase()}|${String(soDienThoai || '').trim()}`;
}

function getWarrantyCustomerKey(warranty) {
  return makeCustomerKey(warranty?.khachHang, warranty?.soDienThoai);
}

function hasCustomer(warranty) {
  return Boolean(String(warranty?.khachHang || '').trim());
}

function getCustomerRows(warranties = []) {
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

  return Array.from(map.values())
    .sort((a, b) => new Date(b.lastNgayNhan).getTime() - new Date(a.lastNgayNhan).getTime())
    .map((row, index) => ({
      maKhachHang: `KH${String(index + 1).padStart(5, '0')}`,
      ...row,
    }));
}

function customerLabel(customer = {}) {
  const name = String(customer.khachHang || '').trim() || 'Chưa có khách hàng';
  const phone = String(customer.soDienThoai || '').trim();
  return phone ? `${name} - ${phone}` : name;
}

export { makeCustomerKey, getWarrantyCustomerKey, hasCustomer, getCustomerRows, customerLabel };

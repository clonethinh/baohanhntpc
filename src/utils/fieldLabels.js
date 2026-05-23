const FIELD_LABELS = {
  soChungTu: 'Số chứng từ',
  khachHang: 'Khách hàng',
  tenKhach: 'Tên khách hàng',
  soDienThoai: 'Số điện thoại',
  sdt: 'Số điện thoại',
  diaChi: 'Địa chỉ',
  tenHang: 'Tên hàng',
  tenSanPham: 'Tên sản phẩm',
  sanPham: 'Sản phẩm',
  soSeri: 'Số seri',
  serial: 'Serial',
  imei: 'IMEI',
  cauHinh: 'Cấu hình',
  loiLucNhan: 'Lỗi lúc nhận',
  phuKien: 'Phụ kiện',
  chiPhi: 'Chi phí',
  baoHanh: 'Bảo hành',
  loaiXuLy: 'Loại xử lý',
  ghiChu: 'Ghi chú',
  ngayMua: 'Ngày mua',
  ngayNhan: 'Ngày nhận',
  ngayHenTra: 'Ngày hẹn trả',
  ngayTra: 'Ngày trả',
  ngayTraThucTe: 'Ngày trả thực tế',
  maNhanVien: 'Nhân viên',
  nhanVien: 'Nhân viên',
  trangThai: 'Trạng thái',
  uuTien: 'Ưu tiên',
  attachments: 'Ảnh đính kèm',
  henTra: 'Hẹn trả',
};

export function getFieldLabel(field, fallback = field) {
  if (!field) return fallback;
  return FIELD_LABELS[field] || fallback;
}

export function getFieldLabels(fields = []) {
  return fields.reduce((labels, field) => {
    labels[field] = getFieldLabel(field);
    return labels;
  }, {});
}

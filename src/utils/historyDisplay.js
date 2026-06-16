export function normalizeHistoryNote(text) {
  return String(text || '')
    .replaceAll('loaiXuLy:', 'Loại xử lý:')
    .replaceAll('soSeri:', 'Số seri:')
    .replaceAll('soSeri :', 'Số seri:')
    .replaceAll('bao_hanh', 'Bảo hành')
    .replaceAll('sua_dv', 'Sửa dịch vụ')
    .replaceAll('Sửa DV', 'Sửa dịch vụ')
    .replaceAll('tra_bao_hanh', 'Trả bảo hành');
}

export function mapLoaiXuLyValue(raw) {
  const key = String(raw || '').trim();
  const map = {
    bao_hanh: 'Bảo hành',
    sua_dv: 'Sửa dịch vụ',
    tra_bao_hanh: 'Trả bảo hành',
  };
  return map[key] || key;
}

import * as XLSX from 'xlsx';
import dayjs from 'dayjs';

export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        resolve(jsonData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Không đọc được file'));
    reader.readAsArrayBuffer(file);
  });
}

function parseDateValue(val) {
  if (!val || val === '') return '';
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return dayjs(date).format('YYYY-MM-DD') + 'T' + dayjs().format('HH:mm:ss');
  }
  const str = String(val).trim();
  const match = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (match) {
    const [, day, month, year, hour, minute] = match;
    if (hour && minute) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:00`;
    }
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${dayjs().format('HH:mm:ss')}`;
  }
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) return dayjs(dt).format('YYYY-MM-DD') + 'T' + dayjs().format('HH:mm:ss');
  return str;
}

export function mapExcelRows(rawRows) {
  if (!rawRows || rawRows.length < 2) return [];

  const firstRow = rawRows[0];
  const hasHeaders = firstRow.some(cell => {
    const s = String(cell || '').toLowerCase().trim();
    return s.includes('chungtu') || s.includes('khach') || s.includes('tenhang') || s.includes('seri');
  });
  const dataRows = hasHeaders ? rawRows.slice(1) : rawRows;

  const records = [];
  let current = null;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || row.every(c => c === '' || c == null)) continue;

    const stt = row[0];
    const hasStt = stt !== '' && stt != null && !isNaN(Number(stt));
    const hasDate = row[1] !== '' && row[1] != null;

    if (hasStt && hasDate) {
      if (current) records.push(current);
      current = {
        stt: Number(stt),
        ngayNhan: parseDateValue(row[1]),
        maNhanVien: String(row[2] || 'admin').trim(),
        soChungTu: String(row[3] || '').trim(),
        khachHang: String(row[4] || '').trim(),
        tenHang: '',
        soSeri: '',
        cauHinh: '',
        loiLucNhan: '',
        phuKien: '',
        chiPhi: 0,
        baoHanh: '',
        ghiChu: '',
        ngayMua: '',
        ngayHenTra: '',
        ngayTra: null,
        trangThai: 'dang_xu_ly',
      };
    } else if (current) {
      if (!current.tenHang) current.tenHang = String(row[5] || '').trim();
      if (!current.soSeri) current.soSeri = String(row[6] || '').trim();
      if (!current.cauHinh) current.cauHinh = String(row[7] || '').trim();
      if (!current.loiLucNhan) current.loiLucNhan = String(row[8] || '').trim();
      if (!current.phuKien) current.phuKien = String(row[9] || '').trim();
      if (!current.chiPhi && row[10]) current.chiPhi = parseInt(row[10]) || 0;
      if (!current.baoHanh) current.baoHanh = String(row[11] || '').trim();
      if (!current.ghiChu) current.ghiChu = String(row[12] || '').trim();
      if (!current.ngayMua && row[13]) current.ngayMua = parseDateValue(row[13]);
      if (!current.ngayHenTra && row[14]) current.ngayHenTra = parseDateValue(row[14]);

      // Column 15 (Ngày Trả) contains "---Đã trả---" marker
      const ngayTraRaw = row[15];
      if (ngayTraRaw && String(ngayTraRaw).includes('Đã trả')) {
        current.trangThai = 'da_tra';
      } else if (ngayTraRaw && ngayTraRaw !== '' && ngayTraRaw != null) {
        current.ngayTra = parseDateValue(ngayTraRaw);
        current.trangThai = 'da_tra';
      }

      // Column 16 (Trả Hàng) also check as fallback
      if (row[16]) {
        const tra = String(row[16]).trim();
        if (tra.includes('Đã trả') || tra.includes('da_tra')) current.trangThai = 'da_tra';
      }

      // Column 17 (Trạng Thái) - read status directly from Excel if available
      if (row[17]) {
        const statusVal = String(row[17]).trim().toLowerCase();
        if (statusVal.includes('đã trả') || statusVal.includes('xong') || statusVal === 'da_tra') {
          current.trangThai = 'da_tra';
        } else if (statusVal.includes('hủy') || statusVal === 'huy') {
          current.trangThai = 'huy';
        } else if (statusVal.includes('đang xử') || statusVal === 'dang_xu_ly' || statusVal.includes('chờ liên')) {
          current.trangThai = 'dang_xu_ly';
        } else if (statusVal.includes('đã nhận') || statusVal === 'da_nhan' || statusVal.includes('chờ xử')) {
          current.trangThai = 'da_nhan';
        }
      }
    }
  }

  if (current) records.push(current);

  return records.map(r => ({
    ...r,
    tenHang: r.tenHang || 'Chưa có',
    soSeri: r.soSeri || 'Chưa có',
    loiLucNhan: r.loiLucNhan || 'Chưa mô tả',
    baoHanh: r.baoHanh || '12 tháng',
    ngayHenTra: r.ngayHenTra || '',
  }));
}

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/vi';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('vi');

export function formatDate(dateStr, format = 'DD/MM/YYYY') {
  if (!dateStr || dateStr === 'none') return '-';
  const d = dayjs(dateStr);
  return d.isValid() ? d.tz('Asia/Ho_Chi_Minh').format(format) : '-';
}

export function formatDateTime(dateStr) {
  if (!dateStr || dateStr === 'none') return '-';
  const d = dayjs(dateStr);
  return d.isValid() ? d.tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY HH:mm') : '-';
}

export function parseExcelDate(serial) {
  if (typeof serial === 'string') {
    const parts = serial.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return serial;
  }
  if (typeof serial === 'number') {
    const date = new Date((serial - 25569) * 86400000);
    return dayjs(date).format('YYYY-MM-DD');
  }
  return '';
}

export function addBusinessDaysSkipSunday(startDate, businessDays = 14) {
  let date = dayjs(startDate);
  let added = 0;

  while (added < businessDays) {
    date = date.add(1, 'day');
    if (date.day() !== 0) added += 1;
  }

  return date.format('YYYY-MM-DD');
}

export function getWarrantyDueDate(warranty) {
  if (warranty?.ngayHenTra && warranty.ngayHenTra !== 'none') return warranty.ngayHenTra;
  if (warranty?.ngayNhan) return addBusinessDaysSkipSunday(warranty.ngayNhan, 14);
  return '';
}

export function shouldShowDueDate(warranty) {
  return warranty?.trangThai !== 'da_tra' && warranty?.trangThai !== 'huy' && warranty?.ngayHenTra !== 'none';
}

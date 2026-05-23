import dayjs from 'dayjs';
import { getWarrantyDueDate } from './dateHelpers';

export function getUrgency(warranty) {
  if (warranty.trangThai === 'da_tra' || warranty.trangThai === 'huy') return 'done';
  const dueDate = getWarrantyDueDate(warranty);
  if (!dueDate) return 'normal';
  const diff = dayjs(dueDate).diff(dayjs(), 'day');
  if (diff < 0) return 'overdue';
  if (diff <= 3) return 'urgent';
  if (diff <= 7) return 'soon';
  return 'normal';
}

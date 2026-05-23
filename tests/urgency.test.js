import { describe, it, expect } from 'vitest';
import { getUrgency } from '../src/utils/urgency';
import dayjs from 'dayjs';

describe('getUrgency', () => {
  it('returns done when trangThai is da_tra', () => {
    const w = { trangThai: 'da_tra', ngayHenTra: dayjs().subtract(5, 'day').format('YYYY-MM-DD') };
    expect(getUrgency(w)).toBe('done');
  });

  it('returns done when trangThai is huy', () => {
    const w = { trangThai: 'huy', ngayHenTra: dayjs().subtract(5, 'day').format('YYYY-MM-DD') };
    expect(getUrgency(w)).toBe('done');
  });

  it('returns overdue when past date and not done', () => {
    const w = { trangThai: 'dang_xu_ly', ngayHenTra: dayjs().subtract(5, 'day').format('YYYY-MM-DD') };
    expect(getUrgency(w)).toBe('overdue');
  });

  it('returns urgent when <= 3 days', () => {
    const w = { trangThai: 'dang_xu_ly', ngayHenTra: dayjs().add(2, 'day').format('YYYY-MM-DD') };
    expect(getUrgency(w)).toBe('urgent');
  });

  it('returns normal when > 3 days', () => {
    const w = { trangThai: 'dang_xu_ly', ngayHenTra: dayjs().add(10, 'day').format('YYYY-MM-DD') };
    expect(getUrgency(w)).toBe('normal');
  });

  it('returns normal when no ngayHenTra', () => {
    const w = { trangThai: 'dang_xu_ly', ngayHenTra: null };
    expect(getUrgency(w)).toBe('normal');
  });
});

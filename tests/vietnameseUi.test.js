import { describe, expect, it } from 'vitest';
import { antdLightTheme } from '../src/theme/antdTheme';
import { normalizeHistoryText } from '../src/components/warranty/WarrantyDetail';
import { normalizeVietnameseText } from '../src/utils/vietnameseText';

describe('Vietnamese UI', () => {
  const legacy = (escaped) => JSON.parse(`"${escaped}"`);

  it('uses a font stack that prioritizes Vietnamese-capable system fonts', () => {
    expect(antdLightTheme.token.fontFamily).toBe('"Segoe UI", Arial, Tahoma, "Noto Sans", "DejaVu Sans", sans-serif');
  });

  it('normalizes legacy history text to valid Vietnamese', () => {
    expect(normalizeHistoryText('Import t? Excel')).toBe('Import từ Excel');
    expect(normalizeHistoryText(legacy('Import t\\ufffd Excel'))).toBe('Import từ Excel');
    expect(normalizeHistoryText('Xoa mem')).toBe('Xóa mềm');
    expect(normalizeHistoryText('Da gui bao hanh NCC: ABC')).toBe('Đã gửi bảo hành nhà cung cấp: ABC');
    expect(normalizeHistoryText('Da nhan lai tu nha cung cap: ABC')).toBe('Đã nhận lại từ nhà cung cấp: ABC');
    expect(normalizeHistoryText('Ðánh d?u uu tiên')).toBe('Đánh dấu ưu tiên');
    expect(normalizeHistoryText('Bo uu tien')).toBe('Bỏ ưu tiên');
  });

  it('uses the shared Vietnamese normalizer for mojibake variants', () => {
    expect(normalizeVietnameseText('Da gui bao hanh nha cung cap: ABC')).toBe('Đã gửi bảo hành nhà cung cấp: ABC');
    expect(normalizeVietnameseText('Ðã nh?n l?i t? nhà cung c?p: ABC')).toBe('Đã nhận lại từ nhà cung cấp: ABC');
  });
});

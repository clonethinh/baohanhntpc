import { describe, expect, it } from 'vitest';
import { formatHistoryChanges } from '../src/utils/historyTimeline.js';
import { getFieldLabel } from '../src/utils/fieldLabels.js';

describe('field labels smoke', () => {
  it('uses i18n field labels with safe fallback', () => {
    expect(getFieldLabel('khachHang')).toBe('Khách hàng');
    expect(getFieldLabel('maNhanVien')).toBe('Nhân viên');
    expect(getFieldLabel('unknownField')).toBe('unknownField');
  });

  it('formats history changes without crashing', () => {
    const output = formatHistoryChanges({
      khachHang: { from: 'A', to: 'B' },
      maNhanVien: { from: 'NV1', to: 'NV2' },
      unknownField: { from: 'x', to: 'y' },
    });

    expect(output).toContain('Khách hàng: A → B');
    expect(output).toContain('Nhân viên: NV1 → NV2');
    expect(output).toContain('unknownField: x → y');
  });
});

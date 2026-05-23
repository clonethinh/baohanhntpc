import { describe, expect, it } from 'vitest';
import i18n from '../src/i18n/index';

describe('i18n setup', () => {
  it('uses Vietnamese as the default and fallback language', () => {
    expect(i18n.language).toBe('vi');
    expect(i18n.options.fallbackLng).toEqual(['vi']);
  });

  it('loads core namespaces', () => {
    expect(i18n.t('button.luu')).toBe('Lưu');
    expect(i18n.t('status:trangThai.dang_xu_ly')).toBe('Đang xử lý');
    expect(i18n.t('validation:khachHangBatBuoc')).toBe('Khách hàng không được để trống');
    expect(i18n.t('nav:page.dashboard')).toBe('Tổng quan');
  });

  it('supports interpolation', () => {
    expect(i18n.t('messages:phieu.taoThanhCong', { so: 'ABC123' })).toBe('Phiếu ABC123 đã được tạo thành công');
  });

  it('backs constants and validation messages with i18n', async () => {
    const { STATUS_LABELS } = await import('../src/constants/statusConfig');
    const { LOAI_XU_LY_LABELS } = await import('../src/constants/warrantyOptions');
    const { warrantyFormSchema } = await import('../src/lib/zodSchemas');

    expect(STATUS_LABELS.dang_xu_ly).toBe(i18n.t('status:trangThai.dang_xu_ly'));
    expect(LOAI_XU_LY_LABELS.bao_hanh).toBe(i18n.t('status:loaiXuLy.bao_hanh'));

    const parsed = warrantyFormSchema.safeParse({
      khachHang: '',
      tenHang: '',
      soSeri: '',
      loiLucNhan: '',
      baoHanh: '',
      ngayHenTra: '',
      maNhanVien: '',
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error.issues.map((issue) => issue.message)).toContain(i18n.t('validation:khachHangBatBuoc'));
  });
});

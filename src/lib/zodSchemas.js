import { z } from 'zod';
import i18n from '../i18n/index.js';

const t = (key) => i18n.t(key, { ns: 'validation' });

export const warrantyFormSchema = z.object({
  khachHang: z.string().min(1, t('khachHangBatBuoc')),
  soDienThoai: z.string().optional().default(''),
  diaChi: z.string().optional().default(''),
  loaiPhieu: z.enum(['nhan_bao_hanh', 'bien_nhan']).default('nhan_bao_hanh'),
  baoGiaSau: z.boolean().optional().default(false),
  tenHang: z.string().min(1, t('tenHangBatBuoc')),
  soSeri: z.string().min(1, t('soSeriBatBuoc')),
  cauHinh: z.string().optional().default(''),
  loiLucNhan: z.string().min(1, t('loiLucNhanBatBuoc')),
  phuKien: z.string().optional().default(''),
  chiPhi: z.coerce.number().min(0, t('chiPhiKhongAm')).default(0),
  baoHanh: z.string().min(1, t('baoHanhBatBuoc')),
  loaiXuLy: z.enum(['bao_hanh', 'sua_dv', 'doi_moi', 'khac']).default('bao_hanh'),
  ghiChu: z.string().optional().default(''),
  ngayMua: z.string().optional().default(''),
  ngayHenTra: z.string().optional().default(''),
  maNhanVien: z.string().min(1, t('nhanVienBatBuoc')),
});

import z from 'zod';

const warrantySchema = z.object({
  khachHang: z.string().min(1, 'Khách hàng không được để trống'),
  soDienThoai: z.string().optional().default(''),
  diaChi: z.string().optional().default(''),
  tenHang: z.string().min(1, 'Tên hàng không được để trống'),
  soSeri: z.string().min(1, 'Số seri không được để trống'),
  cauHinh: z.string().optional().default(''),
  loiLucNhan: z.string().min(1, 'Lỗi lúc nhận không được để trống'),
  phuKien: z.string().optional().default(''),
  chiPhi: z.number().min(0, 'Chi phí phải >= 0').default(0),
  baoGiaSau: z.boolean().default(false),
  loaiPhieu: z.enum(['nhan_bao_hanh', 'bien_nhan']).default('nhan_bao_hanh'),
  baoHanh: z.string().min(1, 'Thời hạn bảo hành không được để trống'),
  loaiXuLy: z.enum(['bao_hanh', 'sua_dv', 'doi_moi', 'khac']).default('bao_hanh'),
  loaiXuLyKhac: z.string().optional().default(''),
  ghiChu: z.string().optional().default(''),
  ngayMua: z.string().optional().default(''),
  ngayHenTra: z.string().optional().default(''),
  maNhanVien: z.string().min(1, 'Nhân viên không được để trống'),
  trangThai: z.enum(['cho_xu_ly', 'dang_xu_ly', 'cho_lien_he', 'da_tra', 'huy']).default('dang_xu_ly'),
}).superRefine((data, ctx) => {
  if (data.loaiPhieu === 'bien_nhan' && !['sua_dv', 'khac'].includes(data.loaiXuLy)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['loaiXuLy'], message: 'Bien nhan chi ho tro "Sua dich vu" hoac "Khac".' });
  }
  if (data.loaiXuLy === 'khac' && !String(data.loaiXuLyKhac || '').trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['loaiXuLyKhac'], message: 'Nhap noi dung loai xu ly khac.' });
  }
});

const statusUpdateSchema = z.object({
  trangThai: z.enum(['cho_xu_ly', 'dang_xu_ly', 'cho_lien_he', 'da_tra', 'huy']),
  note: z.string().optional().default(''),
});

const traHangSchema = z.object({
  ngayTra: z.string().optional(),
  note: z.string().optional().default(''),
});

const exchangeReturnSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('doi_hang'),
    tenHangMoi: z.string().min(1, 'Tên sản phẩm đổi không được để trống'),
    soSeriMoi: z.string().min(1, 'Số serial mới không được để trống'),
    note: z.string().optional().default(''),
    attachmentsInput: z.array(z.object({
      dataUrl: z.string(),
      name: z.string().optional().default('image'),
      mime: z.string().optional().default('image/jpeg'),
      publicVisible: z.boolean().optional().default(true),
    })).optional().default([]),
  }),
  z.object({
    type: z.literal('tra_hang'),
    reason: z.string().min(1, 'Lý do trả hàng không được để trống'),
    note: z.string().optional().default(''),
    attachmentsInput: z.array(z.object({
      dataUrl: z.string(),
      name: z.string().optional().default('image'),
      mime: z.string().optional().default('image/jpeg'),
      publicVisible: z.boolean().optional().default(true),
    })).optional().default([]),
  }),
]);

const supplierSchema = z.object({
  code: z.string().trim().optional().default(''),
  name: z.string().trim().min(1, 'Ten nha cung cap khong duoc de trong'),
  phone: z.string().trim().optional().default(''),
  email: z.string().trim().optional().default(''),
  address: z.string().trim().optional().default(''),
  contactPerson: z.string().trim().optional().default(''),
  note: z.string().trim().optional().default(''),
  isActive: z.boolean().optional().default(true),
});

const supplierSendSchema = z.object({
  supplierId: z.string().min(1, 'Chon nha cung cap'),
  // YYYY-MM-DD
  sentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngay gui khong hop le'),
  // YYYY-MM-DD or empty
  expectedReturnAt: z.string().optional().default('').refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: 'Ngay hen nhan khong hop le',
  }),
  note: z.string().optional().default(''),
});

const supplierReturnSchema = z.object({
  returnedAt: z.string().min(1, 'Ngay nhan lai khong hop le'),
  note: z.string().optional().default(''),
});

export { warrantySchema, statusUpdateSchema, traHangSchema, exchangeReturnSchema, supplierSchema, supplierSendSchema, supplierReturnSchema };

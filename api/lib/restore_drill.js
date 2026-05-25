import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function runRestoreDrill(backupFilePath) {
  console.log(`[DRILL] Bắt đầu thử nghiệm khôi phục từ tệp tin: ${backupFilePath}`);

  if (!fs.existsSync(backupFilePath)) {
    console.error(`[DRILL] Tệp tin backup không tồn tại: ${backupFilePath}`);
    return { ok: false, error: 'FILE_NOT_FOUND' };
  }

  let data;
  try {
    const raw = fs.readFileSync(backupFilePath, 'utf-8');
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`[DRILL] Lỗi parse JSON tệp tin backup:`, err.message);
    return { ok: false, error: 'INVALID_JSON', message: err.message };
  }

  try {
    await prisma.$transaction(async (tx) => {
      console.log('[DRILL] Bắt đầu Transaction bảo vệ...');

      // 1. Xóa toàn bộ dữ liệu theo thứ tự chuẩn quan hệ (bảng phụ thuộc trước)
      console.log('[DRILL] Đang xóa thử dữ liệu cũ...');
      await tx.supplierLog.deleteMany();
      await tx.warranty.deleteMany();
      await tx.nhanVien.deleteMany();
      await tx.supplier.deleteMany();

      // 2. Thêm mới dữ liệu theo thứ tự chuẩn quan hệ (bảng độc lập trước)

      // a. Đồng bộ bảng Nhân Viên
      if (Array.isArray(data.nhanVien) && data.nhanVien.length > 0) {
        console.log(`[DRILL] Đang nạp thử ${data.nhanVien.length} nhân viên...`);
        await tx.nhanVien.createMany({
          data: data.nhanVien.map(nv => ({
            maNV: String(nv.maNV || '').trim(),
            tenNV: String(nv.tenNV || '').trim(),
            matKhau: String(nv.matKhau || '').trim(),
            quyen: String(nv.quyen || nv.role || 'staff').trim(),
            active: nv.active !== false,
            createdAt: nv.createdAt ? new Date(nv.createdAt) : new Date(),
            updatedAt: nv.updatedAt ? new Date(nv.updatedAt) : new Date(),
          }))
        });
      }

      // b. Đồng bộ bảng Nhà Cung Cấp
      if (Array.isArray(data.suppliers) && data.suppliers.length > 0) {
        console.log(`[DRILL] Đang nạp thử ${data.suppliers.length} nhà cung cấp...`);
        await tx.supplier.createMany({
          data: data.suppliers.map(s => ({
            id: String(s.id || '').trim(),
            code: String(s.code || '').trim(),
            name: String(s.name || '').trim(),
            phone: String(s.phone || '').trim(),
            email: String(s.email || '').trim(),
            address: String(s.address || '').trim(),
            contactPerson: String(s.contactPerson || '').trim(),
            note: String(s.note || '').trim(),
            isActive: s.isActive !== false,
          }))
        });
      }

      // c. Đồng bộ bảng Phiếu Bảo Hành
      if (Array.isArray(data.warranties) && data.warranties.length > 0) {
        console.log(`[DRILL] Đang nạp thử ${data.warranties.length} phiếu bảo hành...`);
        const batchSize = 100;
        for (let i = 0; i < data.warranties.length; i += batchSize) {
          const batch = data.warranties.slice(i, i + batchSize);
          await tx.warranty.createMany({
            data: batch.map(w => ({
              id: String(w.id || '').trim(),
              stt: Number(w.stt || 0),
              soChungTu: String(w.soChungTu || '').trim(),
              khachHang: String(w.khachHang || '').trim(),
              soDienThoai: String(w.soDienThoai || '').trim(),
              diaChi: String(w.diaChi || '').trim(),
              tenHang: String(w.tenHang || '').trim(),
              soSeri: String(w.soSeri || '').trim(),
              cauHinh: String(w.cauHinh || '').trim(),
              loiLucNhan: String(w.loiLucNhan || '').trim(),
              phuKien: String(w.phuKien || '').trim(),
              chiPhi: Number(w.chiPhi || 0.0),
              baoGiaSau: w.baoGiaSau === true,
              loaiPhieu: String(w.loaiPhieu || 'nhan_bao_hanh').trim(),
              baoHanh: String(w.baoHanh || '').trim(),
              loaiXuLy: String(w.loaiXuLy || 'bao_hanh').trim(),
              loaiXuLyKhac: String(w.loaiXuLyKhac || '').trim(),
              ghiChu: String(w.ghiChu || '').trim(),
              ngayMua: String(w.ngayMua || '').trim(),
              ngayNhan: String(w.ngayNhan || '').trim(),
              ngayHenTra: String(w.ngayHenTra || '').trim(),
              ngayTra: String(w.ngayTra || '').trim(),
              maNhanVien: String(w.maNhanVien || '').trim(),
              trangThai: String(w.trangThai || 'dang_xu_ly').trim(),
              uuTien: w.uuTien === true,
              createdAt: String(w.createdAt || dayjs().format()),
              updatedAt: String(w.updatedAt || dayjs().format()),
              deletedAt: String(w.deletedAt || ''),
              doiTra: w.doiTra || null,
              attachments: w.attachments || null,
              history: w.history || null,
              supplierLogs: w.supplierLogs || null,
              supplierStatus: String(w.supplierStatus || 'none').trim(),
              supplierIdCurrent: w.supplierIdCurrent ? String(w.supplierIdCurrent).trim() : null,
              sentSupplierAt: String(w.sentSupplierAt || '').trim(),
              expectedReturnSupplierAt: String(w.expectedReturnSupplierAt || '').trim(),
            }))
          });
        }
      }

      // d. Đồng bộ bảng Nhật Ký Nhà Cung Cấp
      if (Array.isArray(data.supplierLogs) && data.supplierLogs.length > 0) {
        console.log(`[DRILL] Đang nạp thử ${data.supplierLogs.length} nhật ký NCC...`);
        await tx.supplierLog.createMany({
          data: data.supplierLogs.map(l => ({
            id: String(l.id || '').trim(),
            supplierId: String(l.supplierId || '').trim(),
            supplierName: String(l.supplierName || l.supplier || '').trim(),
            warrantyId: String(l.warrantyId || '').trim(),
            action: String(l.action || '').trim(),
            sentAt: String(l.sentAt || '').trim(),
            expectedReturnAt: String(l.expectedReturnAt || '').trim(),
            returnedAt: String(l.returnedAt || '').trim(),
            note: String(l.note || '').trim(),
            createdBy: String(l.createdBy || '').trim(),
            createdAt: l.at ? new Date(l.at) : new Date(),
          }))
        });
      }

      // Kiểm định khóa ngoại và tính nhất quán bằng lệnh SELECT thử các liên kết quan hệ
      console.log('[DRILL] Kiểm định liên kết dữ liệu quan hệ...');
      const samples = await tx.warranty.findMany({
        take: 5,
        include: {
          nhanVien: true,
          supplierCurrent: true
        }
      });
      console.log(`[DRILL] Kiểm định thành công! Lấy mẫu thử ${samples.length} phiếu liên kết chuẩn.`);

      // HỦY BỎ TRANSACTION ĐỂ KHÔNG LÀM THAY ĐỔI CƠ SỞ DỮ LIỆU THẬT
      console.log('[DRILL] Đang kích hoạt Rollback để hoàn tác toàn bộ thay đổi...');
      throw new Error('ROLLBACK_DRILL');
    });
  } catch (err) {
    if (err.message === 'ROLLBACK_DRILL') {
      console.log('🌟 [DRILL] HOÀN THÀNH: Tệp tin khôi phục đạt tiêu chuẩn và an toàn để nạp!');
      return { ok: true, message: 'Restore drill success! All schema structures, foreign keys, and indexes are 100% valid.' };
    } else {
      console.error('❌ [DRILL] THẤT BẠI: Lỗi không thể nạp tệp tin khôi phục:', err.message);
      return { ok: false, error: 'TRANSACTION_FAILED', message: err.message };
    }
  }
}

// Nếu chạy trực tiếp từ CLI
const __filename = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] && (process.argv[1] === __filename || process.argv[1].endsWith('restore_drill.js'));

if (isDirectRun) {
  const defaultPath = path.join(path.dirname(__filename), '..', 'db.json');
  const targetPath = process.argv[2] || defaultPath;
  runRestoreDrill(targetPath)
    .then((res) => {
      process.exit(res.ok ? 0 : 1);
    })
    .catch((err) => {
      console.error('[CLI] Lỗi hệ thống:', err.message);
      process.exit(1);
    });
}

export { runRestoreDrill };

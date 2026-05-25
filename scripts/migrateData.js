// -------------------------------------------------------------
// SCRIPT DI CHUYỂN DỮ LIỆU TỪ TỆP JSON SANG POSTGRESQL (PRISMA)
// -------------------------------------------------------------

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'api', 'db.json');
const prisma = new PrismaClient();

// Hàm chuẩn hóa giá trị số (phòng khi dữ liệu JSON là chuỗi)
function parseNumber(val, defaultVal = 0) {
  if (val === null || val === undefined) return defaultVal;
  const num = Number(val);
  return Number.isFinite(num) ? num : defaultVal;
}

// Hàm chuẩn hóa giá trị Boolean
function parseBoolean(val, defaultVal = false) {
  if (val === null || val === undefined) return defaultVal;
  return Boolean(val);
}

// Hàm chuẩn hóa giá trị JSON (chuẩn bị lưu vào Postgres Json column)
function parseJson(val) {
  if (!val) return null;
  return val; // Prisma tự động serialize Object/Array thành JSON
}

async function runMigration() {
  console.log('🚀 Bắt đầu quá trình di chuyển dữ liệu từ file JSON sang PostgreSQL...');

  // 1. Kiểm tra sự tồn tại của file db.json
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Không tìm thấy file dữ liệu tại đường dẫn: ${DB_PATH}`);
    process.exit(1);
  }

  let dbData;
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    dbData = JSON.parse(raw);
  } catch (err) {
    console.error('❌ Lỗi đọc hoặc phân tích cú pháp tệp db.json:', err.message);
    process.exit(1);
  }

  const { nhanVien = [], suppliers = [], supplierLogs = [], warranties = [] } = dbData;

  console.log(`📋 Phát hiện:`);
  console.log(`   - Nhân viên: ${nhanVien.length} dòng`);
  console.log(`   - Nhà cung cấp: ${suppliers.length} dòng`);
  console.log(`   - Nhật ký gửi NCC: ${supplierLogs.length} dòng`);
  console.log(`   - Phiếu bảo hành: ${warranties.length} dòng`);

  try {
    // Kết nối đến CSDL
    await prisma.$connect();
    console.log('🔌 Kết nối thành công tới cơ sở dữ liệu PostgreSQL.');

    // 2. Di chuyển dữ liệu Nhân Viên (NhanVien)
    if (nhanVien.length > 0) {
      console.log('⏳ Đang di chuyển dữ liệu Nhân viên...');
      // Dọn sạch dữ liệu cũ trong bảng trước khi nạp để tránh trùng lặp
      await prisma.nhanVien.deleteMany();
      
      const nhanVienData = nhanVien.map(nv => ({
        maNV: String(nv.maNV || '').trim(),
        tenNV: String(nv.tenNV || '').trim(),
        matKhau: String(nv.matKhau || '').trim(),
        quyen: String(nv.quyen || 'staff').trim(),
        active: parseBoolean(nv.active, true),
        createdAt: nv.createdAt ? new Date(nv.createdAt) : new Date(),
        updatedAt: nv.updatedAt ? new Date(nv.updatedAt) : new Date(),
      }));

      await prisma.nhanVien.createMany({ data: nhanVienData });
      console.log('✅ Di chuyển dữ liệu Nhân viên THÀNH CÔNG.');
    }

    // 3. Di chuyển dữ liệu Nhà Cung Cấp (Supplier)
    if (suppliers.length > 0) {
      console.log('⏳ Đang di chuyển dữ liệu Nhà cung cấp...');
      await prisma.supplier.deleteMany();

      const supplierData = suppliers.map(s => ({
        id: String(s.id || '').trim(),
        code: String(s.code || '').trim(),
        name: String(s.name || '').trim(),
        phone: String(s.phone || '').trim(),
        email: String(s.email || '').trim(),
        address: String(s.address || '').trim(),
        contactPerson: String(s.contactPerson || '').trim(),
        note: String(s.note || '').trim(),
        isActive: parseBoolean(s.isActive, true),
      }));

      await prisma.supplier.createMany({ data: supplierData });
      console.log('✅ Di chuyển dữ liệu Nhà cung cấp THÀNH CÔNG.');
    }

    // 4. Di chuyển dữ liệu Nhật ký gửi NCC (SupplierLog)
    if (supplierLogs.length > 0) {
      console.log('⏳ Đang di chuyển dữ liệu Nhật ký gửi nhà cung cấp...');
      await prisma.supplierLog.deleteMany();

      const supplierLogData = supplierLogs.map(l => ({
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
      }));

      await prisma.supplierLog.createMany({ data: supplierLogData });
      console.log('✅ Di chuyển dữ liệu Nhật ký gửi nhà cung cấp THÀNH CÔNG.');
    }

    // 5. Di chuyển dữ liệu Phiếu Bảo Hành (Warranty)
    if (warranties.length > 0) {
      console.log('⏳ Đang di chuyển dữ liệu Phiếu bảo hành...');
      await prisma.warranty.deleteMany();

      // Chia nhỏ mảng để insert theo lô (batch insert) tránh quá tải Postgres query parameters (tối đa 32767 params)
      const batchSize = 100;
      for (let i = 0; i < warranties.length; i += batchSize) {
        const batch = warranties.slice(i, i + batchSize);
        const warrantyData = batch.map(w => ({
          id: String(w.id || '').trim(),
          stt: parseNumber(w.stt, 0),
          soChungTu: String(w.soChungTu || '').trim(),
          khachHang: String(w.khachHang || '').trim(),
          soDienThoai: String(w.soDienThoai || '').trim(),
          diaChi: String(w.diaChi || '').trim(),
          tenHang: String(w.tenHang || '').trim(),
          soSeri: String(w.soSeri || '').trim(),
          cauHinh: String(w.cauHinh || '').trim(),
          loiLucNhan: String(w.loiLucNhan || '').trim(),
          phuKien: String(w.phuKien || '').trim(),
          chiPhi: parseNumber(w.chiPhi, 0.0),
          baoGiaSau: parseBoolean(w.baoGiaSau, false),
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
          uuTien: parseBoolean(w.uuTien, false),
          createdAt: String(w.createdAt || new Date().toISOString()),
          updatedAt: String(w.updatedAt || new Date().toISOString()),
          deletedAt: String(w.deletedAt || ''),
          
          // Nạp các cấu phần JSON phức tạp nguyên vẹn
          doiTra: parseJson(w.doiTra),
          attachments: parseJson(w.attachments),
          history: parseJson(w.history),
          supplierLogs: parseJson(w.supplierLogs),

          // Trạng thái đồng bộ nhà cung cấp
          supplierStatus: String(w.supplierStatus || 'none').trim(),
          supplierIdCurrent: w.supplierIdCurrent ? String(w.supplierIdCurrent).trim() : null,
          sentSupplierAt: String(w.sentSupplierAt || '').trim(),
          expectedReturnSupplierAt: String(w.expectedReturnSupplierAt || '').trim(),
        }));

        await prisma.warranty.createMany({ data: warrantyData });
        console.log(`   - Đã nạp thành công ${Math.min(i + batchSize, warranties.length)} / ${warranties.length} phiếu.`);
      }
      console.log('✅ Di chuyển dữ liệu Phiếu bảo hành THÀNH CÔNG.');
    }

    console.log('🎉 QUÁ TRÌNH DI CHUYỂN DỮ LIỆU ĐÃ HOÀN THÀNH XUẤT SẮC 100%! Cơ sở dữ liệu PostgreSQL đã sẵn sàng.');

  } catch (err) {
    console.error('❌ Đã xảy ra lỗi nghiêm trọng trong quá trình di chuyển dữ liệu:', err);
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Đứt kết nối CSDL an toàn.');
  }
}

runMigration();

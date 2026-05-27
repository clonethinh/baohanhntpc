// -------------------------------------------------------------
// LỚP TRUY XUẤT CƠ SỞ DỮ LIỆU CHUYỂN ĐỔI: FILE JSON -> POSTGRESQL
// -------------------------------------------------------------

import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { fileURLToPath } from 'url';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Ho_Chi_Minh');
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'db.json');

// Khởi tạo Prisma Client để giao tiếp với PostgreSQL
const prisma = new PrismaClient();

function normalizeNhanVienRows(rows = []) {
  return rows.map((nv) => {
    const role = nv.role || nv.quyen || 'staff';
    return { ...nv, role, quyen: role };
  });
}

function normalizeSupplierLogs(logs = []) {
  return logs.map((log) => {
    if (log.at) return log;
    let atVal = '';
    const dateVal = log.createdAt || log.at;
    if (dateVal) {
      try {
        const d = dayjs(dateVal);
        if (d.isValid()) {
          atVal = d.format('YYYY-MM-DDTHH:mm:ss');
        }
      } catch {
        atVal = String(dateVal);
      }
    }
    return { ...log, at: atVal };
  });
}

function normalizeDbShape(data = {}) {
  return {
    ...data,
    nhanVien: normalizeNhanVienRows(data.nhanVien || []),
    supplierLogs: normalizeSupplierLogs(data.supplierLogs || []),
  };
}

/**
 * 1. Hàm readDb: Tái thiết lập định dạng CSDL cũ từ PostgreSQL để giữ tương thích ngược 100%
 */
async function readDb() {
  try {
    const [warranties, nhanVien, suppliers, supplierLogs] = await Promise.all([
      prisma.warranty.findMany({ orderBy: { stt: 'asc' } }),
      prisma.nhanVien.findMany({ orderBy: { maNV: 'asc' } }),
      prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
      prisma.supplierLog.findMany({ orderBy: { createdAt: 'desc' } }),
    ]);

    let adminConfig = null;
    let customers = [];
    if (fs.existsSync(DB_PATH)) {
      try {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        adminConfig = parsed.adminConfig || null;
        customers = parsed.customers || [];
      } catch { /* ignore */ }
    }

    // Trả về đối tượng khớp 100% với cấu trúc db.json cũ
    return {
      warranties,
      nhanVien: normalizeNhanVienRows(nhanVien),
      suppliers,
      supplierLogs: normalizeSupplierLogs(supplierLogs),
      adminConfig,
      customers
    };
  } catch (err) {
    console.error('[DB] Lỗi khi truy vấn dữ liệu từ PostgreSQL:', err.message);
    
    // Fallback trong trường hợp kết nối DB lỗi (phục vụ môi trường chạy thử chưa cấu hình DB)
    if (fs.existsSync(DB_PATH)) {
      try {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        return normalizeDbShape(JSON.parse(raw));
      } catch { /* ignore */ }
    }
    return { warranties: [], nhanVien: [], suppliers: [], supplierLogs: [], customers: [] };
  }
}

/**
 * 2. Hàm writeDb: Ghi đè toàn bộ dữ liệu CSDL PostgreSQL an toàn thông qua Transaction
 */
async function writeDb(data) {
  if (!data) return;

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Xóa toàn bộ dữ liệu theo thứ tự chuẩn quan hệ (bảng phụ thuộc trước)
      await tx.supplierLog.deleteMany();
      await tx.warranty.deleteMany();
      await tx.nhanVien.deleteMany();
      await tx.supplier.deleteMany();

      // 2. Thêm mới dữ liệu theo thứ tự chuẩn quan hệ (bảng độc lập trước)

      // a. Đồng bộ bảng Nhân Viên
      if (Array.isArray(data.nhanVien) && data.nhanVien.length > 0) {
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

      // c. Đồng bộ bảng Phiếu Bảo Hành (Batch insert đề phòng vượt giới hạn tham số Postgres)
      if (Array.isArray(data.warranties) && data.warranties.length > 0) {
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
              createdAt: String(w.createdAt || dayjs.tz().format()),
              updatedAt: String(w.updatedAt || dayjs.tz().format()),
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
    });

    // Đồng thời đồng bộ ra file db.json dự phòng ở ổ cứng
    try {
      const content = JSON.stringify(data, null, 2);
      fs.writeFileSync(DB_PATH, content, 'utf-8');
    } catch { /* ignore */ }

  } catch (err) {
    console.warn('[DB] Giao dịch ghi database PostgreSQL thất bại. Tự động chuyển hướng ghi file cục bộ db.json làm dự phòng. Lỗi:', err.message);
    
    // Ghi vào file JSON cục bộ làm phương án dự phòng khẩn cấp
    try {
      const content = JSON.stringify(data, null, 2);
      fs.writeFileSync(DB_PATH, content, 'utf-8');
    } catch (writeErr) {
      console.error('[DB] Không thể ghi file dự phòng cục bộ db.json:', writeErr.message);
      throw writeErr;
    }
  }
}

/**
 * 3. Hàm getCollection: Lấy danh sách bản ghi của một bảng cụ thể
 */
async function getCollection(name) {
  try {
    if (name === 'warranties') return await prisma.warranty.findMany({ orderBy: { stt: 'asc' } });
    if (name === 'nhanVien') return normalizeNhanVienRows(await prisma.nhanVien.findMany({ orderBy: { maNV: 'asc' } }));
    if (name === 'suppliers') return await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
    if (name === 'supplierLogs') return await prisma.supplierLog.findMany({ orderBy: { createdAt: 'desc' } });
    if (name === 'customers') {
      const db = await readDb();
      return db.customers || [];
    }
    return [];
  } catch (err) {
    console.error(`[DB] Lỗi truy vấn bảng ${name}:`, err.message);
    const db = await readDb();
    return db[name] || [];
  }
}

/**
 * 4. Hàm setCollection: Ghi đè toàn bộ bản ghi của một bảng cụ thể
 */
async function setCollection(name, data) {
  if (!Array.isArray(data)) return;
  const db = await readDb();
  db[name] = data;
  await writeDb(db);
}

/**
 * 5. Hàm addToCollection: Thêm mới 1 bản ghi vào bảng cụ thể
 */
async function addToCollection(name, item) {
  try {
    if (name === 'warranties') {
      const created = await prisma.warranty.create({
        data: {
          id: String(item.id || ''),
          stt: Number(item.stt || 0),
          soChungTu: String(item.soChungTu || ''),
          khachHang: String(item.khachHang || ''),
          soDienThoai: String(item.soDienThoai || ''),
          diaChi: String(item.diaChi || ''),
          tenHang: String(item.tenHang || ''),
          soSeri: String(item.soSeri || ''),
          cauHinh: String(item.cauHinh || ''),
          loiLucNhan: String(item.loiLucNhan || ''),
          phuKien: String(item.phuKien || ''),
          chiPhi: Number(item.chiPhi || 0.0),
          baoGiaSau: item.baoGiaSau === true,
          loaiPhieu: String(item.loaiPhieu || 'nhan_bao_hanh'),
          baoHanh: String(item.baoHanh || ''),
          loaiXuLy: String(item.loaiXuLy || 'bao_hanh'),
          loaiXuLyKhac: String(item.loaiXuLyKhac || ''),
          ghiChu: String(item.ghiChu || ''),
          ngayMua: String(item.ngayMua || ''),
          ngayNhan: String(item.ngayNhan || ''),
          ngayHenTra: String(item.ngayHenTra || ''),
          ngayTra: String(item.ngayTra || ''),
          maNhanVien: String(item.maNhanVien || ''),
          trangThai: String(item.trangThai || 'dang_xu_ly'),
          uuTien: item.uuTien === true,
          createdAt: String(item.createdAt || dayjs.tz().format()),
          updatedAt: String(item.updatedAt || dayjs.tz().format()),
          deletedAt: String(item.deletedAt || ''),
          doiTra: item.doiTra || null,
          attachments: item.attachments || null,
          history: item.history || null,
          supplierLogs: item.supplierLogs || null,
          supplierStatus: String(item.supplierStatus || 'none'),
          supplierIdCurrent: item.supplierIdCurrent ? String(item.supplierIdCurrent) : null,
          sentSupplierAt: String(item.sentSupplierAt || ''),
          expectedReturnSupplierAt: String(item.expectedReturnSupplierAt || ''),
        }
      });
      return created;
    } else if (name === 'nhanVien') {
      return await prisma.nhanVien.create({
        data: {
          maNV: String(item.maNV || '').trim(),
          tenNV: String(item.tenNV || '').trim(),
          matKhau: String(item.matKhau || '').trim(),
          quyen: String(item.quyen || item.role || 'staff').trim(),
          active: item.active !== false,
        }
      });
    } else if (name === 'suppliers') {
      return await prisma.supplier.create({
        data: {
          id: String(item.id || ''),
          code: String(item.code || ''),
          name: String(item.name || ''),
          phone: String(item.phone || ''),
          email: String(item.email || ''),
          address: String(item.address || ''),
          contactPerson: String(item.contactPerson || ''),
          note: String(item.note || ''),
          isActive: item.isActive !== false,
        }
      });
    } else if (name === 'supplierLogs') {
      return await prisma.supplierLog.create({
        data: {
          id: String(item.id || ''),
          supplierId: String(item.supplierId || ''),
          supplierName: String(item.supplierName || item.supplier || ''),
          warrantyId: String(item.warrantyId || ''),
          action: String(item.action || ''),
          sentAt: String(item.sentAt || ''),
          expectedReturnAt: String(item.expectedReturnAt || ''),
          returnedAt: String(item.returnedAt || ''),
          note: String(item.note || ''),
          createdBy: String(item.createdBy || ''),
          createdAt: item.at ? new Date(item.at) : new Date(),
        }
      });
    }
    
    // Đồng bộ ngược lại file JSON dự phòng
    const db = await readDb();
    if (!db[name]) db[name] = [];
    db[name].push(item);
    await writeDb(db);
    return item;
  } catch (err) {
    console.warn('[DB] Thêm mới bản ghi vào PostgreSQL thất bại. Tự động chuyển hướng ghi file cục bộ db.json làm dự phòng. Lỗi:', err.message);
    
    // Đồng bộ ngược lại file JSON dự phòng
    const db = await readDb();
    if (!db[name]) db[name] = [];
    
    // Tránh trùng lặp nếu bản ghi đã tồn tại trong mảng dự phòng
    const index = db[name].findIndex(x => (x.id && x.id === item.id) || (x.maNV && x.maNV === item.maNV));
    if (index >= 0) {
      db[name][index] = item;
    } else {
      db[name].push(item);
    }
    
    await writeDb(db);
    return item;
  }
}

/**
 * 6. Hàm atomicWriteJsonFile: Hỗ trợ khôi phục các tệp tin backup ghi thẳng vào PostgreSQL
 */
async function atomicWriteJsonFile(filePath, data) {
  if (filePath === DB_PATH) {
    // Nếu restore đè file chính, tự động đồng bộ hóa nạp vào PostgreSQL
    await writeDb(data);
  } else {
    // Với các tệp tin backup lịch sử cục bộ
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

// -------------------------------------------------------------
// HÀNG ĐỢI GHI STANDBY FILE & CƠ CHẾ KHỬ DỘC (DEBOUNCE WRITE QUEUE)
// -------------------------------------------------------------
let writeQueueBuffer = null;
let writeQueueDirty = false;
let writeQueueTimer = null;
const WRITE_DELAY_MS = 2500; // Trễ đệm đĩa cứng 2.5 giây

/**
 * 7. Hàm syncLocalBackup: Đồng bộ hóa trạng thái PostgreSQL ra file db.json dự phòng bất đồng bộ
 * Tối ưu hóa đĩa cứng VPS bằng cơ chế Debounce ghi đĩa đệm.
 */
async function syncLocalBackup() {
  try {
    const db = await readDb();
    
    // Lưu trạng thái mới nhất vào RAM đệm
    writeQueueBuffer = db;
    writeQueueDirty = true;

    // Nếu chưa có bộ hẹn giờ đếm ngược, khởi chạy hoãn ghi
    if (!writeQueueTimer) {
      writeQueueTimer = setTimeout(() => {
        flushWriteQueue();
      }, WRITE_DELAY_MS);
    }
  } catch (err) {
    console.warn('[BACKUP] Lỗi đồng bộ db.json:', err.message);
  }
}

/**
 * Ghi bất đồng bộ dữ liệu đệm ra đĩa khi hết trễ
 */
function flushWriteQueue() {
  if (writeQueueDirty && writeQueueBuffer) {
    try {
      const content = JSON.stringify(writeQueueBuffer, null, 2);
      fs.writeFileSync(DB_PATH, content, 'utf-8');
      writeQueueDirty = false;
    } catch (err) {
      console.error('[BACKUP] Lỗi ghi đĩa đệm db.json:', err.message);
    }
  }
  writeQueueTimer = null;
}

/**
 * Ghi đồng bộ cưỡng bức dữ liệu đệm ra đĩa khẩn cấp (Graceful Shutdown)
 */
function flushWriteQueueSync() {
  if (writeQueueDirty && writeQueueBuffer) {
    try {
      const content = JSON.stringify(writeQueueBuffer, null, 2);
      fs.writeFileSync(DB_PATH, content, 'utf-8');
      console.log('[BACKUP] Đã ghi đệm Standby File db.json an toàn trước khi tắt máy chủ.');
      writeQueueDirty = false;
    } catch (err) {
      console.error('[BACKUP] Lỗi ghi đè Standby File khẩn cấp khi tắt máy:', err.message);
    }
  }
  if (writeQueueTimer) {
    clearTimeout(writeQueueTimer);
    writeQueueTimer = null;
  }
}

// Lắng nghe tín hiệu tắt tiến trình từ OS để bảo toàn dữ liệu đệm
if (typeof process !== 'undefined') {
  process.on('SIGINT', () => {
    flushWriteQueueSync();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    flushWriteQueueSync();
    process.exit(0);
  });
}

// Helper an toàn lấy timestamp từ chuỗi ngày tháng
function getTimestamp(val) {
  if (!val) return 0;
  try {
    const t = new Date(val).getTime();
    return isNaN(t) ? 0 : t;
  } catch {
    return 0;
  }
}

/**
 * 8. Hàm autoSelfHealingSync: Kiểm tra trạng thái dữ liệu hai chiều và tự động phục hồi chéo
 */
async function autoSelfHealingSync() {
  try {
    console.log('[DB] Khởi chạy công cụ tự phục hồi và đồng bộ hóa hai chiều...');
    
    // 1. Đọc dữ liệu thô từ PostgreSQL
    const [warranties, nhanVien, suppliers, supplierLogs] = await Promise.all([
      prisma.warranty.findMany({ orderBy: { stt: 'asc' } }),
      prisma.nhanVien.findMany({ orderBy: { maNV: 'asc' } }),
      prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
      prisma.supplierLog.findMany({ orderBy: { createdAt: 'desc' } }),
    ]);

    // Tìm max updatedAt trong SQL
    let maxSqlUpdatedAt = 0;
    for (const w of warranties) {
      const t = getTimestamp(w.updatedAt || w.createdAt);
      if (t > maxSqlUpdatedAt) maxSqlUpdatedAt = t;
    }

    // 2. Đọc tệp tin db.json cục bộ
    let dbJsonData = null;
    let maxJsonUpdatedAt = 0;
    if (fs.existsSync(DB_PATH)) {
      try {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        dbJsonData = JSON.parse(raw);
      } catch { /* ignore */ }
    }

    if (dbJsonData && Array.isArray(dbJsonData.warranties)) {
      for (const w of dbJsonData.warranties) {
        const t = getTimestamp(w.updatedAt || w.createdAt);
        if (t > maxJsonUpdatedAt) maxJsonUpdatedAt = t;
      }
    }

    const sqlCount = warranties.length;
    const jsonCount = dbJsonData && Array.isArray(dbJsonData.warranties) ? dbJsonData.warranties.length : 0;

    console.log(`[DB] Chỉ số đồng bộ: PostgreSQL (Bản ghi: ${sqlCount}, MaxUpdate: ${new Date(maxSqlUpdatedAt || 0).toISOString()}) | db.json (Bản ghi: ${jsonCount}, MaxUpdate: ${new Date(maxJsonUpdatedAt || 0).toISOString()})`);

    // 3. Thực thi kịch bản tự phục hồi và đồng bộ hóa chéo
    if (maxJsonUpdatedAt > maxSqlUpdatedAt || (sqlCount === 0 && jsonCount > 0)) {
      console.warn('[DB] PHÁT HIỆN LỆCH PHA: File db.json chứa dữ liệu mới hơn PostgreSQL. Bắt đầu tự động khôi phục ngược (Reverse Sync)...');
      await writeDb(dbJsonData);
      console.log('[DB] Khôi phục ngược thành công! Dữ liệu từ db.json đã được phục hồi toàn diện vào PostgreSQL.');
    } else {
      console.log('[DB] Trạng thái đồng nhất: PostgreSQL đã là nguồn dữ liệu chuẩn nhất. Đồng bộ xuôi ra db.json.');
      const currentData = {
        warranties,
        nhanVien: normalizeNhanVienRows(nhanVien),
        suppliers,
        supplierLogs: normalizeSupplierLogs(supplierLogs),
        adminConfig: dbJsonData?.adminConfig || null,
        customers: dbJsonData?.customers || []
      };
      const content = JSON.stringify(currentData, null, 2);
      fs.writeFileSync(DB_PATH, content, 'utf-8');
    }
  } catch (err) {
    console.error('[DB] Tiến trình tự động phục hồi dữ liệu startup gặp sự cố:', err.message);
  }
}

export { readDb, writeDb, getCollection, setCollection, addToCollection, atomicWriteJsonFile, syncLocalBackup, autoSelfHealingSync, DB_PATH, prisma };

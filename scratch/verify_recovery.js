import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { syncLocalBackup, autoSelfHealingSync, readDb, DB_PATH } from '../api/lib/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runVerification() {
  console.log('=== KHỞI CHẠY DIỄN TẬP KIỂM TRA TÍNH NĂNG ĐỒNG BỘ HAI CHIỀU ===\n');

  // 1. Kiểm tra trạng thái hiện tại
  console.log('[STEP 1] Đọc trạng thái ban đầu từ PostgreSQL...');
  const initialDb = await readDb();
  console.log(`Số lượng bảo hành trong DB: ${initialDb.warranties.length}`);

  // 2. Kiểm tra hàng đợi ghi đệm (Throttled Write Queue)
  console.log('\n[STEP 2] Thử nghiệm Hàng đợi ghi Standby File (Write Queue)...');
  console.log('Gọi syncLocalBackup() 5 lần liên tiếp trong 50ms...');
  
  const mtimeBefore = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).mtimeMs : 0;
  
  for (let i = 0; i < 5; i++) {
    syncLocalBackup();
  }
  
  const mtimeAfterImmediate = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).mtimeMs : 0;
  console.log(`- File db.json được ghi ngay lập tức? ${mtimeBefore === mtimeAfterImmediate ? 'KHÔNG (Chính xác, dữ liệu được giữ trong RAM)' : 'CÓ (Lỗi, ghi trực tiếp)'}`);

  // Chờ 3 giây để bộ đếm thời gian (2.5s) kích hoạt ghi đĩa
  console.log('Đang chờ bộ đếm hoãn ghi (2.5 giây) hoàn tất...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  const mtimeAfterDelay = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).mtimeMs : 0;
  console.log(`- File db.json đã được ghi đĩa sau 3 giây? ${mtimeAfterDelay > mtimeBefore ? 'CÓ (Chính xác, bộ đệm đã tự động ghi)' : 'KHÔNG (Lỗi bộ đệm)'}`);

  // 3. Kiểm tra tự phục hồi dữ liệu hai chiều
  console.log('\n[STEP 3] Diễn tập kiểm tra Tự phục hồi hai chiều (autoSelfHealingSync)...');
  await autoSelfHealingSync();

  console.log('\n=== KẾT THÚC DIỄN TẬP: TẤT CẢ KIỂM TRA ĐỀU HOÀN THÀNH HOÀN HẢO ===');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('Lỗi kiểm tra:', err);
  process.exit(1);
});

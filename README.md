# NTPC Warranty - Đánh giá chi tiết dự án

## 1. Tổng quan dự án

NTPC Warranty là hệ thống quản lý bảo hành, sửa chữa, khách hàng, nhân viên, nhà cung cấp và tra cứu tình trạng phiếu bảo hành. Dự án dùng React/Vite cho giao diện, Express cho API, Prisma + PostgreSQL cho dữ liệu chính, kèm cơ chế dự phòng bằng `api/db.json` và hệ thống backup file.

Mục tiêu nghiệp vụ hiện tại:

- Nhân viên tạo, cập nhật, in và theo dõi phiếu bảo hành.
- Khách hàng tra cứu tình trạng phiếu bằng số chứng từ.
- Quản trị viên quản lý nhân viên, import/export, backup/restore.
- Theo dõi gửi/nhận bảo hành qua nhà cung cấp.
- Lưu ảnh/file đính kèm trong `api/uploads`.
- Chạy local bằng Vite + Express hoặc triển khai Docker Compose với Nginx + API + PostgreSQL + Cloudflare Quick Tunnel.

## 2. Kiến trúc kỹ thuật hiện tại

### 2.1 Frontend

- Framework: React 18.
- Build tool: Vite 5.
- UI: Ant Design 5, Ant Design Mobile.
- Routing: `react-router-dom` v6.
- Form/validation: `react-hook-form`, `zod`, `@hookform/resolvers`.
- HTTP client: Axios.
- i18n: `i18next`, `react-i18next`, detector trình duyệt.
- Test: Vitest, Testing Library, jsdom.

Thư mục chính:

```txt
src/
  App.jsx
  main.jsx
  components/
  constants/
  contexts/
  hooks/
  i18n/
  lib/
  pages/
  services/
  styles/
  theme/
  utils/
```

Luồng route chính trong `src/App.jsx`:

- `/tra-cuu`: trang tra cứu công khai.
- `/tra-cuu/:soChungTu`: kết quả tra cứu công khai.
- `/admin/dashboard`: dashboard nhân viên.
- `/admin/phieu`: danh sách phiếu.
- `/admin/phieu/:id/in`: in phiếu.
- `/admin/tao-phieu`: tạo phiếu.
- `/admin/khach-hang`: thông tin khách hàng.
- `/admin/nhan-vien`: quản lý nhân viên, yêu cầu admin.
- `/admin/nha-cung-cap`: quản lý nhà cung cấp.
- `/admin/thong-ke`: thống kê.
- `/admin/import-export`: import/export, yêu cầu admin.

Điểm tốt frontend:

- Có lazy loading route bằng `React.lazy` và `Suspense`.
- Có `ErrorBoundary` để chặn crash toàn app.
- Có layout riêng cho admin và khách hàng.
- Có bảo vệ route theo đăng nhập và quyền admin.
- Có hỗ trợ mobile qua Ant Design Mobile.
- Có hooks riêng cho debounce, mobile, theme, shortcut, warranties.
- Có test smoke cho UI tiếng Việt, status tag, i18n, urgency, generate chứng từ.

### 2.2 Backend/API

- Runtime: Node.js ESM.
- Framework: Express 4.
- Middleware: CORS, Morgan, JSON parser.
- Auth: cookie JWT HS256 tự viết, password hash bằng `crypto.scryptSync`.
- Rate limit đăng nhập: memory map theo IP + mã nhân viên.
- Database layer: Prisma Client + fallback file JSON.
- Static uploads: `/uploads` trỏ vào `api/uploads`.

File chính:

```txt
api/server.js
api/lib/db.js
api/lib/auth.js
api/lib/backup.js
api/lib/validators.js
api/routes/auth.js
api/routes/backups.js
api/routes/customers.js
api/routes/nhanVien.js
api/routes/public.js
api/routes/stats.js
api/routes/suppliers.js
api/routes/warranties.js
```

Route backend chính:

- `GET /api/health`: kiểm tra sống.
- `/api/public`: API công khai cho tra cứu.
- `/api/auth`: đăng nhập, đăng xuất, trạng thái phiên.
- `/api/warranties`: quản lý phiếu, yêu cầu đăng nhập.
- `/api/nhan-vien`: quản lý nhân viên, yêu cầu admin.
- `/api/stats`: thống kê.
- `/api/customers`: khách hàng.
- `/api/suppliers`: nhà cung cấp.
- `/api/admin/backups`: backup/restore, yêu cầu admin.

Cấu hình bảo mật hiện tại trong `api/server.js`:

```js
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

Cookie auth hiện tại:

- `httpOnly: true`
- `secure`: bật khi production hoặc `COOKIE_SECURE=true`
- `sameSite: 'lax'`
- TTL mặc định: 8 giờ

### 2.3 Database

Prisma schema hiện tại dùng PostgreSQL:

```txt
prisma/schema.prisma
```

Model chính:

- `NhanVien`: nhân viên, mật khẩu, quyền, active.
- `Supplier`: nhà cung cấp.
- `SupplierLog`: nhật ký gửi/nhận nhà cung cấp.
- `Warranty`: phiếu bảo hành.

Đặc điểm kỹ thuật database:

- `Warranty.soChungTu` có `@unique`.
- Nhiều trường ngày đang lưu `String` thay vì `DateTime`.
- Các cấu trúc động như `doiTra`, `attachments`, `history`, `supplierLogs` lưu dạng `Json`.
- `createdAt`, `updatedAt` trong `Warranty` đang là `String`, không phải `DateTime`.
- Chưa thấy quan hệ Prisma rõ giữa `Warranty`, `NhanVien`, `Supplier`, `SupplierLog`.

### 2.4 Cơ chế dữ liệu lai PostgreSQL + JSON

`api/lib/db.js` đang đóng vai trò lớp tương thích ngược:

- `readDb()` đọc từ PostgreSQL, trả về object giống cấu trúc `db.json` cũ.
- Nếu PostgreSQL lỗi, fallback sang `api/db.json`.
- `writeDb(data)` ghi bằng transaction vào PostgreSQL, sau đó đồng bộ ra `api/db.json`.
- Nếu ghi PostgreSQL lỗi, ghi vào `api/db.json` làm dự phòng.

Ưu điểm:

- Dễ chuyển đổi từ dữ liệu JSON cũ sang PostgreSQL.
- App vẫn chạy khi DB tạm lỗi hoặc môi trường dev chưa có DB.
- Có bản sao dữ liệu local phục vụ phục hồi khẩn cấp.

Nhược điểm:

- `writeDb()` nhiều chỗ xóa toàn bộ bảng rồi `createMany` lại. Rủi ro mất dữ liệu nếu transaction/logic lỗi.
- Dữ liệu có thể lệch giữa PostgreSQL và `db.json` khi fallback xảy ra.
- `readDb()` có xu hướng load toàn bộ dữ liệu, không tối ưu khi số phiếu tăng lớn.
- Quan hệ dữ liệu chưa được tận dụng đúng sức mạnh PostgreSQL.

### 2.5 Backup/restore

Dự án có thư mục:

```txt
api/backups/
  hourly/
  daily/
  monthly/
  manual/
  restore-safety/
  uploaded/
```

Quan sát hiện tại:

- Có nhiều file backup `.json` kèm `.sha256`.
- Có backup tài sản dạng `.assets.tgz` kèm metadata và checksum.
- Có backup trước restore trong `restore-safety`.

Điểm mạnh:

- Có phân tầng backup theo giờ/ngày/tháng/manual.
- Có checksum SHA-256 để kiểm tra toàn vẹn.
- Có safety backup trước khi restore.

Điểm yếu:

- Backup nằm trong repository/project directory, dễ bị commit nhầm hoặc mất nếu xóa thư mục dự án.
- Chưa thấy tài liệu restore rõ trong README cũ vì README đang trống.
- Chưa thấy kiểm tra định kỳ khả năng restore thực tế.

### 2.6 Docker/triển khai

`docker-compose.yml` gồm:

- `postgres-db`: PostgreSQL 15 Alpine.
- `backend-api`: Express API, build từ `api.Dockerfile`.
- `frontend-web`: Nginx phục vụ React build, build từ `web.Dockerfile`.
- `cloudflare-quick-tunnel`: public frontend qua trycloudflare.com.

Điểm tốt:

- Có tách service DB/API/Web.
- Có volume bền vững cho PostgreSQL, uploads, backups.
- Có network nội bộ riêng.
- Có cấu hình production env cho API.

Điểm cần sửa:

- `DATABASE_URL=postgresql://${POSTGRES_USER}:***@postgres-db:5432/${POSTGRES_DB}?schema=public` đang dùng `***`, Prisma sẽ không kết nối nếu không thay bằng password thật hoặc biến đúng.
- Expose `5432:5432` ra host; production nên chỉ expose nội bộ nếu không cần truy cập ngoài.
- Dùng Cloudflare Quick Tunnel tiện thử nghiệm nhưng không ổn định bằng named tunnel cho production.
- Chưa thấy healthcheck cho DB/API/Web trong compose.

## 3. Điểm mạnh chi tiết

### 3.1 Phù hợp nghiệp vụ bảo hành thực tế

Dự án đã có đủ nhóm chức năng cần thiết cho cửa hàng/trung tâm bảo hành:

- Lập phiếu.
- In phiếu.
- Theo dõi trạng thái.
- Quản lý khách hàng.
- Quản lý nhân viên.
- Quản lý nhà cung cấp.
- Gửi/nhận nhà cung cấp.
- Thống kê.
- Tra cứu công khai.
- Backup/restore.

Giá trị: dự án không chỉ là demo CRUD, mà đã bám sát quy trình vận hành thật.

### 3.2 Frontend tổ chức tương đối rõ

Dự án có tách:

- `components`: UI tái sử dụng.
- `pages`: màn hình nghiệp vụ.
- `services`: gọi API.
- `utils`: xử lý dữ liệu.
- `constants`: cấu hình trạng thái, route, option.
- `hooks`: logic React tái sử dụng.
- `theme`: theme Ant Design.

Giá trị: dễ bảo trì hơn so với để toàn bộ logic trong một file.

### 3.3 Có bảo vệ quyền và phiên đăng nhập

Backend có:

- JWT ký HMAC.
- Cookie `httpOnly`.
- Kiểm tra `requireAuth`.
- Kiểm tra `requireRole('admin')`.
- Hash mật khẩu bằng scrypt.
- Tự rehash mật khẩu cũ dạng plain/sha256 sang scrypt.
- Rate limit đăng nhập cơ bản.

Giá trị: tốt hơn nhiều so với lưu staff trong localStorage hoặc gửi mã nhân viên tự do.

### 3.4 Có bước chuyển đổi sang PostgreSQL

Dự án đã có Prisma schema và dùng PostgreSQL thay vì chỉ dùng JSON file. Đây là bước quan trọng để:

- Tăng độ bền dữ liệu.
- Tăng khả năng truy vấn.
- Dễ backup production chuẩn hơn.
- Dễ mở rộng người dùng và dữ liệu.

### 3.5 Có backup nhiều lớp

Backup theo giờ/ngày/tháng/manual và checksum là điểm mạnh lớn. Nhiều dự án nội bộ bỏ qua phần này, dẫn tới mất dữ liệu khi lỗi ổ cứng, restore nhầm hoặc sửa code sai.

### 3.6 Có test tự động ban đầu

Thư mục `tests/` có nhiều test nhỏ. Dù chưa đủ, đây là nền tốt để mở rộng regression test khi sửa nghiệp vụ.

### 3.7 Có hướng mobile và trải nghiệm thực tế

Dùng Ant Design Mobile, route khách hàng, QR code, print CSS, shortcut, notification. Đây là các chi tiết cho thấy dự án đã nghĩ tới người dùng thật, không chỉ admin desktop.

## 4. Điểm yếu/rủi ro chi tiết

### 4.1 README trước đó trống

Tình trạng: `README.md` cũ không có nội dung.

Rủi ro:

- Người mới không biết chạy dự án.
- Không biết cấu hình `.env`.
- Không biết backup/restore.
- Không biết kiến trúc và giới hạn kỹ thuật.
- Khó bàn giao hoặc triển khai lại sau sự cố.

Khắc phục:

- README hiện tại đã bổ sung đánh giá chi tiết.
- Nên tiếp tục thêm ảnh màn hình, sơ đồ luồng nghiệp vụ, API contract và runbook production.

### 4.2 Test hiện tại chưa chạy được trong môi trường kiểm tra

Lệnh đã chạy:

```bash
npm test
```

Lỗi hiện tại:

```txt
Error: Cannot find module @rollup/rollup-linux-x64-gnu. npm has a bug related to optional dependencies.
```

Nguyên nhân khả dĩ:

- `node_modules` thiếu optional dependency của Rollup.
- Dự án nằm trên `/mnt/c/...` WSL, có thể `node_modules` được cài từ Windows hoặc bị lệch platform.
- npm optional dependency bug.

Cách khắc phục đề xuất:

```bash
rm -rf node_modules package-lock.json
npm install
npm test
```

Nếu muốn giữ lockfile:

```bash
rm -rf node_modules
npm ci
npm test
```

Nếu vẫn lỗi trên WSL:

```bash
npm rebuild rollup
npm install @rollup/rollup-linux-x64-gnu -D
npm test
```

Khuyến nghị tốt hơn:

- Không dùng chung `node_modules` giữa Windows và WSL.
- Clone/move project vào filesystem Linux, ví dụ `~/projects/baohanh3ant5`, để tăng tốc và tránh lỗi native optional dependency.
- Thêm CI chạy `npm ci && npm test && npm run build`.

### 4.3 Database schema chưa chuẩn quan hệ

Vấn đề:

- `Warranty.maNhanVien` là `String`, chưa khai báo relation tới `NhanVien`.
- `SupplierLog.supplierId`, `SupplierLog.warrantyId` là `String`, chưa relation tới `Supplier`/`Warranty`.
- Nhiều ngày lưu `String`.
- Nhiều dữ liệu nghiệp vụ quan trọng lưu `Json`.

Rủi ro:

- Không có foreign key, dễ sinh dữ liệu mồ côi.
- Khó query báo cáo nâng cao.
- Khó index theo ngày/trạng thái.
- Dễ sai format ngày.
- Khó migrate khi dữ liệu tăng.

Khắc phục ngắn hạn:

- Thêm index cho field hay lọc:

```prisma
@@index([trangThai])
@@index([maNhanVien])
@@index([ngayNhan])
@@index([ngayHenTra])
@@index([supplierStatus])
@@index([deletedAt])
```

- Chuẩn hóa format ngày ISO khi ghi.
- Thêm validator backend bắt buộc format ngày hợp lệ.

Khắc phục dài hạn tốt hơn:

- Chuyển `ngayNhan`, `ngayHenTra`, `ngayTra`, `createdAt`, `updatedAt`, `deletedAt` sang `DateTime?`.
- Thêm relation:

```prisma
model Warranty {
  maNhanVien String
  nhanVien   NhanVien @relation(fields: [maNhanVien], references: [maNV])
}
```

- Tách `attachments`, `history`, `supplierLogs` thành bảng riêng nếu cần lọc/tìm kiếm/báo cáo.

### 4.4 Lớp `writeDb()` ghi đè toàn bộ bảng

Vấn đề:

`writeDb(data)` có nhiều đoạn:

```js
await tx.warranty.deleteMany();
await tx.warranty.createMany(...);
```

Rủi ro:

- Dữ liệu lớn sẽ chậm.
- Ghi đồng thời dễ mất update cuối.
- Nếu dữ liệu input thiếu bảng/phần tử, có thể xóa nhầm nhiều dữ liệu.
- Không tận dụng update từng bản ghi.

Khắc phục ngắn hạn:

- Chỉ dùng `writeDb()` cho migrate/import/restore.
- Với CRUD hàng ngày, dùng route gọi Prisma `create/update/delete` theo từng record.
- Thêm log audit mỗi lần `writeDb()` được gọi: user, route, số lượng record, thời điểm.

Phương án tốt hơn:

- Tách repository/service theo entity:

```txt
api/repositories/warrantyRepository.js
api/repositories/staffRepository.js
api/repositories/supplierRepository.js
api/services/warrantyService.js
api/services/backupService.js
```

- API tạo phiếu dùng `prisma.warranty.create`.
- API sửa phiếu dùng `prisma.warranty.update` với optimistic locking bằng `updatedAt`.
- API xóa dùng soft delete `deletedAt`.
- Import/restore dùng transaction riêng, có dry-run và preview diff.

### 4.5 Fallback JSON có thể gây lệch dữ liệu

Vấn đề:

Khi PostgreSQL lỗi, app đọc/ghi `api/db.json`. Khi DB quay lại, dữ liệu trong JSON có thể mới hơn DB hoặc ngược lại.

Rủi ro:

- Người dùng thấy dữ liệu khác nhau sau restart.
- Restore nhầm nguồn.
- Backup có thể backup nguồn không mong muốn.

Khắc phục:

- Ghi thêm metadata nguồn dữ liệu đang dùng:

```json
{
  "source": "postgres" | "json-fallback",
  "lastWriteAt": "...",
  "lastWriteId": "..."
}
```

- Khi fallback xảy ra, hiển thị cảnh báo rõ trong admin dashboard.
- Khi PostgreSQL hồi phục, yêu cầu admin chọn sync từ JSON sang PostgreSQL hoặc bỏ JSON.

Phương án tốt hơn:

- Production không nên tự động fallback ghi JSON âm thầm.
- Production nên fail closed: trả lỗi 503 nếu DB chết, để tránh split-brain.
- JSON fallback chỉ bật trong dev bằng biến:

```env
ENABLE_JSON_FALLBACK=true
```

### 4.6 Security headers còn thiếu

Hiện có một số header cũ/cơ bản. Thiếu:

- Content-Security-Policy.
- Referrer-Policy.
- Permissions-Policy.
- Strict-Transport-Security khi HTTPS.
- Cross-Origin-Opener-Policy tùy nhu cầu.

Khắc phục:

- Dùng `helmet`:

```bash
npm install helmet
```

```js
import helmet from 'helmet';
app.use(helmet({
  contentSecurityPolicy: false
}));
```

Sau đó cấu hình CSP riêng cho production khi biết domain ảnh/API/tunnel.

### 4.7 CORS cấu hình còn thủ công

Vấn đề:

`allowedOrigins` hard-code localhost và IP LAN. Production dựa vào `CORS_ORIGIN`.

Rủi ro:

- Quên cập nhật domain mới.
- CORS lỗi khi đổi tunnel/domain.
- Dễ mở rộng sai thành `*` với credentials.

Khắc phục:

- Bắt buộc `CORS_ORIGIN` trong production.
- Log origin bị từ chối.
- Không dùng wildcard khi `credentials: true`.

### 4.8 Rate limit đăng nhập dùng memory map

Vấn đề:

`loginAttempts` nằm trong RAM process.

Rủi ro:

- Restart app mất rate limit.
- Scale nhiều instance không chia sẻ trạng thái.
- Memory có thể tăng nếu nhiều IP/mã nhân viên lạ.

Khắc phục ngắn hạn:

- Dọn map định kỳ.
- Giới hạn kích thước map.

Phương án tốt hơn:

- Dùng Redis hoặc table `LoginAttempt` trong PostgreSQL.
- Dùng package `express-rate-limit` với store phù hợp.

### 4.9 Upload/static file cần kiểm soát chặt hơn

Quan sát:

- `express.static(uploadsDir)` public `/uploads`.
- Chưa đánh giá sâu route upload vì chưa đọc toàn bộ route.

Rủi ro cần kiểm tra:

- Upload file quá lớn.
- Upload file không phải ảnh.
- File name nguy hiểm/path traversal.
- Public URL lộ ảnh nhạy cảm.
- Không có virus scan nếu dùng production public.

Khắc phục:

- Dùng whitelist MIME thật bằng đọc magic bytes.
- Giới hạn kích thước file.
- Rename file bằng UUID.
- Không tin `originalname`.
- Lưu metadata file trong DB.
- Nếu ảnh bảo hành riêng tư, bảo vệ `/uploads` bằng auth thay vì static public.

### 4.10 Docker Compose còn thiếu healthcheck và secret handling chuẩn

Vấn đề:

- `DATABASE_URL` trong compose đang có `***`.
- DB port mở ra host.
- Không có healthcheck.
- Không có named Cloudflare tunnel.

Khắc phục:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
  interval: 10s
  timeout: 5s
  retries: 5
```

Sửa `DATABASE_URL`:

```yaml
- DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres-db:5432/${POSTGRES_DB}?schema=public
```

Production nên bỏ:

```yaml
ports:
  - "5432:5432"
```

nếu không cần truy cập DB từ ngoài Docker network.

### 4.11 `.env` có trong project directory

Quan sát project có file `.env`.

Rủi ro:

- Dễ commit secret.
- Dễ copy nhầm lên nơi công khai.

Khắc phục:

- Đảm bảo `.env` nằm trong `.gitignore`.
- Tạo `.env.example` không chứa secret thật.
- Rotate secret nếu từng commit `.env`.

### 4.12 Dữ liệu runtime nằm trong repository

Các thư mục runtime hiện nằm trong dự án:

```txt
pgdata/
api/backups/
api/uploads/
api/db.json
```

Rủi ro:

- Git status nặng.
- Backup/source/runtime lẫn nhau.
- Xóa repo có thể xóa dữ liệu.
- Copy dự án chậm.

Khắc phục:

- Đưa data ra ngoài repo bằng `.env` path hoặc Docker volume named.
- Thêm `.gitignore` rõ:

```gitignore
.env
pgdata/
api/backups/
api/uploads/
api/db.json
*.log
node_modules/
dist/
```

Phương án tốt hơn:

- Production dùng volume riêng:

```yaml
volumes:
  postgres_data:
  api_uploads:
  api_backups:
```

hoặc mount tới `/var/lib/ntpc/...`.

## 5. Phương án khắc phục chi tiết theo mức ưu tiên

### P0 - Việc cần làm ngay trước khi chạy production

1. Sửa Docker `DATABASE_URL`.

```yaml
- DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres-db:5432/${POSTGRES_DB}?schema=public
```

2. Bắt buộc secret mạnh.

```env
AUTH_SECRET=chuoi-ngau-nhien-it-nhat-32-ky-tu
POSTGRES_PASSWORD=mat-khau-manh
COOKIE_SECURE=true
NODE_ENV=production
```

3. Kiểm tra `.gitignore` có chặn dữ liệu nhạy cảm/runtime.

4. Sửa môi trường test:

```bash
rm -rf node_modules
npm ci
npm test
npm run build
```

5. Thêm `helmet` và header bảo mật cơ bản.

6. Không expose PostgreSQL port ra Internet.

7. Test restore backup thật trên môi trường staging.

### P1 - Ổn định dữ liệu và giảm rủi ro mất dữ liệu

1. Giảm dùng `writeDb()` cho CRUD thường ngày.
2. Chuyển các route quan trọng sang Prisma create/update/delete từng record.
3. Thêm index Prisma cho trạng thái, ngày, nhân viên, nhà cung cấp.
4. Thêm audit log cho hành động tạo/sửa/xóa/restore.
5. Thêm transaction rõ cho nghiệp vụ phức tạp.
6. Thêm cảnh báo khi app đang chạy bằng JSON fallback.
7. Production tắt fallback JSON tự động hoặc chỉ cho read-only fallback.

### P2 - Chuẩn hóa schema

1. Chuyển ngày từ `String` sang `DateTime?`.
2. Thêm relation và foreign key.
3. Tách bảng:

```txt
WarrantyAttachment
WarrantyHistory
WarrantySupplierLog
Customer
```

4. Thêm enum Prisma cho trạng thái:

```prisma
enum WarrantyStatus {
  cho_xu_ly
  dang_xu_ly
  cho_lien_he
  da_tra
  huy
}
```

5. Thêm migration có script backfill dữ liệu cũ.

### P3 - Nâng chất lượng code và vận hành

1. Thêm ESLint script:

```json
"lint": "eslint ."
```

2. Thêm format script:

```json
"format": "prettier --write ."
```

3. Thêm type check nếu chuyển dần sang TypeScript.
4. Thêm CI:

```yaml
npm ci
npm run lint
npm test
npm run build
```

5. Thêm API integration tests cho auth/warranties/backups.
6. Thêm logging structured bằng `pino` hoặc `winston`.
7. Thêm monitoring uptime và disk space backup.

## 6. Phương án tốt hơn: kiến trúc mục tiêu đề xuất

### 6.1 Kiến trúc mục tiêu

```txt
Browser
  |
  v
Nginx / Reverse Proxy / Cloudflare Named Tunnel
  |
  +--> React static assets
  |
  +--> Express API
          |
          +--> PostgreSQL
          +--> File storage / object storage
          +--> Backup service
          +--> Redis optional for rate limit/session/cache
```

### 6.2 Backend mục tiêu

Tách lớp:

```txt
api/
  server.js
  app.js
  config/
    env.js
    cors.js
  middleware/
    auth.js
    errorHandler.js
    validate.js
    rateLimit.js
  modules/
    auth/
    warranties/
    customers/
    suppliers/
    staff/
    backups/
  repositories/
  services/
  utils/
```

Mỗi module có:

```txt
routes.js
controller.js
service.js
repository.js
schema.js
test.js
```

Lợi ích:

- Dễ test.
- Dễ sửa nghiệp vụ.
- Giảm file route quá lớn.
- Dễ thay Prisma/query.
- Dễ kiểm soát quyền từng endpoint.

### 6.3 Database mục tiêu

Nên có bảng rõ:

```txt
NhanVien
Customer
Warranty
WarrantyAttachment
WarrantyHistory
Supplier
SupplierLog
BackupJob
AuditLog
LoginAttempt
```

Quan hệ chính:

- `Warranty.customerId -> Customer.id`
- `Warranty.maNhanVien -> NhanVien.maNV`
- `SupplierLog.warrantyId -> Warranty.id`
- `SupplierLog.supplierId -> Supplier.id`
- `WarrantyAttachment.warrantyId -> Warranty.id`
- `WarrantyHistory.warrantyId -> Warranty.id`

Lợi ích:

- Truy vấn nhanh.
- Báo cáo chính xác.
- Không có dữ liệu mồ côi.
- Dễ phân quyền và audit.

### 6.4 Auth mục tiêu

Hiện tại cookie JWT là ổn cho app nhỏ. Nếu nâng cấp:

- Dùng access session server-side trong DB/Redis để revoke phiên.
- Thêm CSRF token cho request thay đổi dữ liệu nếu dùng cookie auth.
- Thêm password policy.
- Thêm lock tài khoản sau nhiều lần sai.
- Thêm audit login/logout/change password.
- Thêm optional 2FA cho admin.

### 6.5 Backup mục tiêu

Backup nên gồm:

1. PostgreSQL dump:

```bash
pg_dump --format=custom --file=backup.dump "$DATABASE_URL"
```

2. Uploads archive:

```bash
tar -czf uploads.tgz api/uploads
```

3. Metadata:

```json
{
  "createdAt": "...",
  "dbSha256": "...",
  "uploadsSha256": "...",
  "appVersion": "3.0.0"
}
```

4. Restore drill định kỳ:

- Restore vào DB staging.
- Chạy smoke test.
- Kiểm tra số phiếu, số nhân viên, số file.

### 6.6 Deploy mục tiêu

Thay Quick Tunnel tạm bằng:

- Cloudflare Named Tunnel hoặc reverse proxy Nginx/Caddy có TLS ổn định.
- Domain cố định.
- Healthcheck service.
- Auto restart có kiểm tra readiness.
- Backup offsite: Google Drive/S3/R2/ổ NAS.

## 7. Hướng dẫn chạy dự án hiện tại

### 7.1 Cài dependency

```bash
npm install
```

Nếu lỗi Rollup optional dependency:

```bash
rm -rf node_modules package-lock.json
npm install
```

Hoặc:

```bash
rm -rf node_modules
npm ci
```

### 7.2 Chạy frontend + API local

```bash
npm run start
```

Lệnh này chạy song song:

```bash
npm run api
npm run dev
```

### 7.3 Chạy API riêng

```bash
npm run api
```

API mặc định:

```txt
http://localhost:3004
```

Health check:

```bash
curl http://localhost:3004/api/health
```

### 7.4 Chạy frontend riêng

```bash
npm run dev
```

### 7.5 Build frontend

```bash
npm run build
```

### 7.6 Test

```bash
npm test
```

Lưu ý hiện tại: môi trường kiểm tra đang lỗi thiếu `@rollup/rollup-linux-x64-gnu`; cần cài lại dependency như mục 7.1.

### 7.7 Chạy Docker Compose

Tạo `.env` phù hợp trước:

```env
POSTGRES_USER=ntpc
POSTGRES_PASSWORD=mat-khau-manh
POSTGRES_DB=ntpc_warranty
AUTH_SECRET=chuoi-ngau-nhien-it-nhat-32-ky-tu
INITIAL_STAFF_PASSWORD=doi-mat-khau-ngay
SESSION_TTL_SECONDS=28800
COOKIE_SECURE=true
CORS_ORIGIN=https://domain-cua-ban.example
```

Sửa `docker-compose.yml` để `DATABASE_URL` dùng `${POSTGRES_PASSWORD}` thay vì placeholder mật khẩu.

Chạy:

```bash
docker compose up -d --build
```

Xem log:

```bash
docker compose logs -f backend-api
```

## 8. Checklist chất lượng trước bàn giao

### Bảo mật

- [ ] `.env` không bị commit.
- [ ] `AUTH_SECRET` >= 32 ký tự, ngẫu nhiên.
- [ ] `POSTGRES_PASSWORD` mạnh.
- [ ] `COOKIE_SECURE=true` khi HTTPS.
- [ ] CORS chỉ cho domain thật.
- [ ] Helmet/CSP đã cấu hình.
- [ ] Upload giới hạn type/size.
- [ ] Admin route kiểm tra quyền đầy đủ.

### Dữ liệu

- [ ] PostgreSQL kết nối thật trong production.
- [ ] Không dùng `***` trong `DATABASE_URL`.
- [ ] Có backup DB + uploads.
- [ ] Restore đã test ít nhất một lần.
- [ ] Có cảnh báo khi fallback JSON.
- [ ] Có index cho field hay lọc.

### Code

- [ ] `npm test` pass.
- [ ] `npm run build` pass.
- [ ] Có lint/format.
- [ ] Route chính có integration test.
- [ ] Không còn log/debug nhạy cảm.

### Vận hành

- [ ] Docker healthcheck.
- [ ] Không expose DB nếu không cần.
- [ ] Logs có rotation.
- [ ] Backup offsite.
- [ ] Có tài liệu restore.
- [ ] Có domain/tunnel ổn định.

## 9. Kết luận đánh giá

Dự án có nền nghiệp vụ tốt và đã đi xa hơn mức prototype: có React UI, Express API, auth, phân quyền, PostgreSQL, backup, Docker, tra cứu công khai và test ban đầu. Điểm mạnh nhất là hệ thống đã bám sát quy trình bảo hành thực tế và có ý thức bảo vệ dữ liệu bằng backup/checksum.

Rủi ro lớn nhất hiện tại nằm ở lớp dữ liệu lai PostgreSQL + JSON, cách `writeDb()` ghi đè toàn bộ bảng, schema chưa chuẩn quan hệ, Docker secret chưa đúng, test chưa chạy được do dependency native Rollup, và README trước đây thiếu tài liệu vận hành.

Hướng tốt nhất: giữ giao diện/luồng nghiệp vụ hiện tại, nhưng nâng cấp dần backend theo module, chuyển CRUD sang Prisma trực tiếp, chuẩn hóa schema quan hệ, tắt fallback JSON âm thầm trong production, bổ sung healthcheck/CI/security headers/restore drill. Sau các bước này, dự án sẽ bền hơn, dễ mở rộng hơn và an toàn hơn khi dùng thật lâu dài.

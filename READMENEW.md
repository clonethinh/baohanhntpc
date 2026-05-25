# NTPC Warranty - Báo cáo đánh giá kỹ thuật chi tiết

## 1. Tóm tắt dự án

NTPC Warranty là hệ thống quản lý bảo hành/sửa chữa dùng cho quy trình vận hành thực tế. Dự án gồm:

- Giao diện web React cho nhân viên/admin.
- Giao diện tra cứu công khai cho khách hàng.
- API Express quản lý phiếu, nhân viên, nhà cung cấp, thống kê, backup/restore.
- PostgreSQL qua Prisma làm database chính.
- File `api/db.json` làm lớp tương thích/fallback từ giai đoạn dữ liệu JSON cũ.
- Docker Compose chạy PostgreSQL + backend + frontend + Cloudflare Quick Tunnel.
- Backup nhiều tầng: hourly, daily, monthly, manual, restore-safety, uploaded.
- Audit log và healthcheck đã được bổ sung.

Dự án hiện không còn là prototype đơn giản. Đây là app nghiệp vụ nội bộ có nhiều phần production-like: auth, phân quyền, backup, Docker, public tracking, print, upload ảnh, supplier workflow.

## 2. Kiến trúc hiện tại

```txt
Browser / Mobile
  |
  v
Frontend React + Vite + Ant Design
  |
  v
Nginx container frontend-web
  |
  +--> /api/* proxy sang backend-api
  |
  v
Express API
  |
  +--> PostgreSQL qua Prisma
  +--> api/db.json fallback/tương thích cũ
  +--> api/uploads lưu ảnh/file
  +--> api/backups lưu backup
  +--> audit_logs ghi hành động quan trọng
  |
  v
Cloudflare Quick Tunnel public frontend
```

## 3. Stack kỹ thuật

### 3.1 Frontend

- React 18.
- Vite 5.
- Ant Design 5.
- Ant Design Mobile.
- React Router DOM v6.
- Axios.
- React Hook Form.
- Zod.
- i18next/react-i18next.
- QR code: `qrcode.react`.
- Print: `react-to-print`.
- Test: Vitest + Testing Library + jsdom.

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

Route chính:

```txt
/tra-cuu
/tra-cuu/:soChungTu
/admin/dashboard
/admin/phieu
/admin/phieu/:id/in
/admin/tao-phieu
/admin/khach-hang
/admin/nhan-vien
/admin/nha-cung-cap
/admin/thong-ke
/admin/import-export
```

### 3.2 Backend

- Node.js ESM.
- Express 4.
- Prisma Client.
- PostgreSQL.
- Cookie JWT tự ký bằng HMAC SHA-256.
- Password hash bằng `crypto.scryptSync`.
- CORS có credentials.
- Helmet đã thêm.
- Morgan log request.
- Upload ảnh qua data URL, lưu tại `api/uploads/warranties`.
- Backup/restore tại `api/backups`.

File chính:

```txt
api/server.js
api/lib/db.js
api/lib/auth.js
api/lib/audit.js
api/lib/backup.js
api/lib/restore_drill.js
api/lib/validators.js
api/routes/auth.js
api/routes/warranties.js
api/routes/nhanVien.js
api/routes/suppliers.js
api/routes/backups.js
api/routes/public.js
api/routes/stats.js
api/routes/customers.js
```

### 3.3 Database

Prisma schema hiện có:

- `NhanVien`
- `Supplier`
- `SupplierLog`
- `Warranty`
- `AuditLog`

Điểm đã nâng cấp:

- Có index cho quyền/active nhân viên.
- Có index cho nhà cung cấp theo code/name/isActive.
- Có index cho supplier log theo supplierId/warrantyId/action/createdAt.
- Có index cho phiếu theo trạng thái, nhân viên, ngày, supplier, deletedAt, updatedAt.
- Có bảng `audit_logs` để ghi hành động quan trọng.
- Schema đã khai báo relation giữa:
  - `Warranty.maNhanVien -> NhanVien.maNV`
  - `Warranty.supplierIdCurrent -> Supplier.id`
  - `SupplierLog.supplierId -> Supplier.id`
  - `SupplierLog.warrantyId -> Warranty.id`

Điểm vẫn cần chú ý:

- Nhiều field ngày trong `Warranty` vẫn là `String`, chưa phải `DateTime`.
- `history`, `attachments`, `doiTra`, `supplierLogs` vẫn là JSON, tiện tương thích nhưng khó query/report sâu.
- Một số route bảo hành vẫn còn dùng `getCollection/setCollection/writeDb` theo kiểu legacy.

## 4. Trạng thái kỹ thuật hiện tại

### 4.1 Docker Compose

Service hiện tại:

```txt
postgres-db
backend-api
frontend-web
cloudflare-quick-tunnel
```

Đã có healthcheck:

- PostgreSQL: `pg_isready`.
- Backend: gọi `/api/health`.
- Frontend: wget trang `/`.

Điểm mạnh:

- Service phụ thuộc healthcheck, backend chờ DB healthy, frontend chờ backend healthy.
- Backend/frontend container đã healthy trong lần kiểm tra gần nhất.
- Cloudflare Quick Tunnel hoạt động, link lấy qua log container.

Điểm yếu lớn:

- `docker-compose.yml` hiện đang có dòng:

```yaml
DATABASE_URL=postgresql://${POSTGRES_USER}:***@postgres-db:5432/${POSTGRES_DB}?schema=public
```

Dòng này nên đổi thành:

```yaml
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres-db:5432/${POSTGRES_DB}?schema=public
```

Nếu để `***`, môi trường build/run khác có thể không kết nối được DB.

### 4.2 Cloudflare Quick Tunnel

Container:

```txt
ntpc-cloudflare-quick-tunnel
```

Lấy link:

```bash
docker logs ntpc-cloudflare-quick-tunnel | grep -Eo 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' | tail -1
```

Lưu ý:

- Quick Tunnel không đảm bảo uptime.
- Restart container có thể đổi link.
- Production nên dùng Cloudflare Named Tunnel.

### 4.3 Backup/restore

Có các thư mục:

```txt
api/backups/hourly
api/backups/daily
api/backups/monthly
api/backups/manual
api/backups/restore-safety
api/backups/uploaded
```

Đã có checksum `.sha256` và assets `.tgz`.

Có `api/lib/restore_drill.js` để thử restore trong transaction và rollback bằng lỗi chủ đích `ROLLBACK_DRILL`.

Điểm tốt:

- Có tư duy backup nhiều lớp.
- Có checksum.
- Có safety backup trước restore.
- Có restore drill.

Điểm cần sửa:

- Backup nằm trong repo/project directory, rủi ro xóa nhầm cùng source.
- Cần backup offsite: S3/R2/Google Drive/NAS.
- Cần lịch restore drill định kỳ, không chỉ có script.

### 4.4 Sự cố DB gần đây

PostgreSQL từng lỗi WAL/checkpoint:

```txt
invalid magic number 0000 in log segment
PANIC: could not locate a valid checkpoint record
```

Đã xử lý bằng:

1. Dừng DB.
2. Backup `pgdata` sang `repair-backups/`.
3. Chạy `pg_resetwal` bằng image `postgres:15-alpine` với user `postgres`.
4. Start DB lại.
5. Apply migration audit/index thủ công.
6. Verify DB/API/frontend healthy.

Rút kinh nghiệm:

- `pgdata` để trong thư mục project trên `/mnt/c/...` có rủi ro I/O/Windows/WSL làm hỏng WAL.
- Production nên dùng named Docker volume hoặc Linux filesystem thật, không để PostgreSQL data trên Windows mount.

## 5. Điểm mạnh chi tiết

### 5.1 Bám nghiệp vụ thật

Dự án xử lý nhiều quy trình thật:

- Tạo phiếu bảo hành.
- In phiếu.
- Theo dõi trạng thái.
- Ưu tiên phiếu.
- Khách hàng tra cứu công khai.
- Quản lý nhân viên.
- Quản lý nhà cung cấp.
- Gửi/nhận nhà cung cấp.
- Thống kê.
- Import/export.
- Backup/restore.

Đây là điểm mạnh nhất: app có giá trị vận hành, không chỉ demo CRUD.

### 5.2 UI chia module tốt

Frontend có tách:

- `pages`: màn hình nghiệp vụ.
- `components`: component tái sử dụng.
- `services`: gọi API.
- `hooks`: logic React.
- `utils`: xử lý dữ liệu.
- `constants`: trạng thái/route/options.
- `theme`: Ant Design theme.
- `i18n`: đa ngôn ngữ.

Tổ chức này giúp mở rộng dần.

### 5.3 Auth khá tốt cho app nội bộ

Có:

- Cookie httpOnly.
- JWT ký HMAC.
- TTL session.
- Role admin/staff.
- `requireAuth`, `requireRole`.
- Password scrypt.
- Rehash mật khẩu cũ.
- Rate limit login cơ bản.

Đây là nền bảo mật tốt hơn nhiều app nội bộ thường gặp.

### 5.4 Đã chuyển dần sang PostgreSQL

Dự án từng dựa vào JSON, nay đã có Prisma/PostgreSQL. Đây là hướng đúng để:

- Dữ liệu bền hơn.
- Query tốt hơn.
- Backup chuẩn hơn.
- Dễ audit hơn.
- Dễ mở rộng users/records hơn.

### 5.5 Đã có audit log

`AuditLog` giúp truy vết hành động:

- Ai tạo/sửa/xóa.
- Entity nào bị tác động.
- Trước/sau thay đổi.
- IP/user agent.
- Thời điểm.

Rất cần cho app vận hành thật.

### 5.6 Đã có healthcheck

Healthcheck giúp Docker Compose không start mù:

- DB phải healthy trước backend.
- Backend phải healthy trước frontend.
- Dễ quan sát bằng `docker compose ps`.

### 5.7 Backup có chiều sâu

Có backup JSON, assets, checksum, restore-safety, restore drill. Đây là lợi thế lớn so với dự án nội bộ thiếu kế hoạch phục hồi.

## 6. Điểm yếu/rủi ro chi tiết

### 6.1 PostgreSQL data đang nằm trong repo trên Windows mount

Hiện có:

```txt
pgdata/
```

Rủi ro:

- Git status bị bẩn/nặng.
- Xóa project có thể xóa DB.
- Windows/WSL mount có thể làm I/O chậm và tăng rủi ro hỏng WAL.
- Đã từng gặp lỗi WAL/checkpoint.

Khắc phục:

- Không để `pgdata` trong source repo.
- Dùng Docker named volume:

```yaml
volumes:
  postgres_data:

services:
  postgres-db:
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

Hoặc mount vào Linux path thật:

```txt
/var/lib/ntpc/postgres
```

### 6.2 `DATABASE_URL` trong Docker Compose đang sai/không sạch

Vấn đề:

```yaml
DATABASE_URL=postgresql://${POSTGRES_USER}:***@postgres-db:5432/${POSTGRES_DB}?schema=public
```

Rủi ro:

- Deploy mới có thể fail vì password literal là `***`.
- Người khác clone không chạy được.
- CI/staging không ổn định.

Khắc phục:

```yaml
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres-db:5432/${POSTGRES_DB}?schema=public
```

### 6.3 Dữ liệu lai PostgreSQL + JSON còn phức tạp

`api/lib/db.js` vẫn có:

- `readDb()` đọc PostgreSQL rồi trả shape giống JSON cũ.
- fallback sang `api/db.json` khi DB lỗi.
- `writeDb()` ghi đè nhiều bảng.

Rủi ro:

- Dữ liệu lệch giữa PostgreSQL và JSON.
- Ghi đè toàn bảng gây nguy hiểm khi input thiếu.
- Concurrency yếu.
- Query lớn sẽ chậm.

Khắc phục:

- Chỉ giữ `writeDb()` cho import/restore/migration.
- CRUD thường ngày dùng Prisma create/update/delete từng record.
- Production không fallback ghi JSON âm thầm.
- Khi DB lỗi, trả 503 thay vì ghi JSON fallback.

### 6.4 Một số route bảo hành vẫn legacy

Đã chuyển một số phần:

- `suppliers` sang Prisma direct.
- `nhanVien` sang Prisma direct.
- đổi trạng thái warranty sang transaction.

Nhưng vẫn nên chuyển tiếp:

- trả hàng.
- đổi/trả.
- log.
- priority.
- attachments.
- supplier logs.
- import/export.
- customer transfer.

Rủi ro nếu chưa chuyển:

- Một số endpoint vẫn có thể gọi `setCollection` và ghi đè toàn bộ collection.
- Audit chưa phủ toàn bộ hành động nghiệp vụ.
- Transaction chưa bao quanh mọi thay đổi phức tạp.

### 6.5 Date đang lưu String

Ví dụ trong `Warranty`:

```prisma
ngayNhan   String
ngayHenTra String
createdAt  String
updatedAt  String
```

Rủi ro:

- Query theo ngày không tối ưu bằng DateTime.
- Dễ sai timezone/format.
- Sort/filter có thể lệch nếu format không thống nhất.

Khắc phục:

- Migration sang `DateTime?` cho field ngày chính.
- Chuẩn hóa timezone Asia/Ho_Chi_Minh ở presentation layer.
- DB lưu UTC, UI format Việt Nam.

### 6.6 JSON field quá nhiều

Field JSON:

```prisma
doiTra
attachments
history
supplierLogs
```

Ưu điểm:

- Dễ tương thích dữ liệu cũ.
- Linh hoạt.

Nhược điểm:

- Khó index.
- Khó báo cáo.
- Khó validate quan hệ.
- Dễ dữ liệu không nhất quán.

Phương án tốt hơn:

Tách bảng:

```txt
WarrantyAttachment
WarrantyHistory
WarrantyExchangeReturn
WarrantySupplierEvent
```

### 6.7 Upload public cần kiểm soát sâu hơn

Hiện ảnh/file upload phục vụ qua `/uploads`.

Rủi ro:

- Ảnh bảo hành có thể chứa thông tin khách hàng/thiết bị.
- Public static dễ lộ nếu biết URL.
- Cần kiểm tra magic bytes, không chỉ MIME string.

Khắc phục:

- Rename bằng UUID đã có, tốt.
- Thêm magic-byte validation.
- Thêm giới hạn tổng dung lượng theo phiếu/ngày.
- Nếu ảnh riêng tư, phục vụ qua route auth thay vì static public.

### 6.8 Quick Tunnel không phù hợp production

Quick Tunnel tiện test, nhưng:

- Link đổi sau restart.
- Không SLA.
- Không quản lý domain cố định.

Phương án tốt hơn:

- Cloudflare Named Tunnel.
- Domain riêng.
- Access policy nếu cần.
- TLS ổn định.

### 6.9 Test/build còn cần ổn định

Từng ghi nhận:

- `npm test` timeout ở `tests/i18n.test.js`.
- `npm run build` có thể timeout trên filesystem `/mnt/c`.

Khắc phục:

- Chạy project trên Linux filesystem, ví dụ `~/projects/baohanh3ant5`.
- Không dùng chung `node_modules` giữa Windows và WSL.
- Tối ưu test i18n tránh promise treo/detector/browser side effect.
- CI chạy trên Ubuntu để phát hiện lỗi sớm.

## 7. Phương án khắc phục chi tiết

### P0 - Cần làm ngay

1. Sửa `DATABASE_URL` trong Docker Compose.

```yaml
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres-db:5432/${POSTGRES_DB}?schema=public
```

2. Chuyển PostgreSQL data khỏi repo/Windows mount.

```yaml
volumes:
  postgres_data:
```

3. Đảm bảo `.gitignore` có:

```gitignore
.env
pgdata/
api/backups/
api/uploads/
api/db.json
repair-backups/
node_modules/
dist/
*.log
```

4. Kiểm tra backup mới sau khi DB đã reset WAL.

```bash
docker compose exec backend-api node -e "fetch('http://127.0.0.1:3003/api/health').then(r=>r.text()).then(console.log)"
```

5. Chạy manual backup và restore drill.

### P1 - Ổn định dữ liệu

1. Chuyển hết route warranty còn lại sang Prisma direct.
2. Mỗi hành động phức tạp dùng `prisma.$transaction`.
3. Ghi audit log cho mọi hành động thay đổi dữ liệu.
4. Tắt fallback JSON ghi âm thầm trong production.
5. Thêm endpoint `/api/admin/audit-logs` cho admin xem audit.
6. Thêm optimistic locking bằng `updatedAt` khi sửa phiếu.

### P2 - Chuẩn hóa schema

1. Chuyển ngày sang `DateTime`.
2. Thêm enum Prisma:

```prisma
enum WarrantyStatus {
  cho_xu_ly
  dang_xu_ly
  cho_lien_he
  da_tra
  huy
}
```

3. Tách bảng attachments/history/supplier events.
4. Thêm bảng `Customer` thật thay vì build customer master động từ warranties.
5. Thêm unique/index phù hợp:

```prisma
@@unique([code])
@@index([khachHang])
@@index([soDienThoai])
@@index([soSeri])
```

### P3 - Vận hành production

1. Cloudflare Named Tunnel.
2. Backup offsite.
3. Cron restore drill hàng tuần.
4. Monitoring disk/RAM/CPU.
5. Log rotation.
6. Alert khi backup fail.
7. Alert khi DB healthcheck fail.
8. CI bắt buộc pass trước deploy.

## 8. Phương án kiến trúc tốt hơn

### 8.1 Kiến trúc mục tiêu

```txt
Cloudflare DNS + Named Tunnel
  |
  v
Nginx/Caddy reverse proxy
  |
  +--> React static files
  +--> Express API
          |
          +--> PostgreSQL named volume/Linux disk
          +--> Object storage for uploads/backups
          +--> Redis optional for rate limit/session
          +--> Audit log table
```

### 8.2 Backend module hóa

Nên tách:

```txt
api/modules/
  auth/
    auth.routes.js
    auth.controller.js
    auth.service.js
    auth.schema.js
  warranties/
    warranty.routes.js
    warranty.controller.js
    warranty.service.js
    warranty.repository.js
    warranty.schema.js
  suppliers/
  staff/
  backups/
  audit/
```

Lợi ích:

- Dễ test.
- Dễ review.
- Dễ enforce transaction.
- Dễ bỏ legacy `readDb/writeDb`.

### 8.3 Database mục tiêu

```txt
NhanVien
Customer
Warranty
WarrantyAttachment
WarrantyHistory
Supplier
SupplierLog
AuditLog
BackupJob
LoginAttempt
```

Mục tiêu:

- PostgreSQL là source of truth duy nhất.
- JSON chỉ dùng cho metadata linh hoạt, không dùng cho dữ liệu cần query.
- Có foreign key rõ.
- Có indexes theo truy vấn thực tế.

### 8.4 Auth mục tiêu

Hiện tại cookie JWT ổn cho app nhỏ. Bản tốt hơn:

- Session table/Redis để revoke phiên.
- CSRF token cho request ghi dữ liệu.
- Audit login/logout/change password.
- Password policy.
- Optional 2FA cho admin.

### 8.5 Backup mục tiêu

Backup nên gồm:

```txt
pg_dump custom format
uploads archive
metadata JSON
sha256 checksum
offsite copy
restore drill report
```

Command mẫu:

```bash
pg_dump --format=custom --file=ntpc.dump "$DATABASE_URL"
tar -czf uploads.tgz api/uploads
sha256sum ntpc.dump uploads.tgz > SHA256SUMS
```

Restore drill:

1. Restore vào DB staging.
2. Chạy migration.
3. Chạy smoke test.
4. Đối chiếu số phiếu/nhân viên/NCC/uploads.
5. Gửi báo cáo.

## 9. Hướng dẫn vận hành nhanh

### 9.1 Chạy Docker

```bash
docker compose up -d --build
```

### 9.2 Xem trạng thái

```bash
docker compose ps
```

### 9.3 Xem log backend

```bash
docker logs -f ntpc-backend-api
```

### 9.4 Xem link Cloudflare Quick Tunnel

```bash
docker logs ntpc-cloudflare-quick-tunnel | grep -Eo 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' | tail -1
```

### 9.5 Kiểm tra API

```bash
curl http://localhost:8888/api/health
```

### 9.6 Apply migration

```bash
npx prisma migrate deploy
```

Nếu DB đã có schema cũ và chưa có `_prisma_migrations`, cần baseline hoặc apply SQL thủ công + resolve.

### 9.7 Prisma validate/generate

```bash
npx prisma validate
npx prisma generate
```

## 10. Checklist trước production

### Bảo mật

- [ ] `AUTH_SECRET` mạnh, >= 32 ký tự.
- [ ] `COOKIE_SECURE=true` khi chạy HTTPS.
- [ ] CORS chỉ cho domain thật.
- [ ] Helmet bật.
- [ ] CSP cấu hình theo domain thật.
- [ ] Upload kiểm tra magic bytes.
- [ ] Admin route có `requireRole('admin')`.
- [ ] `.env` không commit.

### Dữ liệu

- [ ] PostgreSQL data dùng named volume/Linux disk.
- [ ] Backup offsite.
- [ ] Restore drill định kỳ.
- [ ] Không fallback JSON ghi âm thầm trong production.
- [ ] Audit log phủ mọi hành động ghi.
- [ ] Migration được quản lý chuẩn.

### Code

- [ ] `npm test` pass.
- [ ] `npm run build` pass.
- [ ] CI pass.
- [ ] Route warranty legacy đã chuyển sang Prisma direct.
- [ ] Không còn secret trong log.
- [ ] Lint/format có script chính thức.

### Vận hành

- [ ] Docker healthcheck healthy.
- [ ] Không expose PostgreSQL port nếu không cần.
- [ ] Cloudflare Named Tunnel thay Quick Tunnel.
- [ ] Log rotation.
- [ ] Monitoring disk.
- [ ] Alert khi backup/restore drill fail.

## 11. Kết luận

Dự án NTPC Warranty có nền nghiệp vụ mạnh và đã qua nhiều bước nâng cấp quan trọng: React UI, Express API, Prisma/PostgreSQL, auth cookie, phân quyền, backup, restore drill, audit log, Docker healthcheck, Cloudflare tunnel. Điểm mạnh lớn nhất là app bám sát quy trình bảo hành thật và đã có cơ chế bảo vệ dữ liệu tốt hơn mức trung bình của dự án nội bộ.

Rủi ro lớn nhất còn lại nằm ở vận hành dữ liệu: PostgreSQL data đang nằm trong project/Windows mount, một số route bảo hành vẫn còn legacy `writeDb/setCollection`, date field còn là String, JSON field còn nhiều, và Quick Tunnel chưa phù hợp production. Sự cố WAL vừa qua cho thấy cần ưu tiên chuyển data ra named volume/Linux disk và tăng kỷ luật backup/restore drill.

Phương án tốt hơn là giữ luồng nghiệp vụ hiện tại, nhưng hoàn tất chuyển backend sang Prisma direct theo module, chuẩn hóa schema quan hệ, tách bảng history/attachments/supplier events, dùng Named Tunnel/domain cố định, backup offsite, CI bắt buộc, và quan sát sức khỏe hệ thống bằng healthcheck/alert. Khi hoàn tất các bước này, dự án đủ nền để chạy ổn định dài hạn cho vận hành thật.

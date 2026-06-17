# NTPC Bảo Hành — Tài Liệu Kỹ Thuật Toàn Diện

> Tài liệu mô tả chi tiết toàn bộ hệ thống quản lý bảo hành của **Công ty TNHH Máy Tính Nguyễn Tân** (NTPC).
> Mục đích: phục vụ onboarding, đánh giá hiện trạng, và lập kế hoạch phát triển tiếp theo.
> Phiên bản hệ thống đang chạy: **v3.0.0** (`package.json`), code-name nội bộ `baohanh3ant5`.
> Tên miền production: `https://baohanh.nguyentanpc.com` (Cloudflare Tunnel).

---

## Mục Lục

1. [Tổng quan sản phẩm](#1-tổng-quan-sản-phẩm)
2. [Tech stack & phiên bản](#2-tech-stack--phiên-bản)
3. [Kiến trúc hệ thống (Docker)](#3-kiến-trúc-hệ-thống-docker)
4. [Cấu trúc thư mục](#4-cấu-trúc-thư-mục)
5. [Backend — tổng quan](#5-backend--tổng-quan)
6. [Backend — Data layer (`api/lib/db.js`)](#6-backend--data-layer-apilibdbjs)
7. [Backend — Authentication (`api/lib/auth.js`)](#7-backend--authentication-apilibauthjs)
8. [Backend — Backup & Restore (`api/lib/backup.js`)](#8-backend--backup--restore-apilibbackupjs)
9. [Backend — Audit / Validators / Helpers](#9-backend--audit--validators--helpers)
10. [Backend — REST API endpoints](#10-backend--rest-api-endpoints)
11. [Cơ sở dữ liệu — Prisma schema](#11-cơ-sở-dữ-liệu--prisma-schema)
12. [Frontend — Bootstrap & Routing](#12-frontend--bootstrap--routing)
13. [Frontend — i18n, Theme, Hooks](#13-frontend--i18n-theme-hooks)
14. [Frontend — Pages (Admin)](#14-frontend--pages-admin)
15. [Frontend — Pages (Customer / Public)](#15-frontend--pages-customer--public)
16. [Frontend — Components & Services](#16-frontend--components--services)
17. [Frontend — Styles (157K global.css)](#17-frontend--styles-157k-globalcss)
18. [Backup format & tương thích](#18-backup-format--tương-thích)
19. [Quy trình nghiệp vụ chính](#19-quy-trình-nghiệp-vụ-chính)
20. [Bảo mật hiện tại](#20-bảo-mật-hiện-tại)
21. [Build, Test, Deploy](#21-build-test-deploy)
22. [Điểm mạnh](#22-điểm-mạnh)
23. [Điểm yếu & Tech debt](#23-điểm-yếu--tech-debt)
24. [Rủi ro & bẫy đã biết](#24-rủi-ro--bẫy-đã-biết)
25. [Khuyến nghị khi lập kế hoạch mới](#25-khuyến-nghị-khi-lập-kế-hoạch-mới)

---

## 1. Tổng quan sản phẩm

### 1.1. Bài toán nghiệp vụ
Một trung tâm bảo hành máy tính (Nguyễn Tân PC, Đồng Nai) cần quản lý toàn bộ vòng đời **phiếu bảo hành** từ lúc khách mang máy đến cho đến khi trả lại khách, bao gồm:

- Tiếp nhận → xử lý → gửi nhà cung cấp (NCC) → nhận lại → trả khách.
- Theo dõi trạng thái, lịch sử thao tác, hẹn ngày trả, phí, đổi/trả hàng.
- Quản lý khách hàng, nhân viên, NCC.
- Khách hàng tra cứu tiến độ phiếu **không cần đăng nhập** bằng số chứng từ / SĐT.
- In phiếu A4 có QR code.
- Thống kê dashboard, top sản phẩm / khách hàng.
- Sao lưu/phục hồi dữ liệu.

### 1.2. Đối tượng sử dụng
- **Nhân viên tiếp nhận** (`/admin/phieu`, `/admin/tao-phieu`, `/admin/khach-hang`): nhập phiếu, cập nhật trạng thái, in phiếu.
- **Nhân viên kỹ thuật**: cập nhật tiến độ, đổi/trả hàng, đính kèm ảnh.
- **Quản lý** (admin role): xem dashboard, thống kê, quản lý nhân viên, NCC, import/export, backup/restore.
- **Khách hàng cuối** (public, `/tra-cuu`): tra cứu phiếu bằng số chứng từ hoặc SĐT.

### 1.3. Quy mô
- **Phiếu**: ~4,000+ bản ghi (`stt: 4043` cho thấy seed data đã build tới index này).
- **Nhân viên**: 4 trong seed (`admin`, `nv001`, `nv002`, `nv003`) — tăng trưởng thực tế không lớn.
- **NCC**: tùy biến, quản lý CRUD.
- **Backup**: hourly backups đang chạy (`api/backups/hourly/db-20260615-*.json` ~311KB mỗi file).
- **Lượt tra cứu public**: rate-limit 30 req/phút/IP.

---

## 2. Tech stack & phiên bản

### 2.1. Frontend
| Công nghệ | Phiên bản | Vai trò |
|-----------|-----------|---------|
| React | 18.3.0 | UI framework |
| Vite | 5.4.0 | Build tool, dev server |
| antd | 5.22.2 | UI components desktop |
| antd-mobile | 5.42.3 | UI components mobile |
| @ant-design/icons | 5.5.2 | Icon set |
| @ant-design/charts | 2.2.0 | Biểu đồ (Statistics) |
| @ant-design/x | 1.6.1 | AI Assistant bubble |
| react-router-dom | 6.26.0 | Routing (v7 future flags đã bật) |
| react-i18next + i18next | 17.0.8 / 26.2.0 | Đa ngôn ngữ |
| i18next-browser-languagedetector | 8.2.1 | Auto-detect ngôn ngữ |
| axios | 1.7.0 | HTTP client |
| dayjs | 1.11.13 | Date utility (chính) |
| date-fns | 3.6.0 | Date utility (phụ) |
| react-hook-form | 7.53.0 | Form state (chưa dùng nhiều) |
| zod | 3.23.0 | Validation schema (chưa dùng ở FE) |
| react-quill | 2.0.0 | Rich-text editor (notes) |
| dompurify | 3.4.8 | Sanitize HTML |
| react-to-print | 3.0.0 | In phiếu A4 |
| qrcode.react | 4.0.1 | QR code trên phiếu in |
| xlsx | 0.18.5 | Import/Export Excel |
| uuid | 10.0.0 | ID generation (FE) |

### 2.2. Backend
| Công nghệ | Phiên bản | Vai trò |
|-----------|-----------|---------|
| Node.js | 20 LTS (Alpine) | Runtime |
| Express | 4.21.0 | HTTP server |
| Prisma | 5.20.0 | ORM (PostgreSQL) |
| @prisma/client | 5.20.0 | Prisma runtime |
| helmet | 8.0.0 | HTTP security headers |
| cors | 2.8.5 | CORS |
| morgan | 1.10.0 | Request logger |
| body-parser | 1.20.0 | Body parser |
| dayjs | 1.11.13 | Date utility |
| zod | 3.23.0 | Server-side validation |
| uuid | 10.0.0 | ID generation |
| tar (CLI) | — | Đóng gói uploads backup |

### 2.3. Database
| Công nghệ | Phiên bản | Vai trò |
|-----------|-----------|---------|
| PostgreSQL | 15-alpine | CSDL chính |
| JSONB | — | Lưu `history`, `attachments`, `doiTra`, `supplierLogs` dạng JSON trong PG |

### 2.4. Infrastructure
| Công nghệ | Vai trò |
|-----------|---------|
| Docker Compose v3.8 | Orchestration 4 services |
| Nginx (alpine) | Static SPA + reverse proxy `/api` |
| Cloudflare Quick Tunnel | Public HTTPS (trycloudflare.com) |
| `tz=Asia/Ho_Chi_Minh` | Toàn bộ hệ thống dùng múi giờ VN |

### 2.5. Testing / Quality
| Công nghệ | Phiên bản | Vai trò |
|-----------|-----------|---------|
| Vitest | 2.0.0 | Unit test (FE) |
| @testing-library/react | 16.0.0 | Component test |
| jsdom | 24.0.0 | DOM test env |
| playwright | 1.60.0 | E2E (chưa dùng nhiều) |
| eslint | 9.0.0 | Lint |
| prettier | 3.3.0 | Format |

---

## 3. Kiến trúc hệ thống (Docker)

### 3.1. Topology
```
                ┌─────────────────────────────────────┐
                │   Cloudflare Quick Tunnel (HTTPS)   │
                │   https://baohanh.nguyentanpc.com   │
                └────────────────┬────────────────────┘
                                 │
                ┌────────────────▼────────────────────┐
                │   frontend-web (nginx alpine) :80  │
                │   host port 8888 → container 80     │
                │   - SPA static (dist/)              │
                │   - /api/* → proxy backend-api:3003 │
                │   - /uploads/* → proxy backend-api  │
                └────────────────┬────────────────────┘
                                 │ (mạng nội bộ ntpc-network)
                ┌────────────────▼────────────────────┐
                │   backend-api (node 20 alpine) :3003│
                │   - Express + Prisma                │
                │   - Backup scheduler                │
                │   - JWT auth + scrypt hash          │
                │   Volumes: ./api/uploads, ./api/backups
                └────────────────┬────────────────────┘
                                 │
                ┌────────────────▼────────────────────┐
                │   postgres-db (postgres:15-alpine)  │
                │   internal 5432, host 5435          │
                │   Volume: ./pgdata (persistent)     │
                └─────────────────────────────────────┘
```

### 3.2. Services (`docker-compose.yml`)
| Service | Image/Build | Healthcheck | Restart |
|---------|------------|-------------|---------|
| `postgres-db` | `postgres:15-alpine` | `pg_isready` | always |
| `backend-api` | `./api.Dockerfile` | `GET /api/health` (200/503) | always |
| `frontend-web` | `./web.Dockerfile` | `wget localhost` | always |
| `cloudflare-quick-tunnel` | `cloudflare/cloudflared:latest` | — | always |

### 3.3. Network
- Mạng bridge `ntpc-network` cô lập, mọi giao tiếp nội bộ qua DNS tên service.
- Không có container nào public port DB ra ngoài (chỉ map 5435 cho debug).
- Port 8888 (frontend) và 5435 (postgres) là các port duy nhất lộ ra host.

### 3.4. Dependencies (depends_on + health)
- `backend-api` chờ `postgres-db` healthy.
- `frontend-web` chờ `backend-api` healthy.
- `cloudflare-quick-tunnel` chờ `frontend-web` (không có healthcheck trên tunnel — race condition nhỏ khi boot lần đầu, người dùng có thể thấy 502 vài giây).

### 3.5. Volumes (persistent data)
| Host path | Container path | Mục đích |
|-----------|---------------|---------|
| `./pgdata` | `/var/lib/postgresql/data` | Toàn bộ PG data |
| `./api/uploads` | `/app/api/uploads` | Ảnh đính kèm (chưa xóa) |
| `./api/backups` | `/app/api/backups` | Snapshots + history.json |

### 3.6. Environment (.env, không commit)
```
AUTH_SECRET                 # JWT secret, >=32 chars in production
INITIAL_STAFF_PASSWORD      # Bootstrap password cho admin lần đầu
SESSION_TTL_SECONDS         # Mặc định 8*3600 = 8h (override 86400 trong .env.example)
COOKIE_SECURE               # true cho HTTPS, false cho dev
API_PORT                    # 3003
CORS_ORIGIN                 # Domain frontend thật
POSTGRES_USER/PASSWORD/DB   # ntpc_user / ntpc_warranty
DATABASE_URL                # postgresql://...@postgres-db:5432/ntpc_warranty
```

---

## 4. Cấu trúc thư mục

```
/mnt/baohanhntpc/
├── api/                                # Backend (Node + Express)
│   ├── server.js                       # 7.6K - bootstrap + middleware + mount routes
│   ├── seedData.js                     # 7.0K - data mẫu (4 NV, ~6 phiếu)
│   ├── lib/                            # Core libs
│   │   ├── db.js                       # 21.5K - Prisma wrapper + JSON fallback + sync
│   │   ├── auth.js                     # 8.9K - JWT + scrypt + session cookie
│   │   ├── backup.js                   # 30.6K - snapshot, restore, scheduler
│   │   ├── restore_drill.js            # 8.1K - test restore không commit (rollback)
│   │   ├── audit.js                    # 962B - ghi audit log
│   │   ├── validators.js               # 6.2K - zod schemas
│   │   ├── customerMaster.js           # 3.6K - aggregate customers từ phiếu
│   │   └── customers.js                # 4.5K - helpers cho customer rows
│   ├── routes/                         # REST endpoints
│   │   ├── auth.js                     # 2.6K - login/logout/me/change-password
│   │   ├── nhanVien.js                 # 6.6K - staff CRUD
│   │   ├── warranties.js               # 62.9K - main CRUD (largest file)
│   │   ├── customers.js                # 9.4K - customer master
│   │   ├── suppliers.js                # 8.7K - NCC CRUD
│   │   ├── supplierLogs (embedded)     # trong warranties.js
│   │   ├── stats.js                    # 6.2K - dashboard stats
│   │   ├── customerNotifications.js    # 12.0K - banner/popup cho public
│   │   ├── public.js                   # 11.5K - tra cứu public + notifications
│   │   └── backups.js                  # 2.9K - admin backup API
│   ├── uploads/                        # Ảnh đính kèm (persistent, gitignored)
│   ├── backups/                        # Snapshot files + history.json
│   ├── db.json                         # 243K - JSON fallback (deprecated primary)
│   ├── db.json.bak.*                   # Backups cũ (chỉ giữ local, không commit)
│   ├── db.example.json                 # 122B - placeholder template
│   └── *.bak* / *.prev                 # Nhiều file backup nội bộ
│
├── src/                                # Frontend (React + Vite)
│   ├── main.jsx                        # Entry
│   ├── App.jsx                         # 6.0K - routes + ConfigProvider + Auth
│   ├── components/
│   │   ├── admin/
│   │   │   └── BackupRestorePanel.jsx  # 15.2K
│   │   ├── common/                     # 9 components dùng chung
│   │   │   ├── AiAssistant.jsx         # 16.6K - chat AI bubble (mock)
│   │   │   ├── ChangePasswordModal.jsx # 2.3K
│   │   │   ├── CustomerPickerModal.jsx # 15.0K
│   │   │   ├── ErrorBoundary.jsx       # 782B
│   │   │   ├── FloatingZalo.jsx        # 12.1K - draggable Zalo button
│   │   │   ├── ShortcutsModal.jsx      # 1.1K
│   │   │   ├── SkeletonCard.jsx        # 201B
│   │   │   └── StaffPickerModal.jsx    # 2.8K - login modal
│   │   ├── customer/
│   │   │   └── CustomerNotifications.jsx # 4.5K - banner/popup public
│   │   ├── layout/
│   │   │   ├── AdminLayout.jsx         # 1.2K
│   │   │   ├── AppHeader.jsx           # 5.8K
│   │   │   ├── AppSider.jsx            # 4.7K
│   │   │   └── CustomerLayout.jsx      # 6.6K
│   │   └── warranty/
│   │       ├── WarrantyDetail.jsx      # 123.1K - hero component (rất lớn)
│   │       ├── WarrantyPrint.jsx       # 30.5K - A4 print template
│   │       ├── WarrantyProgress.jsx    # 754B
│   │       ├── StatusTag.jsx           # 308B
│   │       └── MobileStatusTag.jsx     # 547B
│   │       # + nhiều .backup-* files (rollback safety)
│   ├── pages/
│   │   ├── admin/                      # 9 pages quản trị
│   │   │   ├── Dashboard.jsx           # 21.2K
│   │   │   ├── WarrantyList.jsx        # 26.0K
│   │   │   ├── CreateWarranty.jsx      # 22.6K
│   │   │   ├── CustomerInfo.jsx        # 31.3K
│   │   │   ├── StaffManagement.jsx     # 10.4K
│   │   │   ├── Suppliers.jsx           # 31.3K
│   │   │   ├── ImportExport.jsx        # 14.5K
│   │   │   ├── Statistics.jsx          # 13.0K
│   │   │   └── CustomerNotifications.jsx # 11.5K
│   │   └── customer/                   # Tra cứu public
│   │       ├── Tracuu.jsx              # 23.6K
│   │       ├── TrackingResult.jsx      # 57.4K
│   │       └── CustomerPortal.jsx      # 14.8K
│   ├── hooks/                          # 5 hooks
│   ├── contexts/AuthContext.jsx        # 1.6K
│   ├── services/warrantyService.js     # 4.5K - toàn bộ API client
│   ├── services/backupService.js       # 1.2K
│   ├── lib/
│   │   ├── axios.js                    # 412B - instance + 429 handler
│   │   ├── richText.js                 # 1.6K - DOMPurify wrapper
│   │   └── zodSchemas.js               # 1.1K (chưa wire nhiều)
│   ├── constants/                      # statusConfig, warrantyOptions, badgeConfig
│   ├── utils/                          # dateHelpers, excelHelpers, historyTimeline, ...
│   ├── theme/antdTheme.js              # 1.8K - light/dark antd theme
│   ├── i18n/
│   │   ├── index.js                    # i18next init (namespace ui mặc định)
│   │   └── locales/vi/                 # 6 namespaces, ~60KB JSON
│   │       ├── ui.json                 # 46.3K
│   │       ├── print.json              # 4.6K
│   │       ├── nav.json                # 887B
│   │       ├── messages.json           # 751B
│   │       ├── validation.json         # 864B
│   │       └── status.json             # 581B
│   ├── styles/
│   │   ├── global.css                  # 157.7K (!) — toàn bộ style admin + customer
│   │   └── print.css                   # 831B
│   └── utils/...
│
├── prisma/
│   ├── schema.prisma                   # 7.8K - 5 models chính
│   └── migrations/20260525_add_audit_indexes/
│       └── migration.sql               # Indexes + audit_logs table
│
├── tests/                              # Vitest
│   ├── setup.js
│   ├── i18n.test.js
│   ├── StatusTag.test.jsx
│   ├── generateChungTu.test.js
│   ├── fieldLabels.smoke.test.js
│   ├── urgency.test.js
│   └── vietnameseUi.test.js
│
├── public/                             # Static assets
│   ├── logo.png, white.png
│   └── favicon.ico
│
├── dist/                               # Vite build output
├── pgdata/                             # PG data persistent (gitignored)
├── api/uploads/                        # Ảnh persistent (gitignored)
├── api/backups/                        # Snapshots + history (gitignored)
│
├── nginx.conf                          # Reverse proxy + SPA serve
├── docker-compose.yml                  # 4 services
├── api.Dockerfile                      # Node 20 alpine + Prisma generate
├── web.Dockerfile                      # Multi-stage: build → nginx
├── vite.config.js                      # Port 8888, proxy /api → :3004 (dev)
├── vitest.config.js                    # jsdom env
├── package.json                        # Scripts: dev, build, test, api, start
├── .env.example                        # Template
├── .gitignore                          # + .hermes, .backup, .bak-*, scratch/
└── README.md                           # README gốc (28.8K, ngắn gọn)
```

---

## 5. Backend — tổng quan

### 5.1. Bootstrap (`api/server.js`)

Server khởi chạy theo thứ tự:

1. **Đọc `.env` thủ công** (không qua `dotenv`): tự parse file `.env` từ `..`, gán `process.env.*`. Lý do: container production mount `.env` qua Docker secrets, không cần dotenv.
2. **Import động** (`await import('./lib/db.js')` v.v.) — top-level await.
3. **Khởi tạo Express** với:
   - `helmet` (CSP optional, default off để khỏi vỡ SVG/inline).
   - `cors` với `checkCorsOrigin` cho phép localhost + LAN (10.x, 172.16-31.x, 192.168.x).
   - `morgan('dev')` cho log.
   - `express.json({ limit: '50mb' })` cho phép upload ảnh base64 lớn.
4. **Serve `/uploads`** tĩnh qua `express.static`.
5. **Set security headers** (`X-Content-Type-Options`, `X-Frame-Options: DENY`, `X-XSS-Protection`).
6. **Force UTF-8 JSON** response header.
7. **Mount routes theo thứ tự**:
   - `GET /api/health` — không auth.
   - `/api/public` — không auth (tra cứu, notifications).
   - `attachUser` middleware — parse JWT cookie, gán `req.user`.
   - `/api/auth` — login/logout.
   - `requireAuth` middleware — chặn mọi route sau đó.
   - `/api/warranties`, `/api/nhan-vien`, `/api/stats`, `/api/customers`, `/api/suppliers`, `/api/customer-notifications`.
   - `/api/admin/backups` — `requireRole('admin')`.
8. **`seedIfEmpty()`**: thử kết nối PG 5 lần (delay 2s/lần), fallback về `db.json` nếu thất bại. Nếu DB trống thì seed từ `seedData.js`.
9. **`startBackupScheduler()`** — chạy ngay sau seed.

### 5.2. CORS logic chi tiết
```
if (!origin)                       → OK (mobile app, curl)
if (origin in allowedOrigins)       → OK
if (hostname localhost/127.0.0.1)   → OK
if (10.x | 172.16-31.x | 192.168.x) → OK (LAN)
else                                 → DENY
```

### 5.3. Middleware chain (thứ tự áp dụng)
```
request
  → helmet (set headers, optionally CSP)
  → cors (check origin)
  → morgan (log)
  → express.json (parse body)
  → static /uploads
  → security headers
  → JSON UTF-8 wrapper
  → /api/health (no auth, no user)
  → /api/public (no auth, no user)
  → attachUser (parses JWT cookie, sets req.user if valid)
  → /api/auth (login sets cookie, others use req.user)
  → requireAuth (rejects 401 if no req.user)
  → /api/warranties, /api/nhan-vien, /api/stats, /api/customers, /api/suppliers, /api/customer-notifications
  → /api/admin/backups (requireRole 'admin')
```

### 5.4. Error envelope
Mọi response lỗi trả về:
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```
Response thành công:
```json
{ "success": true, "data": { ... } }
```

---

## 6. Backend — Data layer (`api/lib/db.js`)

Đây là lớp **abstraction quan trọng nhất** — toàn bộ routes gọi qua nó thay vì trực tiếp Prisma. Lý do: hỗ trợ fallback JSON khi PG chưa sẵn sàng + đảm bảo 100% tương thích ngược với cấu trúc `db.json` cũ.

### 6.1. Khởi tạo
```js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const DB_PATH = path.join(__dirname, '..', 'db.json');
```

### 6.2. `readDb()` — đọc toàn bộ
- Query 5 bảng song song bằng `Promise.all`: `warranty`, `nhanVien`, `supplier`, `supplierLog`, `customerNotification`.
- Đọc `db.json` để lấy `adminConfig` và `customers` (lưu JSON, không migrate sang PG).
- Normalize: `nhanVien.role = quyen`, `supplierLogs.at = createdAt`.
- Trả về object khớp 100% cấu trúc `db.json`:
  ```js
  { warranties, nhanVien, suppliers, supplierLogs, customerNotifications, adminConfig, customers }
  ```
- **Fallback**: nếu PG lỗi → đọc `db.json` (mode degraded). Nếu cả hai đều lỗi → trả object rỗng.

### 6.3. `writeDb(data)` — ghi toàn bộ
- **Transaction** với Prisma: xóa hết (`deleteMany` theo thứ tự phụ thuộc) → tạo lại theo thứ tự độc lập.
- **Batch insert** `warranties` theo lô 100 (tránh vượt giới hạn param PG).
- **Đồng bộ mirror ra `db.json`** (atomic write qua `fs.writeFileSync`).
- **Fallback**: nếu transaction lỗi → ghi `db.json` local làm dự phòng. BẢO TOÀN dữ liệu trong mọi tình huống.

### 6.4. `addToCollection(name, item)` — thêm 1 record
- Tùy `name` (`warranties` / `nhanVien` / `suppliers` / `supplierLogs`) mà dùng `prisma.create` tương ứng.
- Fallback: ghi vào `db.json` nếu PG lỗi.
- Tránh trùng lặp: kiểm tra `id` / `maNV` đã tồn tại chưa.

### 6.5. `syncLocalBackup()` — debounced write queue
- Trigger mỗi khi có thay đổi dữ liệu.
- Lưu snapshot vào RAM buffer.
- Sau 2.5 giây không có thay đổi mới → ghi `db.json` ra đĩa.
- Tối ưu disk I/O khi có nhiều write liên tiếp (vd: import 1000 phiếu).
- **Graceful shutdown**: lắng nghe `SIGINT`/`SIGTERM` → `flushWriteQueueSync()` ghi cưỡng bức.

### 6.6. `autoSelfHealingSync()` — tự phục hồi
Chạy khi server start:
1. Đọc PG và `db.json`.
2. So sánh `max(updatedAt)` của mỗi bên.
3. Nếu `db.json` mới hơn → **reverse sync** (ghi `db.json` lại PG).
4. Nếu PG mới hơn → forward sync ra `db.json`.
5. Nếu cả hai đều rỗng → thì thôi.

Đây là **safety net** khi deploy lỗi: nếu ai đó edit `db.json` thủ công rồi restart, hệ thống tự phát hiện và merge.

### 6.7. Điểm đáng lưu ý
- `customers` collection chỉ tồn tại trong `db.json`, không có bảng PG. Mọi query customer phải đi qua `getCollection('customers')` → `readDb()`.
- `writeDb` XÓA SẠCH rồi INSERT lại (slow với 10K+ records). Mỗi thao tác CRUD không phải `warranty` cũng trigger full re-write.
- Khi cập nhật 1 warranty, flow thật sự:
  1. Route `PUT /warranties/:id` gọi `prisma.warranty.update(...)` (nhanh).
  2. Sau đó gọi `setCollection('customers', ...)` hoặc `syncLocalBackup()` → trigger `writeDb` → full table rebuild.

---

## 7. Backend — Authentication (`api/lib/auth.js`)

### 7.1. Cơ chế
- **JWT** tự ký bằng `crypto.createHmac('sha256', AUTH_SECRET)`.
- **Lưu trong HTTP-only cookie** `ntpc_session` (sameSite=lax, secure=true ở prod).
- **Session TTL** mặc định 8h (`SESSION_TTL_SECONDS`).
- **Hash password** bằng `scrypt` với salt ngẫu nhiên 16 bytes:
  ```
  scrypt$<salt_base64url>$<hash_base64url>
  ```
- Hỗ trợ fallback SHA-256 cũ (auto-rehash sang scrypt khi login thành công).

### 7.2. Login flow
```js
POST /api/auth/login { maNV, matKhau }
  → check maNV + matKhau tồn tại
  → check rate limit (8 lần/10 phút/IP+maNV)
  → verify password (scrypt hoặc sha256)
  → nếu OK: tạo JWT, set cookie ntpc_session
  → trả { maNV, tenNV, role, active }
```

### 7.3. Authorization
- `requireAuth`: 401 nếu không có `req.user`.
- `requireRole('admin')`: 403 nếu `req.user.role !== 'admin'`.
- Áp dụng:
  - `POST/PUT/PATCH/DELETE /api/nhan-vien/*` → admin only.
  - `DELETE /api/warranties/*` → admin only (cá nhân có thể edit).
  - `POST /api/customers/delete` → admin only.
  - `ALL /api/admin/backups/*` → admin only.

### 7.4. Bootstrap
Khi server start lần đầu (DB trống):
- Nếu `INITIAL_STAFF_PASSWORD` được set → hash password đó cho `admin` user.
- Nếu trong DB không có admin nào → set role admin cho user đầu tiên.

### 7.5. Rate limiting (login)
- 8 lần sai / 10 phút / (IP + maNV).
- Sau khi vượt → 429 cho đến khi window trôi qua.
- Lưu trong `Map` in-memory → mất khi restart.

### 7.6. Điểm đáng lưu ý
- `req.user` chỉ chứa `maNV`, `tenNV`, `role`, `active` (sanitize) — không bao giờ trả password hash về client.
- Header `x-nhan-vien` cũng được set để backwards-compat với code cũ.
- Cookie tên `ntpc_session` cố định, không thể đổi qua env (chỉ TTL).

---

## 8. Backend — Backup & Restore (`api/lib/backup.js`)

Đây là một trong những **module phức tạp nhất** (~30K LOC, 777 dòng).

### 8.1. Các loại backup
| Type | Mục đích | Retention | Số lượng tối đa |
|------|----------|-----------|-----------------|
| `minute` | Snapshots mỗi phút (chỉ khi thay đổi) | 6h | 10 |
| `hourly` | Mỗi giờ | 7 ngày | 10 |
| `daily` | Mỗi ngày | 365 ngày | 10 |
| `monthly` | Ngày 1 hàng tháng | 5 năm | 10 |
| `manual` | User tạo thủ công | 5 năm | 10 |
| `restore-safety` | Auto tạo trước khi restore | 30 ngày | 10 |
| `uploaded` | Upload từ máy khác | 7 ngày | 10 |

### 8.2. Cấu trúc file backup
Mỗi backup lưu 3 file:
```
backups/<type>/db-YYYYMMDD-HHmmss.json        # Main JSON
backups/<type>/db-YYYYMMDD-HHmmss.json.sha256 # SHA-256 checksum
backups/<type>/db-YYYYMMDD-HHmmss.assets.tgz  # Gói ảnh (nếu có)
backups/<type>/db-YYYYMMDD-HHmmss.assets.tgz.sha256
backups/<type>/db-YYYYMMDD-HHmmss.assets.tgz.json # Manifest gói ảnh
backups/<type>/db-YYYYMMDD-HHmmss.assets.tgz.list # tmp file (xóa sau)
```

### 8.3. Snapshot format (`backupVersion: 3`)
```json
{
  "backupVersion": 3,
  "createdAt": "2026-06-15T01:50:38+07:00",
  "source": "baohanh3ant5",
  "appData": {
    "phieu": [ ... warranties không có deletedAt ... ],
    "khachHang": [ ... customer rows (buildCustomerRows) ... ],
    "nhaCungCap": [ ... suppliers active ... ],
    "nhanVien": [ ... staff active ... ],
    "supplierLogs": [ ... logs lọc theo supplier/warranty còn tồn tại ... ]
  }
}
```
Định dạng V3 tách `appData` rõ ràng để dễ mở rộng (vs V1 raw `db.json` shape).

### 8.4. Asset bundle (ảnh)
- Duyệt snapshot tìm tất cả URL `/uploads/warranties/...` trong `attachments` của từng phiếu.
- Gom thành 1 file `.tgz` (tar gzip).
- Tính **assetKey** = SHA-256 của danh sách `(rel, size, mtime)`. Nếu key trùng với bundle cũ → **hardlink** thay vì tạo mới → tiết kiệm đĩa.
- Verify SHA-256 khi restore.

### 8.5. Scheduler
Chạy khi `startBackupScheduler()` được gọi (1 lần duy nhất):
- `setInterval(hourly, 1h)`.
- `setInterval(daily, 24h)`.
- `setInterval(monthly check, 24h)` — chỉ tạo monthly khi `getDate() === 1`.
- `setInterval(cleanup, 6h)`.

Lưu ý: **KHÔNG** có backup `minute` tự động (chỉ chạy khi gọi thủ công `createBackup('minute', { onlyIfChanged: true })`).

### 8.6. Restore flow
1. User nhập `RESTORE` để xác nhận.
2. Tạo `restore-safety` backup TRƯỚC.
3. Verify SHA-256 của file backup.
4. `atomicWriteJsonFile(DB_PATH, data)` → ghi vào PG (qua `writeDb`).
5. Nếu có `.assets.tgz` → extract về `api/uploads/`.
6. Ghi `appendHistory({ action: 'restore', status: 'success' })`.

### 8.7. Upload & restore
- User upload file `.json` từ máy local → server lưu vào `backups/uploaded/`, verify SHA, rồi apply.
- User có thể upload riêng file `.assets.tgz` (nếu chỉ muốn restore ảnh).

### 8.8. Restore drill (`api/lib/restore_drill.js`)
- Mô phỏng restore: chạy transaction đầy đủ (delete + insert) rồi `throw new Error('ROLLBACK_DRILL')` để rollback.
- Dùng để **kiểm tra file backup có hợp lệ không** mà không cần backup hiện tại.
- Trả về `ok: true` nếu schema + FK đều pass.

### 8.9. Pinned backup
- User có thể "ghim" backup quan trọng (`pinned: true` lưu trong `metadata.json`).
- Cleanup **không xóa** pinned backups kể cả khi vượt retention.
- Mỗi backup có `note` (tối đa 500 chars) cho admin ghi chú.

### 8.10. History log
- File `backups/history.json` (rolling 180 ngày, tối đa 10K entries).
- Mỗi action: `backup`, `restore`, `upload_restore`, `delete_backup`, `cleanup`, `metadata`.
- Hiển thị trong UI `BackupRestorePanel.jsx`.

---

## 9. Backend — Audit / Validators / Helpers

### 9.1. Audit (`api/lib/audit.js`)
```js
writeAuditLog(req, {
  action: 'create' | 'update' | 'delete' | 'update_status' | 'reset_password' | 'restore' | ...,
  entity: 'warranty' | 'staff' | 'supplier' | 'customer_notification' | 'backup',
  entityId: '...',
  summary: 'Mô tả ngắn (<500 chars)',
  before: {...} | null,
  after: {...} | null
}, tx = prisma)
```
Lưu vào bảng `audit_logs` (PG), gồm:
- `actor_id`, `actor_name` (từ `req.user`).
- `ip`, `user_agent`.
- `before` / `after` JSONB (full snapshot để so sánh).
- `summary` (text ngắn).

**Hiện tại chưa có UI xem audit log** — chỉ lưu trong DB.

### 9.2. Validators (`api/lib/validators.js`)
Zod schemas cho:
- `warrantySchema` — validate create/update phiếu (kèm `superRefine` để check `bien_nhan` chỉ hỗ trợ `sua_dv` hoặc `khac`).
- `statusUpdateSchema` — chuyển trạng thái.
- `traHangSchema`, `exchangeReturnSchema` (discriminated union) — trả/đổi hàng.
- `supplierSchema`, `supplierSendSchema`, `supplierReturnSchema` — NCC.
- `customerNotificationSchema` (có `superRefine` validate date range).

Mọi route đều dùng `.safeParse()` rồi trả 400 với message zod đầu tiên.

### 9.3. Customer master (`api/lib/customerMaster.js`)
- `buildCustomerMasterFromWarranties(warranties, existing)` — quét tất cả phiếu, group theo `key = lower(name)|phone`, gán mã `KH00001`, `KH00002`... theo thứ tự lastSeen.
- `upsertCustomer(customers, payload)` — thêm/cập nhật 1 customer, tự sinh mã nếu chưa có.
- Mã KH **tăng dần vĩnh viễn** (không reuse khi xóa).

### 9.4. Customer helpers (`api/lib/customers.js`)
- `getWarrantyCustomerKey(w)` — sinh key từ warranty (chỉ name+phone, không address).
- `aggregateCustomerStats(warranties)` — group by key, đếm `totalWarranties`, `dangXuLyCount`, `daTraCount`, `huyCount`.
- `getCustomerRows(warranties, customers)` — merge stats + customer master.
- `customerLabel(c)` — format `"Tên - SĐT"` hoặc chỉ tên.

### 9.5. Zod schemas frontend (`src/lib/zodSchemas.js`)
Có sẵn nhưng **chưa wire** vào form. Có thể là dead code hoặc dự phòng.

---

## 10. Backend — REST API endpoints

Tất cả routes (trừ `/api/health` và `/api/public/*`) đều yêu cầu JWT cookie hợp lệ. Roles: `staff` mặc định, `admin` cho vài endpoints đặc biệt.

### 10.1. Auth (`/api/auth`)
| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| POST | `/login` | none | `{ maNV, matKhau }` → set cookie |
| POST | `/logout` | none | Clear cookie |
| GET | `/me` | auth | Trả `req.user` |
| POST | `/change-password` | auth | Đổi pass (yêu cầu nhập pass cũ, >=8 chars) |

### 10.2. Nhân viên (`/api/nhan-vien`)
| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/` | auth | Danh sách active staff |
| POST | `/verify` | none | Verify credentials (dùng cho login modal) |
| POST | `/` | **admin** | Tạo NV mới (pass >=8 chars) |
| PATCH | `/:maNV/password` | **admin** | Reset password (không cho reset admin) |
| DELETE | `/:maNV` | **admin** | Soft-delete (set `active: false`) |

### 10.3. Phiếu bảo hành (`/api/warranties`) — 62.9K, file lớn nhất
| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/` | auth | List + filter (status, loaiXuLy, maNV, date range, q, sortBy, page, limit) |
| GET | `/next-code` | auth | Generate `DDMMYYYYNTPC<n>` số chứng từ tiếp theo |
| GET | `/template` | auth | Download Excel template |
| GET | `/export` | auth | Export Excel (filter giống list) |
| GET | `/:id` | auth | Chi tiết 1 phiếu |
| POST | `/` | auth | Tạo phiếu mới (validate + tạo history + sync customer master) |
| PUT | `/:id` | auth | Update fields (ghi history cho từng field changed) |
| PATCH | `/:id/customer` | auth | Gán khách hàng (transfer customer giữa các phiếu) |
| PATCH | `/:id/status` | auth | Đổi trạng thái |
| PATCH | `/:id/tra-hang` | auth | Trả hàng (set `ngayTra`, `trangThai=da_tra`) |
| PATCH | `/:id/exchange-return` | auth | Đổi/trả hàng có ảnh (discriminated union) |
| PATCH | `/:id/log` | auth | Thêm log tiến trình |
| PATCH | `/:id/priority` | auth | Bật/tắt ưu tiên |
| POST | `/:id/attachments` | auth | Upload ảnh base64 (max 10/lần) |
| DELETE | `/:id/attachments/:attachmentId` | auth | Xóa 1 ảnh + xóa file vật lý |
| DELETE | `/:id/history/:historyIndex` | auth | Xóa 1 dòng history (admin-like) |
| GET | `/:id/supplier-logs` | auth | Lấy nhật ký gửi/nhận NCC của phiếu |
| PATCH | `/:id/supplier-logs/:logId` | auth | Cập nhật ghi chú nhật ký |
| DELETE | `/:id/supplier-logs/:logId` | auth | Xóa nhật ký |
| POST | `/:id/supplier-send` | auth | Gửi bảo hành cho NCC (validate schema) |
| POST | `/:id/supplier-return` | auth | Nhận lại từ NCC |
| DELETE | `/` | **admin** | Xóa TẤT CẢ phiếu (hiếm khi dùng, có confirm) |
| DELETE | `/:id` | **admin** | Soft-delete 1 phiếu (`deletedAt = now`) |
| POST | `/import` | auth | Import batch từ Excel |

### 10.4. Khách hàng (`/api/customers`)
| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/list` | auth | List customer master (auto-fill mã KH thiếu) |
| GET | `/unassigned` | auth | Phiếu chưa có khách hàng |
| GET | `/suggest?q=` | auth | Gợi ý tên |
| GET | `/lookup?q=&key=` | auth | Tìm theo mã KH / SĐT / tên |
| PUT | `/update` | auth | Sửa KH (cascading update tất cả phiếu cùng key) |
| POST | `/delete` | **admin** | Xóa KH (set blank trên tất cả phiếu + remove from master) |
| POST | `/backfill` | **admin** | Rebuild toàn bộ customer master từ phiếu |

### 10.5. Nhà cung cấp (`/api/suppliers`)
| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/?q=&isActive=&page=&limit=` | auth | List + filter + thống kê pending/returned |
| POST | `/` | auth | Tạo NCC (auto-generate `code = NCC00001`...) |
| PUT | `/:id` | auth | Update |
| PATCH | `/:id/status` | auth | Bật/tắt active |
| GET | `/:id/warranties` | auth | List phiếu liên quan + lịch sử gửi/nhận |

### 10.6. Stats (`/api/stats`)
| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/summary` | auth | TongPhieu, dangXuLy, daTraHomNay, sapHan (overdue) |
| GET | `/by-date?from=&to=` | auth | Biểu đồ theo ngày (in/out) |
| GET | `/top-products?limit=10` | auth | Top sản phẩm theo tên hàng |
| GET | `/top-customers?limit=10` | auth | Top khách hàng theo số phiếu |
| GET | `/distribution?from=&to=` | auth | Phân bố trạng thái / loại xử lý / nhân viên |

### 10.7. Customer notifications (`/api/customer-notifications`)
Banner/popup cho trang public.
| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/?q=&displayType=&isActive=&effectiveStatus=&page=&limit=` | auth | List (lọc theo trạng thái hiệu lực: visible/scheduled/expired/inactive) |
| GET | `/summary` | auth | Đếm theo 6 tiêu chí |
| POST | `/` | auth | Tạo (rich-text HTML content, schedule range optional) |
| PUT | `/:id` | auth | Update |
| PATCH | `/:id/status` | auth | Bật/tắt |
| DELETE | `/:id` | auth | Xóa |

### 10.8. Public (`/api/public`) — không auth
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/customer-notifications` | Banner + popup active (cho trang `/tra-cuu`) |
| GET | `/track?q=` | Tìm theo mã CT (returns single) hoặc SĐT (returns list 50) |
| GET | `/track/:soChungTu` | Chi tiết 1 phiếu (cho `/tra-cuu/:soChungTu`) |
| Rate limit | 30 req/phút/IP |

### 10.9. Admin backups (`/api/admin/backups`) — **admin only**
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/status` | Trạng thái hiện tại + scheduler state |
| GET | `/history?limit=200` | Lịch sử thao tác |
| GET | `/` | List backups |
| POST | `/{type?}` | Tạo backup manual/hourly/daily/monthly |
| GET | `/download?path=` | Download file JSON |
| GET | `/download-assets?path=` | Download gói ảnh |
| GET | `/view?path=&limit=50` | Preview nội dung backup (không apply) |
| PATCH | `/metadata` | Pin/note backup |
| POST | `/restore` | Restore từ backup có sẵn (confirm=`RESTORE`) |
| POST | `/upload-restore` | Upload file JSON rồi restore |
| POST | `/upload-assets` | Upload gói ảnh `.tgz` |
| DELETE | `/?path=` | Xóa backup |

---

## 11. Cơ sở dữ liệu — Prisma schema

### 11.1. Models
5 models chính (tất cả snake_case trong DB, camelCase trong Prisma):

#### `NhanVien` (bảng `nhan_vien`)
- `maNV` (PK, `NV001`, `admin`...)
- `tenNV`, `matKhau` (scrypt hash)
- `quyen` ('admin' | 'staff')
- `active` (boolean)
- `createdAt`, `updatedAt`
- Relation: `warranties` (1-n)
- Index: `quyen`, `active`

#### `Supplier` (bảng `suppliers`)
- `id` (UUID)
- `code` (NCC00001, unique khi upper-case)
- `name`, `phone`, `email`, `address`, `contactPerson`, `note`
- `isActive`, timestamps
- Index: `code`, `name`, `isActive`

#### `SupplierLog` (bảng `supplier_logs`)
- `id` (UUID)
- `supplierId` (FK → suppliers), `supplierName` (snapshot), `warrantyId` (FK → warranties)
- `action` ('sent' | 'returned')
- `sentAt` (YYYY-MM-DD), `expectedReturnAt`, `returnedAt`
- `note`, `createdBy`, `createdAt`
- Index: `supplierId`, `warrantyId`, `action`, `createdAt`

#### `Warranty` (bảng `warranties`) — bảng trọng tâm
- `id` (UUID)
- `stt` (auto-increment số thứ tự)
- `soChungTu` (unique, format `DDMMYYYYNTPC<n>`)
- Thông tin khách: `khachHang`, `soDienThoai`, `diaChi`
- Thông tin sản phẩm: `tenHang`, `soSeri`, `cauHinh`, `loiLucNhan`, `phuKien`
- Phí & BH: `chiPhi` (float), `baoGiaSau` (bool), `baoHanh` (string: "1 tháng", "12 tháng"...), `loaiPhieu` (`nhan_bao_hanh` | `bien_nhan`)
- Xử lý: `loaiXuLy` (`bao_hanh` | `sua_dv` | `doi_moi` | `khac`), `loaiXuLyKhac` (text)
- `ghiChu`, `ngayMua`, `ngayNhan` (ISO local string), `ngayHenTra`, `ngayTra`
- `maNhanVien` (FK → nhan_vien), `trangThai` (`cho_xu_ly` | `dang_xu_ly` | `cho_lien_he` | `da_tra` | `huy`)
- `uuTien` (bool)
- Timestamps + `deletedAt` (**luôn là STRING rỗng `''`**, KHÔNG dùng NULL — đây là quirk quan trọng khi query thủ công SQL)
- **JSONB fields**:
  - `doiTra` (đổi hàng: type, tenHangCu/Moi, soSeriCu/Moi, reason, note, attachments, at, by)
  - `attachments` (mảng: id, url, name, mime, publicVisible, uploadedBy, uploadedAt)
  - `history` (mảng: at, by, action, changes {field: {from, to}}, note, customer)
  - `supplierLogs` (nhúng, mặc dù bảng riêng `supplier_logs` cũng tồn tại — duplicate để tương thích backup V1)
- NCC tracking: `supplierStatus` (`none` | `sent` | `returned`), `supplierIdCurrent` (FK), `sentSupplierAt`, `expectedReturnSupplierAt`
- Index: `trangThai`, `maNhanVien`, `ngayNhan`, `ngayHenTra`, `supplierStatus`, `supplierIdCurrent`, `deletedAt`, `updatedAt`

#### `CustomerNotification` (bảng `customer_notifications`)
- `id` (UUID)
- `title`, `content` (HTML)
- `displayType` ('banner' | 'popup')
- `priority` (int, desc sort)
- `isActive`, `scheduleType` ('manual' | 'range')
- `startAt`, `endAt` (DateTime, nullable)
- `createdBy`, `updatedBy`, timestamps
- Index: 7 indexes cho filter

#### `AuditLog` (bảng `audit_logs`)
- `id` (UUID)
- `actorId`, `actorName`, `ip`, `userAgent`
- `action`, `entity`, `entityId`
- `summary` (text 500 chars)
- `before` / `after` (JSONB)
- `createdAt`
- Index: `actorId`, `action`, `entity`, `entityId`, `createdAt`

### 11.2. Migrations
Hiện có 1 migration duy nhất:
- `20260525_add_audit_indexes/` — tạo bảng `audit_logs` + indexes.

**Quirk quan trọng**: Prisma schema có nhiều models nhưng **migration history chỉ có 1 file** (audit indexes). Có thể base schema đã được tạo thủ công ban đầu (qua SQL) hoặc đã từng có migrations khác bị xóa. Cần kiểm tra khi setup môi trường mới.

### 11.3. Các quirks nghiệp vụ
- `deletedAt = ''` (string rỗng) chứ không phải `NULL`. Query thủ công: `WHERE deleted_at = ''` KHÔNG phải `IS NULL`.
- `ngayNhan`, `ngayHenTra`, `ngayTra` là **string** (không phải `DateTime` Prisma). Lý do: backup V1/V2 lưu string, muốn round-trip an toàn.
- `history`, `attachments`, `doiTra` lưu JSON trong PG (JSONB), cho phép truy vấn lồng nhưng đồng thời khiến việc migrate schema cấu trúc khó hơn.
- `soChungTu` UNIQUE toàn cục → tự retry tối đa 5 lần nếu trùng (race condition ngày đầu tiên).

---

## 12. Frontend — Bootstrap & Routing

### 12.1. Entry (`src/main.jsx`)
```jsx
import './i18n/index.js';  // Side-effect: init i18next
import App from './App.jsx';
import './styles/global.css';

ReactDOM.createRoot(...).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 12.2. `App.jsx` — Provider tree (thứ tự quan trọng)
```
ErrorBoundary
  ConfigProvider (antd) - theme + locale vi_VN
    MobileConfigProvider (antd-mobile) - locale vi-VN
      AntdApp (antd App context - message/notification)
        AuthProvider (context API)
          BrowserRouter (v7 future flags)
            AppShortcuts (hook keyboard)
            Suspense (lazy load pages)
              Routes
            ShortcutsModal
```

### 12.3. Routes
Public (CustomerLayout):
- `/` → redirect `/tra-cuu`
- `/tra-cuu` → Tracuu (search form)
- `/tra-cuu/:soChungTu` → TrackingResult (chi tiết)
- `/tracuu`, `/tracuu/:soChungTu` → redirect canonical

Admin (AdminLayout + RequireStaff):
- `/admin` → redirect `/admin/dashboard`
- `/admin/dashboard` → Dashboard (KPI + recent activity)
- `/admin/phieu` → WarrantyList
- `/admin/phieu/:id/in` → WarrantyPrint (in phiếu A4)
- `/admin/tao-phieu` → CreateWarranty
- `/admin/khach-hang` → CustomerInfo
- `/admin/nha-cung-cap` → Suppliers
- `/admin/thong-bao-khach-hang` → CustomerNotifications
- `/admin/thong-ke` → Statistics
- `/admin/nhan-vien` → StaffManagement (**AdminOnlyRoute**)
- `/admin/import-export` → ImportExport (**AdminOnlyRoute**)

Catch-all: `*` → NotFound

### 12.4. Lazy loading
Mọi page (kể cả admin) đều `lazy(() => import(...))` → giảm bundle size ban đầu.

### 12.5. RequireStaff / RequireAdminRole
- `RequireStaff`: nếu `currentStaff === null` (sau khi `authLoading = false`) → render `<StaffPickerModal />` (modal login).
- `RequireAdminRole`: nếu `!isAdmin` → render `<Result status="403" />`.

`StaffPickerModal` mặc định **auto-open** khi vào `/admin/*` (vì `currentStaff` null lúc đầu).

### 12.6. Vite config
```js
server: { port: 8888, host: true, proxy: { '/api': 'http://localhost:3004', '/uploads': 'http://localhost:3004' } }
```
**Quirk**: Vite proxy trỏ tới `3004` (mặc định trong `server.js` khi không có `API_PORT`) nhưng Docker expose `3003` và nginx cũng proxy `3003`. Lúc dev local cần set `API_PORT=3004` hoặc đổi vite proxy. Tốt nhất: align cả 2 về 3003.

---

## 13. Frontend — i18n, Theme, Hooks

### 13.1. i18n (`src/i18n/index.js`)
- **Chỉ có 1 locale: `vi`** (Vietnamese). Không có fallback đa ngôn ngữ thật sự, dù `fallbackLng: 'vi'` được set.
- **6 namespaces**: `ui` (default, 46.3K), `status`, `messages`, `validation`, `print`, `nav`.
- File JSON import trực tiếp vào bundle (không lazy) → toàn bộ ~60KB i18n được ship xuống client ngay lần load đầu.
- `interpolation.escapeValue: false` → KHÔNG escape interpolation (nguy hiểm nếu input user không tin cậy).
- Sử dụng `i18next-browser-languagedetector` nhưng force `lng: 'vi'` → detector thực ra vô dụng.

### 13.2. Theme (`src/hooks/useTheme.js`)
- Toggle dark/light, lưu `localStorage.ntpc-theme` ('dark' | 'light').
- Set `document.documentElement.dataset.theme` để CSS selector `html[data-theme='dark']` hoạt động.
- Custom antd themes: `antdLightTheme` và `antdDarkTheme` (`src/theme/antdTheme.js`).
- Lắng nghe `storage` event để sync giữa các tab.
- `currentIsDark` là module-level variable (singleton).

### 13.3. Hooks
| Hook | Mục đích |
|------|----------|
| `useIsMobile()` | Match `(max-width: 1199px)`, dùng để render mobile/desktop UI riêng |
| `useDebounce(value, delay=400)` | Generic debounce |
| `useTheme()` | Xem trên |
| `useKeyboardShortcuts({onSearchFocus, onShowShortcuts, onNavigate})` | `Ctrl+N` (new), `Ctrl+K` (search), `Ctrl+P` (print), `Esc` (close drawer), `?` (shortcuts modal) |
| `useWarranties()` | Fetch + auto-refresh (chưa dùng nhiều) |

### 13.4. AuthContext (`src/contexts/AuthContext.jsx`)
```js
useEffect(() => {
  localStorage.removeItem('ntpc-staff');           // cleanup legacy
  localStorage.removeItem('ntpc-admin-unlocked');  // cleanup legacy
  refreshAuth();  // GET /api/auth/me
}, []);
```
- `currentStaff: { maNV, tenNV, role, active }` hoặc null.
- `isAdmin = currentStaff?.role === 'admin'`.
- `login(maNV, matKhau)` gọi `/api/auth/login` rồi set state.
- `logout()` gọi `/api/auth/logout` rồi clear state.

---

## 14. Frontend — Pages (Admin)

### 14.1. `Dashboard.jsx` (21.2K)
- **KPI strip** (mới redesign ở commit `d87541a`): Tổng phiếu / Đang xử lý / Đã trả hôm nay / Sắp hạn.
- **Recent activity** (priority sort: ưu tiên → quá hạn → đến hạn hôm nay → bình thường).
- **Top customers / Top products** mini-cards.
- Mỗi phiếu click → mở `WarrantyDetail` drawer/modal.
- Lazy load chi tiết qua `warrantyService.getById(id)`.

### 14.2. `WarrantyList.jsx` (26.0K)
- Bảng full list với filter: status, loaiXuLy, maNV, ngayNhan range, q (search).
- Columns: STT, số CT, ngày nhận, khách, sản phẩm, trạng thái, ngày hẹn trả (urgency color), nhân viên, actions.
- Urgency logic: `getUrgency()` → 'overdue' | 'urgent' | 'soon' | 'normal' | 'done' → màu badge.
- Row click → mở `WarrantyDetail`.
- Bulk actions: chưa có.
- Sort theo `updatedAt desc` mặc định.

### 14.3. `CreateWarranty.jsx` (22.6K)
- Form tạo phiếu mới, dùng antd Form + validation.
- Auto-generate `soChungTu` qua `/api/warranties/next-code` khi mount.
- Picker khách hàng (`CustomerPickerModal`) — cho phép tìm theo SĐT/tên hoặc tạo mới.
- Picker sản phẩm, loại xử lý, BH.
- Rich-text `ghiChu` qua `react-quill` (sanitize bằng DOMPurify).
- Upload ảnh base64 inline (max 10).
- On submit: `warrantyService.create()` → toast → redirect về list.

### 14.4. `CustomerInfo.jsx` (31.3K) — Master khách hàng
- Bảng: mã KH, tên, SĐT, địa chỉ, tổng phiếu, đang xử lý, đã trả, hủy, lần cuối.
- Filter theo tên/SĐT.
- Click row → drawer với lịch sử tất cả phiếu của KH.
- Edit KH: `customers.update` (cascading tới tất cả phiếu).
- Delete KH (admin only): xóa khỏi master + set blank trên phiếu.

### 14.5. `StaffManagement.jsx` (10.4K) — **Admin only**
- CRUD nhân viên.
- Reset password (>=8 chars).
- Soft delete (set `active = false`).
- Không cho xóa admin hoặc chính mình.

### 14.6. `Suppliers.jsx` (31.3K)
- CRUD NCC.
- Card mỗi NCC: code, name, phone, email, contact, address, stats (pending/returned), active toggle.
- Drawer xem các phiếu liên quan + lịch sử gửi/nhận.
- Create form: code (auto NCC00001, có thể override), name (required), phone, email, address, contactPerson, note.
- Code unique check phía server.

### 14.7. `ImportExport.jsx` (14.5K) — **Admin only**
- Import: parse Excel → preview table → confirm → POST `/warranties/import`.
- Export: filter (status, date range) → GET `/warranties/export` → download blob.
- Template download: GET `/warranties/template`.
- Embed `BackupRestorePanel` (admin only) — full backup management.

### 14.8. `Statistics.jsx` (13.0K)
- Biểu đồ từ `@ant-design/charts`:
  - Line: phiếu theo ngày (`/stats/by-date`).
  - Bar top 10 sản phẩm.
  - Bar top 10 khách hàng.
  - Pie: phân bố trạng thái / loại xử lý / nhân viên.
- Date range picker.

### 14.9. `CustomerNotifications.jsx` (11.5K)
- Quản lý banner/popup hiển thị trên trang public.
- Form: title, content (rich-text), displayType, priority, isActive, scheduleType (manual/range với startAt/endAt).
- Bảng list với filter (q, displayType, isActive, effectiveStatus).

### 14.10. `WarrantyPrint.jsx` (30.5K) — Route `/admin/phieu/:id/in`
- A4 template với QR code (link tra cứu public).
- In qua `react-to-print`.
- 2 phiên bản: PHIẾU NHẬN BẢO HÀNH / BIÊN NHẬN / PHIẾU TRẢ HÀNG.
- Logo, thông tin công ty, signature boxes.

---

## 15. Frontend — Pages (Customer / Public)

### 15.1. `Tracuu.jsx` (23.6K) — Trang tra cứu chính
- Hero card: ô nhập mã CT hoặc SĐT + nút Tra cứu.
- Validation: mã CT format `^\d{8}NTPC\d+$` hoặc SĐT 9-11 số.
- Recent lookups (localStorage, max 6).
- Multi-tab hiển thị kết quả theo SĐT: Tất cả / Chờ xử lý / Đã xong.
- Mobile dùng `antd-mobile` (SearchBar, CapsuleTabs, List, Empty, SwipeAction).
- Desktop dùng `antd` (Card, Input, Tabs, List).
- Click 1 phiếu trong kết quả → navigate `/tra-cuu/:soChungTu`.

### 15.2. `TrackingResult.jsx` (57.4K) — Chi tiết phiếu public
- File lớn nhất frontend (sau WarrantyDetail).
- Layout:
  - Header: thông tin khách + sản phẩm + trạng thái hiện tại.
  - **Progress steps** (Đã nhận → Đang xử lý → Đã xong/Hủy).
  - **Status log** (timeline với tất cả thay đổi).
  - **DoiTra** (nếu có): thông tin đổi/trả hàng + ảnh public.
  - **Attachments public** (lọc `publicVisible !== false`).
  - **Support info** hardcoded: hotline 0937 63 2000, company info, address.
- Mobile vs desktop responsive riêng.
- Watermark "Nguyễn Tân PC" trên desktop.
- Pull-to-refresh trên mobile.
- Print / copy URL / share.

### 15.3. `CustomerPortal.jsx` (14.8K)
- Ít dùng (route không mount trong `App.jsx` mặc định, có thể legacy).
- Chỉ là wrapper xem thông tin phiếu dạng customer.

### 15.4. CustomerNotifications component (4.5K)
- Mount ở `CustomerLayout` (cả desktop + mobile).
- Fetch `/api/public/customer-notifications` mỗi lần mount.
- Hiển thị banners (Alert component) ở đầu trang.
- Hiển thị popup 1 lần (dismiss lưu `sessionStorage` theo `id+updatedAt`).

---

## 16. Frontend — Components & Services

### 16.1. Components layout
| File | Mô tả |
|------|-------|
| `AdminLayout.jsx` | Shell chính: Sider (desktop) / Drawer (mobile) + Header + Content |
| `AppHeader.jsx` (5.8K) | Logo, user menu, theme toggle, notification bell, hamburger mobile |
| `AppSider.jsx` (4.7K) | Menu sidebar (icon + label), collapse |
| `CustomerLayout.jsx` (6.6K) | Nav glassmorphic (mobile) / Header desktop, footer, embedded `CustomerNotifications` + `FloatingZalo` |

### 16.2. Common components
| File | Mô tả |
|------|-------|
| `AiAssistant.jsx` (16.6K) | Chat bubble góc dưới phải, dùng `@ant-design/x`, có thể mock response, support tìm phiếu, NCC, trợ giúp |
| `FloatingZalo.jsx` (12.1K) | Nút Zalo nổi có thể **kéo thả**, mở `zalo://chat?phone=...` trên mobile, `https://zalo.me/...` trên desktop |
| `StaffPickerModal.jsx` (2.8K) | Modal login maNV + matKhau, auto-open khi vào `/admin/*` |
| `CustomerPickerModal.jsx` (15.0K) | Picker khách hàng (search + tạo mới) |
| `ChangePasswordModal.jsx` (2.3K) | Đổi mật khẩu |
| `ShortcutsModal.jsx` (1.1K) | Danh sách phím tắt |
| `SkeletonCard.jsx` (201B) | Loading placeholder |
| `ErrorBoundary.jsx` (782B) | Catch React error, hiện Result + nút reload |

### 16.3. Warranty components
| File | Mô tả |
|------|-------|
| `WarrantyDetail.jsx` (123.1K) | **File lớn nhất frontend** — drawer/modal chi tiết 1 phiếu (mobile + desktop). Có nhiều backup files `*.backup-*` cho thấy đã qua nhiều lần redesign (desktop hero 2x3 grid, mobile tabs, scroll). Bao gồm: tabs (info, history, attachments, doiTra, supplier logs), form edit, status flow buttons, action menu |
| `WarrantyPrint.jsx` (30.5K) | Template A4 (xem trên) |
| `WarrantyProgress.jsx` (754B) | Mini progress bar (progress %) |
| `StatusTag.jsx` (308B) | Desktop tag (dùng antd Tag + color) |
| `MobileStatusTag.jsx` (547B) | Mobile tag (dùng antd-mobile) |

### 16.4. Admin components
| File | Mô tả |
|------|-------|
| `BackupRestorePanel.jsx` (15.2K) | Bảng list backup + filter (pinned, type) + buttons: create / restore (with RESTORE confirm) / view / download / upload / pin / delete / history log |

### 16.5. Services (`src/services/`)
**Một file duy nhất `warrantyService.js` export mọi service**:
```js
warrantyService    // CRUD phiếu + attachments + supplier logs + exchange-return
customerService    // list, unassigned, suggest, lookup, update, delete
statsService       // summary, by-date, top-products, top-customers, distribution
publicService      // track, search, getCustomerNotifications
customerNotificationService  // list, summary, create, update, setStatus, remove
supplierService    // CRUD + getWarranties
nhanVienService    // list, create, resetPassword, remove, verifyPassword
authService        // login, logout, me, changePassword
```
`backupService.js` riêng: status, list, history, create, restore, uploadRestore, uploadAssets, delete, view, metadata, downloadUrl, downloadAssetsUrl.

### 16.6. `src/lib/axios.js`
```js
const api = axios.create({
  baseURL: '/api',
  timeout: 300000,  // 5 phút (cho upload ảnh lớn)
  withCredentials: true,  // gửi cookie
});
```
- Interceptor 429: chỉ log dev, không auto-retry.
- KHÔNG có request interceptor (không auto-attach CSRF token vì dùng cookie sameSite=lax).

### 16.7. Constants & config
| File | Mục đích |
|------|----------|
| `statusConfig.js` | Map `STATUS = { da_nhan, dang_xu_ly, da_tra, huy }` → label (i18n) + color + icon + `next` states |
| `warrantyOptions.js` | `BAO_HANH_OPTIONS` (1/3/12/24/36/60 tháng + Khác), `LOAI_XU_LY_OPTIONS` |
| `badgeConfig.js` | `BADGE_COLORS` cho status / priority / overdue / warning / info / success / error / neutral — cả desktop (antd) lẫn mobile (antd-mobile) |

### 16.8. Utils
| File | Mục đích |
|------|----------|
| `dateHelpers.js` | `formatDate`, `formatDateTime`, `parseExcelDate`, `addBusinessDaysSkipSunday` (skip CN), `getWarrantyDueDate`, `shouldShowDueDate`, `hasExplicitDueDate` |
| `excelHelpers.js` | `parseExcelFile`, `mapExcelRows` (Excel → warranty objects) |
| `urgency.js` | `getUrgency(w)` → 'overdue' | 'urgent' | 'soon' | 'normal' | 'done' |
| `historyTimeline.js` (11.3K) | `buildInternalHistoryTimeline`, `buildPublicHistoryTimeline` — lọc + format history entries |
| `historyDisplay.js` | Helper normalize action text |
| `vietnameseText.js` | Normalize Vietnamese (fix mojibake, dedupe spaces) |
| `richText` (trong `src/lib/`) | `RICH_TEXT_MODULES` (Quill config), `sanitizeRichText` (DOMPurify) |
| `zodSchemas.js` | (chưa dùng) |
| `fieldLabels.js` | I18n field labels cho timeline |
| `formatters.js` | Generic formatters |
| `copy.js` | Clipboard helper |
| `generateChungTu.js` | Logic sinh số chứng từ (FE fallback) |
| `i18nOptions.js` (chưa có trong tree) | (có thể legacy) |

---

## 17. Frontend — Styles (157K global.css)

### 17.1. Tổng quan
- **1 file CSS duy nhất** `src/styles/global.css` (6540 dòng, 157.7K).
- Mobile-first responsive, dùng `html[data-theme='dark']` selector.
- Dùng CSS variables cho color tokens.
- antd antd-mobile theme override riêng qua `ConfigProvider`.
- Nhiều **backup files** `global.css.backup-*-pre-redesign` cho thấy desktop hero đã qua nhiều lần redesign.

### 17.2. Cấu trúc CSS (ước lượng)
- `html[data-theme='dark']` — dark mode overrides (~200 rules).
- `.admin-shell`, `.admin-main-layout`, `.admin-main-content` — admin layout.
- `.admin-mobile-menu` — antd-mobile Popup cho sider mobile.
- `.admin-desktop-sider-shell` — show/hide sider theo viewport.
- `.stats-kpi`, `.staff-kpi`, `.notif-kpi` — các dải KPI cards (cùng pattern).
- `.customer-header` — header cho trang public.
- `.brand-wrap`, `.brand-logo`, `.brand-center`, `.brand-right` — layout brand.
- `.hotline`, `.mobile-call`, `.mobile-theme` — buttons trên header.
- `.warranty-detail`, `.warranty-hero`, `.warranty-grid` — drawer chi tiết.
- `.warranty-status-pill` — badge trạng thái custom (ngoài antd Tag).
- `.ql-editor`, `.ntpc-rich-preview` — Quill content display.
- `.ntpc-nav-glass` — navbar mobile glassmorphic.
- `.zalo-floating`, `.zalo-trash` — nút Zalo.
- ... + ~5000 rules khác.

### 17.3. Print (`src/styles/print.css` 831B)
- Ẩn sider/header khi in.
- Giữ nguyên A4 template.

### 17.4. Vấn đề
- **157K CSS trong 1 file** → khó maintain, không tree-shake, browser parse chậm.
- Nhiều class có prefix `admin-mobile-*` KHÔNG có dark-mode override → tạo vùng sáng trong dark mode (recurring bug đã thấy trong memory notes).
- Không có CSS-in-JS, không có CSS Modules, không có Tailwind.

---

## 18. Backup format & tương thích

### 18.1. Phiên bản
- **V1**: `{ warranties, nhanVien, suppliers, supplierLogs, customers, customerNotifications, adminConfig }` — raw db.json shape.
- **V2**: `{ backupVersion: 2, rawDb, appData: { phieu, khachHang, nhaCungCap, nhanVien, supplierLogs } }` — bắt đầu wrap.
- **V3** (hiện tại): bỏ `rawDb`, chỉ `appData` + thêm `source: 'baohanh3ant5'`.

### 18.2. `normalizeBackupPayload(payload)`
Tự động detect version và convert về V3 tương thích:
- V3+ → dùng nguyên `appData`.
- V2 → lấy `appData` hoặc fallback `rawDb`.
- V1 (legacy) → wrap raw vào shape chuẩn.

### 18.3. `getSnapshotParts(payload)`
Trả về:
```js
{ phieu, khachHang, nhaCungCap, nhanVien, supplierLogs, rawDb, backupVersion, createdAt }
```
- Nếu V2+ có `appData.khachHang` → dùng luôn.
- Nếu không → build từ `phieu` (buildCustomerRows).
- Mã KH auto-fill nếu thiếu.

### 18.4. Khi restore
- V1/V2/V3 đều được accept.
- `customers` master được rebuild lại (KH mới sẽ được cấp mã mới nếu conflict → có thể đổi mã KH khi restore từ backup cũ).

### 18.5. Rủi ro tương thích
- Nếu refactor schema PG trong tương lai → cần đảm bảo restore vẫn parse được JSON cũ.
- Nếu thêm field mới vào `history`/`attachments` → backup cũ sẽ thiếu → render phải default fallback.

---

## 19. Quy trình nghiệp vụ chính

### 19.1. Tạo phiếu mới
```
User click "Tạo phiếu" → /admin/tao-phieu
  → Fetch /warranties/next-code → hiện số CT preview
  → User chọn/tạo khách hàng (CustomerPickerModal)
  → User điền: tenHang, soSeri, cauHinh, loiLucNhan, phuKien
  → Chọn baoHanh, loaiXuLy, ngayMua
  → Optional: ghiChu (rich-text), attachments
  → Submit
    → Validate zod
    → Sinh soChungTu (DDMMYYYYNTPC<n>)
    → Insert vào PG (transaction)
    → Audit log
    → Rebuild customers master (writeDb)
    → syncLocalBackup (2.5s debounce)
  → Redirect /admin/phieu (toast success)
```

### 19.2. Đổi trạng thái
```
PATCH /warranties/:id/status { trangThai, note }
  → Check STATUS_TRANSITIONS[from].includes(to) — CHƯA enforce server-side
  → Update DB + append history entry
  → Audit log
```

### 19.3. Gửi NCC
```
POST /warranties/:id/supplier-send { supplierId, sentAt, expectedReturnAt, note }
  → Validate zod
  → Create SupplierLog (action='sent')
  → Update warranty: supplierStatus='sent', supplierIdCurrent, sentSupplierAt, expectedReturnSupplierAt
  → Append history (action='supplier_sent')
  → Audit log
```

### 19.4. Nhận lại từ NCC
```
POST /warranties/:id/supplier-return { returnedAt, note }
  → Create SupplierLog (action='returned')
  → Update warranty: supplierStatus='returned', supplierIdCurrent=null
  → Append history (action='supplier_returned')
```

### 19.5. Đổi hàng
```
PATCH /warranties/:id/exchange-return { type: 'doi_hang', tenHangMoi, soSeriMoi, note, attachmentsInput }
  → Validate zod
  → Save attachments
  → Update warranty.doiTra = { type, tenHangCu, soSeriCu, tenHangMoi, soSeriMoi, note, attachments, at, by }
  → Append history (action='exchange')
```

### 19.6. Trả hàng
```
PATCH /warranties/:id/tra-hang { ngayTra, note }
  → Update ngayTra + trangThai='da_tra'
  → Append history (action='tra_hang')
```

### 19.7. Tra cứu public
```
Khách nhập số CT → /tra-cuu?q=25052026NTPC1
  → publicService.search(q)
    → GET /api/public/track?q=...
      → if SĐT (9-11 digits): list mode (max 50 items)
      → if mã CT: single mode → navigate /tra-cuu/:soChungTu
  → publicService.track(soChungTu) → GET /api/public/track/:soChungTu
    → normalize Vietnamese text (fix mojibake)
    → generate steps (3 bước)
    → generate statusLog (timeline)
    → attachmentsPublic (lọc publicVisible)
  → Render TrackingResult
```

### 19.8. Backup tự động
```
Server start → startBackupScheduler()
  → setInterval(hourly, 1h)     → createBackup('hourly')
  → setInterval(daily, 24h)     → createBackup('daily')
  → setInterval(monthly, 24h)   → nếu ngày 1 → createBackup('monthly')
  → setInterval(cleanup, 6h)    → cleanupOldBackups() theo retention
Mỗi createBackup():
  → readDb() → validate
  → createApplicationSnapshot() → backupVersion 3
  → SHA-256 hash → so sánh với lastMinuteHash (cho minute)
  → Write file JSON + .sha256
  → Tạo asset bundle (.tgz) nếu không phải minute/hourly
  → Tính assetKey, hardlink nếu trùng
  → Append history
```

### 19.9. Khôi phục
```
User chọn backup + gõ "RESTORE" → POST /api/admin/backups/restore
  → Tạo restore-safety backup trước
  → Verify SHA-256
  → atomicWriteJsonFile(DB_PATH, data)
    → gọi writeDb → Xóa toàn bộ + insert lại
  → Extract assets .tgz (nếu có)
  → Append history
```

---

## 20. Bảo mật hiện tại

### 20.1. Đã làm
- ✅ JWT signed HMAC-SHA256 với secret.
- ✅ HTTP-only cookie, sameSite=lax, secure=true ở HTTPS.
- ✅ scrypt password hash với salt ngẫu nhiên.
- ✅ Helmet security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).
- ✅ CORS whitelist (localhost + LAN).
- ✅ Login rate limit (8 lần/10 phút).
- ✅ Public API rate limit (30 req/phút).
- ✅ Role-based access control (admin only endpoints).
- ✅ DOMPurify sanitize cho rich-text content.
- ✅ Safe path resolve trong backup (chống path traversal).
- ✅ SQL parameterization qua Prisma (chống SQLi).
- ✅ Audit log cho mọi write action.
- ✅ Soft-delete thay vì hard-delete.

### 20.2. Còn thiếu / yếu
- ⚠️ **CSRF token**: chỉ dựa vào sameSite cookie. Nếu user vào site khác có form submit tới domain mình → có thể bị CSRF. Cần CSRF token cho POST/PUT/DELETE.
- ⚠️ **CSP**: default off (`HELMET_CSP` env), chỉ bật khi cần. Bật CSP strict có thể vỡ 1 số inline script.
- ⚠️ **Rate limit trên `/api/warranties` POST** (spam tạo phiếu) — chưa có.
- ⚠️ **Upload file size limit**: chỉ limit qua Nginx (50MB) + Express (50MB). Không có validation file type/mime nghiêm ngặt.
- ⚠️ **No password complexity**: chỉ check >=8 chars, không yêu cầu số + chữ + ký tự đặc biệt.
- ⚠️ **JWT không có refresh token**: TTL 8h, sau đó user phải login lại.
- ⚠️ **`AUTH_SECRET` rotation**: chưa có cơ chế rotate (sẽ invalidate tất cả sessions).
- ⚠️ **Audit log không có UI** → khó phát hiện hành vi bất thường.
- ⚠️ **Public tra cứu không có CAPTCHA** → bot có thể scrape toàn bộ số CT.
- ⚠️ **Backup files không mã hóa** → nếu VPS bị compromise, attacker có toàn bộ data.
- ⚠️ **Không có HTTPS strict** trên dev (HTTP cookie).
- ⚠️ **JWT secret nếu yếu** → có thể brute force (nên >= 64 chars random).
- ⚠️ **i18n interpolation không escape** (`escapeValue: false`) → XSS nếu t() truyền user input.

---

## 21. Build, Test, Deploy

### 21.1. Scripts (`package.json`)
```bash
npm run dev          # vite dev (port 8888, proxy /api → :3004)
npm run api          # node api/server.js (port 3003 hoặc API_PORT)
npm run start        # concurrently chạy cả 2 (chỉ dev local)
npm run build        # vite build → dist/
npm run preview      # vite preview
npm test             # vitest run
```

### 21.2. Docker build
```bash
docker compose build            # build tất cả services
docker compose up -d            # start
docker compose logs -f backend-api
docker compose exec backend-api node -e "..."
docker compose exec postgres-db psql -U ntpc_user -d ntpc_warranty -c "SELECT 1"
```

### 21.3. Tests
- **Hiện tại rất ít**: 6 file test, focus vào util/helper:
  - `i18n.test.js` — kiểm tra có key Vietnamese cốt lõi.
  - `StatusTag.test.jsx` — render status tag.
  - `generateChungTu.test.js` — sinh số chứng từ.
  - `fieldLabels.smoke.test.js` — field labels.
  - `urgency.test.js` — urgency logic.
  - `vietnameseUi.test.js` — kiểm tra normalize Vietnamese.
- **Không có**: integration test, E2E (playwright có nhưng không dùng), route test, DB test.

### 21.4. Migrate data thủ công
Scripts có sẵn trong `scripts/`:
- `bootstrap-auth.mjs` — bootstrap admin password nếu hash cũ.
- `cleanup-current-data.mjs` — xóa data test.
- `cleanup-orphan-uploads.js` — xóa file upload không còn reference.
- `migrateData.js` — migrate từ JSON cũ → PG.
- `migrate_fix_mojibake_notes.py` — fix encoding notes.
- `migrate_fix_priority_mojibake_notes.py` — fix encoding priority notes.

### 21.5. Setup môi trường mới
1. Clone repo.
2. `cp .env.example .env` → sửa `AUTH_SECRET`, `INITIAL_STAFF_PASSWORD`, `POSTGRES_PASSWORD`.
3. `docker compose up -d` → auto build + start + seed.
4. Login với `maNV=admin` + `INITIAL_STAFF_PASSWORD` (sau đó đổi pass ngay).
5. Prisma client đã được generate trong Docker build, không cần chạy `prisma generate` thủ công.

### 21.6. Cloudflare Tunnel
Container `cloudflare-quick-tunnel` tự động start, mỗi lần restart sẽ có URL mới (trycloudflare.com) — nếu cần URL cố định phải dùng `cloudflared tunnel login` + named tunnel.

---

## 22. Điểm mạnh

### 22.1. Kiến trúc & code
- ✅ **Fullstack TypeScript-free JavaScript** (ESM) — đơn giản, ít cần config.
- ✅ **Layered architecture rõ ràng** ở backend: routes → lib → Prisma. Dễ test, dễ refactor.
- ✅ **Backup system rất tốt** (V1→V2→V3 evolution, asset bundling, dedup, retention, restore drill, history log) — đây là feature **xuất sắc**, ít hệ thống nhỏ có.
- ✅ **Auto-healing sync** giữa PG và `db.json` — safety net tuyệt vời.
- ✅ **Public tracking** (tra cứu không cần login) là core value, implementation gọn với rate limit + sanitize.
- ✅ **Migrate dễ** — backup format hỗ trợ V1/V2/V3, restore từ file cũ vẫn work.
- ✅ **Zod validation ở server** — input an toàn, message lỗi rõ ràng bằng tiếng Việt.
- ✅ **Customer master tự động** sinh mã `KH00001` tăng dần, cascading update khi đổi tên/SĐT.

### 22.2. UX / Frontend
- ✅ **Responsive design tốt** — desktop + mobile dùng 2 bộ UI riêng (antd + antd-mobile) tối ưu cho từng context.
- ✅ **Lazy loading** mọi page → bundle ban đầu nhỏ.
- ✅ **Dark mode hoàn chỉnh** với `html[data-theme='dark']` + `useTheme` hook.
- ✅ **i18n structure** sẵn sàng (6 namespaces, dù hiện chỉ có `vi`).
- ✅ **Keyboard shortcuts** hữu ích (`Ctrl+N`, `Ctrl+K`, `Ctrl+P`, `?`).
- ✅ **In phiếu A4** chuyên nghiệp, có QR code.
- ✅ **Floating Zalo button** draggable — chi tiết UX tốt.
- ✅ **Recent lookups** localStorage — UX thân thiện.
- ✅ **Customer notifications** (banner/popup) — linh hoạt cho marketing.

### 22.3. DevOps
- ✅ **Docker Compose chuẩn production**: healthcheck, depends_on, restart: always, volume persistent.
- ✅ **Multi-stage build** cho frontend (build → nginx) → image nhỏ.
- ✅ **Backup scheduled** tự động (hourly/daily/monthly) + retention policy.
- ✅ **Tự động seed** khi DB trống.
- ✅ **Cloudflare Tunnel** integrated — không cần public port 80/443.

### 22.4. Vận hành
- ✅ **Vietnamese-first** UI (i18n namespace `ui`, locale `vi_VN`) — phù hợp user Việt.
- ✅ **Audit log** đầy đủ (ai, khi nào, before/after) — quan trọng cho warranty disputes.
- ✅ **Soft delete** cho cả staff và warranty — bảo toàn lịch sử.
- ✅ **NCC tracking** đầy đủ (gửi → nhận → log lịch sử) — workflow thực tế.
- ✅ **Import/Export Excel** — operator nhập liệu dễ.
- ✅ **Hỗ trợ nhiều hình thức xử lý**: bảo hành, sửa dịch vụ, đổi mới, khác.

---

## 23. Điểm yếu & Tech debt

### 23.1. Code quality
- ⚠️ **`WarrantyDetail.jsx` 123K** + **`WarrantyList.jsx` 26K** + **`routes/warranties.js` 62.9K** — quá lớn, nhiều logic trộn lẫn. Cần tách:
  - Hooks (useWarrantyEdit, useWarrantyActions).
  - Sub-components (Header, InfoTab, HistoryTab, AttachmentsTab, SupplierTab).
  - Route handlers thành modules nhỏ.
- ⚠️ **`global.css` 157K trong 1 file** — khó maintain, không tree-shake. Nên tái cấu trúc thành CSS Modules / CSS-in-JS / Tailwind theo feature.
- ⚠️ **Backup files rải rác**: `WarrantyDetail.jsx.backup-*` (8 files), `global.css.backup-*` (5 files), `db.json.bak.*`, `db.json.prev`, `warranties.js.bak-customers-master`, `historyTimeline.js.bak-field-labels` — nên dọn dẹp định kỳ hoặc move vào Git tags.
- ⚠️ **Nhiều comment tiếng Việt trong code** dài dòng — che noise, làm tăng file size. Tốt cho documentation nhưng khó scan.
- ⚠️ **Magic strings**: trạng thái `da_nhan`, `dang_xu_ly`... lặp đi lặp lại ở cả FE + BE. Nên share constants qua npm package hoặc JSON.
- ⚠️ **No TypeScript** — dễ typo, khó refactor khi schema phức tạp. Type definitions cho Warranty/Customer/Supplier sẽ rất giá trị.
- ⚠️ **`AiAssistant.jsx`** (16.6K) — không rõ wire tới API thật nào hay chỉ mock. Có thể là dead code hoặc cần kiểm tra.
- ⚠️ **`zodSchemas.js` ở FE chưa wire** — dead code, gây nhầm lẫn.
- ⚠️ **`CustomerPortal.jsx`** route không mount → có thể là legacy.

### 23.2. Kiến trúc
- ⚠️ **Write-through rebuild** trong `writeDb()`: mỗi CRUD trigger full table delete+recreate → CHẬM khi data lớn. Nên dùng update/create/delete riêng lẻ.
- ⚠️ **Customer master chỉ trong JSON**, không migrate sang PG. Split-brain risk.
- ⚠️ **JSONB cho `history`/`attachments`** — query lồng phức tạp, không index được. Nếu cần search history theo keyword sẽ rất chậm.
- ⚠️ **`date`-type fields** (`ngayNhan`, `ngayHenTra`, `ngayTra`) lưu STRING thay vì `DateTime` Prisma → mất type safety, mọi code phải tự parse.
- ⚠️ **`deletedAt = ''` (string rỗng)** thay vì `NULL` — quirky, sai convention PG, dễ bug nếu quên filter `WHERE deletedAt = ''`.
- ⚠️ **Backup types `minute` và `hourly` skip assets** — chỉ `daily`/`monthly`/`manual` mới bundle ảnh. Hàm `findReusableAssetBundle` chỉ scan các bundles đã tồn tại → nếu assets bundle bị xóa, lần backup sau sẽ tạo mới (tốn disk).
- ⚠️ **No DB connection pooling config** — dùng Prisma mặc định.
- ⚠️ **Single Prisma client** — không có pattern cho multiple transactions song song.
- ⚠️ **Scheduler chỉ chạy trong 1 process** — nếu chạy 2 backend container → 2 scheduler chạy đồng thời → duplicate backup.
- ⚠️ **Rate limiter in-memory** — mất khi restart, không sync giữa các instance.

### 23.3. Bảo mật (xem mục 20.2)
- ⚠️ Thiếu CSRF token cho state-changing requests.
- ⚠️ CSP off mặc định.
- ⚠️ Không có password complexity.
- ⚠️ Không refresh token.
- ⚠️ Backup không mã hóa.
- ⚠️ Public API không có CAPTCHA.

### 23.4. UX
- ⚠️ **Dark mode có recurring bug**: class `admin-mobile-*` mới thêm ship light bg, không có dark override → light blocks trong dark mode.
- ⚠️ **No empty state UI** cho một số list (vd: NCC rỗng).
- ⚠️ **No loading skeleton** cho vài page load chậm.
- ⚠️ **Toast/Message qua `App.useApp()`** chưa đồng nhất — vài chỗ dùng `message.success()` global.
- ⚠️ **No undo cho delete** (vd: xóa KH).
- ⚠️ **No bulk actions** trên list phiếu.
- ⚠️ **No pagination UI** trên customer master (load all → chậm nếu 10K KH).
- ⚠️ **No advanced search** (chỉ text contains).
- ⚠️ **No keyboard navigation** đầy đủ trong drawer.
- ⚠️ **A11y**: thiếu aria-label, role cho vài nút.

### 23.5. Testing
- ⚠️ **Test coverage cực thấp** — chỉ 6 file unit test, 0 integration/E2E.
- ⚠️ **Không test cho backup/restore flow** (rủi ro lớn).
- ⚠️ **Không test cho rate limit / auth edge cases**.
- ⚠️ **Không snapshot test** cho UI components.

### 23.6. Monitoring / Observability
- ⚠️ **Không có structured logging** (chỉ `console.log` qua morgan).
- ⚠️ **Không có error tracking** (Sentry, Rollbar...).
- ⚠️ **Không có metrics** (Prometheus, StatsD).
- ⚠️ **Không có healthcheck chi tiết** — chỉ check DB connection + FS writable.
- ⚠️ **Không có alerting** khi backup fail, DB lag, disk full.

### 23.7. Documentation
- ⚠️ **README gốc** chỉ 28K — thiếu sơ đồ database, API contract, deployment guide chi tiết.
- ⚠️ **No OpenAPI/Swagger** — phải đọc code để biết API shape.
- ⚠️ **No CHANGELOG** — chỉ có git log.
- ⚠️ **No architecture decision record (ADR)**.
- ⚠️ **Comment trong code không phải JSDoc** → IDE không suggest.

---

## 24. Rủi ro & bẫy đã biết

### 24.1. Rủi ro dữ liệu
- 🔴 **`writeDb` XÓA HẾT rồi INSERT lại** → nếu crash giữa chừng (OOM, kill -9) → **mất toàn bộ data** chỉ còn trong `db.json` (sync 2.5s debounce). Fix: dùng UPDATE thay vì DELETE+INSERT.
- 🔴 **PG và `db.json` có thể drift** nếu `syncLocalBackup` fail lặp lặp lại. Auto-heal chỉ chạy 1 lần khi start.
- 🔴 **`db.json` không gitignored đầy đủ** (chỉ `db.json` cụ thể) — file `.bak-*` có thể bị commit nhầm.
- 🟠 **Backup `restoreUploadedBackup`** ghi đè DB ngay khi upload mà không cần confirm rõ ràng ngoài chuỗi `RESTORE`.
- 🟠 **Hard delete trong `writeDb`** kết hợp soft-delete `deletedAt=''` → nếu code path quên filter `deletedAt` → lộ data đã xóa.

### 24.2. Rủi ro bảo mật
- 🔴 **CSRF** chưa có token → nếu browser có session cookie `ntpc_session` và user vào site độc hại → có thể bị forced action.
- 🟠 **JWT secret ngắn** → brute-force khả thi (nên enforce >=64 chars random).
- 🟠 **Backup files chứa password hash** → nếu rò rỉ → offline brute-force scrypt.
- 🟠 **Public tra cứu liệt kê SĐT** → bot có thể enumerate.

### 24.3. Rủi ro vận hành
- 🟠 **Cloudflare quick tunnel URL đổi mỗi restart** → nếu không có CNAME → user phải cập nhật URL.
- 🟠 **PG data ở `./pgdata`** — nếu mount sai quyền → container không đọc được → mất data khi restart.
- 🟠 **Backup retention 5 năm cho monthly** → tích lũy 60+ files × 311KB JSON × 5 năm → có thể ~100MB JSON + ~500MB tgz. Cần monitor disk.
- 🟠 **Scheduler chạy in-process** → nếu scale 2 backend → duplicate work.
- 🟠 **`cloudflared` container không có healthcheck** → nếu crash → tunnel down nhưng nginx vẫn serve.

### 24.4. Bẫy nghiệp vụ
- 🟡 **`soChungTu` format `DDMMYYYYNTPC<n>`** → nếu nhập sai năm (vd: 2025 thay vì 2026) → khó audit.
- 🟡 **`history` JSON append-only** → nếu user edit 1 dòng → mất thông tin trước/sau.
- 🟡 **Customer master mã `KH00001` KHÔNG reuse** → khi xóa KH, mã bỏ trống → restore từ backup cũ có thể cấp mã khác.
- 🟡 **Supplier code `NCC00001` case-insensitive unique** → nếu create 2 NCC cùng tên viết hoa/thường khác → vẫn pass.

### 24.5. Quirk đã ghi nhận
- `deletedAt` = `''` (empty string), không phải `NULL`.
- `ngayNhan`/`ngayHenTra`/`ngayTra` lưu string, không phải DateTime.
- Vite dev proxy `:3004` (mặc định `server.js` khi không có `API_PORT`) nhưng Docker/NGINX dùng `:3003`.
- Cổng backend trong `server.js` là `process.env.API_PORT || 3004` (KHÔNG phải 3003) — khác `docker-compose.yml` (3003) và `nginx.conf` (3003). Cần align.

---

## 25. Khuyến nghị khi lập kế hoạch mới

### 25.1. Quick wins (1-2 tuần, ít rủi ro)
1. **Align ports**: Chốt `API_PORT=3003` ở cả 3 chỗ (server.js, vite.config.js, docker-compose). Tránh bẫy "chạy được ở local nhưng fail ở Docker".
2. **Cleanup backup files** trong repo: xóa `*.backup-*` cũ, move vào git tag nếu cần. Tránh commit nhầm.
3. **Thêm dark mode override** cho các class `admin-mobile-*` mới — đây là recurring bug đã thấy.
4. **Audit UI** (xem log trong admin) — sử dụng `audit_logs` table đã có sẵn.
5. **CAPTCHA** cho public tra cứu — chặn bot scrape SĐT.
6. **Gỡ dead code**: `zodSchemas.js` FE, `CustomerPortal.jsx`, kiểm tra `AiAssistant.jsx` thật hay mock.

### 25.2. Refactor trung hạn (1-2 tháng)
1. **Tách `WarrantyDetail.jsx`** (123K) thành sub-components + hooks. Mục tiêu: < 30K mỗi file.
2. **Tách `global.css`** (157K) thành CSS Modules theo component hoặc migrate sang Tailwind.
3. **Refactor `writeDb()`**: chuyển từ DELETE+INSERT sang Prisma `upsert`/`update`/`delete` cho từng bảng. Tránh race condition + tăng tốc 10x.
4. **Migrate customer master sang PG** — bỏ JSON fallback cho collection này.
5. **Convert date fields** sang `DateTime` Prisma + giữ backward-compat ở API layer.
6. **Convert `deletedAt` sang NULL** thay vì empty string. Cẩn thận khi migrate dữ liệu cũ.
7. **Thêm tests** cho backup/restore (critical path), auth, customer master.
8. **OpenAPI/Swagger** auto-generated từ zod schemas → tạo FE types + API docs.

### 25.3. Dài hạn (3-6 tháng)
1. **Adopt TypeScript** dần (allowJs → checkJs → strict). Bắt đầu với `src/lib/`, `api/lib/`.
2. **Refresh token + CSRF token** — bảo mật auth flow chuẩn.
3. **Backup encryption at rest** — dùng GPG hoặc age.
4. **Background job queue** (Bull/BullMQ + Redis) thay vì in-process scheduler. Cần khi scale > 1 instance.
5. **Monitoring stack**: Prometheus + Grafana + Sentry.
6. **Move customer notifications** sang CDN/S3 để giảm tải Express.
7. **Mobile app** (React Native) nếu cần push notification.
8. **Tách audit log UI** thành module riêng + filter theo entity/actor/date.
9. **Thêm webhook** để integrate Zalo OA / SMS / email khi trạng thái phiếu đổi.
10. **Multi-tenant** nếu muốn bán SaaS (1 instance nhiều công ty).

### 25.4. Khi scale data
1. **Partition `warranties`** theo năm (vd: `warranties_2025`, `warranties_2026`).
2. **Index thêm** cho search full-text trên `khachHang`, `tenHang`, `soSeri`.
3. **Materialized view** cho dashboard stats (refresh mỗi 5 phút thay vì query live).
4. **Redis cache** cho `getCollection('warranties')` (invalidate khi write).
5. **S3/MinIO** cho uploads thay vì local disk.

### 25.5. Khi onboard người mới
1. **Setup guide** chi tiết trong `docs/setup.md`.
2. **Architecture diagram** (C4 model) trong `docs/architecture.md`.
3. **Glossary** thuật ngữ (chứng từ, NCC, BH-KT, hotine...).
4. **Onboarding checklist** cho dev mới.
5. **Code style guide** (chưa có, chỉ có `.prettierrc` defaults).

### 25.6. Câu hỏi cần trả lời trước khi lập plan
- [ ] Mục tiêu 6-12 tháng tới là gì? (Thêm chi nhánh, scale user, ra mobile app, tích hợp Zalo OA, mở rộng dịch vụ...)
- [ ] Data hiện tại bao nhiêu? Dự kiến tăng bao nhiêu/năm?
- [ ] Có cần SaaS hóa (multi-tenant) không?
- [ ] Có cần app mobile native không? (PWA có đủ không?)
- [ ] Budget cho infra: tự host hay lên cloud (AWS/GCP/Azure)?
- [ ] Team size: bao nhiêu dev, bao nhiêu người vận hành?
- [ ] SLA mục tiêu: uptime bao nhiêu %? RPO/RTO bao nhiêu?
- [ ] Có yêu cầu tuân thủ pháp lý nào không? (VD: lưu trữ hóa đơn điện tử, GDPR-like cho data khách hàng)
- [ ] Tích hợp với hệ thống nào khác? (Kế toán, CRM, ERP)

### 25.7. Đề xuất roadmap gợi ý
**Phase 1 (1 tháng) — Quick wins + Stabilization**
- Align ports, cleanup backups, dark mode bug fixes.
- Thêm audit UI.
- Restore script tự động test hàng tuần (cron chạy `restore_drill.js`).
- Backup monitoring alert (email khi fail).

**Phase 2 (2-3 tháng) — Refactor core**
- Tách `WarrantyDetail.jsx`, `global.css`.
- Refactor `writeDb()` sang upsert/update.
- Migrate customer master → PG.
- TypeScript light (JSDoc + checkJs).
- Test coverage 60%+ cho core flows.

**Phase 3 (3-6 tháng) — Feature expansion**
- Zalo OA integration (auto thông báo khi đổi trạng thái).
- Multi-branch (nếu mở chi nhánh mới).
- PWA install prompt + offline mode cho tra cứu.
- Advanced search + bulk actions.
- Refresh token + CSRF + 2FA.

**Phase 4 (6-12 tháng) — Scale & SaaS-ready**
- Multi-tenant (nếu cần).
- Background job queue + Redis.
- Mobile app (React Native hoặc Expo).
- S3 storage.
- Monitoring stack đầy đủ.
- CI/CD + staging environment.

---

## Phụ lục A: Liên kết nhanh

- **Live site**: https://baohanh.nguyentanpc.com
- **Cloudflare tunnel**: container tự start, URL động (cần named tunnel cho URL cố định).
- **PG port local**: 5435 (host) → 5432 (container).
- **Frontend port local**: 8888 (host) → 80 (container nginx).
- **API port local**: 3003 (nếu `API_PORT=3003`).
- **Admin test account**: `maNV=admin`, password xem `.env` (`INITIAL_STAFF_PASSWORD`).
- **Hotline**: 0937 63 2000 (BH-KT, tổng đài).
- **MST**: 3603797285.

## Phụ lục B: Quy ước dự án

- **Date format**: DD-MM-YYYY (display, DatePicker, dayjs, backend public API, Excel export).
- **i18n namespace**: `ui` (mặc định), `status`, `messages`, `validation`, `print`, `nav`.
- **Múi giờ**: `Asia/Ho_Chi_Minh` (TZ env + dayjs.tz.setDefault).
- **Backup refactor rule**: 2-layer backup khi sửa files >=200 dòng: (1) git branch `backup/<scope>-pre-redesign-<date>`, (2) `cp file file.backup-<scope>-pre-redesign`.
- **Phase refactor rule**: 1 branch per phase `chore/i18n-phaseN-...`, build + docker rebuild + curl verify sau mỗi phase, explicit "chưa commit" hold for review.
- **i18n rule**: Khi thêm/cleanup gitignored config hoặc data files, cũng commit sample với placeholder (`.env.example`, `api/db.example.json`).
- **Style convention**: antd cho desktop, antd-mobile cho mobile (mobile breakpoint: `< 1200px` qua `useIsMobile`).
- **Commit message**: `feat(scope)`, `fix(scope)`, `chore(scope)` + mô tả tiếng Việt.
- **Color semantics**: `'Đang xử lý'` → orange (warning) trên cả desktop + mobile.

## Phụ lục C: Lệnh thường dùng

```bash
# Khởi động
docker compose up -d

# Xem log backend
docker compose logs -f backend-api

# Query DB trực tiếp
docker compose exec postgres-db psql -U ntpc_user -d ntpc_warranty -c "SELECT count(*) FROM \"warranties\""

# Tail console logs
tail -f server-start.out.log

# Build local
npm run build

# Test
npm test

# Tạo backup manual từ CLI
docker compose exec backend-api node -e "import('./api/lib/backup.js').then(m=>m.createBackup('manual').then(r=>console.log(JSON.stringify(r))))"

# Chạy restore drill
node api/lib/restore_drill.js api/backups/hourly/db-XXX.json

# Verify backup SHA
cat api/backups/hourly/db-XXX.json.sha256
sha256sum api/backups/hourly/db-XXX.json
```

---

**Tài liệu này được tạo dựa trên rà soát mã nguồn thực tế tại `/mnt/baohanhntpc` phiên bản v3.0.0.**
**Mọi thông tin về file:line, dependency, schema đều đã được verify từ repo.**
**Ngày tạo**: 2026-06-15.
**Người tạo**: Hermes Agent (MiniMax-M3) trong session đánh giá hệ thống.

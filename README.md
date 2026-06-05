# 🔧 NTPC — Hệ Thống Quản Lý Bảo Hành

> **Quản lý phiếu bảo hành thiết bị máy tính** từ tiếp nhận, sửa chữa, gửi nhà cung cấp đến trả khách — toàn bộ quy trình trên một nền tảng web duy nhất.

---

## Mục Lục

- [Tính Năng Chính](#tính-năng-chính)
- [Kiến Trúc Tổng Quan](#kiến-trúc-tổng-quan)
- [Tech Stack](#tech-stack)
- [Cấu Trúc Thư Mục](#cấu-trúc-thư-mục)
- [Bắt Đầu Nhanh](#bắt-đầu-nhanh)
- [Sử Dụng](#sử-dụng)
- [Tài Liệu API](#tài-liệu-api)
- [Luồng Dữ Liệu](#luồng-dữ-liệu)
- [Cơ Sở Dữ Liệu](#cơ-sở-dữ-liệu)
- [Testing](#testing)
- [Deployment](#deployment)
- [Đóng Góp](#đóng-góp)
- [License](#license)

---

## Tính Năng Chính

- **Quản lý phiếu bảo hành (CRUD)** — Tạo, sửa, xóa, tìm kiếm phiếu với phân trang, lọc theo trạng thái / loại xử lý / nhân viên / ngày hẹn trả.
- **Luồng trạng thái hoàn chỉnh** — `Chờ xử lý → Đang xử lý → Chờ linh kiện → Đã sửa xong → Đã trả` / `Đã hủy`, kèm đổi trả hàng.
- **Gửi / nhận từ nhà cung cấp** — Gán phiếu cho NCC, theo dõi trạng thái gửi - nhận, nhật ký supplier logs.
- **Tra cứu công khai (không cần đăng nhập)** — Khách hàng tra cứu phiếu bằng số chứng từ hoặc SĐT tại `/tra-cuu`.
- **Dashboard & Thống kê** — Tổng quan phiếu, biểu đồ xu hướng theo ngày/tháng, top sản phẩm / khách hàng.
- **Quản lý nhân viên & khách hàng** — CRUD nhân viên, phân quyền admin/staff, quản lý hồ sơ khách hàng.
- **Import / Export Excel** — Tự động ánh xạ cột, xem trước, batch import. Export filtered results.
- **Backup & Restore** — Tự động backup theo giờ, backup thủ công, restore với SHA-256 checksum, restore drill (mô phỏng khôi phục).
- **Audit Log** — Ghi nhật ký mọi thay đổi (ai, khi nào, thay đổi gì, trước/sau).
- **In phiếu bảo hành** — Template phiếu in A4 với QR code, hỗ trợ `react-to-print`.
- **Trợ lý AI** — Chat assistant tích hợp (`@ant-design/x`) hỗ trợ tra cứu phiếu, thống kê, thông tin liên hệ.
- **Đa ngôn ngữ (i18n)** — Tiếng Việt mặc định qua `react-i18next` với 6 namespaces.
- **Dark/Light Theme** — Chuyển đổi giao diện, lưu preference vào localStorage.
- **Responsive Mobile** — Hỗ trợ đầy đủ trên mobile với `antd-mobile`, hook `useIsMobile`.
- **Phím tắt** — `Ctrl+N` tạo phiếu mới, `Ctrl+K` tìm kiếm, `Ctrl+P` in, `?` xem danh sách phím tắt.
- **Zalo Floating Button** — Nút chat Zalo nổi có thể kéo thả trên cả mobile và desktop.

---

## Kiến Trúc Tổng Quan

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Cloudflare Tunnel                           │
│                    (trycloudflare.com HTTPS)                        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      frontend-web (Nginx)                           │
│                     Port 8888 → 80 (nginx)                          │
│              Serve React SPA + Proxy /api → backend                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ /api proxy
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    backend-api (Express.js)                          │
│                        Port 3003                                    │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐            │
│  │ warranties│ │  auth    │ │  stats    │ │ suppliers │            │
│  │ customers │ │ nhanVien │ │  public   │ │  backups  │            │
│  └─────┬────┘ └────┬─────┘ └─────┬─────┘ └─────┬─────┘            │
│        └───────────┴─────────────┴──────────────┘                   │
│                         │ lib layer                                  │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐            │
│  │ db.js    │ │ auth.js  │ │ audit.js  │ │ backup.js │            │
│  │ (Prisma) │ │ (JWT)    │ │ (logging) │ │ (auto/h)  │            │
│  └────┬─────┘ └──────────┘ └───────────┘ └───────────┘            │
└───────┼────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  postgres-db (PostgreSQL 15)                         │
│                     Port 5435 → 5432                                │
│  Tables: nhan_vien, warranties, suppliers,                          │
│          supplier_logs, audit_logs                                   │
│  Volume: ./pgdata (persistent)                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Quy tắc dependency trong Docker Compose:**

| Service | Depends On | Health Check |
|---------|-----------|--------------|
| `backend-api` | `postgres-db` (healthy) | `GET /api/health` |
| `frontend-web` | `backend-api` (healthy) | `wget localhost` |
| `cloudflare-quick-tunnel` | `frontend-web` | — |

---

## Tech Stack

| Layer | Công nghệ | Phiên bản |
|-------|----------|-----------|
| **Frontend** | React | ^18.3.0 |
| **UI Framework** | Ant Design (antd) + antd-mobile | ^5.22.2 / ^5.42.3 |
| **AI Chat** | @ant-design/x | ^1.6.1 |
| **Charts** | @ant-design/charts | ^2.2.0 |
| **Routing** | React Router DOM | ^6.26.0 |
| **Forms** | react-hook-form + zod + @hookform/resolvers | ^7.53 / ^3.23 / ^3.9 |
| **i18n** | i18next + react-i18next + browser-languagedetector | ^26.2 / ^17.0 / ^8.2 |
| **HTTP Client** | Axios | ^1.7.0 |
| **QR Code** | qrcode.react | ^4.0.1 |
| **Print** | react-to-print | ^3.0.0 |
| **Excel** | SheetJS (xlsx) | ^0.18.5 |
| **Backend** | Express.js | ^4.21.0 |
| **ORM** | Prisma | ^5.20.0 |
| **Database** | PostgreSQL | 15 (Alpine) |
| **Security** | Helmet, JWT (HMAC-SHA256), scrypt password hash | — |
| **Build Tool** | Vite | ^5.4.0 |
| **Test Runner** | Vitest + Testing Library | ^2.0 / ^16.0 |
| **Container** | Docker Compose | 3.8 |
| **Reverse Proxy** | Nginx (Alpine) | — |
| **Tunnel** | Cloudflare Quick Tunnel | — |
| **CI/CD** | GitHub Actions | — |

---

## Cấu Trúc Thư Mục

```
ntpc-warranty/
├── .github/workflows/ci.yml      # CI pipeline (test + build)
├── api/                           # Backend Express.js
│   ├── lib/                       # Shared libraries
│   │   ├── auth.js                # JWT auth, password hashing, middleware
│   │   ├── audit.js               # Audit log writer
│   │   ├── backup.js              # Backup/restore system
│   │   ├── customerMaster.js      # Customer data aggregation
│   │   ├── customers.js           # Customer utility functions
│   │   ├── db.js                  # Prisma + JSON fallback DB layer
│   │   ├── restore_drill.js       # Restore simulation (dry-run)
│   │   └── validators.js          # Zod schemas (backend)
│   ├── routes/                    # Express route handlers
│   │   ├── auth.js                # /api/auth (login, logout, me)
│   │   ├── backups.js             # /api/admin/backups
│   │   ├── customers.js           # /api/customers
│   │   ├── nhanVien.js            # /api/nhan-vien (staff)
│   │   ├── public.js              # /api/public (no auth)
│   │   ├── stats.js               # /api/stats
│   │   ├── suppliers.js           # /api/suppliers
│   │   └── warranties.js          # /api/warranties (core)
│   ├── seedData.js                # Seed/sample data
│   ├── server.js                  # Express entry point
│   ├── uploads/                   # Uploaded images (persistent)
│   └── backups/                   # Backup files (persistent)
├── src/                           # Frontend React SPA
│   ├── components/
│   │   ├── admin/
│   │   │   └── BackupRestorePanel.jsx
│   │   ├── common/               # Shared components
│   │   │   ├── AiAssistant.jsx   # AI chat assistant
│   │   │   ├── ChangePasswordModal.jsx
│   │   │   ├── CustomerPickerModal.jsx
│   │   │   ├── ErrorBoundary.jsx
│   │   │   ├── FloatingZalo.jsx  # Draggable Zalo button
│   │   │   ├── ShortcutsModal.jsx
│   │   │   ├── SkeletonCard.jsx
│   │   │   └── StaffPickerModal.jsx
│   │   ├── layout/               # Layout shells
│   │   │   ├── AdminLayout.jsx
│   │   │   ├── AppHeader.jsx
│   │   │   ├── AppSider.jsx
│   │   │   ├── CustomerLayout.jsx
│   │   │   ├── GlobalSearch.jsx
│   │   │   └── NotificationBell.jsx
│   │   └── warranty/             # Warranty-specific components
│   │       ├── MobileStatusTag.jsx
│   │       ├── StatusTag.jsx
│   │       ├── WarrantyDetail.jsx    # 2299 lines — core detail drawer
│   │       ├── WarrantyPrint.jsx
│   │       └── WarrantyProgress.jsx
│   ├── constants/                # App constants
│   │   ├── badgeConfig.js
│   │   ├── routes.js
│   │   ├── statusConfig.js
│   │   └── warrantyOptions.js
│   ├── contexts/
│   │   └── AuthContext.jsx       # Auth state provider
│   ├── hooks/                    # Custom React hooks
│   │   ├── useDebounce.js
│   │   ├── useIsMobile.js
│   │   ├── useKeyboardShortcuts.js
│   │   ├── useTheme.js
│   │   └── useWarranties.js
│   ├── i18n/
│   │   ├── index.js              # i18next config (vi default)
│   │   └── locales/vi/           # Vietnamese translations
│   │       ├── messages.json     # Success/error/confirm messages
│   │       ├── nav.json          # Navigation labels
│   │       ├── print.json        # Print template strings
│   │       ├── status.json       # Status enum labels
│   │       ├── ui.json           # UI strings (594 lines, main file)
│   │       └── validation.json   # Form validation messages
│   ├── lib/
│   │   ├── axios.js              # Axios instance (baseURL: /api)
│   │   └── zodSchemas.js         # Frontend Zod schemas
│   ├── main.jsx                  # React entry point
│   ├── App.jsx                   # Router + guards + lazy loading
│   ├── pages/
│   │   ├── admin/                # Admin pages
│   │   │   ├── CreateWarranty.jsx
│   │   │   ├── CustomerInfo.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── ImportExport.jsx
│   │   │   ├── StaffManagement.jsx
│   │   │   ├── Statistics.jsx
│   │   │   ├── Suppliers.jsx
│   │   │   └── WarrantyList.jsx
│   │   ├── customer/             # Public pages
│   │   │   ├── CustomerPortal.jsx
│   │   │   ├── TrackingResult.jsx
│   │   │   └── Tracuu.jsx
│   │   └── NotFound.jsx
│   ├── services/                 # API service clients
│   │   ├── warrantyService.js    # 7 services (warranty, customer, stats, public, supplier, nhanVien, auth)
│   │   └── backupService.js
│   ├── styles/
│   │   ├── global.css            # 4022 lines — full theme system
│   │   └── print.css
│   ├── theme/
│   │   └── antdTheme.js          # Light/dark antd theme configs
│   └── utils/                    # Utility functions
│       ├── copy.js               # Clipboard
│       ├── dateHelpers.js        # Date formatting, business days
│       ├── excelHelpers.js       # Excel parse/map
│       ├── fieldLabels.js        # Vietnamese field labels
│       ├── formatters.js         # VND currency, name masking
│       ├── generateChungTu.js    # Document code generator
│       ├── historyDisplay.js     # History normalization
│       ├── historyTimeline.js    # Timeline rendering
│       ├── i18nOptions.js        # i18n helpers
│       ├── urgency.js            # Urgency classification
│       └── vietnameseText.js     # Mojibake fixer
├── tests/                        # Vitest test suite
│   ├── setup.js
│   ├── i18n.test.js
│   ├── urgency.test.js
│   ├── StatusTag.test.jsx
│   ├── fieldLabels.smoke.test.js
│   ├── generateChungTu.test.js
│   └── vietnameseUi.test.js
├── prisma/
│   ├── schema.prisma             # Database schema (5 models)
│   └── migrations/               # Prisma migrations
├── scripts/                      # Utility/migration scripts
├── scratch/                      # Debug/inspection scripts
├── docker-compose.yml            # 4-service orchestration
├── api.Dockerfile                # Backend Docker build
├── web.Dockerfile                # Frontend Docker build (multi-stage)
├── nginx.conf                    # Nginx reverse proxy config
├── package.json                  # ntpc-warranty v3.0.0
├── vite.config.js                # Vite dev server config
├── vitest.config.js              # Test runner config
└── index.html                    # SPA entry HTML
```

---

## Bắt Đầu Nhanh

### Yêu cầu môi trường

| Công nghệ | Phiên bản tối thiểu |
|-----------|---------------------|
| Node.js | 20.x |
| npm | 10.x |
| Docker | 24.x |
| Docker Compose | 2.x |
| PostgreSQL | 15 (hoặc dùng Docker) |

### Cài đặt

```bash
# 1. Clone repo
git clone <repository-url>
cd ntpc-warranty

# 2. Cài dependencies
npm install

# 3. Generate Prisma client
npx prisma generate

# 4. Tạo file .env (xem bảng biến môi trường bên dưới)
cp .env.example .env   # nếu có template
# hoặc tạo thủ công

# 5. Chạy dev (không Docker)
npm run start
# → Frontend: http://localhost:8888
# → Backend API: http://localhost:3004

# 5'. Hoặc chạy bằng Docker Compose
docker compose up -d --build
# → App: http://localhost:8888
```

### Biến môi trường

Tạo file `.env` ở thư mục gốc dự án:

| Tên biến | Mô tả | Bắt buộc | Mặc định |
|----------|-------|-----------|----------|
| `POSTGRES_USER` | Username PostgreSQL | ✅ | — |
| `POSTGRES_PASSWORD` | Password PostgreSQL | ✅ | — |
| `POSTGRES_DB` | Tên database | ✅ | — |
| `DATABASE_URL` | Connection string Prisma (compose tự tạo từ POSTGRES_*) | ✅ | — |
| `AUTH_SECRET` | Secret key ký JWT (HMAC-SHA256) | ✅ | — |
| `INITIAL_STAFF_PASSWORD` | Mật khẩu mặc định cho tài khoản nhân viên đầu tiên | ✅ | — |
| `SESSION_TTL_SECONDS` | Thời gian sống của session cookie (giây) | ❌ | — |
| `COOKIE_SECURE` | Cookie chỉ gửi qua HTTPS | ❌ | `true` |
| `CORS_ORIGIN` | Domain được phép gọi API (dùng `*` cho dev) | ❌ | — |
| `API_PORT` | Port backend API | ❌ | `3004` |
| `NODE_ENV` | Môi trường chạy | ❌ | — |
| `TZ` | Múi giờ | ❌ | `Asia/Ho_Chi_Minh` |

> **Lưu ý:** Khi chạy bằng Docker Compose, biến `DATABASE_URL` được tự động compose từ `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` trong `docker-compose.yml`.

### Lệnh chạy

```bash
# Development (chạy cả API + Vite dev server)
npm run start

# Chỉ chạy frontend (Vite dev server)
npm run dev

# Chỉ chạy backend
npm run api

# Build production
npm run build

# Preview build
npm run preview

# Chạy tests
npm run test

# Docker Compose (production)
docker compose up -d --build

# Xem logs
docker compose logs -f backend-api
docker compose logs -f frontend-web

# Rebuild chỉ 1 service
docker compose up -d --build backend-api
```

---

## Sử Dụng

### Routes chính

| Route | Vai trò | Mô tả |
|-------|---------|-------|
| `/` | Public | Chuyển hướng đến `/tra-cuu` |
| `/tra-cuu` | Public | Tra cứu bảo hành (khách hàng) |
| `/tra-cuu/:soChungTu` | Public | Kết quả chi tiết phiếu |
| `/admin/dashboard` | Staff | Dashboard tổng quan |
| `/admin/phieu` | Staff | Danh sách phiếu bảo hành |
| `/admin/phieu/:id/in` | Staff | In phiếu bảo hành |
| `/admin/tao-phieu` | Staff | Tạo phiếu mới |
| `/admin/khach-hang` | Staff | Quản lý khách hàng |
| `/admin/nhan-vien` | Admin | Quản lý nhân viên |
| `/admin/nha-cung-cap` | Staff | Quản lý nhà cung cấp |
| `/admin/thong-ke` | Staff | Thống kê & biểu đồ |
| `/admin/import-export` | Admin | Import/Export Excel + Backup |

### Phím tắt (Admin)

| Phím | Chức năng |
|------|----------|
| `Ctrl+N` | Tạo phiếu mới |
| `Ctrl+K` | Focus ô tìm kiếm |
| `Ctrl+P` | In phiếu |
| `Escape` | Đóng drawer |
| `?` | Hiển thị danh sách phím tắt |

### Đăng nhập

Truy cập route `/admin/*` sẽ tự động hiện modal đăng nhập StaffPickerModal. Sử dụng mã nhân viên (maNV) và mật khẩu để đăng nhập.

---

## Tài Liệu API

Tất cả endpoints bắt đầu bằng `/api`. Protected routes yêu cầu JWT cookie hợp lệ.

### Auth (`/api/auth`)

| Method | Endpoint | Mô tả | Auth |
|--------|----------|--------|------|
| POST | `/api/auth/login` | Đăng nhập | ❌ |
| POST | `/api/auth/logout` | Đăng xuất | ✅ |
| GET | `/api/auth/me` | Lấy thông tin nhân viên hiện tại | ✅ |
| POST | `/api/auth/change-password` | Đổi mật khẩu | ✅ |

### Warranties (`/api/warranties`)

| Method | Endpoint | Mô tả | Auth |
|--------|----------|--------|------|
| GET | `/api/warranties` | Danh sách phiếu (filter, sort, paginate) | ✅ |
| POST | `/api/warranties` | Tạo phiếu mới | ✅ |
| GET | `/api/warranties/:id` | Chi tiết phiếu | ✅ |
| PUT | `/api/warranties/:id` | Cập nhật phiếu | ✅ |
| DELETE | `/api/warranties/:id` | Xóa mềm phiếu | ✅ |
| POST | `/api/warranties/:id/status` | Cập nhật trạng thái | ✅ |
| POST | `/api/warranties/:id/return` | Xử lý trả hàng | ✅ |
| POST | `/api/warranties/:id/exchange` | Xử lý đổi hàng | ✅ |
| POST | `/api/warranties/import-excel` | Import từ Excel | ✅ |
| GET | `/api/warranties/export` | Export ra Excel | ✅ |

### Public (`/api/public` — không cần auth)

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/api/public/warranty/:id` | Tra cứu phiếu theo ID |
| GET | `/api/public/search` | Tìm kiếm phiếu |
| POST | `/api/public/lookup` | Tra cứu theo SĐT/chứng từ |

### Customers (`/api/customers`)

| Method | Endpoint | Mô tả | Role |
|--------|----------|--------|------|
| GET | `/api/customers/list` | Danh sách khách hàng | Staff |
| GET | `/api/customers/search` | Tìm kiếm khách hàng | Staff |
| GET | `/api/customers/:key` | Chi tiết khách hàng | Staff |
| PUT | `/api/customers/:key` | Cập nhật khách hàng | Staff |

### Staff (`/api/nhan-vien`)

| Method | Endpoint | Mô tả | Role |
|--------|----------|--------|------|
| GET | `/api/nhan-vien` | Danh sách nhân viên | Staff |
| POST | `/api/nhan-vien/verify` | Xác thực nhân viên | ❌ |
| POST | `/api/nhan-vien` | Tạo nhân viên mới | Admin |
| PUT | `/api/nhan-vien/:maNV` | Cập nhật nhân viên | Admin |
| DELETE | `/api/nhan-vien/:maNV` | Vô hiệu hóa nhân viên | Admin |

### Suppliers (`/api/suppliers`)

| Method | Endpoint | Mô tả | Role |
|--------|----------|--------|------|
| GET | `/api/suppliers` | Danh sách NCC | Staff |
| POST | `/api/suppliers` | Tạo NCC mới | Staff |
| PUT | `/api/suppliers/:id` | Cập nhật NCC | Staff |
| DELETE | `/api/suppliers/:id` | Xóa NCC | Admin |

### Stats (`/api/stats`)

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/api/stats/summary` | Tổng quan dashboard |
| GET | `/api/stats/daily` | Thống kê theo ngày |
| GET | `/api/stats/monthly` | Thống kê theo tháng |

### Backups (`/api/admin/backups` — Admin only)

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/api/admin/backups/status` | Trạng thái backup |
| GET | `/api/admin/backups/history` | Lịch sử backup/restore |
| POST | `/api/admin/backups/create` | Tạo backup thủ công |
| POST | `/api/admin/backups/restore` | Restore từ backup |
| DELETE | `/api/admin/backups/:id` | Xóa backup |

### Health Check

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/api/health` | Kiểm tra trạng thái server + DB + filesystem |

---

## Luồng Dữ Liệu

### 1. Tạo phiếu bảo hành

```
Khách hàng mang thiết bị đến
  → Nhân viên tạo phiếu (CreateWarranty page)
    → react-hook-form + zod validate
    → POST /api/warranties
      → Zod warrantySchema validate (backend)
      → Tạo Warranty record trong PostgreSQL
      → Ghi AuditLog
      → Auto-link customer
      → Sync backup
    → Trả về phiếu mới
  → In phiếu (WarrantyPrint + QR code)
```

### 2. Cập nhật trạng thái

```
Nhân viên chọn phiếu → WarrantyDetail drawer
  → Chọn action (nhận, sửa xong, trả, gửi NCC, đổi trả)
    → POST /api/warranties/:id/status
      → Validate trạng thái hợp lệ
      → Cập nhật trangThai + history JSON array
      → Ghi AuditLog (before/after snapshot)
      → Nếu gửi NCC: tạo SupplierLog + cập nhật supplierStatus
    → UI cập nhật StatusTag + timeline
```

### 3. Tra cứu công khai

```
Khách hàng truy cập /tra-cuu
  → Nhập số chứng từ hoặc SĐT
    → GET /api/public/search (rate-limited)
      → Tìm Warranty theo soChungTu hoặc soDienThoai
      → Normalize Vietnamese text cho search
    → Hiển thị kết quả với StatusTag
  → Click vào phiếu → /tra-cuu/:soChungTu
    → GET /api/public/warranty/:id
    → TrackingResult page: timeline, chi tiết, attachments
```

### 4. Backup tự động

```
Server khởi động → startBackupScheduler()
  → Cron job chạy mỗi giờ
    → Tạo JSON snapshot toàn bộ DB
    → Tạo asset bundle (tgz) cho uploads
    → Tính SHA-256 checksum
    → Lưu vào api/backups/hourly/
    → Cleanup backup cũ theo retention policy
```

---

## Cơ Sở Dữ Liệu

Sử dụng **Prisma ORM** với **PostgreSQL 15**. Schema gồm 5 models:

### NhanVien (Nhân viên)

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `maNV` (PK) | String | Mã nhân viên (NV001) |
| `tenNV` | String | Họ tên |
| `matKhau` | String | Mật khẩu (scrypt hash) |
| `quyen` | String | `admin` hoặc `staff` |
| `active` | Boolean | Trạng thái hoạt động |

### Warranty (Phiếu bảo hành)

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` (PK) | UUID | ID phiếu |
| `soChungTu` | String (unique) | Số chứng từ (VD: 25052026NBHSC1) |
| `khachHang` | String | Tên khách hàng |
| `soDienThoai` | String | SĐT |
| `tenHang` | String | Tên sản phẩm |
| `soSeri` | String | Số serial |
| `trangThai` | String | Trạng thái phiếu |
| `ngayNhan` | String | Ngày tiếp nhận |
| `ngayHenTra` | String | Ngày hẹn trả |
| `history` | JSON | Mảng lịch sử thay đổi |
| `attachments` | JSON | Mảng file đính kèm |
| `supplierStatus` | String | Trạng thái gửi NCC |
| ... | ... | (xem `prisma/schema.prisma` đầy đủ) |

### Supplier (Nhà cung cấp)

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` (PK) | UUID | ID nhà cung cấp |
| `code` | String | Mã NCC (NCC00001) |
| `name` | String | Tên NCC |
| `phone`, `email`, `address` | String | Thông tin liên hệ |

### SupplierLog (Nhật ký gửi/nhận NCC)

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` (PK) | UUID | ID nhật ký |
| `supplierId` | FK → Supplier | Nhà cung cấp |
| `warrantyId` | FK → Warranty | Phiếu bảo hành |
| `action` | String | `sent` hoặc `returned` |
| `sentAt`, `returnedAt` | String | Thời gian gửi/nhận |

### AuditLog (Nhật ký kiểm toán)

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` (PK) | UUID | ID log |
| `actorId`, `actorName` | String | Người thực hiện |
| `action` | String | Hành động |
| `entity`, `entityId` | String | Đối tượng bị tác động |
| `before`, `after` | JSON | Snapshot trước/sau |
| `ip`, `userAgent` | String | Thông tin request |

### Mối quan hệ

- `Warranty` → `NhanVien` (nhiều-1, qua `maNhanVien`)
- `Warranty` → `Supplier` (nhiều-1, qua `supplierIdCurrent`)
- `Warranty` → `SupplierLog` (1-nhiều)
- `Supplier` → `SupplierLog` (1-nhiều, cascade delete)

---

## Testing

```bash
# Chạy tất cả tests
npm run test

# Chạy tests trong watch mode (trong dev)
npx vitest
```

**Test suite hiện tại (7 files):**

| Test File | Coverage |
|-----------|----------|
| `i18n.test.js` | i18n config, namespace loading, interpolation |
| `urgency.test.js` | Urgency classification (done/overdue/urgent/soon/normal) |
| `StatusTag.test.jsx` | Status tag rendering, colors, labels |
| `fieldLabels.smoke.test.js` | Vietnamese field label resolution |
| `generateChungTu.test.js` | Document code generation |
| `vietnameseUi.test.js` | Vietnamese text normalization, mojibake fix |

**Test config:** Vitest + jsdom environment + @testing-library/react + @testing-library/jest-dom.

---

## Deployment

### Docker Compose (Production)

```bash
# Build và khởi động tất cả services
docker compose up -d --build

# Kiểm tra health
docker compose ps

# Xem logs
docker compose logs -f

# Rebuild 1 service cụ thể
docker compose up -d --build backend-api

# Dừng tất cả
docker compose down

# Dừng và xóa volumes (⚠️ mất data)
docker compose down -v
```

### Cloudflare Tunnel

Dự án tích hợp Cloudflare Quick Tunnel để truy cập công khai qua HTTPS mà không cần domain riêng.

```bash
# Lấy URL tunnel (Linux/macOS)
bash get-tunnel.sh

# Lấy URL tunnel (Windows)
get-tunnel.bat
```

### CI/CD

GitHub Actions CI chạy trên mọi `push` và `pull_request`:

1. Checkout code
2. Setup Node.js 20
3. `npm ci`
4. `npx prisma validate`
5. `npx prisma generate`
6. `npm test`
7. `npm run build`

---

## Đóng Góp

> TODO: CONTRIBUTING.md chưa có. Dưới đây là quy trình đề xuất.

1. Fork repository
2. Tạo branch từ `main`: `git checkout -b feature/ten-feature`
3. Commit theo convention: `feat:`, `fix:`, `chore:`, `docs:`
4. Push và tạo Pull Request
5. Đảm bảo CI pass (test + build)

---

## License

> TODO: Chưa có file LICENSE. Cần xác định license trước khi public.

---

*README này được tạo dựa trên knowledge graph phân tích tự động (`.understand-anything/`) và đối chiếu với code thực tế. Cập nhật lần cuối: 2026-05-30.*

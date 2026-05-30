# NTPC Warranty Management System

> Hệ thống quản lý bảo hành thiết bị vi tính — Full-stack Web Application

---

## Mục lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Kiến trúc & Công nghệ](#2-kiến-trúc--công-nghệ)
3. [Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
4. [Kỹ thuật & Pattern được áp dụng](#4-kỹ-thuật--pattern-được-áp-dụng)
5. [Giao diện (UI/UX)](#5-giao-diện-uiux)
6. [Phân tích Điểm mạnh & Điểm yếu](#6-phân-tích-điểm-mạnh--điểm-yếu)
7. [Hướng dẫn cài đặt & chạy](#7-hướng-dẫn-cài-đặt--chạy)
8. [API & Tính năng chính](#8-api--tính-năng-chính)

---

## 1. Tổng quan dự án

### Tên dự án
**NTPC Warranty** (ntpc-warranty) — v3.0.0

### Mục đích
Hệ thống quản lý phiếu bảo hành thiết bị vi tính, thay thế quy trình quản lý thủ công (Excel/ giấy) bằng một ứng dụng web toàn diện. Giải quyết bài toán:

- **Theo dõi vòng đời bảo hành**: từ lúc nhận thiết bị từ khách hàng → xử lý → gửi nhà cung cấp (NCC) → trả khách.
- **Quản lý khách hàng & lịch sử sửa chữa**: lưu vết toàn bộ quá trình, hỗ trợ tra cứu nhanh.
- **Thống kê & báo cáo**: dashboard trực quan, xuất/nhập dữ liệu Excel.
- **Cổng tra cứu công khai**: khách hàng tự tra cứu trạng thái bảo hành bằng số chứng từ.

### Đối tượng người dùng
| Vai trò | Mô tả |
|---------|-------|
| **Khách hàng** | Tra cứu trạng thái phiếu bảo hành qua số chứng từ (không cần đăng nhập). |
| **Nhân viên (Staff)** | Tạo/sửa phiếu, cập nhật trạng thái, quản lý ảnh đính kèm, gửi/nhận NCC. |
| **Quản trị viên (Admin)** | Toàn quyền nhân viên + quản lý nhân viên, import/export, xem thống kê, backup/restore. |

---

## 2. Kiến trúc & Công nghệ

### Tech Stack chi tiết

| Thành phần | Công nghệ | Phiên bản | Vai trò |
|------------|-----------|-----------|---------|
| **Frontend Framework** | React | ^18.3.0 | SPA — render giao diện phía client |
| **UI Library (Desktop)** | Ant Design (antd) | ^5.22.2 | Component library chính: Table, Form, Modal, Layout |
| **UI Library (Mobile)** | Ant Design Mobile | ^5.42.3 | Component tối ưu mobile: Popup, List, ActionSheet |
| **Routing** | React Router DOM | ^6.26.0 | Điều hướng SPA, lazy loading route |
| **Form Management** | React Hook Form + Zod | ^7.53.0 + ^3.23.0 | Quản lý form + validation schema |
| **HTTP Client** | Axios | ^1.7.0 | Giao tiếp với Backend API |
| **Internationalization** | i18next + react-i18next | ^26.2.0 + ^17.0.8 | Đa ngôn ngữ (hiện tại: tiếng Việt) |
| **Charts** | @ant-design/charts | ^2.2.0 | Biểu đồ thống kê (Dashboard, Statistics) |
| **QR Code** | qrcode.react | ^4.0.1 | Tạo mã QR cho phiếu bảo hành |
| **Print** | react-to-print | ^3.0.0 | In phiếu bảo hành trực tiếp từ browser |
| **Excel** | xlsx (SheetJS) | ^0.18.5 | Import/Export dữ liệu Excel |
| **Date Utility** | dayjs + date-fns | ^1.11.13 + ^3.6.0 | Xử lý ngày tháng, múi giờ Asia/Ho_Chi_Minh |
| **Build Tool** | Vite | ^5.4.0 | Dev server HMR + build sản phẩm |
| **Backend Runtime** | Node.js | 20 LTS (Alpine) | Chạy server-side JavaScript |
| **Backend Framework** | Express.js | ^4.21.0 | REST API server |
| **ORM** | Prisma | ^5.20.0 | Truy vấn PostgreSQL type-safe |
| **Database** | PostgreSQL | 15 (Alpine) | Cơ sở dữ liệu quan hệ chính |
| **Security** | Helmet | ^8.0.0 | HTTP security headers |
| **Logging** | Morgan | ^1.10.0 | HTTP request logging |
| **Auth** | Custom JWT (HMAC-SHA256) | — | Session-based auth qua httpOnly cookie |
| **Password Hashing** | scrypt (Node.js crypto) | — | Hash mật khẩu nhân viên |
| **Reverse Proxy** | Nginx | Alpine | Phục vụ static files + proxy /api → backend |
| **Tunnel** | Cloudflare Quick Tunnel | — | Truy cập công khai qua trycloudflare.com |
| **Containerization** | Docker Compose | 3.8 | Orchestration 4 services |
| **Testing** | Vitest + Testing Library | ^2.0.0 + ^16.0.0 | Unit test + component test |
| **E2E Testing** | Playwright | ^1.60.0 | End-to-end browser testing |
| **CI/CD** | GitHub Actions | — | Auto test + build on push/PR |
| **Code Quality** | ESLint + Prettier | ^9.0.0 + ^3.3.0 | Lint + format code |

### Sơ đồ kiến trúc tổng thể

```mermaid
graph TB
    subgraph "Client (Browser)"
        A[React SPA<br/>Vite + Ant Design] -->|Axios HTTP| B[Nginx<br/>Port 8888]
    end

    subgraph "Docker Compose Network (ntpc-network)"
        B -->|Reverse Proxy /api| C[Backend API<br/>Express.js :3003]
        B -->|Reverse Proxy /uploads| C
        C -->|Prisma ORM| D[(PostgreSQL 15<br/>Port 5435)]
        C -->|Fallback| E[(db.json<br/>Local File)]
        C -->|Static Files| F[(uploads/<br/>Images)]
        C -->|Scheduled| G[(backups/<br/>JSON + tgz)]
        B -->|Public URL| H[Cloudflare<br/>Quick Tunnel]
    end

    I[Khách hàng] -->|Tra cứu| H
    J[Nhân viên / Admin] -->|Đăng nhập| A

    style A fill:#1677FF,color:#fff
    style C fill:#52C41A,color:#fff
    style D fill:#336791,color:#fff
    style B fill:#269539,color:#fff
```

### Luồng dữ liệu chính (Data Flow)

```mermaid
sequenceDiagram
    participant U as Nhân viên (Browser)
    participant N as Nginx
    participant A as Express API
    participant P as PostgreSQL
    participant F as db.json (Fallback)

    U->>N: POST /api/warranties
    N->>A: Proxy request
    A->>A: Validate (Zod schema)
    A->>A: Auth check (JWT cookie)
    A->>P: Prisma create warranty
    P-->>A: Created record
    A->>F: syncLocalBackup() [debounce 2.5s]
    A-->>N: JSON response
    N-->>U: Response + audit log
```

**Luồng tự phục hồi dữ liệu (Self-Healing Sync):**
```mermaid
flowchart LR
    A[Server khởi động] --> B{Đọc PostgreSQL}
    B --> C{Đọc db.json}
    C --> D{So sánh max updatedAt}
    D -->|db.json mới hơn| E[Reverse Sync<br/>db.json → PostgreSQL]
    D -->|PostgreSQL mới hơn| F[Forward Sync<br/>PostgreSQL → db.json]
    D -->|Bằng nhau| G[Đã đồng nhất]
```

---

## 3. Cấu trúc thư mục

```
ntpc-warranty/
├── api/                          # Backend API (Express.js)
│   ├── lib/                      # Thư viện dùng chung backend
│   │   ├── audit.js              # Ghi audit log (ai làm gì, khi nào)
│   │   ├── auth.js               # Xác thực JWT + phân quyền + hash password
│   │   ├── backup.js             # Hệ thống backup/restore tự động + thủ công
│   │   ├── customerMaster.js     # Xây dựng bảng khách hàng từ warranties
│   │   ├── customers.js          # Logic CRUD khách hàng
│   │   ├── db.js                 # Lớp truy xuất DB: Prisma ↔ JSON fallback
│   │   ├── restore_drill.js      # Kiểm thử khôi phục dữ liệu
│   │   └── validators.js         # Zod schema validation cho API
│   ├── routes/                   # Định tuyến API (REST)
│   │   ├── auth.js               # POST /login, /logout, /me, /change-password
│   │   ├── backups.js            # CRUD backup (admin only)
│   │   ├── customers.js          # Quản lý khách hàng
│   │   ├── nhanVien.js           # Quản lý nhân viên
│   │   ├── public.js             # API công khai (tra cứu không cần login)
│   │   ├── stats.js              # Thống kê & báo cáo
│   │   ├── suppliers.js          # Quản lý nhà cung cấp
│   │   └── warranties.js         # CRUD phiếu bảo hành (core)
│   ├── seedData.js               # Dữ liệu mẫu khởi tạo
│   ├── server.js                 # Entry point Express server
│   └── uploads/                  # Ảnh đính kèm phiếu (persisted volume)
│
├── prisma/
│   └── schema.prisma             # Lược đồ CSDL (6 models)
│
├── src/                          # Frontend (React SPA)
│   ├── components/
│   │   ├── admin/
│   │   │   └── BackupRestorePanel.jsx   # Panel backup/restore admin
│   │   ├── common/
│   │   │   ├── AiAssistant.jsx          # Trợ lý AI (Ant Design X)
│   │   │   ├── ChangePasswordModal.jsx  # Đổi mật khẩu
│   │   │   ├── CustomerPickerModal.jsx  # Chọn khách hàng
│   │   │   ├── ErrorBoundary.jsx        # Bắt lỗi React
│   │   │   ├── FloatingZalo.jsx         # Nút Zalo nổi
│   │   │   ├── ShortcutsModal.jsx       # Phím tắt
│   │   │   ├── SkeletonCard.jsx         # Loading skeleton
│   │   │   └── StaffPickerModal.jsx     # Chọn nhân viên đăng nhập
│   │   ├── layout/
│   │   │   ├── AdminLayout.jsx          # Layout chính admin (sidebar + header)
│   │   │   ├── AppHeader.jsx            # Header với search, notification, user
│   │   │   ├── AppSider.jsx             # Sidebar điều hướng
│   │   │   ├── CustomerLayout.jsx       # Layout trang khách hàng
│   │   │   ├── GlobalSearch.jsx         # Tìm kiếm toàn cục
│   │   │   └── NotificationBell.jsx     # Chuông thông báo
│   │   └── warranty/
│   │       ├── MobileStatusTag.jsx      # Status tag tối ưu mobile
│   │       ├── StatusTag.jsx            # Status tag desktop
│   │       ├── WarrantyDetail.jsx       # Chi tiết phiếu bảo hành
│   │       ├── WarrantyPrint.jsx        # In phiếu bảo hành
│   │       └── WarrantyProgress.jsx     # Progress bar trạng thái
│   ├── constants/
│   │   ├── badgeConfig.js               # Cấu hình màu badge trạng thái
│   │   ├── routes.js                    # Định nghĩa đường dẫn
│   │   ├── statusConfig.js              # Cấu hình trạng thái phiếu
│   │   └── warrantyOptions.js           # Các tùy chọn phiếu BH
│   ├── contexts/
│   │   └── AuthContext.jsx              # Context xác thực toàn cục
│   ├── hooks/
│   │   ├── useDebounce.js               # Debounce input tìm kiếm
│   │   ├── useIsMobile.js               # Detect mobile viewport
│   │   ├── useKeyboardShortcuts.js      # Phím tắt toàn cục
│   │   ├── useTheme.js                  # Dark/Light theme toggle
│   │   └── useWarranties.js             # Fetch & cache danh sách phiếu
│   ├── i18n/
│   │   ├── index.js                     # Khởi tạo i18next
│   │   └── locales/vi/                  # Bản dịch tiếng Việt
│   │       ├── ui.json                  # UI labels (default namespace)
│   │       ├── status.json              # Tên trạng thái
│   │       ├── messages.json            # Thông báo hệ thống
│   │       ├── validation.json          # Lỗi validation
│   │       ├── print.json               # Text in phiếu
│   │       └── nav.json                 # Điều hướng
│   ├── lib/
│   │   ├── axios.js                     # Axios instance + interceptors
│   │   └── zodSchemas.js               # Zod schemas frontend
│   ├── pages/
│   │   ├── admin/
│   │   │   ├── CreateWarranty.jsx       # Tạo phiếu mới
│   │   │   ├── CustomerInfo.jsx         # Quản lý khách hàng
│   │   │   ├── Dashboard.jsx            # Dashboard tổng quan
│   │   │   ├── ImportExport.jsx         # Import/Export Excel
│   │   │   ├── StaffManagement.jsx      # Quản lý nhân viên (admin)
│   │   │   ├── Statistics.jsx           # Thống kê chi tiết
│   │   │   ├── Suppliers.jsx            # Quản lý nhà cung cấp
│   │   │   └── WarrantyList.jsx         # Danh sách phiếu bảo hành
│   │   ├── customer/
│   │   │   ├── CustomerPortal.jsx       # Trang chủ khách hàng
│   │   │   ├── TrackingResult.jsx       # Kết quả tra cứu
│   │   │   ├── TrackingResult.module.css
│   │   │   └── Tracuu.jsx              # Form tra cứu
│   │   └── NotFound.jsx                 # Trang 404
│   ├── services/
│   │   ├── backupService.js             # API calls backup/restore
│   │   └── warrantyService.js           # Tất cả API calls (warranty, customer, stats, auth...)
│   ├── styles/
│   │   ├── global.css                   # Styles toàn cục + responsive
│   │   └── print.css                    # Styles cho in ấn
│   ├── theme/
│   │   └── antdTheme.js                 # Ant Design theme (light + dark)
│   ├── utils/
│   │   ├── copy.js                      # Copy to clipboard
│   │   ├── dateHelpers.js               # Helper ngày tháng
│   │   ├── excelHelpers.js              # Xử lý import/export Excel
│   │   ├── fieldLabels.js               # Nhãn trường dữ liệu
│   │   ├── formatters.js                # Format số, tiền, ngày
│   │   ├── generateChungTu.js           # Sinh số chứng từ tự động
│   │   ├── historyDisplay.js            # Hiển thị lịch sử thay đổi
│   │   ├── historyTimeline.js           # Timeline lịch sử
│   │   ├── i18nOptions.js               # Tùy chọn i18n
│   │   ├── urgency.js                   # Tính toán mức độ ưu tiên
│   │   └── vietnameseText.js            # Xử lý text tiếng Việt
│   ├── App.jsx                          # Root component + routing
│   └── main.jsx                         # Entry point
│
├── tests/                               # Unit & component tests
│   ├── setup.js                         # Vitest setup (jsdom)
│   ├── fieldLabels.smoke.test.js
│   ├── generateChungTu.test.js
│   ├── i18n.test.js
│   ├── StatusTag.test.jsx
│   ├── urgency.test.js
│   └── vietnameseUi.test.js
│
├── public/                              # Static assets
├── scripts/                             # Utility scripts
├── docs/                                # Tài liệu
│
├── docker-compose.yml                   # Orchestration 4 services
├── api.Dockerfile                       # Backend container (Node.js Alpine)
├── web.Dockerfile                       # Frontend container (Nginx Alpine)
├── nginx.conf                           # Nginx config (reverse proxy + SPA)
├── vite.config.js                       # Vite config (dev server + proxy)
├── vitest.config.js                     # Vitest config (jsdom + setup)
├── package.json                         # Dependencies & scripts
├── .env                                 # Environment variables (gitignored)
├── .github/workflows/ci.yml            # GitHub Actions CI
├── cloudflare-ddns.sh                   # Cloudflare DDNS script
└── index.html                           # HTML entry point
```

---

## 4. Kỹ thuật & Pattern được áp dụng

### 4.1 Architecture Patterns

| Pattern | Triển khai | Vị trí trong code |
|---------|-----------|-------------------|
| **Layered Architecture** | Tách biệt Routes → Lib → Prisma → DB | `api/routes/` → `api/lib/` → `prisma/` |
| **Repository Pattern** | `db.js` đóng vai trò Data Access Layer, abstract hóa Prisma vs JSON | `api/lib/db.js` |
| **Service Layer (Frontend)** | `warrantyService.js` tập trung mọi API call | `src/services/warrantyService.js` |
| **Context Provider** | `AuthContext` cung cấp trạng thái auth toàn cục | `src/contexts/AuthContext.jsx` |
| **Custom Hooks** | `useWarranties`, `useDebounce`, `useIsMobile`, `useTheme` | `src/hooks/` |
| **Lazy Loading / Code Splitting** | `React.lazy()` cho mọi page component | `src/App.jsx` |
| **Error Boundary** | Component bắt lỗi React, hiển thị fallback UI | `src/components/common/ErrorBoundary.jsx` |

### 4.2 Authentication & Security

**JWT tự triển khai (custom, không dùng thư viện bên thứ ba):**
```javascript
// api/lib/auth.js — HMAC-SHA256 JWT
const signature = crypto.createHmac('sha256', getAuthSecret())
  .update(`${header}.${body}`).digest('base64url');
```

- **Cookie-based session**: httpOnly cookie `ntpc_session`, chống XSS.
- **Password hashing**: `scrypt` (Node.js built-in) với salt ngẫu nhiên 16 bytes.
- **Tự động rehash**: mật khẩu cũ (SHA256 hoặc plaintext legacy) tự động nâng cấp lên scrypt khi đăng nhập.
- **Rate limiting đăng nhập**: tối đa 8 lần thử trong 10 phút mỗi IP+tài khoản.
- **Timing-safe comparison**: `crypto.timingSafeEqual` chống timing attack.
- **RBAC**: 2 vai trò `admin` / `staff`, middleware `requireRole()` kiểm soát endpoint.
- **Helmet**: HTTP security headers (CSP, X-Frame-Options, X-Content-Type-Options).
- **CORS**: kiểm soát origin cho phép, hỗ trợ dải IP LAN (10.x, 172.16-31.x, 192.168.x).

### 4.3 Database & Persistence

**Chiến lược Dual-Write với Self-Healing:**

```
PostgreSQL (chính) ←→ db.json (dự phòng)
```

- **Primary**: PostgreSQL qua Prisma ORM, transaction an toàn.
- **Fallback**: `db.json` file-based, tự động kích hoạt khi PostgreSQL unreachable.
- **Self-Healing Sync** (`autoSelfHealingSync`): khi server khởi động, so sánh `max(updatedAt)` giữa hai nguồn → chọn nguồn mới nhất → đồng bộ ngược.
- **Debounce Write Queue**: ghi db.json dự phòng với độ trễ 2.5 giây, giảm I/O đĩa.
- **Graceful Shutdown**: `SIGINT`/`SIGTERM` flush buffer ghi đệm trước khi thoát.
- **Batch Insert**: warranties chia batch 100 bản ghi/truy vấn, tránh vượt giới hạn tham số PostgreSQL.

### 4.4 Backup & Restore

Hệ thống backup tự động nhiều tầng:
- **Hourly**: mỗi giờ (giữ 6 giờ gần nhất)
- **Daily**: mỗi ngày (giữ 1 năm)
- **Monthly**: ngày 1 hàng tháng (giữ 5 năm)
- **Manual**: backup thủ công từ UI admin
- **Restore-safety**: tự động backup trước mỗi lần restore

Đặc điểm kỹ thuật:
- SHA-256 checksum cho mỗi file backup (integrity verification).
- Asset bundle (`.tgz`) đóng gói ảnh uploads kèm backup data.
- Deduplication: nếu ảnh không thay đổi, dùng hardlink thay vì copy lại.
- Path traversal protection: mọi đường dẫn backup được validate trước khi truy cập.
- Pin/Unpin: giữ lại backup quan trọng, không bị cleanup tự động xóa.

### 4.5 State Management

- **Không dùng Redux/Zustand**: dự án giữ đơn giản với React Context + `useState` + custom hooks.
- **AuthContext**: trạng thái đăng nhập, phân quyền, được cung cấp ở root component.
- **useWarranties hook**: fetch + cache danh sách phiếu, expose `refetch()` để reload.
- **useTheme hook**: toggle dark/light theme, persist vào localStorage.

### 4.6 Validation

**Zod schema chia sẻ giữa Frontend và Backend:**
- Backend (`api/lib/validators.js`): validate request body trước khi ghi DB.
- Frontend (`src/lib/zodSchemas.js` + `@hookform/resolvers`): validate form realtime.
- Schema sử dụng `.superRefine()` cho logic validation phức tạp (ví dụ: phiếu biên nhận chỉ hỗ trợ "sửa dịch vụ" hoặc "khác").

### 4.7 Internationalization (i18n)

- **6 namespaces**: `ui`, `status`, `messages`, `validation`, `print`, `nav`.
- **Default namespace**: `ui` — tất cả key `t('xxx')` tìm trong `ui.json`.
- **Language detector**: `i18next-browser-languagedetector` tự detect ngôn ngữ browser.
- **Fallback**: luôn fallback về `vi` (tiếng Việt).

### 4.8 File Upload & Images

- Ảnh được upload dưới dạng **Base64 Data URL** từ frontend → backend decode → ghi file.
- Lưu trữ theo cấu trúc `uploads/warranties/YYYY/MM/{uuid}.{ext}`.
- Giới hạn: tối đa 10 ảnh/phiếu, 5MB/ảnh, chỉ chấp nhận JPEG/PNG/WebP.
- `publicVisible` flag: kiểm soát ảnh nào hiển thị cho khách hàng ở trang tra cứu.

### 4.9 Audit Trail

Mọi thay đổi dữ liệu quan trọng được ghi vào bảng `audit_logs`:
- Actor (ai), Action (hành động), Entity (đối tượng), Before/After (trạng thái trước/sau).
- IP address + User Agent của request.

---

## 5. Giao diện (UI/UX)

### Các trang/màn hình chính

| Route | Trang | Mô tả |
|-------|-------|-------|
| `/tra-cuu` | **Tra cứu bảo hành** | Trang công khai, nhập số chứng từ → hiển thị kết quả |
| `/tra-cuu/:soChungTu` | **Kết quả tra cứu** | Chi tiết phiếu + progress bar + ảnh đính kèm |
| `/admin/dashboard` | **Dashboard** | Tổng quan: thống kê phiếu, biểu đồ, phiếu ưu tiên |
| `/admin/phieu` | **Danh sách phiếu** | Bảng phiếu bảo hành với filter, search, sort, pagination |
| `/admin/phieu/:id/in` | **In phiếu** | Preview + in phiếu bảo hành (react-to-print) |
| `/admin/tao-phieu` | **Tạo phiếu mới** | Form tạo phiếu với validation realtime |
| `/admin/khach-hang` | **Quản lý khách hàng** | Danh sách khách hàng, lịch sử bảo hành |
| `/admin/nhan-vien` | **Quản lý nhân viên** | CRUD nhân viên, reset password (admin only) |
| `/admin/nha-cung-cap` | **Nhà cung cấp** | Quản lý NCC, theo dõi gửi/nhận bảo hành |
| `/admin/thong-ke` | **Thống kê** | Biểu đồ theo thời gian, top sản phẩm, top khách hàng |
| `/admin/import-export` | **Import/Export** | Nhập/xuất dữ liệu Excel (admin only) |

### Responsive Design

- **Desktop**: Sidebar + Header layout, bảng dữ liệu đầy đủ cột.
- **Mobile**: Sidebar chuyển thành `Popup` (antd-mobile) trượt từ trái, bảng responsive, dùng `MobileStatusTag` thay `StatusTag`.
- **Breakpoint detection**: custom hook `useIsMobile()` dựa trên `window.innerWidth`.

### Theme

- **Light/Dark mode**: toggle qua `useTheme()`, persist preference vào localStorage.
- Ant Design theme tokens tùy chỉnh: màu primary `#1677FF`, border radius 6px, font Segoe UI.
- Dark mode overrides: background `#141414`, text `#E6E6E6`, table header `#262626`.

### Accessibility

- Ant Design cung cấp sẵn ARIA attributes cho components.
- Keyboard shortcuts toàn cục: `Ctrl+K` tìm kiếm, `Ctrl+N` tạo phiếu mới, `?` hiển thị danh sách phím tắt.
- `ErrorBoundary` bắt lỗi React, hiển thị fallback thay vì crash trắng trang.

---

## 6. Phân tích Điểm mạnh & Điểm yếu

### Điểm mạnh

| # | Điểm mạnh | Dẫn chứng |
|---|-----------|------------|
| 1 | **Kiến trúc rõ ràng, tách biệt tốt** | Backend tách `routes/` (điều hướng) → `lib/` (logic) → `prisma/` (data). Frontend tách `pages/`, `components/`, `services/`, `hooks/`, `utils/`. |
| 2 | **Hệ thống backup tự phục hồi (Self-Healing)** | `autoSelfHealingSync()` trong `db.js` tự so sánh PostgreSQL vs db.json, đồng bộ ngược khi cần. Debounce write queue giảm I/O. |
| 3 | **Bảo mật nhiều lớp** | Custom JWT + scrypt hashing + rate limiting + timing-safe comparison + RBAC + Helmet headers + CORS origin validation. |
| 4 | **Fallback resilience** | Hệ thống tự chuyển sang db.json khi PostgreSQL gặp sự cố, không downtime. |
| 5 | **Lazy loading toàn diện** | Mọi page component đều dùng `React.lazy()`, giảm bundle size ban đầu. |
| 6 | **Validation thống nhất** | Zod schema dùng cả hai phía (frontend + backend), giảm code trùng lặp và đảm bảo一致性. |
| 7 | **i18n có tổ chức** | 6 namespace tách biệt theo chức năng, dễ mở rộng ngôn ngữ mới. |
| 8 | **Backup hệ thống chuyên nghiệp** | Multi-tier (hourly/daily/monthly), SHA-256 checksum, asset bundling, pin/unpin, retention policy. |
| 9 | **Docker production-ready** | Multi-stage build (frontend), healthcheck cho cả 3 services, volume persistence, isolated network. |
| 10 | **Audit trail** | Ghi log mọi thay đổi dữ liệu quan trọng với before/after snapshot. |

### Điểm yếu & Hạn chế

| # | Vấn đề | Chi tiết | Mức độ |
|---|--------|----------|--------|
| 1 | **writeDb() ghi đè toàn bộ bảng** | Mỗi lần `writeDb()` xóa hết rồi insert lại (`deleteMany` + `createMany`). Với dữ liệu lớn sẽ chậm và có race condition. | 🔴 Cao |
| 2 | **Thiếu test nghiêm trọng** | Chỉ 6 test files, chủ yếu smoke test. Không có integration test cho API, không có E2E test cho critical flows (đăng nhập, tạo phiếu, backup/restore). | 🔴 Cao |
| 3 | **JWT tự triển khai** | Không dùng thư viện chuẩn (jsonwebtoken), dễ introduce bug bảo mật. Không hỗ trợ refresh token, token revocation. | 🟡 Trung bình |
| 4 | **Session lưu trong memory** | `loginAttempts` Map mất khi server restart. Không scale được multi-instance. | 🟡 Trung bình |
| 5 | **Không có migration strategy** | Schema thay đổi phải dùng `prisma migrate` thủ công, không có versioned migration trong CI/CD. | 🟡 Trung bình |
| 6 | **CORS hardcode LAN IP** | Danh sách IP LAN hardcode trong `server.js` (`192.168.1.146`). Nên dùng env variable. | 🟢 Thấp |
| 7 | **API timeout 5 phút** | Axios timeout 300s (`src/lib/axios.js`) quá dài, có thể treo UI khi backend down. | 🟢 Thấp |
| 8 | **Không có rate limiting cho API** | Chỉ có rate limiting cho login, các endpoint khác (create warranty, upload ảnh) không giới hạn. | 🟡 Trung bình |
| 9 | **db.json fallback ghi plaintext mật khẩu hash** | Khi fallback sang db.json, mật khẩu hash (scrypt) nằm trong file JSON plaintext trên đĩa. | 🟢 Thấp |

### Đề xuất cải thiện

| # | Vấn đề | Đề xuất |
|---|--------|---------|
| 1 | writeDb() ghi đè | Chuyển sang Prisma upsert hoặc incremental update. Dùng `prisma.$transaction` với từng operation thay vì delete-all + insert-all. |
| 2 | Thiếu test | Viết integration test cho API routes (supertest), E2E test cho critical flows (Playwright). Đặt mục tiêu coverage >70%. |
| 3 | JWT tự triển khai | Thay bằng `jsonwebtoken` library chuẩn. Thêm refresh token rotation. |
| 4 | Session memory | Dùng Redis hoặc PostgreSQL session store cho production. |
| 5 | Migration | Thiết lập `prisma migrate deploy` trong CI/CD pipeline. Version control migration files. |
| 6 | CORS hardcode | Chuyển IP LAN sang env variable `CORS_ORIGIN`. |
| 7 | API timeout | Giảm timeout xuống 30s cho API thường, 120s cho upload/import. Hiển thị retry UI. |
| 8 | Rate limiting | Thêm `express-rate-limit` cho các endpoint ghi dữ liệu. |
| 9 | Audit frontend | Thêm optimistic UI + toast notification cho mọi operation thay vì silent success. |

---

## 7. Hướng dẫn cài đặt & chạy

### Yêu cầu hệ thống

| Yêu cầu | Tối thiểu | Khuyến nghị |
|---------|-----------|-------------|
| OS | Linux (Ubuntu 20.04+) | Ubuntu 22.04 LTS |
| Node.js | 18.x | 20.x LTS |
| Docker | 20.10+ | 24.x |
| Docker Compose | 2.x | 2.24+ |
| RAM | 2 GB | 4 GB+ |
| Disk | 5 GB | 20 GB+ (cho backups) |

### Cài đặt local (không Docker)

```bash
# 1. Clone repository
git clone <repository-url>
cd ntpc-warranty

# 2. Cài đặt dependencies
npm ci

# 3. Cấu hình Prisma
npx prisma generate
npx prisma validate

# 4. Tạo file .env (xem mẫu bên dưới)
cp .env.example .env
# Chỉnh sửa các biến môi trường

# 5. Chạy migration (nếu dùng PostgreSQL local)
npx prisma migrate dev

# 6. Chạy đồng thời cả API + Frontend dev server
npm run start
# Frontend: http://localhost:8888
# API: http://localhost:3004
```

### Cài đặt với Docker Compose

```bash
# 1. Clone repository
git clone <repository-url>
cd ntpc-warranty

# 2. Tạo file .env
cat > .env << 'EOF'
AUTH_SECRET=your-secret-key-at-least-32-characters-long
INITIAL_STAFF_PASSWORD=your-admin-password
SESSION_TTL_SECONDS=28800
COOKIE_SECURE=false
API_PORT=3003
CORS_ORIGIN=http://localhost:8888
POSTGRES_USER=ntpc_user
POSTGRES_PASSWORD=your-postgres-password
POSTGRES_DB=ntpc_warranty
DATABASE_URL=postgresql://ntpc_user:your-postgres-password@postgres-db:5432/ntpc_warranty?schema=public
EOF

# 3. Build và khởi chạy
docker compose up -d --build

# 4. Kiểm tra trạng thái
docker compose ps

# 5. Truy cập
# Frontend: http://localhost:8888
# API Health: http://localhost:8888/api/health
```

### Biến môi trường (.env)

| Variable | Mô tả | Mặc định | Bắt buộc |
|----------|-------|----------|-----------|
| `AUTH_SECRET` | Secret key ký JWT (≥32 ký tự production) | — | ✅ Production |
| `INITIAL_STAFF_PASSWORD` | Mật khẩu bootstrap cho admin | — | ✅ |
| `SESSION_TTL_SECONDS` | Thời hạn session (giây) | `28800` (8h) | ❌ |
| `COOKIE_SECURE` | Cookie secure flag | `true` (production) | ❌ |
| `API_PORT` | Port backend API | `3004` (local) / `3003` (Docker) | ❌ |
| `CORS_ORIGIN` | Danhảng origin cho phép CORS (phân tách dấu phẩy) | — | ❌ |
| `POSTGRES_USER` | Username PostgreSQL | — | ✅ Docker |
| `POSTGRES_PASSWORD` | Password PostgreSQL | — | ✅ Docker |
| `POSTGRES_DB` | Tên database | — | ✅ Docker |
| `DATABASE_URL` | Connection string PostgreSQL | — | ✅ |
| `TZ` | Múi giờ | `Asia/Ho_Chi_Minh` | ❌ |
| `HELMET_CSP` | Bật Content Security Policy | `false` | ❌ |

### Lệnh phát triển

```bash
# Chạy dev server (frontend + API đồng thời)
npm run start

# Chạy riêng frontend (Vite dev server)
npm run dev

# Chạy riêng API
npm run api

# Build sản phẩm
npm run build

# Preview build
npm run preview

# Chạy tests
npm run test

# Prisma commands
npx prisma studio          # Mở Prisma Studio (GUI quản lý DB)
npx prisma migrate dev     # Tạo migration mới
npx prisma generate        # Regenerate Prisma Client
npx prisma validate        # Kiểm tra schema
```

---

## 8. API & Tính năng chính

### Public API (không cần xác thực)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/health` | Health check (DB + filesystem) |
| `GET` | `/api/public/track/:soChungTu` | Tra cứu phiếu theo số chứng từ |
| `GET` | `/api/public/track?q=` | Tìm kiếm phiếu công khai |

### Auth API

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `POST` | `/api/auth/login` | Đăng nhập (maNV + matKhau) |
| `POST` | `/api/auth/logout` | Đăng xuất, xóa cookie |
| `GET` | `/api/auth/me` | Lấy thông tin nhân viên hiện tại |
| `POST` | `/api/auth/change-password` | Đổi mật khẩu |

### Warranty API (cần xác thực)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/warranties` | Danh sách phiếu (filter, sort, paginate) |
| `GET` | `/api/warranties/next-code` | Sinh số chứng từ tiếp theo |
| `GET` | `/api/warranties/:id` | Chi tiết phiếu |
| `POST` | `/api/warranties` | Tạo phiếu mới |
| `PUT` | `/api/warranties/:id` | Cập nhật phiếu |
| `DELETE` | `/api/warranties/:id` | Xóa phiếu (soft delete) |
| `PATCH` | `/api/warranties/:id/status` | Cập nhật trạng thái |
| `PATCH` | `/api/warranties/:id/priority` | Đặt ưu tiên |
| `PATCH` | `/api/warranties/:id/log` | Ghi log tiến trình |
| `PATCH` | `/api/warranties/:id/customer` | Chuyển khách hàng |
| `PATCH` | `/api/warranties/:id/tra-hang` | Trả hàng |
| `PATCH` | `/api/warranties/:id/exchange-return` | Đổi/trả hàng |
| `POST` | `/api/warranties/:id/attachments` | Upload ảnh đính kèm |
| `DELETE` | `/api/warranties/:id/attachments/:attachmentId` | Xóa ảnh |
| `DELETE` | `/api/warranties/:id/history/:index` | Xóa mục lịch sử |
| `POST` | `/api/warranties/:id/supplier-send` | Gửi nhà cung cấp |
| `POST` | `/api/warranties/:id/supplier-return` | Nhận lại từ NCC |
| `GET` | `/api/warranties/:id/supplier-logs` | Nhật ký gửi/nhận NCC |
| `PATCH` | `/api/warranties/:id/supplier-logs/:logId` | Sửa ghi chú NCC log |
| `DELETE` | `/api/warranties/:id/supplier-logs/:logId` | Xóa NCC log |
| `POST` | `/api/warranties/import` | Import từ Excel |
| `GET` | `/api/warranties/export` | Export ra Excel |
| `GET` | `/api/warranties/template` | Tải file mẫu import |

### Customer API

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/customers/list` | Danhảng khách hàng |
| `GET` | `/api/customers/unassigned` | Khách chưa phân loại |
| `GET` | `/api/customers/suggest?q=` | Gợi ý khách hàng |
| `GET` | `/api/customers/lookup?q=` | Tìm kiếm khách hàng |
| `PUT` | `/api/customers/update` | Cập nhật thông tin KH |
| `POST` | `/api/customers/delete` | Xóa khách hàng |

### Staff API

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/nhan-vien` | Danh sách nhân viên |
| `POST` | `/api/nhan-vien` | Tạo nhân viên mới |
| `PATCH` | `/api/nhan-vien/:maNV/password` | Reset mật khẩu |
| `DELETE` | `/api/nhan-vien/:maNV` | Xóa nhân viên |

### Supplier API

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/suppliers` | Danh sách nhà cung cấp |
| `POST` | `/api/suppliers` | Tạo NCC mới |
| `PUT` | `/api/suppliers/:id` | Cập nhật NCC |
| `PATCH` | `/api/suppliers/:id/status` | Bật/tắt NCC |
| `GET` | `/api/suppliers/:id/warranties` | Phiếu gửi NCC |

### Statistics API

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/stats/summary` | Tổng quan thống kê |
| `GET` | `/api/stats/by-date` | Thống kê theo ngày |
| `GET` | `/api/stats/top-products` | Top sản phẩm |
| `GET` | `/api/stats/top-customers` | Top khách hàng |

### Backup API (admin only)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/admin/backups` | Danh sách backup |
| `POST` | `/api/admin/backups` | Tạo backup thủ công |
| `GET` | `/api/admin/backups/status` | Trạng thái backup scheduler |
| `GET` | `/api/admin/backups/history` | Lịch sử thao tác backup |
| `GET` | `/api/admin/backups/view/:path` | Xem nội dung backup |
| `POST` | `/api/admin/backups/restore/:path` | Khôi phục từ backup |
| `POST` | `/api/admin/backups/upload-restore` | Upload + khôi phục |
| `DELETE` | `/api/admin/backups/:path` | Xóa backup |
| `PATCH` | `/api/admin/backups/:path/metadata` | Pin/ghi chú backup |

### Trạng thái phiếu bảo hành

```mermaid
stateDiagram-v2
    [*] --> cho_xu_ly : Tạo phiếu
    [*] --> dang_xu_ly : Tạo phiếu
    cho_xu_ly --> dang_xu_ly : Bắt đầu xử lý
    cho_xu_ly --> huy : Hủy
    dang_xu_ly --> da_tra : Đã trả khách
    dang_xu_ly --> huy : Hủy
    cho_lien_he --> da_tra : Đã trả khách
    cho_lien_he --> huy : Hủy
    da_tra --> [*]
    huy --> [*]
```

### Quy trình gửi/nhận Nhà Cung Cấp

```mermaid
sequenceDiagram
    participant NV as Nhân viên
    participant API as Backend
    participant NCC as Nhà cung cấp

    NV->>API: POST /supplier-send<br/>{supplierId, sentAt, expectedReturnAt}
    API->>API: Tạo SupplierLog (action=sent)
    API->>API: Cập nhật supplierStatus=sent
    API-->>NV: Success

    Note over NCC: NCC xử lý bảo hành...

    NV->>API: POST /supplier-return<br/>{returnedAt, note}
    API->>API: Tạo SupplierLog (action=returned)
    API->>API: Cập nhật supplierStatus=returned
    API-->>NV: Success
```

---

## License

Private — Không phân phối công khai.

---

> Tài liệu này được tạo dựa trên phân tích source code thực tế của dự án ntpc-warranty v3.0.0.

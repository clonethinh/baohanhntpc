# React i18next Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all user-facing Vietnamese strings in the React/Vite frontend into `react-i18next` resources, with Vietnamese as the only active language.

**Architecture:** Add a centralized `src/i18n/` resource layer with six namespaces and initialize it before `App` renders. Components use `useTranslation`; non-component modules import `i18n` directly for schemas/constants. Migrate in strict batches until Unicode grep returns no Vietnamese strings outside `src/i18n/`.

**Tech Stack:** React 18, Vite 5, Ant Design 5, antd-mobile, i18next, react-i18next, i18next-browser-languagedetector, Vitest.

---

## File Structure Map

Create:

- `src/i18n/index.js` — initializes i18next and imports all Vietnamese namespaces.
- `src/i18n/locales/vi/ui.json` — UI labels, buttons, placeholders, table headers, field labels.
- `src/i18n/locales/vi/status.json` — enum display labels and status-like maps.
- `src/i18n/locales/vi/messages.json` — toast, notification, confirm, alert, and interpolated runtime messages.
- `src/i18n/locales/vi/validation.json` — Zod, form, and import validation messages.
- `src/i18n/locales/vi/print.json` — warranty print page and printed document labels.
- `src/i18n/locales/vi/nav.json` — sidebar, header, page titles, breadcrumbs.
- `src/utils/i18nOptions.js` — helper factories for translated select options and status labels.
- `tests/i18n.test.js` — verifies i18n initialization, core keys, interpolation, and default language.

Modify:

- `package.json` and `package-lock.json` — add only `react-i18next`, `i18next`, `i18next-browser-languagedetector`.
- `src/main.jsx` — import i18n before `App`.
- `src/constants/statusConfig.js` — replace Vietnamese labels with i18n-backed labels while preserving enum keys and metadata.
- `src/constants/warrantyOptions.js` — replace hardcoded option labels with translated factories/constants.
- `src/lib/zodSchemas.js` — import i18n and use validation keys.
- `src/utils/copy.js`, `src/utils/excelHelpers.js`, `src/utils/vietnameseText.js` — move user-facing text into i18n or unicode escapes where text is non-UI mojibake data.
- `src/components/common/*.jsx` — migrate common modal/error/shortcut/assistant strings.
- `src/components/layout/*.jsx` — migrate nav, sidebar, header, search, notification strings.
- `src/pages/NotFound.jsx` — migrate not found UI.
- `src/components/warranty/StatusTag.jsx`, `WarrantyProgress.jsx`, `WarrantyPrint.jsx`, `WarrantyDetail.jsx` — migrate warranty status/progress/print/detail strings.
- `src/pages/customer/*.jsx` — migrate public customer tracking strings.
- `src/pages/admin/*.jsx` — migrate admin page strings, with `WarrantyDetail.jsx` last overall.
- `tests/vietnameseUi.test.js` — update tests to read expected Vietnamese through i18n where appropriate.

Verification commands:

```bash
npm test -- --run tests/i18n.test.js tests/vietnameseUi.test.js
npm run build
grep -rn --include="*.jsx" --include="*.js" -P "[\x{00C0}-\x{024F}\x{1E00}-\x{1EFF}]" src/ | grep -v "src/i18n/"
```

---

### Task 1: Install i18n Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install the approved packages**

Run:

```bash
npm install react-i18next i18next i18next-browser-languagedetector
```

Expected: command exits 0 and updates `package.json` plus `package-lock.json`.

- [ ] **Step 2: Verify dependency names**

Run:

```bash
node -e "const p=require('./package.json'); for (const n of ['react-i18next','i18next','i18next-browser-languagedetector']) { if (!p.dependencies[n]) { throw new Error(n + ' missing'); } console.log(n + '=' + p.dependencies[n]); }"
```

Expected: prints all three package names and versions, exits 0.

- [ ] **Step 3: Verify no extra i18n package was added**

Run:

```bash
node -e "const p=require('./package.json'); const allowed=new Set(['react-i18next','i18next','i18next-browser-languagedetector']); const extras=Object.keys(p.dependencies).filter(n => /i18n|intl|translate|locale/i.test(n) && !allowed.has(n)); if (extras.length) throw new Error('Unexpected i18n deps: ' + extras.join(', ')); console.log('i18n dependency set OK');"
```

Expected: `i18n dependency set OK`.

---

### Task 2: Add i18n Foundation and Tests

**Files:**
- Create: `src/i18n/index.js`
- Create: `src/i18n/locales/vi/ui.json`
- Create: `src/i18n/locales/vi/status.json`
- Create: `src/i18n/locales/vi/messages.json`
- Create: `src/i18n/locales/vi/validation.json`
- Create: `src/i18n/locales/vi/print.json`
- Create: `src/i18n/locales/vi/nav.json`
- Create: `tests/i18n.test.js`
- Modify: `src/main.jsx`

- [ ] **Step 1: Create initial resource files**

Create `src/i18n/locales/vi/ui.json`:

```json
{
  "app": {
    "name": "Bảo Hành Nguyễn Tân PC"
  },
  "button": {
    "luu": "Lưu",
    "huy": "Hủy",
    "dong": "Đóng",
    "xoa": "Xóa",
    "capNhat": "Cập nhật",
    "taoPhieuMoi": "Tạo phiếu mới"
  },
  "common": {
    "co": "Có",
    "khong": "Không",
    "tatCa": "Tất cả",
    "khac": "Khác",
    "dangTai": "Đang tải",
    "khongCoDuLieu": "Không có dữ liệu"
  },
  "table": {
    "stt": "STT",
    "khachHang": "Khách hàng",
    "tenHang": "Tên hàng",
    "soSeri": "Số seri",
    "trangThai": "Trạng thái",
    "hanhDong": "Hành động"
  },
  "field": {
    "khachHang": "Khách hàng",
    "soDienThoai": "Số điện thoại",
    "diaChi": "Địa chỉ",
    "tenHang": "Tên hàng",
    "soSeri": "Số seri",
    "cauHinh": "Cấu hình",
    "loiLucNhan": "Lỗi lúc nhận",
    "phuKien": "Phụ kiện",
    "chiPhi": "Chi phí",
    "baoHanh": "Bảo hành",
    "ghiChu": "Ghi chú",
    "ngayMua": "Ngày mua",
    "ngayHenTra": "Ngày hẹn trả",
    "nhanVien": "Nhân viên"
  }
}
```

Create `src/i18n/locales/vi/status.json`:

```json
{
  "trangThai": {
    "da_nhan": "Đã nhận",
    "dang_xu_ly": "Đang xử lý",
    "da_tra": "Đã xong",
    "huy": "Đã hủy",
    "cho_xu_ly": "Đã nhận",
    "cho_lien_he": "Đang xử lý"
  },
  "loaiXuLy": {
    "bao_hanh": "Bảo hành",
    "sua_dv": "Sửa dịch vụ",
    "doi_moi": "Đổi mới",
    "khac": "Khác"
  },
  "baoHanh": {
    "motThang": "1 tháng",
    "baThang": "3 tháng",
    "muoiHaiThang": "12 tháng",
    "haiMuoiBonThang": "24 tháng",
    "baMuoiSauThang": "36 tháng",
    "sauMuoiThang": "60 tháng",
    "khac": "Khác"
  }
}
```

Create `src/i18n/locales/vi/messages.json`:

```json
{
  "success": {
    "taoPhieu": "Tạo phiếu bảo hành thành công",
    "capNhat": "Cập nhật thành công",
    "xoa": "Xóa thành công",
    "traHang": "Đã trả hàng cho khách",
    "saoChep": "Đã sao chép"
  },
  "error": {
    "taiDuLieu": "Không thể tải dữ liệu. Vui lòng thử lại.",
    "luu": "Có lỗi khi lưu. Vui lòng thử lại.",
    "khongTimThay": "Không tìm thấy bản ghi",
    "saoChep": "Không thể sao chép"
  },
  "confirm": {
    "xoa": "Bạn có chắc muốn xóa mục này không?",
    "traHang": "Xác nhận trả hàng cho khách?",
    "huyPhieu": "Xác nhận hủy phiếu này?"
  },
  "phieu": {
    "taoThanhCong": "Phiếu {{so}} đã được tạo thành công"
  }
}
```

Create `src/i18n/locales/vi/validation.json`:

```json
{
  "batBuoc": "Trường này là bắt buộc",
  "khachHangBatBuoc": "Khách hàng không được để trống",
  "tenHangBatBuoc": "Tên hàng không được để trống",
  "soSeriBatBuoc": "Số seri không được để trống",
  "loiLucNhanBatBuoc": "Lỗi lúc nhận không được để trống",
  "baoHanhBatBuoc": "Thời hạn bảo hành không được để trống",
  "ngayHenTraBatBuoc": "Ngày hẹn trả không được để trống",
  "nhanVienBatBuoc": "Nhân viên không được để trống",
  "soDienThoaiSai": "Số điện thoại không hợp lệ",
  "soChungTuTonTai": "Số chứng từ đã tồn tại trong hệ thống",
  "ngayKhongHopLe": "Ngày không hợp lệ",
  "chiPhiPhaiLaSo": "Chi phí phải là số dương",
  "chiPhiKhongAm": "Chi phí phải >= 0",
  "emailSai": "Email không hợp lệ"
}
```

Create `src/i18n/locales/vi/print.json`:

```json
{
  "title": "Phiếu bảo hành",
  "template": {
    "khachHangKyTen": "Khách hàng ký tên",
    "nhanVienKyTen": "Nhân viên ký tên"
  }
}
```

Create `src/i18n/locales/vi/nav.json`:

```json
{
  "page": {
    "dashboard": "Tổng quan",
    "phieu": "Phiếu bảo hành",
    "taoPhieu": "Tạo phiếu",
    "khachHang": "Khách hàng",
    "nhanVien": "Nhân viên",
    "nhaCungCap": "Nhà cung cấp",
    "thongKe": "Thống kê",
    "importExport": "Import / Export",
    "traCuu": "Tra cứu bảo hành"
  },
  "menu": {
    "dashboard": "Tổng quan",
    "phieu": "Phiếu bảo hành",
    "taoPhieu": "Tạo phiếu",
    "khachHang": "Khách hàng",
    "nhanVien": "Nhân viên",
    "nhaCungCap": "Nhà cung cấp",
    "thongKe": "Thống kê",
    "importExport": "Import / Export"
  }
}
```

- [ ] **Step 2: Create `src/i18n/index.js`**

```js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import uiVi from './locales/vi/ui.json';
import statusVi from './locales/vi/status.json';
import messagesVi from './locales/vi/messages.json';
import validationVi from './locales/vi/validation.json';
import printVi from './locales/vi/print.json';
import navVi from './locales/vi/nav.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: 'vi',
    fallbackLng: 'vi',
    defaultNS: 'ui',
    ns: ['ui', 'status', 'messages', 'validation', 'print', 'nav'],
    resources: {
      vi: {
        ui: uiVi,
        status: statusVi,
        messages: messagesVi,
        validation: validationVi,
        print: printVi,
        nav: navVi,
      },
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
```

- [ ] **Step 3: Import i18n in `src/main.jsx`**

Change the imports to this order:

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n/index.js';
import App from './App';
import './styles/global.css';
```

Keep the render block unchanged.

- [ ] **Step 4: Add `tests/i18n.test.js`**

```js
import { describe, expect, it } from 'vitest';
import i18n from '../src/i18n/index';

describe('i18n setup', () => {
  it('uses Vietnamese as the default and fallback language', () => {
    expect(i18n.language).toBe('vi');
    expect(i18n.options.fallbackLng).toEqual(['vi']);
  });

  it('loads core namespaces', () => {
    expect(i18n.t('button.luu')).toBe('Lưu');
    expect(i18n.t('status:trangThai.dang_xu_ly')).toBe('Đang xử lý');
    expect(i18n.t('validation:khachHangBatBuoc')).toBe('Khách hàng không được để trống');
    expect(i18n.t('nav:page.dashboard')).toBe('Tổng quan');
  });

  it('supports interpolation', () => {
    expect(i18n.t('messages:phieu.taoThanhCong', { so: 'ABC123' })).toBe('Phiếu ABC123 đã được tạo thành công');
  });
});
```

- [ ] **Step 5: Run i18n test**

Run:

```bash
npm test -- --run tests/i18n.test.js
```

Expected: test file passes.

- [ ] **Step 6: Run build**

Run:

```bash
npm run build
```

Expected: build exits 0.

---

### Task 3: Migrate Constants, Validation Schemas, and Shared i18n Helpers

**Files:**
- Create: `src/utils/i18nOptions.js`
- Modify: `src/constants/statusConfig.js`
- Modify: `src/constants/warrantyOptions.js`
- Modify: `src/lib/zodSchemas.js`
- Modify: `tests/i18n.test.js`

- [ ] **Step 1: Create `src/utils/i18nOptions.js`**

```js
import i18n from '../i18n/index.js';

export function tStatus(key) {
  return i18n.t(`status:${key}`);
}

export function makeWarrantyOptions() {
  return {
    baoHanhOptions: [
      { label: i18n.t('status:baoHanh.motThang'), value: '1 tháng' },
      { label: i18n.t('status:baoHanh.baThang'), value: '3 tháng' },
      { label: i18n.t('status:baoHanh.muoiHaiThang'), value: '12 tháng' },
      { label: i18n.t('status:baoHanh.haiMuoiBonThang'), value: '24 tháng' },
      { label: i18n.t('status:baoHanh.baMuoiSauThang'), value: '36 tháng' },
      { label: i18n.t('status:baoHanh.sauMuoiThang'), value: '60 tháng' },
      { label: i18n.t('status:baoHanh.khac'), value: 'khac' },
    ],
    loaiXuLyOptions: ['bao_hanh', 'sua_dv', 'doi_moi', 'khac'].map((value) => ({
      label: i18n.t(`status:loaiXuLy.${value}`),
      value,
    })),
  };
}
```

- [ ] **Step 2: Update `src/constants/statusConfig.js`**

Replace labels with i18n-backed values:

```js
import { CheckCircleOutlined, CloseCircleOutlined, SyncOutlined } from '@ant-design/icons';
import i18n from '../i18n/index.js';

const label = (key) => i18n.t(`status:trangThai.${key}`);

export const STATUS = {
  da_nhan: {
    label: label('da_nhan'),
    color: 'blue',
    icon: CheckCircleOutlined,
    next: ['dang_xu_ly', 'huy'],
  },
  dang_xu_ly: {
    label: label('dang_xu_ly'),
    color: 'orange',
    icon: SyncOutlined,
    next: ['da_tra', 'huy'],
  },
  da_tra: {
    label: label('da_tra'),
    color: 'green',
    icon: CheckCircleOutlined,
    next: [],
  },
  huy: {
    label: label('huy'),
    color: 'red',
    icon: CloseCircleOutlined,
    next: [],
  },
};

export const STATUS_LABELS = {
  da_nhan: label('da_nhan'),
  dang_xu_ly: label('dang_xu_ly'),
  da_tra: label('da_tra'),
  huy: label('huy'),
  cho_xu_ly: label('cho_xu_ly'),
  cho_lien_he: label('cho_lien_he'),
};
```

- [ ] **Step 3: Update `src/constants/warrantyOptions.js`**

```js
import i18n from '../i18n/index.js';

export const BAO_HANH_OPTIONS = [
  { label: i18n.t('status:baoHanh.motThang'), value: '1 tháng' },
  { label: i18n.t('status:baoHanh.baThang'), value: '3 tháng' },
  { label: i18n.t('status:baoHanh.muoiHaiThang'), value: '12 tháng' },
  { label: i18n.t('status:baoHanh.haiMuoiBonThang'), value: '24 tháng' },
  { label: i18n.t('status:baoHanh.baMuoiSauThang'), value: '36 tháng' },
  { label: i18n.t('status:baoHanh.sauMuoiThang'), value: '60 tháng' },
  { label: i18n.t('status:baoHanh.khac'), value: 'khac' },
];

export const LOAI_XU_LY_OPTIONS = ['bao_hanh', 'sua_dv', 'doi_moi', 'khac'].map((value) => ({
  label: i18n.t(`status:loaiXuLy.${value}`),
  value,
}));

export const LOAI_XU_LY_LABELS = {
  bao_hanh: i18n.t('status:loaiXuLy.bao_hanh'),
  sua_dv: i18n.t('status:loaiXuLy.sua_dv'),
  doi_moi: i18n.t('status:loaiXuLy.doi_moi'),
  khac: i18n.t('status:loaiXuLy.khac'),
};
```

- [ ] **Step 4: Update `src/lib/zodSchemas.js`**

```js
import { z } from 'zod';
import i18n from '../i18n/index.js';

const t = (key) => i18n.t(key, { ns: 'validation' });

export const warrantyFormSchema = z.object({
  khachHang: z.string().min(1, t('khachHangBatBuoc')),
  soDienThoai: z.string().optional().default(''),
  diaChi: z.string().optional().default(''),
  loaiPhieu: z.enum(['nhan_bao_hanh', 'bien_nhan']).default('nhan_bao_hanh'),
  baoGiaSau: z.boolean().optional().default(false),
  tenHang: z.string().min(1, t('tenHangBatBuoc')),
  soSeri: z.string().min(1, t('soSeriBatBuoc')),
  cauHinh: z.string().optional().default(''),
  loiLucNhan: z.string().min(1, t('loiLucNhanBatBuoc')),
  phuKien: z.string().optional().default(''),
  chiPhi: z.coerce.number().min(0, t('chiPhiKhongAm')).default(0),
  baoHanh: z.string().min(1, t('baoHanhBatBuoc')),
  loaiXuLy: z.enum(['bao_hanh', 'sua_dv', 'doi_moi', 'khac']).default('bao_hanh'),
  ghiChu: z.string().optional().default(''),
  ngayMua: z.string().optional().default(''),
  ngayHenTra: z.string().min(1, t('ngayHenTraBatBuoc')),
  maNhanVien: z.string().min(1, t('nhanVienBatBuoc')),
});
```

- [ ] **Step 5: Extend `tests/i18n.test.js`**

Add this test inside the existing `describe` block:

```js
it('backs constants and validation messages with i18n', async () => {
  const { STATUS_LABELS } = await import('../src/constants/statusConfig');
  const { LOAI_XU_LY_LABELS } = await import('../src/constants/warrantyOptions');
  const { warrantyFormSchema } = await import('../src/lib/zodSchemas');

  expect(STATUS_LABELS.dang_xu_ly).toBe(i18n.t('status:trangThai.dang_xu_ly'));
  expect(LOAI_XU_LY_LABELS.bao_hanh).toBe(i18n.t('status:loaiXuLy.bao_hanh'));

  const parsed = warrantyFormSchema.safeParse({});
  expect(parsed.success).toBe(false);
  expect(parsed.error.issues.map((issue) => issue.message)).toContain(i18n.t('validation:khachHangBatBuoc'));
});
```

- [ ] **Step 6: Run tests and build**

Run:

```bash
npm test -- --run tests/i18n.test.js tests/vietnameseUi.test.js
npm run build
```

Expected: both commands exit 0.

---

### Task 4: Migrate Common and Layout Components

**Files:**
- Modify: `src/i18n/locales/vi/ui.json`
- Modify: `src/i18n/locales/vi/messages.json`
- Modify: `src/i18n/locales/vi/nav.json`
- Modify: `src/components/common/AdminPasswordModal.jsx`
- Modify: `src/components/common/ErrorBoundary.jsx`
- Modify: `src/components/common/StaffPickerModal.jsx`
- Modify: `src/components/common/ShortcutsModal.jsx`
- Modify: `src/components/common/AiAssistant.jsx`
- Modify: `src/components/layout/AppHeader.jsx`
- Modify: `src/components/layout/AppSider.jsx`
- Modify: `src/components/layout/CustomerLayout.jsx`
- Modify: `src/components/layout/GlobalSearch.jsx`
- Modify: `src/components/layout/NotificationBell.jsx`
- Modify: `src/pages/NotFound.jsx`

- [ ] **Step 1: Capture exact current strings**

Run:

```bash
grep -rn --include="*.jsx" --include="*.js" -P "[\x{00C0}-\x{024F}\x{1E00}-\x{1EFF}]" src/components/common src/components/layout src/pages/NotFound.jsx
```

Expected: list of current hardcoded strings in common/layout files.

- [ ] **Step 2: Add keys to resource JSON files**

Add keys for every string found in Step 1. Use these target groups:

```json
{
  "modal": {
    "adminPassword": {},
    "staffPicker": {},
    "shortcuts": {}
  },
  "search": {},
  "notification": {},
  "errorBoundary": {},
  "aiAssistant": {},
  "notFound": {}
}
```

Place generic UI text in `ui.json`, runtime messages in `messages.json`, and navigation/page labels in `nav.json`.

- [ ] **Step 3: Migrate each React component**

For each component in this task, add:

```jsx
import { useTranslation } from 'react-i18next';
```

Inside the component function add the needed hook, for example:

```jsx
const { t } = useTranslation(['ui', 'messages', 'nav']);
```

Replace JSX strings and message calls with `t(...)`. Example replacement patterns:

```jsx
<Button>{t('ui:button.dong')}</Button>
notification.error({ message: t('messages:error.taiDuLieu') });
<Menu.Item>{t('nav:menu.dashboard')}</Menu.Item>
```

- [ ] **Step 4: Run targeted grep for common/layout**

Run:

```bash
grep -rn --include="*.jsx" --include="*.js" -P "[\x{00C0}-\x{024F}\x{1E00}-\x{1EFF}]" src/components/common src/components/layout src/pages/NotFound.jsx | grep -v "src/i18n/"
```

Expected: no output. If output remains, move the remaining user-facing text into i18n or replace non-user-facing Vietnamese with unicode escapes.

- [ ] **Step 5: Run tests and build**

Run:

```bash
npm test -- --run tests/i18n.test.js tests/vietnameseUi.test.js
npm run build
```

Expected: both commands exit 0.

---

### Task 5: Migrate Warranty Support Components and Print Page

**Files:**
- Modify: `src/i18n/locales/vi/ui.json`
- Modify: `src/i18n/locales/vi/status.json`
- Modify: `src/i18n/locales/vi/messages.json`
- Modify: `src/i18n/locales/vi/print.json`
- Modify: `src/components/warranty/StatusTag.jsx`
- Modify: `src/components/warranty/WarrantyProgress.jsx`
- Modify: `src/components/warranty/WarrantyPrint.jsx`

- [ ] **Step 1: Capture exact current strings**

Run:

```bash
grep -rn --include="*.jsx" --include="*.js" -P "[\x{00C0}-\x{024F}\x{1E00}-\x{1EFF}]" src/components/warranty/StatusTag.jsx src/components/warranty/WarrantyProgress.jsx src/components/warranty/WarrantyPrint.jsx
```

Expected: list of strings to migrate.

- [ ] **Step 2: Add status/progress/print keys**

Add status-like values to `status.json`, general labels to `ui.json`, runtime messages to `messages.json`, and printable document text to `print.json`.

Minimum print structure:

```json
{
  "title": "Phiếu bảo hành",
  "company": {},
  "field": {},
  "section": {},
  "template": {
    "khachHangKyTen": "Khách hàng ký tên",
    "nhanVienKyTen": "Nhân viên ký tên"
  }
}
```

- [ ] **Step 3: Migrate `StatusTag.jsx` and `WarrantyProgress.jsx`**

Use:

```jsx
const { t } = useTranslation('status');
const label = t(`trangThai.${value}`);
```

Preserve existing colors, icons, and status keys.

- [ ] **Step 4: Migrate `WarrantyPrint.jsx`**

Use:

```jsx
const { t } = useTranslation(['print', 'ui', 'status']);
```

Replace printed labels with `t('print:...')` or `t('ui:field...')`. Do not change the data fields read from the warranty object.

- [ ] **Step 5: Run targeted grep**

Run:

```bash
grep -rn --include="*.jsx" --include="*.js" -P "[\x{00C0}-\x{024F}\x{1E00}-\x{1EFF}]" src/components/warranty/StatusTag.jsx src/components/warranty/WarrantyProgress.jsx src/components/warranty/WarrantyPrint.jsx | grep -v "src/i18n/"
```

Expected: no output.

- [ ] **Step 6: Run build**

Run:

```bash
npm run build
```

Expected: build exits 0.

---

### Task 6: Migrate Customer Pages

**Files:**
- Modify: `src/i18n/locales/vi/ui.json`
- Modify: `src/i18n/locales/vi/status.json`
- Modify: `src/i18n/locales/vi/messages.json`
- Modify: `src/i18n/locales/vi/nav.json`
- Modify: `src/pages/customer/CustomerPortal.jsx`
- Modify: `src/pages/customer/TrackingResult.jsx`
- Modify: `src/pages/customer/Tracuu.jsx`

- [ ] **Step 1: Capture exact current strings**

Run:

```bash
grep -rn --include="*.jsx" --include="*.js" -P "[\x{00C0}-\x{024F}\x{1E00}-\x{1EFF}]" src/pages/customer
```

Expected: list of customer page strings.

- [ ] **Step 2: Add customer page keys**

Place page title and route-like labels in `nav.json`, field/button/empty-state text in `ui.json`, status labels in `status.json`, and fetch/error text in `messages.json`.

Recommended key groups:

```json
{
  "customerPortal": {},
  "tracking": {},
  "lookup": {}
}
```

- [ ] **Step 3: Migrate components**

For each customer page, add:

```jsx
import { useTranslation } from 'react-i18next';
```

Inside the component:

```jsx
const { t } = useTranslation(['ui', 'messages', 'status', 'nav']);
```

Use interpolation for dynamic messages:

```jsx
t('messages:tracking.maPhieu', { so: soChungTu })
```

- [ ] **Step 4: Run targeted grep**

Run:

```bash
grep -rn --include="*.jsx" --include="*.js" -P "[\x{00C0}-\x{024F}\x{1E00}-\x{1EFF}]" src/pages/customer | grep -v "src/i18n/"
```

Expected: no output.

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: build exits 0.

---

### Task 7: Migrate Admin Pages Except WarrantyDetail

**Files:**
- Modify: `src/i18n/locales/vi/ui.json`
- Modify: `src/i18n/locales/vi/status.json`
- Modify: `src/i18n/locales/vi/messages.json`
- Modify: `src/i18n/locales/vi/validation.json`
- Modify: `src/i18n/locales/vi/nav.json`
- Modify: `src/pages/admin/Dashboard.jsx`
- Modify: `src/pages/admin/WarrantyList.jsx`
- Modify: `src/pages/admin/CreateWarranty.jsx`
- Modify: `src/pages/admin/CustomerInfo.jsx`
- Modify: `src/pages/admin/Statistics.jsx`
- Modify: `src/pages/admin/ImportExport.jsx`
- Modify: `src/pages/admin/StaffManagement.jsx`
- Modify: `src/pages/admin/Suppliers.jsx`

- [ ] **Step 1: Capture exact current strings**

Run:

```bash
grep -rn --include="*.jsx" --include="*.js" -P "[\x{00C0}-\x{024F}\x{1E00}-\x{1EFF}]" src/pages/admin
```

Expected: list of admin page strings.

- [ ] **Step 2: Add admin page keys**

Use these key groups:

```json
{
  "dashboard": {},
  "warrantyList": {},
  "createWarranty": {},
  "customerInfo": {},
  "statistics": {},
  "importExport": {},
  "staffManagement": {},
  "suppliers": {}
}
```

Place keys in the namespace matching the string purpose. Do not put every admin page string into `ui.json`; put toasts/confirms in `messages.json`, validation text in `validation.json`, page titles in `nav.json`, status-like labels in `status.json`.

- [ ] **Step 3: Migrate each admin page**

For each page, add:

```jsx
import { useTranslation } from 'react-i18next';
```

Inside the component:

```jsx
const { t } = useTranslation(['ui', 'messages', 'status', 'validation', 'nav']);
```

Replace table titles:

```jsx
{ title: t('ui:table.khachHang'), dataIndex: 'khachHang' }
```

Replace toasts:

```jsx
message.success(t('messages:success.capNhat'));
notification.error({ message: t('messages:error.taiDuLieu') });
```

Replace dynamic strings:

```jsx
t('messages:phieu.taoThanhCong', { so: soChungTu })
```

- [ ] **Step 4: Run targeted grep**

Run:

```bash
grep -rn --include="*.jsx" --include="*.js" -P "[\x{00C0}-\x{024F}\x{1E00}-\x{1EFF}]" src/pages/admin | grep -v "src/i18n/"
```

Expected: no output from admin pages after this task. If `src/pages/admin/Dashboard.jsx` still imports or delegates to `WarrantyDetail`, ignore `WarrantyDetail.jsx` because it is handled in Task 8 only if the grep path points there separately.

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: build exits 0.

---

### Task 8: Migrate `WarrantyDetail.jsx` Last

**Files:**
- Modify: `src/i18n/locales/vi/ui.json`
- Modify: `src/i18n/locales/vi/status.json`
- Modify: `src/i18n/locales/vi/messages.json`
- Modify: `src/i18n/locales/vi/validation.json`
- Modify: `src/components/warranty/WarrantyDetail.jsx`
- Modify: `tests/vietnameseUi.test.js`

- [ ] **Step 1: Capture exact current strings**

Run:

```bash
grep -n -P "[\x{00C0}-\x{024F}\x{1E00}-\x{1EFF}]" src/components/warranty/WarrantyDetail.jsx
```

Expected: list of all remaining Vietnamese strings in the largest component.

- [ ] **Step 2: Add detail keys**

Use these key groups:

```json
{
  "warrantyDetail": {
    "section": {},
    "action": {},
    "history": {},
    "modal": {},
    "mobile": {}
  }
}
```

Put runtime success/error text in `messages.json`, validation/form messages in `validation.json`, status labels in `status.json`, and labels/buttons in `ui.json`.

- [ ] **Step 3: Migrate component hook**

At top:

```jsx
import { useTranslation } from 'react-i18next';
```

Inside `WarrantyDetail` component:

```jsx
const { t } = useTranslation(['ui', 'messages', 'status', 'validation']);
```

For helper functions outside the component that need translations, either pass `t` as an argument or import `i18n` directly if the function is pure and not hook-aware.

- [ ] **Step 4: Migrate history action labels**

Replace hardcoded action labels with i18n keys. Example:

```jsx
function mapHistoryAction(action, t) {
  const key = `ui:warrantyDetail.history.action.${action}`;
  const translated = t(key);
  return translated === key ? action : translated;
}
```

Add matching keys for known actions: `create`, `update`, `status`, `tra_hang`, `exchange`, `return`, `priority`, `supplier_sent`, `supplier_returned`, `log`, `delete`.

- [ ] **Step 5: Preserve mojibake normalization without literal Vietnamese outside i18n**

If `normalizeHistoryText` currently returns Vietnamese literals, move replacement targets into `src/i18n/locales/vi/messages.json` or use `i18n.t('messages:history.importExcel')`. Keep broken input patterns as unicode escapes when they contain Vietnamese characters so final grep stays clean.

- [ ] **Step 6: Update `tests/vietnameseUi.test.js`**

Where the test expects Vietnamese output from `normalizeHistoryText`, import i18n and use i18n expectations:

```js
import i18n from '../src/i18n/index';

expect(normalizeHistoryText('Import t? Excel')).toBe(i18n.t('messages:history.importExcel'));
```

- [ ] **Step 7: Run targeted grep**

Run:

```bash
grep -n -P "[\x{00C0}-\x{024F}\x{1E00}-\x{1EFF}]" src/components/warranty/WarrantyDetail.jsx
```

Expected: no output.

- [ ] **Step 8: Run tests and build**

Run:

```bash
npm test -- --run tests/i18n.test.js tests/vietnameseUi.test.js
npm run build
```

Expected: both commands exit 0.

---

### Task 9: Strict Cleanup Across `src/`

**Files:**
- Modify any remaining file reported by grep outside `src/i18n/`.

- [ ] **Step 1: Run full strict grep**

Run:

```bash
grep -rn --include="*.jsx" --include="*.js" -P "[\x{00C0}-\x{024F}\x{1E00}-\x{1EFF}]" src/ | grep -v "src/i18n/"
```

Expected: no output.

- [ ] **Step 2: Classify any remaining output**

For each remaining line:

- If user-facing text: add an i18n key and replace with `t(...)` or `i18n.t(...)`.
- If enum/API/db value: keep the value unchanged if it is ASCII; if it contains Vietnamese, preserve behavior using unicode escapes.
- If mojibake test fixture or pattern: use unicode escapes so the final grep is clean.

- [ ] **Step 3: Re-run full strict grep**

Run:

```bash
grep -rn --include="*.jsx" --include="*.js" -P "[\x{00C0}-\x{024F}\x{1E00}-\x{1EFF}]" src/ | grep -v "src/i18n/"
```

Expected: no output.

- [ ] **Step 4: Run final automated verification**

Run:

```bash
npm test -- --run tests/i18n.test.js tests/vietnameseUi.test.js
npm run build
```

Expected: both commands exit 0.

---

### Task 10: Manual Browser Verification

**Files:**
- No required code changes unless manual verification finds a bug.

- [ ] **Step 1: Start app**

Run:

```bash
npm run start
```

Expected: API and Vite dev server start. If API port 3003 is already in use, confirm the existing API is serving the same project before continuing.

- [ ] **Step 2: Open app**

Open the Vite URL printed by the terminal, typically:

```text
http://localhost:5175
```

Expected: app loads without blank screen.

- [ ] **Step 3: Check core UI flows**

Verify:

- Sidebar and header labels show Vietnamese.
- Customer lookup page shows Vietnamese.
- Admin dashboard table labels show Vietnamese.
- Create warranty form labels and validation messages show Vietnamese.
- Warranty detail drawer/modal labels, history, action buttons, and toasts show Vietnamese.
- Print page labels show Vietnamese.

- [ ] **Step 4: Check console**

Open DevTools Console.

Expected: no missing translation key errors and no runtime exceptions.

- [ ] **Step 5: Stop dev server**

Stop the process started in Step 1.

---

## Final Report Requirements

When implementation finishes, report:

- Number of i18n resource keys created, counted with a JSON key-count script.
- Number of files changed.
- Namespace with the most keys.
- Verification commands and exact pass/fail results.
- Any remaining hardcoded strings, if strict grep could not reach 0, with explanation.

Use this script for the key count:

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const dir = path.join('src', 'i18n', 'locales', 'vi');
function countLeafKeys(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.values(value).reduce((sum, child) => sum + countLeafKeys(child), 0);
  }
  return 1;
}
const rows = fs.readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => {
  const data = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
  return [name, countLeafKeys(data)];
});
for (const [name, count] of rows) console.log(`${name}: ${count}`);
console.log(`total: ${rows.reduce((sum, [, count]) => sum + count, 0)}`);
NODE
```

## Self-Review

- Spec coverage: This plan covers dependency installation, exact i18n structure, namespace rules, strict migration, no backend/db changes, build verification, strict grep verification, and manual browser verification.
- Placeholder scan: No `TBD`, `TODO`, or unspecified implementation placeholders remain; tasks that require exact current string extraction include exact grep commands and classification rules.
- Type consistency: `i18n`, `t`, namespace names, enum keys, and file paths are consistent across tasks.

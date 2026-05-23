# React i18next Rollout Design

## Goal

Move all user-facing Vietnamese strings in the React/Vite frontend into `react-i18next` resources so the app can support additional languages later. Vietnamese (`vi`) is the only active language for this rollout.

## Scope

In scope:

- Install `react-i18next`, `i18next`, and `i18next-browser-languagedetector`.
- Add `src/i18n/index.js` and Vietnamese resource files under `src/i18n/locales/vi/`.
- Import i18n before rendering `App` in `src/main.jsx`.
- Migrate hardcoded Vietnamese strings in `src/` into i18n namespaces.
- Keep Ant Design and antd-mobile Vietnamese locale providers in `App.jsx`.
- Verify the final grep for Vietnamese source strings outside `src/i18n/` returns no matches.

Out of scope:

- Backend changes under `api/`.
- Changes to `db.json`, API response field names, route names, or persisted enum keys.
- Adding languages other than Vietnamese.
- Installing packages beyond the three i18n dependencies.

## i18n Architecture

Create this structure:

```text
src/i18n/
  index.js
  locales/vi/
    ui.json
    status.json
    messages.json
    validation.json
    print.json
    nav.json
```

`src/i18n/index.js` initializes i18next with:

- `lng: 'vi'`
- `fallbackLng: 'vi'`
- `defaultNS: 'ui'`
- namespaces: `ui`, `status`, `messages`, `validation`, `print`, `nav`
- resources imported from the JSON files above
- `escapeValue: false`

`src/main.jsx` imports `./i18n/index.js` before importing/rendering `App`.

## Namespace Rules

- `ui.json`: generic UI labels, buttons, placeholders, table headers, field labels, empty states, tooltips.
- `status.json`: display labels for enums/maps, including warranty status, processing type, ticket type, urgency, supplier status.
- `messages.json`: toast text, notification text, confirm dialog text, alert text, API fallback errors, interpolated success messages.
- `validation.json`: Zod, react-hook-form, import preview validation messages.
- `print.json`: warranty print page, printable labels, print-only template text.
- `nav.json`: sidebar menu labels, route/page titles, breadcrumbs, header navigation text.

Key style:

- Use camelCase for object groups and normal keys, for example `button.taoPhieuMoi`.
- Keep enum values as snake_case under their enum group, for example `trangThai.dang_xu_ly`.
- Use interpolation for dynamic text, for example `phieu.taoThanhCong` = `Phiếu {{so}} đã được tạo thành công`.
- For strict grep cleanup, move one-off Vietnamese strings into i18n rather than leaving `TODO: i18n` comments.

## Migration Strategy

Use strict migration in controlled batches.

1. Foundation
   - Install the three i18n packages.
   - Create i18n files and initial resources.
   - Import i18n in `main.jsx`.

2. Constants, schemas, and utilities
   - Move labels from `statusConfig`, `warrantyOptions`, validators, and utility messages into i18n.
   - For non-component modules, import `i18n` directly and call `i18n.t(...)`.

3. Common and layout components
   - Migrate `src/components/common/`, `src/components/layout/`, and `src/pages/NotFound.jsx`.
   - Use `useTranslation()` in React components.

4. Warranty, customer, and admin pages
   - Migrate from lower-risk files to higher-risk files.
   - Use `useTranslation(['ui', 'messages', 'status', ...])` when a component needs multiple namespaces.
   - Table columns use translated titles.
   - Toasts and dynamic text use interpolation.
   - Migrate `WarrantyDetail.jsx` last because it has the most logic and history rendering.

5. Strict cleanup
   - Run the Unicode grep against `src/` excluding `src/i18n/`.
   - For remaining strings that are intentionally not user-facing but contain Vietnamese characters, use unicode escapes or move the text into i18n if it affects UI.
   - Do not change backend behavior or persisted data shape.

## Component Patterns

React components:

```jsx
const { t } = useTranslation(['ui', 'messages', 'status']);

<Button>{t('ui:button.taoPhieuMoi')}</Button>
message.success(t('messages:success.taoPhieu'));
const label = t(`status:trangThai.${record.trangThai}`);
```

Non-component modules:

```js
import i18n from '../i18n/index.js';

const message = i18n.t('validation:batBuoc');
```

Dynamic text:

```js
t('messages:phieu.taoThanhCong', { so: soChungTu });
```

## Verification

Run after migration:

```bash
npm run build
grep -rn --include="*.jsx" --include="*.js" -P "[\x{00C0}-\x{024F}\x{1E00}-\x{1EFF}]" src/ | grep -v "src/i18n/"
```

Expected:

- Build exits 0.
- Final grep returns no rows.

Manual browser verification:

- Sidebar, header, route titles, forms, tables, modals, customer tracking, warranty detail, and print page show correct Vietnamese.
- Create warranty flow shows correct toast and validation messages.
- Invalid form input shows translated validation messages.
- DevTools console has no missing translation key errors.

## Risks and Controls

- Large string footprint: migrate in batches and build after each batch.
- Complex components: migrate `WarrantyDetail.jsx` last.
- Non-component modules cannot use hooks: import `i18n` directly.
- Enum keys must remain stable: translate display labels only, never API/db keys.
- Grep strictness may flag non-UI Vietnamese text: resolve deliberately without changing runtime behavior.

# Đánh giá chi tiết dự án NTPC Warranty

> Thời điểm đánh giá: 23/05/2026  
> Phạm vi: frontend React/Vite, backend Express, dữ liệu JSON, UI admin/customer/public, nghiệp vụ bảo hành.

## 1. Tổng quan dự án

NTPC Warranty là hệ thống quản lý bảo hành nội bộ có đầy đủ luồng nghiệp vụ chính:

- tạo phiếu bảo hành
- quản lý danh sách phiếu
- theo dõi trạng thái xử lý
- cập nhật tiến trình/lịch sử
- gửi/nhận nhà cung cấp
- đổi hàng/trả hàng
- quản lý khách hàng
- quản lý nhà cung cấp
- quản lý nhân viên
- thống kê dashboard
- import/export Excel
- in phiếu
- tra cứu công khai cho khách hàng
- upload ảnh đính kèm
- tìm kiếm toàn cục
- giao diện desktop và mobile

Dự án không còn ở mức prototype CRUD đơn giản. Nó đã có nhiều chức năng thực tế phục vụ vận hành bảo hành hằng ngày.

## 2. Công nghệ sử dụng

### Frontend

- React 18
- Vite 5
- Ant Design 5
- Ant Design Mobile 5
- React Router
- React Hook Form
- Axios
- Dayjs
- Zod
- i18next
- QRCode React
- XLSX
- Vitest

### Backend

- Node.js
- Express
- File JSON storage qua `api/db.json`
- Middleware CORS, Morgan, Body Parser
- Upload file/ảnh lưu trong `api/uploads`
- API route tách theo nhóm nghiệp vụ

### Build/Test

Script chính:

```bash
npm run dev
npm run api
npm run start
npm run build
npm test
```

Build production hiện tại chạy được:

```txt
npm run build
✓ built
```

## 3. Cấu trúc dự án

### Frontend chính

```txt
src/
├── components/
│   ├── admin/
│   ├── common/
│   ├── layout/
│   └── warranty/
├── constants/
├── contexts/
├── hooks/
├── i18n/
├── pages/
│   ├── admin/
│   └── customer/
├── services/
├── styles/
├── utils/
└── validation/
```

### Backend chính

```txt
api/
├── lib/
│   └── db.js
├── routes/
│   ├── adminSecurity.js
│   ├── backups.js
│   ├── customers.js
│   ├── nhanVien.js
│   ├── public.js
│   ├── stats.js
│   ├── suppliers.js
│   └── warranties.js
├── uploads/
├── db.json
└── server.js
```

## 4. Đánh giá chức năng hiện có

### 4.1. Quản lý phiếu bảo hành

Đã có:

- tạo phiếu mới
- sửa thông tin phiếu
- xóa/ẩn phiếu
- cập nhật trạng thái
- đánh dấu ưu tiên
- ngày nhận, ngày hẹn trả, ngày trả
- loại xử lý
- phụ kiện, cấu hình, lỗi lúc nhận
- ảnh đính kèm
- lịch sử thay đổi
- tìm kiếm/lọc/sắp xếp
- giao diện desktop và mobile

Trạng thái chính hiện được chuẩn hóa:

```txt
Đã nhận      = blue / primary
Đang xử lý   = orange / warning
Đã xong      = green / success
Đã hủy       = red / danger
```

Đánh giá: tốt. Luồng nghiệp vụ đủ dùng thực tế.

### 4.2. Drawer chi tiết phiếu

Drawer `WarrantyDetail` là màn nghiệp vụ nặng nhất.

Có:

- xem thông tin phiếu
- sửa nhanh từng nhóm thông tin
- cập nhật trạng thái
- thêm ghi chú tiến trình
- xem timeline lịch sử
- thêm/xóa ảnh
- đổi/trả hàng
- gửi nhà cung cấp
- quản lý lịch sử NCC
- in phiếu
- giao diện mobile riêng

Đã cải thiện:

- đóng drawer không còn tự refresh danh sách nếu không có thay đổi
- chỉ refresh khi có thao tác sửa dữ liệu thật
- timeline đã dùng helper chung nội bộ

Đánh giá: chức năng mạnh, nhưng file còn quá lớn và nên tách nhỏ.

### 4.3. Dashboard admin

Có:

- thống kê tổng quan
- phiếu cần chú ý
- phiếu quá hạn/gần hạn/ưu tiên
- tiến trình & lịch sử mới nhất
- mở nhanh chi tiết phiếu

Đã cải thiện:

- `Tiến trình & Lịch sử mới nhất` dùng `buildInternalHistoryTimeline`
- không còn hiển thị raw `supplierLogs`
- đồng bộ logic lọc/format với drawer

Đánh giá: hữu ích, nhưng nên bổ sung thêm biểu đồ theo nhân viên/NCC nếu cần quản trị sâu hơn.

### 4.4. Tra cứu công khai `/tracuu`

Có:

- tra cứu bằng mã phiếu/số điện thoại
- hiển thị trạng thái
- hiển thị tiến trình xử lý
- hiển thị thông tin phiếu đã public hóa
- hiển thị ảnh public nếu được phép
- rate limit cơ bản theo IP

Đã cải thiện:

- `statusLog` public dùng `buildPublicHistoryTimeline`
- public ẩn dữ liệu nhạy cảm như `chiPhi`, `uuTien`, `maNhanVien`, `supplierLogs`, chuyển khách hàng

Đánh giá: tốt cho khách hàng. Cần tiếp tục kiểm soát trường public nếu mở rộng dữ liệu.

### 4.5. Khách hàng/Nhà cung cấp/Nhân viên

Có:

- quản lý khách hàng
- gợi ý/chọn khách hàng
- chuyển phiếu sang khách hàng khác
- quản lý nhà cung cấp
- gửi/nhận NCC
- quản lý nhân viên
- gán nhân viên vào thao tác/lịch sử

Đánh giá: đủ nền cho vận hành nội bộ nhỏ/vừa.

### 4.6. Import/Export/Backup

Có:

- import Excel
- export dữ liệu
- validate dòng import
- tag hợp lệ/lỗi
- backup/restore dữ liệu
- lịch sử backup/restore

Đánh giá: điểm mạnh thực dụng. Tuy nhiên restore dữ liệu nên có cơ chế xác nhận và kiểm tra integrity rõ hơn nếu chạy production.

## 5. Đánh giá UX/UI

### Điểm tốt

- Có desktop và mobile layout.
- Ant Design giúp UI nhất quán.
- Badge màu trạng thái đã được chuẩn hóa qua `badgeConfig.js`.
- `/admin/phieu` đã sửa lỗi scroll FullHD.
- Drawer không reload vô ích khi chỉ đóng.
- Public tracking có giao diện dễ hiểu.

### Điểm cần cải thiện

- `WarrantyDetail.jsx` quá dài, khó đọc.
- Một số component còn chứa logic nghiệp vụ trực tiếp.
- Mobile/desktop đôi lúc vẫn tách logic render nhiều, dễ lệch về sau.
- Nên gom các formatter UI như timeline, badge, status, field label về helper chung nhiều hơn.

## 6. Đánh giá dữ liệu

### Hiện trạng

Dữ liệu chính lưu tại:

```txt
api/db.json
```

Ảnh upload lưu tại:

```txt
api/uploads
```

`api/lib/db.js` xử lý đọc/ghi file JSON.

### Ưu điểm

- Dễ triển khai.
- Không cần cài database.
- Phù hợp app nội bộ nhỏ, single-instance.
- Backup file đơn giản.

### Hạn chế

- Không có transaction thật.
- Rủi ro khi nhiều người ghi cùng lúc.
- File lớn sẽ chậm.
- Khó query phức tạp.
- Khó audit/rollback chuẩn.
- Không phù hợp multi-instance.

Đánh giá: chấp nhận được cho nội bộ nhỏ. Nếu dùng lâu dài, nên chuyển sang SQLite/PostgreSQL.

## 7. Đánh giá backend

### Điểm tốt

- API route chia theo nhóm nghiệp vụ.
- Có validation bằng Zod.
- Có lịch sử thay đổi trong phiếu.
- Có public API tách riêng.
- Có rate limit public.
- Có backup API.

### Điểm yếu

- `api/routes/warranties.js` quá lớn, nhiều trách nhiệm.
- Business logic nằm nhiều trong route handler.
- Chưa có service layer rõ.
- Chưa có repository/data access layer thật.
- Chưa có auth/session/token đúng chuẩn.
- Rate limit đang in-memory.
- Một số lỗi tiếng Việt/encoding từng xuất hiện trong lịch sử hoặc README cũ.

### Nên tách sau

```txt
api/services/warrantyService.js
api/services/historyService.js
api/services/attachmentService.js
api/services/supplierWorkflowService.js
api/services/importExportService.js
api/repositories/warrantyRepository.js
```

## 8. Đánh giá bảo mật

### Hiện có

- Có route admin security.
- Có unlock admin bằng mật khẩu.
- Có public rate limit.
- Có giới hạn public tracking.

### Rủi ro

- Chưa có auth token/session thật.
- Mật khẩu/admin unlock còn thiên về nội bộ, chưa đủ production.
- Phân quyền nhân viên còn nhẹ.
- Upload ảnh cần kiểm tra kỹ MIME/size/path traversal.
- Public API cần whitelist field nghiêm ngặt.
- File JSON chứa dữ liệu thật, cần bảo vệ quyền truy cập filesystem.

Đánh giá: đủ cho mạng nội bộ tin cậy. Chưa đủ cho public internet nếu không có lớp bảo vệ thêm.

## 9. Đánh giá timeline/lịch sử

Đã thêm helper chung:

```txt
src/utils/historyTimeline.js
```

Có:

```js
buildInternalHistoryTimeline()
buildPublicHistoryTimeline()
formatHistoryChanges()
```

### Nội bộ thấy

```txt
create
status
tra_hang
exchange
return
priority
supplier_sent
supplier_returned
customer_transfer
customer_detached
update
log
```

### Public thấy

```txt
create
status
tra_hang
exchange
return
supplier_sent
supplier_returned
update an toàn
log
```

### Public ẩn

```txt
delete
priority
customer_transfer
customer_detached
supplier_log_deleted
supplierLogs raw update
chiPhi
uuTien
maNhanVien
```

Đánh giá: hướng này đúng. Timeline đã bớt lệch giữa dashboard, drawer và public.

## 10. Đánh giá badge/trạng thái

Đã thêm:

```txt
src/constants/badgeConfig.js
src/components/warranty/MobileStatusTag.jsx
```

Quy ước màu:

```txt
info      = blue / primary
warning   = orange / warning
success   = green / success
danger    = red / danger
neutral   = default / default
```

Đánh giá: tốt. Nên tiếp tục cấm hardcode màu trạng thái trong page mới.

## 11. Kiểm thử

Hiện có Vitest.

Điểm tốt:

- Có test cho một số logic lõi.
- Có thể chạy build production thành công.

Điểm yếu:

- Coverage còn thấp.
- Thiếu test API chính.
- Thiếu test import/export.
- Thiếu test public tracking.
- Thiếu test timeline helper mới.
- Một số test cũ từng fail do dữ liệu kỳ vọng không khớp hoặc timeout i18n.

Nên thêm test cho:

```txt
historyTimeline.js
badgeConfig.js
public track response
warranty create/update/status
import Excel validation
supplier send/return flow
```

## 12. Hiệu năng

### Hiện trạng

- Build báo warning chunk lớn.
- Một số bundle rất lớn, đặc biệt `Statistics` và main `index`.
- Dashboard lấy `limit: 1000` phiếu rồi xử lý frontend.
- File JSON backend đọc/ghi có thể thành bottleneck khi dữ liệu tăng.

### Rủi ro

- Tải lần đầu nặng.
- Dashboard chậm nếu phiếu nhiều.
- Import/export lớn có thể nghẽn.
- File JSON có thể phình to.

### Nên cải thiện

- Code split thêm các màn nặng.
- Tách `Statistics` lazy mạnh hơn nếu chưa đủ.
- Dashboard dùng API summary/latest riêng thay vì kéo 1000 phiếu.
- Thêm pagination/filters server-side thực sự.
- Chuyển DB nếu dữ liệu tăng.

## 13. Khả năng bảo trì

### Điểm tốt

- Có thư mục rõ ràng.
- Có constants/utils/services.
- Đã bắt đầu gom logic chung: badge, timeline.
- Tên nghiệp vụ khá dễ hiểu.

### Điểm yếu

- `WarrantyDetail.jsx` rất lớn.
- `warranties.js` rất lớn.
- Một số logic giống nhau vẫn còn ở nhiều nơi.
- Nhiều rule nghiệp vụ nằm trực tiếp trong UI.

### Nên làm

- Tách `WarrantyDetail` thành tab/component nhỏ.
- Tách backend route thành services.
- Thêm test trước khi refactor sâu.
- Chuẩn hóa field labels toàn hệ thống.

## 14. Mức độ sẵn sàng vận hành

### Phù hợp

```txt
Dùng nội bộ
1 server
ít người dùng đồng thời
quy mô dữ liệu vừa/nhỏ
mạng LAN hoặc môi trường tin cậy
```

### Chưa phù hợp

```txt
Public internet không bảo vệ
nhiều chi nhánh ghi dữ liệu đồng thời
dữ liệu rất lớn
multi-instance
cần audit pháp lý/chặt chẽ
```

## 15. Ưu tiên cải thiện tiếp theo

### Ưu tiên 1 — ổn định dữ liệu

1. Thêm backup tự động theo lịch.
2. Kiểm tra integrity trước/ sau restore.
3. Log lỗi ghi file JSON rõ hơn.
4. Cân nhắc SQLite nếu dữ liệu tăng.

### Ưu tiên 2 — bảo trì code

1. Tách `WarrantyDetail.jsx`.
2. Tách `api/routes/warranties.js`.
3. Gom field labels vào 1 helper chung.
4. Thêm test cho `historyTimeline.js`.

### Ưu tiên 3 — bảo mật

1. Thay unlock admin bằng auth/session/token.
2. Hash mật khẩu đúng chuẩn.
3. Kiểm soát upload ảnh chặt hơn.
4. Public API chỉ trả whitelist field.
5. Rate limit dùng store bền hơn nếu deploy nhiều instance.

### Ưu tiên 4 — hiệu năng

1. API riêng cho dashboard latest events.
2. Server-side filters đầy đủ.
3. Lazy load/chunk split sâu hơn.
4. Tối ưu import/export dữ liệu lớn.

## 16. Kết luận

Dự án NTPC Warranty hiện là app nghiệp vụ nội bộ khá hoàn chỉnh, có nhiều chức năng sát thực tế và đã vượt xa CRUD cơ bản. Điểm mạnh lớn nhất là độ phủ nghiệp vụ: phiếu bảo hành, trạng thái, lịch sử, NCC, import/export, dashboard, public tracking và mobile UI.

Điểm yếu lớn nhất nằm ở nền tảng vận hành lâu dài: lưu trữ file JSON, bảo mật còn nhẹ, route/backend lớn, component chi tiết phiếu quá nặng, test coverage còn thấp.

Đánh giá tổng thể:

```txt
Mức hoàn thiện chức năng: 8/10
Mức sẵn sàng nội bộ:     7/10
Mức sẵn sàng production: 5/10
Khả năng mở rộng:        5/10
Khả năng bảo trì:        6/10
```

Nếu mục tiêu là dùng nội bộ quy mô nhỏ/vừa, dự án đã đủ nền tốt. Nếu mục tiêu là vận hành dài hạn, nên ưu tiên database thật, auth thật, tách backend service, tách `WarrantyDetail`, và tăng test coverage.

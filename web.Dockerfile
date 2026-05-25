# ==========================================
# STAGE 1: Xây dựng và biên dịch Frontend (Build Stage)
# ==========================================
FROM node:20-alpine AS build

# Thiết lập thư mục làm việc
WORKDIR /app

# Sao chép các tệp cấu hình dependency
COPY package*.json ./

# Cài đặt toàn bộ dependencies (bao gồm cả devDependencies phục vụ build)
RUN npm ci

# Sao chép toàn bộ mã nguồn Frontend
COPY . .

# Biên dịch ứng dụng ra các tệp tĩnh tối ưu hóa (HTML/JS/CSS) trong thư mục dist/
RUN npm run build

# ==========================================
# STAGE 2: Khởi chạy máy chủ Web tĩnh siêu nhỏ Nginx
# ==========================================
FROM nginx:alpine

# Sao chép cấu hình Nginx tùy chỉnh của chúng ta vào thư mục cấu hình Nginx chính thức
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Sao chép toàn bộ các tệp tĩnh đã build ở Stage 1 vào thư mục phục vụ của Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Mở cổng 80 (cổng HTTP tiêu chuẩn của Nginx bên trong container)
EXPOSE 80

# Chạy Nginx ở chế độ foreground để container duy trì trạng thái hoạt động
CMD ["nginx", "-g", "daemon off;"]

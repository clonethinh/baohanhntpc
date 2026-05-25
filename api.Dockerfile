# Sử dụng Node.js 20 LTS (Alpine) siêu nhẹ
FROM node:20-alpine

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Cài đặt các thư viện hệ thống cần thiết cho Prisma Engine hoạt động trên Linux Alpine
RUN apk add --no-cache openssl libc6-compat

# Sao chép file cấu hình dependency
COPY package*.json ./

# Sao chép cấu trúc CSDL Prisma
COPY prisma/ ./prisma/

# Cài đặt toàn bộ dependencies để có Prisma CLI sinh mã Client
RUN npm ci

# Sinh mã Prisma Client bên trong container tương thích với kiến trúc Linux Alpine
RUN npx prisma generate

# Dọn dẹp devDependencies để giữ dung lượng container gọn nhẹ tối đa
RUN npm prune --production

# Sao chép các tệp tiện ích từ src/ (Backend dùng chung các tiện ích lịch sử với Frontend)
COPY src/ ./src/

# Sao chép mã nguồn API vào container
COPY api/ ./api/

# Tạo các thư mục lưu trữ dữ liệu bền vững vật lý
RUN mkdir -p api/uploads api/backups

# Cấu hình biến môi trường
ENV NODE_ENV=production
ENV API_PORT=3003

EXPOSE 3003

CMD ["node", "api/server.js"]

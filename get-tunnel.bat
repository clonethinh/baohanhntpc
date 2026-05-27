@echo off
:: -------------------------------------------------------------------
:: SCRIPT LẤY NHANH LINK CLOUDFLARE QUICK TUNNEL CHO WINDOWS
:: -------------------------------------------------------------------
title NTPC Warranty - Cloudflare Tunnel URL Extractor
color 0B
echo.
echo ===================================================================
echo   NTPC WARRANTY - DICH VU TRICH XUAT LINK CLOUDFLARE QUICK TUNNEL
echo ===================================================================
echo.
echo Dang quet logs tu container 'ntpc-cloudflare-quick-tunnel'...
echo.

:: Sử dụng PowerShell để trích xuất link mới nhất từ Docker logs một cách chính xác nhất
set "TUNNEL_URL="
for /f "usebackq tokens=*" %%a in (`powershell -NoProfile -Command "(docker logs ntpc-cloudflare-quick-tunnel 2>&1 | Select-String -Pattern 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' | Select-Object -ExpandProperty Matches | Select-Object -ExpandProperty Value) | Select-Object -Last 1"`) do (
    set "TUNNEL_URL=%%a"
)

if "%TUNNEL_URL%"=="" goto notfound

:found
color 0A
:: Xoá khoảng trắng thừa
set "TUNNEL_URL=%TUNNEL_URL: =%"

echo ===================================================================
echo  LINK TUNNEL HTTPS CUA BAN:
echo  %TUNNEL_URL%
echo ===================================================================
echo.

:: Copy thẳng link vào Clipboard của Windows
echo | set /p="%TUNNEL_URL%" | clip
echo [OK] Da tu dong sao chep Link vao Clipboard! Ban chi viec nhan Ctrl + V de dan vao trinh duyet.
echo.

:: Tự động mở link bằng trình duyệt mặc định
echo Dang mo link trong trinh duyet...
start "" "%TUNNEL_URL%"
goto end

:notfound
color 0C
echo [LOI] Khong tim thay link Cloudflare Tunnel.
echo Vui long kiem tra xem container da khoi dong thanh cong chua bang lenh:
echo.
echo   docker-compose ps
echo.

:end
pause

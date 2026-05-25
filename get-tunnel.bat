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

:: Tìm kiếm dòng chứa link .trycloudflare.com trong log của container
set "TUNNEL_URL="
for /f "tokens=*" %%i in ('docker logs ntpc-cloudflare-quick-tunnel 2^>^&1 ^| findstr /r "https://.*\.trycloudflare\.com"') do (
    for %%j in (%%i) do (
        echo %%j | findstr "https://" >nul
        if not errorlevel 1 (
            set "TUNNEL_URL=%%j"
            goto found
        )
    )
)

:notfound
color 0C
echo [LOI] Khong tim thay link Cloudflare Tunnel.
echo Vui long kiem tra xem container da khoi dong thanh cong chua bang lenh:
echo.
echo   docker-compose ps
echo.
goto end

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

:end
pause

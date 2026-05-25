#!/bin/bash
# -------------------------------------------------------------------
# SCRIPT LẤY NHANH LINK CLOUDFLARE QUICK TUNNEL CHO LINUX VPS
# -------------------------------------------------------------------

GREEN='\033[0;32'
RED='\033[0;31'
NC='\033[0m' # No Color

echo -e "${GREEN}===================================================================${NC}"
echo -e "   NTPC WARRANTY - DỊCH VỤ TRÍCH XUẤT LINK CLOUDFLARE QUICK TUNNEL"
echo -e "${GREEN}===================================================================${NC}"
echo "Đang quét logs từ container 'ntpc-cloudflare-quick-tunnel'..."
echo ""

# Trích xuất URL
TUNNEL_URL=$(docker logs ntpc-cloudflare-quick-tunnel 2>&1 | grep -oE "https://[a-zA-Z0-9-]+\.trycloudflare\.com" | head -n 1)

if [ -n "$TUNNEL_URL" ]; then
    echo -e "${GREEN}===================================================================${NC}"
    echo -e " LINK TUNNEL HTTPS CỦA BẠN:"
    echo -e " ${GREEN}${TUNNEL_URL}${NC}"
    echo -e "${GREEN}===================================================================${NC}"
    echo ""
    
    # Thử sao chép vào Clipboard hệ thống nếu có tiện ích
    if command -v pbcopy &> /dev/null; then
        echo -n "$TUNNEL_URL" | pbcopy
        echo -e "${GREEN}[OK] Đã tự động sao chép Link vào Clipboard (MacOS pbcopy)!${NC}"
    elif command -v xclip &> /dev/null; then
        echo -n "$TUNNEL_URL" | xclip -selection clipboard
        echo -e "${GREEN}[OK] Đã tự động sao chép Link vào Clipboard (Linux xclip)!${NC}"
    else
        echo "(Vui lòng bôi đen và sao chép link trên màn hình)"
    fi
else
    echo -e "${RED}[LỖI] Chưa tìm thấy link Cloudflare Tunnel.${NC}"
    echo "Hãy chắc chắn rằng docker-compose đang chạy bằng lệnh: docker-compose ps"
fi
echo ""

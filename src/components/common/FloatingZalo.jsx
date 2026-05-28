import { useState, useEffect, useRef } from 'react';
import { RightOutlined } from '@ant-design/icons';

const ZALO_WEB_URL = 'https://zalo.me/0937632000';
const ZALO_APP_URL = 'zalo://chat?phone=0937632000';

export default function FloatingZalo() {
  const [showZaloBubble, setShowZaloBubble] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [position, setPosition] = useState({
    x: window.innerWidth - 72,
    y: window.innerHeight - 150
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const elementStart = useRef({ x: 0, y: 0 });
  const clickPrevented = useRef(false);

  // Adjust position when viewport size changes
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setPosition((pos) => {
        const maxX = window.innerWidth - 68;
        const maxY = window.innerHeight - 150;
        return {
          x: Math.max(16, Math.min(maxX, pos.x)),
          y: Math.max(16, Math.min(maxY, pos.y))
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const openZaloApp = (event) => {
    if (clickPrevented.current) {
      event.preventDefault();
      clickPrevented.current = false;
      return;
    }

    event?.preventDefault?.();
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    if (!isMobile) {
      window.open(ZALO_WEB_URL, '_blank', 'noopener,noreferrer');
      return;
    }
    window.location.href = ZALO_APP_URL;
    setTimeout(() => {
      window.location.href = ZALO_WEB_URL;
    }, 800);
  };

  const handleStart = (clientX, clientY) => {
    dragStart.current = { x: clientX, y: clientY };
    elementStart.current = { x: position.x, y: position.y };
    setIsDragging(true);
    clickPrevented.current = false;
  };

  const handleMove = (clientX, clientY) => {
    if (!isDragging) return;
    const dx = clientX - dragStart.current.x;
    const dy = clientY - dragStart.current.y;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      clickPrevented.current = true;
    }

    const maxX = window.innerWidth - 68;
    const maxY = window.innerHeight - 80;

    const nextX = Math.max(10, Math.min(maxX, elementStart.current.x + dx));
    const nextY = Math.max(10, Math.min(maxY, elementStart.current.y + dy));

    setPosition({ x: nextX, y: nextY });
  };

  const handleEnd = () => {
    setIsDragging(false);

    const buttonWidth = 56;
    const padding = 16;
    const tabbarHeight = 80;

    const currentX = position.x;
    const currentY = position.y;

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    const snapLeft = padding;
    const snapRight = screenW - buttonWidth - padding;
    const snapTop = padding;
    const snapBottom = screenH - buttonWidth - tabbarHeight;

    const distToLeft = Math.abs(currentX - snapLeft);
    const distToRight = Math.abs(currentX - snapRight);
    const distToTop = Math.abs(currentY - snapTop);
    const distToBottom = Math.abs(currentY - snapBottom);

    let targetX = currentX;
    let targetY = currentY;

    // Snaps to the closest edge horizontally
    targetX = distToLeft < distToRight ? snapLeft : snapRight;

    // Corner magnetic snapping (snaps to top/bottom corners if close to top/bottom)
    if (distToTop < 100) {
      targetY = snapTop;
    } else if (distToBottom < 100) {
      targetY = snapBottom;
    } else {
      targetY = Math.max(snapTop, Math.min(snapBottom, currentY));
    }

    setPosition({ x: targetX, y: targetY });

    setTimeout(() => {
      clickPrevented.current = false;
    }, 50);
  };

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    handleStart(e.clientX, e.clientY);
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isDragging) return;
      handleMove(e.clientX, e.clientY);
    };

    const onMouseUp = () => {
      if (isDragging) {
        handleEnd();
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  const onTouchStart = (e) => {
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  };

  const onTouchMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  };

  const onTouchEnd = () => {
    handleEnd();
  };

  const bubbleOnRight = position.x < (window.innerWidth - 56) / 2;
  const bubbleX = bubbleOnRight ? position.x + 68 : position.x - 170;

  return (
    <>
      <style>{`
        @keyframes zalo-bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
          60% { transform: translateY(-3px); }
        }
        .zalo-bubble-glow {
          box-shadow: 0 8px 30px rgba(0, 104, 255, 0.15);
          animation: zalo-bounce 2s infinite;
          user-select: none;
        }
        .zalo-btn-glow {
          box-shadow: 0 10px 24px rgba(0, 104, 255, 0.32);
          animation: zalo-bounce 2s infinite;
          user-select: none;
          touch-action: none;
        }
      `}</style>

      {/* 1. Zalo Button (Draggable on mobile, Static on desktop) */}
      <a
        href={ZALO_WEB_URL}
        onClick={openZaloApp}
        onMouseDown={isMobile ? onMouseDown : undefined}
        onTouchStart={isMobile ? onTouchStart : undefined}
        onTouchMove={isMobile ? onTouchMove : undefined}
        onTouchEnd={isMobile ? onTouchEnd : undefined}
        aria-label="Chat Zalo 0937 63 2000"
        className="zalo-btn-glow"
        style={{
          position: 'fixed',
          left: isMobile ? position.x : 'auto',
          top: isMobile ? position.y : 'auto',
          right: isMobile ? 'auto' : 16,
          bottom: isMobile ? 'auto' : 16,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#fff',
          color: '#0068ff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          border: '2px solid #0068ff',
          zIndex: 1200,
          cursor: isMobile ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
          transition: isMobile 
            ? (isDragging 
                ? 'none' 
                : 'left 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28), top 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28), box-shadow 0.2s, transform 0.2s')
            : 'box-shadow 0.2s, transform 0.2s',
        }}
      >
        <img
          src="/zalo.png"
          alt="Zalo"
          width="34"
          height="34"
          style={{ borderRadius: '50%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
        />
      </a>

      {/* 2. Text Bubble (Snaps on mobile, Default on desktop) */}
      {showZaloBubble && (
        <a
          href={ZALO_WEB_URL}
          onClick={openZaloApp}
          className="zalo-bubble-glow"
          style={{
            position: 'fixed',
            left: isMobile ? bubbleX : 'auto',
            top: isMobile ? position.y + 6 : 'auto',
            right: isMobile ? 'auto' : 80,
            bottom: isMobile ? 'auto' : 20,
            background: '#fff',
            borderRadius: 12,
            padding: isMobile ? '10px 14px 10px 12px' : '8px 14px 8px 12px',
            border: '1px solid #d9d9d9',
            zIndex: 1199,
            width: isMobile ? 160 : 170,
            textDecoration: 'none',
            display: 'block',
            transition: isMobile
              ? (isDragging ? 'none' : 'all 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)')
              : 'all 0.2s',
          }}
        >
          {isMobile ? (
            bubbleOnRight ? (
              <div
                style={{
                  position: 'absolute',
                  left: -5,
                  bottom: 12,
                  width: 10,
                  height: 10,
                  background: '#fff',
                  transform: 'rotate(45deg)',
                  borderLeft: '1px solid #d9d9d9',
                  borderBottom: '1px solid #d9d9d9',
                }}
              />
            ) : (
              <div
                style={{
                  position: 'absolute',
                  right: -5,
                  bottom: 12,
                  width: 10,
                  height: 10,
                  background: '#fff',
                  transform: 'rotate(45deg)',
                  borderRight: '1px solid #d9d9d9',
                  borderTop: '1px solid #d9d9d9',
                }}
              />
            )
          ) : (
            <div
              style={{
                position: 'absolute',
                right: -6,
                bottom: 16,
                width: 10,
                height: 10,
                background: '#fff',
                transform: 'rotate(45deg)',
                borderRight: '1px solid #d9d9d9',
                borderTop: '1px solid #d9d9d9',
              }}
            />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setShowZaloBubble(false);
            }}
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              border: 'none',
              background: 'none',
              fontSize: 10,
              color: '#bfbfbf',
              cursor: 'pointer',
              padding: 2,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
          <div style={{ fontSize: isMobile ? 12 : 12, color: '#262626', fontWeight: 600, lineHeight: 1.3 }}>
            Bạn cần trợ giúp?
          </div>
          <div style={{ fontSize: isMobile ? 11 : 11, color: '#0068ff', fontWeight: 700, marginTop: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            Chat ngay <RightOutlined style={{ fontSize: isMobile ? 8 : 9 }} />
          </div>
        </a>
      )}
    </>
  );
}

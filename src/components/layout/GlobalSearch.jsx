import { useState, useRef, useEffect } from 'react';
import { Input, Modal, Tag } from 'antd';
import {
  SearchOutlined,
  PlusCircleOutlined,
  DashboardOutlined,
  FileTextOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '../../hooks/useDebounce';
import { useTheme } from '../../hooks/useTheme';
import { warrantyService } from '../../services/warrantyService';
import { STATUS } from '../../constants/statusConfig';

export default function GlobalSearch() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const debouncedSearch = useDebounce(search, 300);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const activeItemRef = useRef(null);

  useEffect(() => {
    window.__focusSearch = () => {
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    };
  }, []);

  const actions = [
    {
      id: 'create-warranty',
      type: 'action',
      title: 'Tạo phiếu bảo hành mới',
      desc: 'Tạo phiếu nhận máy, báo giá hoặc đổi trả',
      icon: <PlusCircleOutlined style={{ color: isDark ? '#73d13d' : '#2f7a22', fontSize: 16 }} />,
      shortcut: 'Ctrl + N',
      onSelect: () => { setOpen(false); setSearch(''); navigate('/admin/tao-phieu'); }
    },
    {
      id: 'goto-dashboard',
      type: 'action',
      title: 'Xem Bảng điều khiển (Dashboard)',
      desc: 'Báo cáo thống kê, tiến trình & lịch sử mới nhất',
      icon: <DashboardOutlined style={{ color: '#096dd9', fontSize: 16 }} />,
      onSelect: () => { setOpen(false); setSearch(''); navigate('/admin/dashboard'); }
    },
    {
      id: 'goto-list',
      type: 'action',
      title: 'Xem danh sách phiếu bảo hành',
      desc: 'Tra cứu, lọc và cập nhật tất cả phiếu bảo hành',
      icon: <FileTextOutlined style={{ color: isDark ? '#ffc069' : '#d46b08', fontSize: 16 }} />,
      onSelect: () => { setOpen(false); setSearch(''); navigate('/admin/phieu'); }
    },
    {
      id: 'show-shortcuts',
      type: 'action',
      title: 'Xem bảng hướng dẫn phím tắt',
      desc: 'Hiển thị danh sách các phím tắt nhanh trong hệ thống',
      icon: <QuestionCircleOutlined style={{ color: isDark ? '#b37feb' : '#722ed1', fontSize: 16 }} />,
      shortcut: '?',
      onSelect: () => { setOpen(false); setSearch(''); if (window.__showShortcuts) window.__showShortcuts(); }
    }
  ];

  const filteredActions = actions.filter(act =>
    act.title.toLowerCase().includes(search.toLowerCase()) ||
    act.desc.toLowerCase().includes(search.toLowerCase())
  );

  const allItems = [...filteredActions, ...results];

  useEffect(() => {
    if (debouncedSearch.length >= 2) {
      setLoading(true);
      warrantyService.getList({ search: debouncedSearch, page: 1, limit: 10 })
        .then(res => {
          if (res.data.success) {
            const rows = res.data.data.rows.map(row => ({ ...row, type: 'warranty' }));
            setResults(rows);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setResults([]);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    setActiveIndex(0);
  }, [search, results]);

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [activeIndex]);

  const handleSelectItem = (item) => {
    if (item.type === 'action') {
      item.onSelect();
    } else {
      setOpen(false);
      setSearch('');
      navigate(`/admin/phieu?detail=${item.id}`);
    }
  };

  const handleKeyDown = (e) => {
    const total = allItems.length;
    if (total === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % total);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + total) % total);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelectItem(allItems[activeIndex]);
    }
  };

  const renderHeaderIfNeeded = (index) => {
    const current = allItems[index];
    const prev = allItems[index - 1];

    const headerStyle = {
      padding: '12px 16px 6px 16px',
      fontSize: '11px',
      fontWeight: 700,
      color: isDark ? '#8a9984' : '#74806d',
      letterSpacing: '0.08em',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    };

    if (index === 0) {
      return (
        <div style={headerStyle}>
          {current.type === 'action' ? (
            <>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: isDark ? '#b37feb' : '#722ed1' }} />
              LỆNH & PHÍM TẮT NHANH
            </>
          ) : (
            <>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: isDark ? '#73d13d' : '#2f7a22' }} />
              PHIẾU BẢO HÀNH TÌM THẤY
            </>
          )}
        </div>
      );
    }

    if (current.type !== 'action' && prev?.type === 'action') {
      return (
        <div style={{ ...headerStyle, borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #f0f5eb', marginTop: '6px', paddingTop: '16px' }}>
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: isDark ? '#73d13d' : '#2f7a22' }} />
          PHIẾU BẢO HÀNH TÌM THẤY
        </div>
      );
    }

    return null;
  };

  const getItemStyle = (index) => {
    const isActive = activeIndex === index;
    return {
      cursor: 'pointer',
      padding: '12px 16px',
      borderRadius: '10px',
      marginBottom: '4px',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      background: isActive 
        ? (isDark 
            ? 'linear-gradient(90deg, rgba(47, 122, 34, 0.35) 0%, rgba(47, 122, 34, 0.15) 100%)' 
            : 'linear-gradient(90deg, rgba(233, 246, 226, 0.8) 0%, rgba(244, 251, 240, 0.6) 100%)') 
        : 'transparent',
      borderLeft: isActive 
        ? (isDark ? '4px solid #73d13d' : '4px solid #2f7a22') 
        : '4px solid transparent',
      transform: isActive ? 'translateX(2px)' : 'translateX(0)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: isActive 
        ? (isDark ? '0 4px 12px rgba(0, 0, 0, 0.25)' : '0 4px 12px rgba(47, 122, 34, 0.05)') 
        : 'none',
    };
  };

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '210px',
          height: '32px',
          padding: '0 12px',
          background: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f4f7f4',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #e2ebd9',
          borderRadius: '999px',
          cursor: 'pointer',
          transition: 'all 0.25s ease',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.13)' : '#eaf2e8';
          e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.25)' : '#cddcc3';
          e.currentTarget.style.boxShadow = isDark ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(47, 122, 34, 0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.08)' : '#f4f7f4';
          e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.15)' : '#e2ebd9';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: isDark ? '#a8b5a0' : '#74806d' }}>
          <SearchOutlined style={{ fontSize: 14, color: isDark ? '#73d13d' : '#2f7a22' }} />
          <span style={{ fontSize: 13, color: isDark ? '#a8b5a0' : '#74806d', fontWeight: 500 }}>
            Tìm kiếm...
          </span>
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: isDark ? 'rgba(255, 255, 255, 0.1)' : '#ffffff',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid #cbd6c5',
            borderRadius: '5px',
            padding: '2px 6px',
            fontSize: '10px',
            color: isDark ? '#c5d1be' : '#4e5d47',
            boxShadow: isDark ? '0 1px 0 rgba(0,0,0,0.2)' : '0 1px 0 rgba(0,0,0,0.05)',
            fontWeight: 750,
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            lineHeight: '1',
          }}
        >
          Ctrl K
        </span>
      </div>
      <Modal
        open={open}
        onCancel={() => { setOpen(false); setSearch(''); setResults([]); }}
        footer={
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 16,
            padding: '12px 20px',
            background: isDark ? '#1b2019' : '#fcfdfb',
            borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #f0f5eb',
            fontSize: 12,
            color: isDark ? '#8a9984' : '#8c9485',
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16
          }}>
            <span><Tag style={{ margin: 0, padding: '0 4px', fontSize: 10, background: isDark ? 'rgba(255,255,255,0.08)' : '#fff', border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #d9e2d5', color: isDark ? '#a8b5a0' : '#4e5d47' }}>↑↓</Tag> Điều hướng</span>
            <span><Tag style={{ margin: 0, padding: '0 4px', fontSize: 10, background: isDark ? 'rgba(255,255,255,0.08)' : '#fff', border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #d9e2d5', color: isDark ? '#a8b5a0' : '#4e5d47' }}>↵ Enter</Tag> Chọn</span>
            <span><Tag style={{ margin: 0, padding: '0 4px', fontSize: 10, background: isDark ? 'rgba(255,255,255,0.08)' : '#fff', border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #d9e2d5', color: isDark ? '#a8b5a0' : '#4e5d47' }}>Esc</Tag> Đóng</span>
          </div>
        }
        closable={false}
        width={550}
        styles={{
          mask: {
            backdropFilter: 'blur(8px)',
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(28, 38, 24, 0.3)',
          },
          content: {
            padding: 0,
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' : '0 25px 50px -12px rgba(28, 38, 24, 0.15)',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.8)',
            background: isDark ? 'rgba(30, 35, 28, 0.95)' : 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(20px)',
          }
        }}
      >
        <Input
          ref={inputRef}
          prefix={<SearchOutlined style={{ color: isDark ? '#73d13d' : '#2f7a22', fontSize: 18, marginRight: 8 }} />}
          placeholder={t('search.placeholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          size="large"
          bordered={false}
          style={{
            padding: '16px 20px',
            fontSize: '15px',
            borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #f0f5eb',
            background: 'transparent',
            color: isDark ? '#e0ebd8' : '#2d332a',
          }}
          autoFocus
        />
        <div style={{ maxHeight: 380, overflowY: 'auto', padding: '8px 12px' }} className="command-palette-results">
          {loading && <div style={{ padding: 24, textAlign: 'center', color: isDark ? '#8a9984' : '#74806d' }}>{t('search.loading')}</div>}
          
          {!loading && allItems.length === 0 && search.length > 0 && (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: isDark ? '#e0ebd8' : '#4e5d47' }}>
                {t('search.noResults')}
              </div>
              <div style={{ fontSize: '12px', color: isDark ? '#8a9984' : '#8c9485', marginTop: '4px' }}>
                Thử tìm kiếm theo Tên, Số điện thoại, Mã phiếu hoặc Số seri khác
              </div>
            </div>
          )}

          {!loading && allItems.map((item, index) => {
            const isActive = activeIndex === index;
            return (
              <div key={item.id} ref={isActive ? activeItemRef : null}>
                {renderHeaderIfNeeded(index)}
                <div
                  style={getItemStyle(index)}
                  onClick={() => handleSelectItem(item)}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  {item.type === 'action' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                      <div style={{
                        display: 'inline-flex',
                        width: 34,
                        height: 34,
                        borderRadius: '8px',
                        background: isActive ? (isDark ? 'rgba(255, 255, 255, 0.15)' : '#fff') : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#f5f7f4'),
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e2e8e0',
                        transition: 'all 0.2s'
                      }}>
                        {item.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: isActive ? (isDark ? '#73d13d' : '#2f7a22') : (isDark ? '#e2e8df' : '#2d332a'), transition: 'color 0.2s' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: '11px', color: isDark ? '#8a9984' : '#74806d', marginTop: 2 }}>
                          {item.desc}
                        </div>
                      </div>
                      {item.shortcut && (
                        <Tag style={{
                          background: isActive ? (isDark ? 'rgba(47, 122, 34, 0.4)' : '#e9f6e2') : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#f5f7f4'),
                          border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd6c5',
                          borderRadius: '5px',
                          margin: 0,
                          fontSize: 10,
                          color: isDark ? '#d3f261' : '#4e5d47',
                          fontWeight: 600
                        }}>
                          {item.shortcut}
                        </Tag>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: isActive ? (isDark ? '#73d13d' : '#2f7a22') : (isDark ? '#e2e8df' : '#2d332a'), transition: 'color 0.2s' }}>
                          <strong>{item.soChungTu}</strong> · {item.khachHang} {item.soDienThoai ? `(${item.soDienThoai})` : ''}
                        </div>
                        <div style={{ fontSize: '11px', color: isDark ? '#8a9984' : '#74806d', marginTop: 2 }}>
                          {item.tenHang} {item.soSeri ? `· Seri: ${item.soSeri}` : ''}
                        </div>
                      </div>
                      <Tag color={STATUS[item.trangThai]?.color} style={{ margin: 0, borderRadius: '5px', fontSize: 11, fontWeight: 550, border: 'none', padding: '2px 8px' }}>
                        {STATUS[item.trangThai]?.label}
                      </Tag>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </>
  );
}

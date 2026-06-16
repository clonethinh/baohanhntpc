import { useState, useEffect } from 'react';
import { Table, Space, Input, Select, Button, Popconfirm, App, Typography, Tag, DatePicker, Affix, Tooltip } from 'antd';
import {
  Button as MobileButton,
  Card as MobileCard,
  Checkbox,
  Dialog,
  List,
  Popup,
  SearchBar,
  Selector,
  Space as MobileSpace,
  Tag as MobileTag,
} from 'antd-mobile';
import { SearchOutlined, DeleteOutlined, CheckCircleOutlined, DownloadOutlined, CopyOutlined, EyeOutlined, PrinterOutlined, StarOutlined, FilterOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '../../hooks/useDebounce';
import { useIsMobile } from '../../hooks/useIsMobile';
import { warrantyService, nhanVienService } from '../../services/warrantyService';
import { STATUS } from '../../constants/statusConfig';
import { getStatusBadgeColor } from '../../constants/badgeConfig';
import { LOAI_XU_LY_OPTIONS, LOAI_XU_LY_LABELS } from '../../constants/warrantyOptions';
import { getUrgency } from '../../utils/urgency';
import { formatDate, getWarrantyDueDate, shouldShowDueDate, hasExplicitDueDate } from '../../utils/dateHelpers';
import StatusTag from '../../components/warranty/StatusTag';
import WarrantyDetail from '../../components/warranty/WarrantyDetail';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

export default function WarrantyList() {
  const { t } = useTranslation();
  const { message, notification } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState({ rows: [], total: 0, page: 1, limit: 25 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [trangThai, setTrangThai] = useState('');
  const [loaiXuLy, setLoaiXuLy] = useState('');
  const [maNhanVien, setMaNhanVien] = useState('');
  const [dueType, setDueType] = useState(() => {
    const qDueType = searchParams.get('dueType');
    return qDueType === 'today' || qDueType === 'overdue' ? qDueType : '';
  });
  const [uuTienOnly, setUuTienOnly] = useState(() => searchParams.get('uuTien') === '1');
  const [ngayNhanRange, setNgayNhanRange] = useState(null);
  const [sortBy, setSortBy] = useState('trangThaiPriority');
  const [sortOrder, setSortOrder] = useState('ascend');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const debouncedSearch = useDebounce(search, 400);
  const isMobile = useIsMobile();

  useEffect(() => {
    nhanVienService.getList().then(res => {
      if (res.data.success) setStaffList(res.data.data);
    });
  }, []);

  useEffect(() => {
    const qDueType = searchParams.get('dueType');
    setDueType(qDueType === 'today' || qDueType === 'overdue' ? qDueType : '');
    setUuTienOnly(searchParams.get('uuTien') === '1');

    if (searchParams.get('new') === '1') {
      navigate('/admin/phieu', { replace: true });
    }

    const qDetailId = searchParams.get('detail');
    if (qDetailId) {
      setDetailId(qDetailId);
      setDetailOpen(true);
    }
  }, [searchParams, navigate]);

  const fetchData = (page, limit) => {
    setLoading(true);
    const p = page ?? data.page;
    const l = limit ?? data.limit;
    const params = {
      page: p,
      limit: l,
      search: debouncedSearch,
      trangThai,
      loaiXuLy,
      maNhanVien,
      dueType,
      uuTien: uuTienOnly ? '1' : '',
      sortBy,
      sortOrder: sortOrder === 'ascend' ? 'asc' : 'desc',
    };
    if (ngayNhanRange) {
      params.from = ngayNhanRange[0].format('YYYY-MM-DD');
      params.to = ngayNhanRange[1].format('YYYY-MM-DD');
    }

    warrantyService.getList(params)
      .then(res => {
        if (res.data.success) setData({ ...res.data.data });
      })
      .catch(() => notification.error({ message: t('errorBoundary.title'), description: t('adminWarrantyList.loadError') }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData(1);
  }, [debouncedSearch, trangThai, loaiXuLy, maNhanVien, ngayNhanRange, dueType, uuTienOnly, sortBy, sortOrder]);

  const handlePageChange = (page, limit) => {
    fetchData(page, limit);
  };

  const handleTableChange = (pagination, filters, sorter) => {
    if (sorter.field) {
      setSortBy(sorter.field);
      setSortOrder(sorter.order);
    } else {
      setSortBy('trangThaiPriority');
      setSortOrder('ascend');
    }
  };

  const handleOpenDetail = (id) => {
    setDetailId(id);
    setDetailOpen(true);
  };

  const handleTraHang = async (id) => {
    try {
      await warrantyService.traHang(id, { ngayTra: dayjs().format('YYYY-MM-DD') });
      message.success(t('adminWarrantyList.markDoneSuccess'));
      fetchData();
    } catch {
      notification.error({ message: t('errorBoundary.title'), description: t('adminWarrantyList.returnError') });
    }
  };

  const handleDelete = async (id) => {
    try {
      await warrantyService.delete(id);
      // Hiển thị message với nút "Hoàn tác" trong 6 giây
      const key = `delete-warranty-${id}-${Date.now()}`;
      message.success({
        content: (
          <span>
            {t('adminWarrantyList.deleteSuccess')}{' '}
            <Button
              type="link"
              size="small"
              style={{ padding: 0, height: 'auto', fontWeight: 600 }}
              onClick={async () => {
                message.destroy(key);
                try {
                  await warrantyService.restore(id);
                  message.success(t('adminWarrantyList.undoneSuccess'));
                  fetchData();
                } catch (err) {
                  message.error(t('adminWarrantyList.deleteError'));
                }
              }}
            >
              {t('adminCustomer.undo')}
            </Button>
          </span>
        ),
        duration: 6,
        key,
      });
      fetchData();
    } catch {
      notification.error({ message: t('errorBoundary.title'), description: t('adminWarrantyList.deleteError') });
    }
  };

  const handlePriority = async (id, current) => {
    try {
      await warrantyService.setPriority(id, !current);
      message.success(!current ? t('adminWarrantyList.priorityMarked') : t('adminWarrantyList.priorityUnmarked'));
      fetchData();
    } catch {
      notification.error({ message: t('errorBoundary.title'), description: t('adminWarrantyList.priorityError') });
    }
  };

  const handleBulkTraHang = async () => {
    for (const id of selectedRowKeys) {
      await warrantyService.traHang(id, { ngayTra: dayjs().format('YYYY-MM-DD') });
    }
    message.success(t('adminWarrantyList.bulkDoneSuccess', { count: selectedRowKeys.length }));
    setSelectedRowKeys([]);
    fetchData();
  };

  const handleExport = () => {
    warrantyService.exportWarranties({ trangThai, loaiXuLy, maNhanVien }).then(res => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ntpc-warranties.xlsx';
      link.click();
    });
  };

  const confirmMobile = (content, onConfirm) => {
    Dialog.confirm({
      content,
      confirmText: t('button.xacNhan'),
      cancelText: t('button.huy'),
      onConfirm,
    });
  };

  const columns = [
    {
      title: t('adminWarrantyList.documentNumber'),
      dataIndex: 'soChungTu',
      key: 'soChungTu',
      width: 104,
      render: (text, record) => (
        <Space>
          <Typography.Link onClick={(event) => { event.stopPropagation(); handleOpenDetail(record.id); }}>{text}</Typography.Link>
          <CopyOutlined
            style={{ cursor: 'pointer', color: '#999' }}
            onClick={async (event) => {
              event.stopPropagation();
              try {
                await navigator.clipboard.writeText(text);
                message.success(t('adminWarrantyList.copied'));
              } catch {
                const ta = document.createElement('textarea');
                ta.value = String(text || '');
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                message.success(t('adminWarrantyList.copied'));
              }
            }}
          />
        </Space>
      ),
    },
    {
      title: t('field.ngayNhan'),
      dataIndex: 'ngayNhan',
      key: 'ngayNhan',
      width: 70,
      sorter: true,
      render: (text) => formatDate(text),
    },
    {
      title: t('field.khachHang'),
      dataIndex: 'khachHang',
      key: 'khachHang',
      width: 100,
      sorter: true,
      ellipsis: true,
    },
    {
      title: t('field.tenHang'),
      dataIndex: 'tenHang',
      key: 'tenHang',
      width: 180,
      sorter: true,
      ellipsis: { showTitle: false },
      render: (text) => <Tooltip title={text}><span>{text}</span></Tooltip>,
    },
    {
      title: t('field.soSeri'),
      dataIndex: 'soSeri',
      key: 'soSeri',
      width: 100,
      ellipsis: true,
    },
    {
      title: t('adminWarrantyList.handlingTypeShort'),
      dataIndex: 'loaiXuLy',
      key: 'loaiXuLy',
      width: 65,
      render: (v) => <Tag>{LOAI_XU_LY_LABELS[v] || v}</Tag>,
    },
    {
      title: t('field.henTra'),
      dataIndex: 'ngayHenTra',
      key: 'ngayHenTra',
      width: 70,
      sorter: true,
      render: (text, record) => {
        if (record.ngayHenTra === 'none') {
          if (record.trangThai === 'da_tra' || record.trangThai === 'huy') return '-';
          return <span>Pending<span className="loading-dots" /></span>;
        }
        if (!shouldShowDueDate(record)) return '-';
        const dueDate = getWarrantyDueDate(record);
        const u = getUrgency({ trangThai: 'dang_xu_ly', ngayHenTra: dueDate });
        const color = u === 'overdue' ? '#ff4d4f' : u === 'urgent' ? '#faad14' : undefined;
        return <span style={{ color }}>{formatDate(dueDate)}</span>;
      },
    },
    {
      title: t('table.trangThai'),
      dataIndex: 'trangThai',
      key: 'trangThai',
      width: 75,
      sorter: true,
      render: (s) => <StatusTag status={s} />,
    },
    {
      title: t('notification.priority'),
      dataIndex: 'uuTien',
      key: 'uuTien',
      width: 50,
      render: (v, record) => v && record.trangThai !== 'da_tra' && record.trangThai !== 'huy' ? <Tag color="red">{t('adminDashboard.priority')}</Tag> : <Tag>---</Tag>,
    },
    {
      title: t('adminWarrantyList.action'),
      key: 'actions',
      width: 130,
      render: (_, r) => (
        <Space size="small" style={{ whiteSpace: 'nowrap' }}>
          <Tooltip title={t('adminWarrantyList.viewDetail')}><Button size="small" icon={<EyeOutlined />} onClick={(event) => { event.stopPropagation(); handleOpenDetail(r.id); }} /></Tooltip>
          <Tooltip title={t('adminWarrantyList.printTicket')}><Button size="small" icon={<PrinterOutlined />} onClick={(event) => { event.stopPropagation(); navigate(`/admin/phieu/${r.id}/in`); }} /></Tooltip>
                    {r.trangThai !== 'da_tra' && r.trangThai !== 'huy' && (
            <span onClick={(event) => event.stopPropagation()}>
              <Popconfirm title={t('adminWarrantyList.markWarrantyDoneConfirm')} onConfirm={() => handleTraHang(r.id)}>
                <Tooltip title={t('adminWarrantyList.markDone')}><Button size="small" icon={<CheckCircleOutlined />} type="primary" /></Tooltip>
              </Popconfirm>
            </span>
          )}
          {r.trangThai !== 'da_tra' && r.trangThai !== 'huy' && (
            <Tooltip title={r.uuTien ? t('adminWarrantyList.unmarkPriority') : t('adminDashboard.priority')}>
              <Button
                size="small"
                icon={<StarOutlined />}
                type={r.uuTien ? 'primary' : 'default'}
                danger={Boolean(r.uuTien)}
                onClick={(event) => { event.stopPropagation(); handlePriority(r.id, r.uuTien); }}
              />
            </Tooltip>
          )}
                    <span onClick={(event) => event.stopPropagation()}>
            <Popconfirm title={t('adminWarrantyList.deleteConfirm')} onConfirm={() => handleDelete(r.id)}>
              <Tooltip title={t('adminWarrantyList.deleteTicket')}><Button size="small" danger icon={<DeleteOutlined />} /></Tooltip>
            </Popconfirm>
          </span>
        </Space>
      ),
    },
  ];

  return (
    <>
    {isMobile && <div className="mobile-only admin-mobile-page">
      <MobileCard className="admin-mobile-card" title={t('adminWarrantyList.titleWithTotal', { total: data.total })}>
        <MobileSpace direction="vertical" block style={{ '--gap': '10px' }}>
          <MobileSpace block>
            <div style={{ flex: 1 }}>
              <SearchBar
                placeholder={t('adminWarrantyList.mobileSearchPlaceholder')}
                value={search}
                onChange={setSearch}
                clearable
                style={{ '--height': '42px', '--border-radius': '12px' }}
              />
            </div>
            <MobileButton
              style={{ borderRadius: 12, minWidth: 44 }}
              onClick={() => setMobileFilterOpen(true)}
            >
              <FilterOutlined /> {(loaiXuLy || maNhanVien || ngayNhanRange) ? '●' : ''}
            </MobileButton>
            <MobileButton
              style={{ borderRadius: 12, minWidth: 44 }}
              onClick={handleExport}
            >
              <DownloadOutlined />
            </MobileButton>
          </MobileSpace>
          <Selector
            value={trangThai ? [trangThai] : []}
            onChange={(arr) => setTrangThai(arr[0] || '')}
            options={[
              { label: t('common.tatCa'), value: '' },
              ...Object.entries(STATUS).map(([k, v]) => ({ label: v.label, value: k })),
            ]}
          />
          <MobileSpace wrap>
            <MobileButton size="small" fill={dueType === 'today' ? 'solid' : 'outline'} color="warning" onClick={() => setDueType(dueType === 'today' ? '' : 'today')}>
              {t('adminWarrantyList.due')}
            </MobileButton>
            <MobileButton size="small" fill={dueType === 'overdue' ? 'solid' : 'outline'} color="danger" onClick={() => setDueType(dueType === 'overdue' ? '' : 'overdue')}>
              {t('adminDashboard.overdue')}
            </MobileButton>
            <MobileButton size="small" fill={uuTienOnly ? 'solid' : 'outline'} color="primary" onClick={() => setUuTienOnly(!uuTienOnly)}>
              {t('adminDashboard.priority')}
            </MobileButton>
            {data.rows.length > 0 && (
              <MobileButton size="small" fill="outline" onClick={() => {
                if (selectedRowKeys.length === data.rows.length) {
                  setSelectedRowKeys([]);
                } else {
                  setSelectedRowKeys(data.rows.map(w => w.id));
                }
              }}>
                {selectedRowKeys.length === data.rows.length ? t('adminWarrantyList.deselectAll') : t('adminWarrantyList.selectAll')}
              </MobileButton>
            )}
            <MobileButton size="small" onClick={() => {
              setSearch('');
              setTrangThai('');
              setLoaiXuLy('');
              setMaNhanVien('');
              setNgayNhanRange(null);
              setDueType('');
              setUuTienOnly(false);
              navigate('/admin/phieu', { replace: true });
            }}>
              {t('adminWarrantyList.clearFilters')}
            </MobileButton>
          </MobileSpace>
        </MobileSpace>
      </MobileCard>

      {/* Popup bộ lọc nâng cao mobile */}
      <Popup
        visible={mobileFilterOpen}
        onMaskClick={() => setMobileFilterOpen(false)}
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: '16px 16px 32px' }}
      >
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Bộ lọc nâng cao</div>
        <MobileSpace direction="vertical" block style={{ '--gap': '14px' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, opacity: 0.6 }}>Loại xử lý</div>
            <Selector
              value={loaiXuLy ? [loaiXuLy] : []}
              onChange={(arr) => setLoaiXuLy(arr[0] || '')}
              options={[
                { label: t('common.tatCa'), value: '' },
                ...LOAI_XU_LY_OPTIONS,
              ]}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, opacity: 0.6 }}>Nhân viên</div>
            <Selector
              value={maNhanVien ? [maNhanVien] : []}
              onChange={(arr) => setMaNhanVien(arr[0] || '')}
              options={[
                { label: t('common.tatCa'), value: '' },
                ...staffList.map(nv => ({ label: nv.tenNV, value: nv.maNV })),
              ]}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, opacity: 0.6 }}>Ngày nhận</div>
            <RangePicker
              value={ngayNhanRange}
              onChange={setNgayNhanRange}
              style={{ width: '100%' }}
              format="DD-MM-YYYY"
            />
          </div>
          <MobileSpace block justify="between">
            <MobileButton onClick={() => { setLoaiXuLy(''); setMaNhanVien(''); setNgayNhanRange(null); }}>Xóa lọc</MobileButton>
            <MobileButton color="primary" onClick={() => setMobileFilterOpen(false)}>Áp dụng</MobileButton>
          </MobileSpace>
        </MobileSpace>
      </Popup>

      <div className="admin-mobile-ticket-list">
        {loading ? (
          <MobileCard className="admin-mobile-card">{t('adminWarrantyList.loading')}</MobileCard>
        ) : data.rows.length === 0 ? (
          <MobileCard className="admin-mobile-card">{t('adminWarrantyList.emptyFiltered')}</MobileCard>
        ) : data.rows.map(w => {
          const urgency = getUrgency(w);
          const dueText = hasExplicitDueDate(w) ? formatDate(getWarrantyDueDate(w)) : <span>Pending<span className="loading-dots" /></span>;
          return (
            <MobileCard key={w.id} className={`admin-mobile-ticket row-${urgency}`} onClick={() => handleOpenDetail(w.id)}>
              <div className="admin-mobile-ticket-head" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span onClick={(event) => event.stopPropagation()} style={{ display: 'inline-flex', alignSelf: 'center' }}>
                  <Checkbox
                    checked={selectedRowKeys.includes(w.id)}
                    onChange={(checked) => {
                      if (checked) {
                        setSelectedRowKeys(prev => [...prev, w.id]);
                      } else {
                        setSelectedRowKeys(prev => prev.filter(k => k !== w.id));
                      }
                    }}
                  />
                </span>
                <button type="button" onClick={(event) => { event.stopPropagation(); handleOpenDetail(w.id); }} style={{ flex: 1, textAlign: 'left', border: 'none', background: 'none', padding: 0, fontWeight: 'bold', color: 'inherit', cursor: 'pointer' }}>{w.soChungTu}</button>
                <MobileTag color={w.trangThai === 'da_tra' ? 'success' : w.trangThai === 'huy' ? 'danger' : urgency === 'overdue' ? 'danger' : getStatusBadgeColor(w.trangThai, 'mobile')}>
                  {STATUS[w.trangThai]?.label || w.trangThai}
                </MobileTag>
              </div>
              <div className="admin-mobile-ticket-body">
                <b>{w.khachHang || '-'}</b>
                <span>{w.tenHang || '-'}</span>
                <small>
                  Serial: {w.soSeri || '-'} ·{' '}
                  <span style={{ whiteSpace: 'nowrap' }}>
                    Hẹn trả:&nbsp;
                    {w.ngayHenTra === 'none'
                      ? <span>Pending<span className="loading-dots" /></span>
                      : (shouldShowDueDate(w) ? formatDate(getWarrantyDueDate(w)) : '-')}
                  </span>
                </small>
              </div>
              <MobileSpace wrap className="admin-mobile-ticket-actions">
                {w.uuTien && w.trangThai !== 'da_tra' && w.trangThai !== 'huy' && <MobileTag color="danger">{t('adminDashboard.priority')}</MobileTag>}
                <MobileButton size="mini" onClick={(event) => { event.stopPropagation(); handleOpenDetail(w.id); }}>{t('button.xem')}</MobileButton>
                <MobileButton size="mini" onClick={(event) => { event.stopPropagation(); navigate(`/admin/phieu/${w.id}/in`); }}>{t('trackingResult.print')}</MobileButton>
                {w.trangThai !== 'da_tra' && w.trangThai !== 'huy' && (
                  <>
                    <MobileButton size="mini" color="primary" onClick={(event) => { event.stopPropagation(); confirmMobile(t('adminWarrantyList.doneConfirm'), () => handleTraHang(w.id)); }}>{t('adminWarrantyList.doneShort')}</MobileButton>
                    <MobileButton size="mini" color={w.uuTien ? 'danger' : 'default'} onClick={(event) => { event.stopPropagation(); handlePriority(w.id, w.uuTien); }}>
                      {w.uuTien ? t('adminWarrantyList.unmarkPriority') : t('adminDashboard.priority')}
                    </MobileButton>
                  </>
                )}
                <MobileButton size="mini" color="danger" fill="outline" onClick={(event) => { event.stopPropagation(); confirmMobile(t('adminWarrantyList.deleteConfirm'), () => handleDelete(w.id)); }}>{t('button.xoa')}</MobileButton>
              </MobileSpace>
            </MobileCard>
          );
        })}
      </div>

      <MobileCard className="admin-mobile-card">
        <MobileSpace block justify="between" align="center">
          <MobileButton disabled={data.page <= 1} onClick={() => handlePageChange(data.page - 1, data.limit)}>{t('adminWarrantyList.prevPage')}</MobileButton>
          <span>{t('adminWarrantyList.page', { page: data.page })}</span>
          <MobileButton disabled={data.page * data.limit >= data.total} onClick={() => handlePageChange(data.page + 1, data.limit)}>{t('adminWarrantyList.nextPage')}</MobileButton>
        </MobileSpace>
      </MobileCard>

      {/* Bulk action bar mobile */}
      {selectedRowKeys.length > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200, background: 'var(--ant-color-bg-container)', padding: '12px 16px', boxShadow: '0 -2px 12px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Đã chọn {selectedRowKeys.length} phiếu</span>
          <MobileSpace>
            <MobileButton size="small" color="primary" onClick={() => confirmMobile(t('adminWarrantyList.bulkDoneConfirm', { count: selectedRowKeys.length }), handleBulkTraHang)}>Xong hết</MobileButton>
            <MobileButton size="small" onClick={handleExport}><DownloadOutlined /></MobileButton>
            <MobileButton size="small" onClick={() => setSelectedRowKeys([])}>Bỏ chọn</MobileButton>
          </MobileSpace>
        </div>
      )}
    </div>}

    {!isMobile && <div className="desktop-only admin-warranty-list-desktop" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder={t('adminWarrantyList.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 200 }}
          allowClear
        />
        <Select
          placeholder={t('adminWarrantyList.statusPlaceholder')}
          value={trangThai || undefined}
          onChange={(v) => setTrangThai(v || "")}
          allowClear
          style={{ width: 140 }}
          options={Object.entries(STATUS).map(([k, v]) => ({ label: v.label, value: k }))}
        />
        <Select placeholder={t('adminWarrantyList.handlingTypeShort')} value={loaiXuLy || undefined} onChange={(v) => setLoaiXuLy(v || "")} allowClear style={{ width: 130 }} options={LOAI_XU_LY_OPTIONS} />
        <Select placeholder={t('adminWarrantyList.staffPlaceholder')} value={maNhanVien || undefined} onChange={(v) => setMaNhanVien(v || "")} allowClear style={{ width: 140 }} options={staffList.map(nv => ({ label: nv.tenNV, value: nv.maNV }))} />
        <RangePicker value={ngayNhanRange} onChange={setNgayNhanRange} />
        <Button onClick={() => {
          setSearch('');
          setTrangThai('');
          setLoaiXuLy('');
          setMaNhanVien('');
          setNgayNhanRange(null);
          setDueType('');
          setUuTienOnly(false);
          navigate('/admin/phieu', { replace: true });
        }}>{t('adminWarrantyList.clearFilters')}</Button>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>Export</Button>
      </Space>

      <div className="admin-warranty-table-frame">
        <Table
          className="admin-warranty-table"
          columns={columns}
          dataSource={data.rows}
          rowKey="id"
          loading={loading}
          tableLayout="fixed"
          rowClassName={r => `row-${getUrgency(r)}`}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          onChange={handleTableChange}
          onRow={(record) => ({
            onClick: () => handleOpenDetail(record.id),
            style: { cursor: 'pointer' },
          })}
          pagination={{
            current: data.page,
            pageSize: data.limit,
            total: data.total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '25', '50', '100'],
            showTotal: (total) => t('adminWarrantyList.totalTickets', { total }),
            showQuickJumper: true,
            onChange: handlePageChange,
          }}
        />
      </div>

      {selectedRowKeys.length > 0 && (
        <Affix offsetBottom={0}>
          <div style={{ background: '#fff', padding: '12px 24px', boxShadow: '0 -2px 8px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <strong>{t('adminWarrantyList.selectedTickets', { count: selectedRowKeys.length })}</strong>
            <Space>
              <Popconfirm title={t('adminWarrantyList.bulkDoneConfirm', { count: selectedRowKeys.length })} onConfirm={handleBulkTraHang}>
                <Button type="primary" icon={<CheckCircleOutlined />}>{t('adminWarrantyList.bulkDoneButton')}</Button>
              </Popconfirm>
              <Button icon={<DownloadOutlined />} onClick={handleExport}>Export</Button>
              <Button onClick={() => setSelectedRowKeys([])}>{t('adminWarrantyList.clearSelection')}</Button>
            </Space>
          </div>
        </Affix>
      )}
    </div>}
    <WarrantyDetail open={detailOpen} onClose={() => setDetailOpen(false)} warrantyId={detailId} onRefresh={fetchData} />
    </>
  );
}

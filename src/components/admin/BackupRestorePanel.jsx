import { useEffect, useState } from 'react';
import { Alert, App, Button, Card, Col, Descriptions, Input, Row, Space, Table, Tag, Tooltip, Upload } from 'antd';
import { CloudDownloadOutlined, DeleteOutlined, EyeOutlined, FileImageOutlined, PushpinOutlined, ReloadOutlined, RollbackOutlined, SafetyOutlined, UploadOutlined } from '@ant-design/icons';
import { backupService } from '../../services/backupService';
import { getStatusBadgeColor } from '../../constants/badgeConfig';

const fmtSize = n => {
  if (!n) return '0 KB';
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024).toFixed(1)} KB`;
};
const fmtTime = s => s ? new Date(s).toLocaleString('vi-VN') : '-';
const warrantyStatusMap = {
  da_nhan: { label: 'Đã nhận' },
  dang_xu_ly: { label: 'Đang xử lý' },
  cho_xu_ly: { label: 'Chờ xử lý' },
  cho_lien_he: { label: 'Chờ liên hệ' },
  da_tra: { label: 'Đã trả' },
  huy: { label: 'Hủy' },
};
const renderWarrantyStatus = (status) => {
  const item = warrantyStatusMap[status] || { label: status || '-' };
  return <Tag color={getStatusBadgeColor(status)}>{item.label}</Tag>;
};

export default function BackupRestorePanel() {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [backups, setBackups] = useState([]);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [st, list, hist] = await Promise.all([backupService.status(), backupService.list(), backupService.history(200)]);
      setStatus(st.data.data);
      setBackups(list.data.data);
      setHistory(hist.data.data);
    } catch (err) {
      message.error(err.response?.data?.message || 'Không tải được dữ liệu backup');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const createBackup = async () => {
    setLoading(true);
    try {
      await backupService.create();
      message.success('Đã tạo backup thủ công');
      await loadAll();
    } catch (err) {
      message.error(err.response?.data?.message || 'Tạo backup thất bại');
    } finally {
      setLoading(false);
    }
  };

  const confirmRestore = (relativePath) => {
    let value = '';
    modal.confirm({
      title: 'Khôi phục dữ liệu?',
      content: <Space direction="vertical" style={{ width: '100%' }}>
        <Alert type="warning" showIcon message="Dữ liệu hiện tại sẽ được sao lưu vào restore-safety trước khi thay thế." />
        <div>Nhập <b>RESTORE</b> để xác nhận:</div>
        <Input onChange={e => { value = e.target.value; }} placeholder="RESTORE" />
      </Space>,
      okText: 'Khôi phục',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        if (value !== 'RESTORE') throw new Error('Cần nhập RESTORE');
        await backupService.restore(relativePath);
        message.success('Khôi phục thành công');
        await loadAll();
      },
    });
  };

  const uploadRestore = async (file) => {
    let value = '';
    modal.confirm({
      title: 'Upload và khôi phục dữ liệu?',
      content: <Space direction="vertical" style={{ width: '100%' }}>
        <Alert type="warning" showIcon message="File JSON sẽ thay thế dữ liệu hiện tại. Hệ thống tự tạo restore-safety trước." />
        <div>File: <b>{file.name}</b></div>
        <div>Nhập <b>RESTORE</b> để xác nhận:</div>
        <Input onChange={e => { value = e.target.value; }} placeholder="RESTORE" />
      </Space>,
      okText: 'Upload và khôi phục',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        if (value !== 'RESTORE') throw new Error('Cần nhập RESTORE');
        const text = await file.text();
        const data = JSON.parse(text);
        await backupService.uploadRestore(file.name, data);
        message.success('Upload và khôi phục thành công');
        await loadAll();
      },
    });
    return false;
  };

  const uploadAssets = async (file) => {
    let value = '';
    modal.confirm({
      title: 'Upload gói ảnh backup?',
      content: <Space direction="vertical" style={{ width: '100%' }}>
        <Alert type="warning" showIcon message="Gói ảnh chỉ khôi phục file trong /uploads/warranties, không thay thế dữ liệu phiếu." />
        <div>File: <b>{file.name}</b></div>
        <div>Nhập <b>RESTORE</b> để xác nhận:</div>
        <Input onChange={e => { value = e.target.value; }} placeholder="RESTORE" />
      </Space>,
      okText: 'Upload gói ảnh',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        if (value !== 'RESTORE') throw new Error('Cần nhập RESTORE');
        await backupService.uploadAssets(file.name, file);
        message.success('Đã khôi phục gói ảnh');
        await loadAll();
      },
    });
    return false;
  };

  const deleteBackup = async (relativePath) => {
    modal.confirm({
      title: 'Xóa backup?',
      content: relativePath,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        await backupService.delete(relativePath);
        message.success('Đã xóa backup');
        await loadAll();
      },
    });
  };

  const viewBackup = async (relativePath) => {
    try {
      const res = await backupService.view(relativePath, 20);
      const data = res.data.data;
      modal.info({
        title: `Xem backup: ${relativePath}`,
        width: 900,
        content: <Space direction="vertical" style={{ width: '100%' }}>
          <Descriptions size="small" bordered column={2}>
            <Descriptions.Item label="Phiếu bảo hành">{data.summary.warranties}</Descriptions.Item>
            <Descriptions.Item label="Khách hàng">{data.summary.customers}</Descriptions.Item>
            <Descriptions.Item label="Nhà cung cấp">{data.summary.suppliers}</Descriptions.Item>
            <Descriptions.Item label="Nhân viên">{data.summary.nhanVien}</Descriptions.Item>
            <Descriptions.Item label="Gói ảnh">{data.summary.assets?.exists ? `${data.summary.assets.count ?? '-'} file - ${fmtSize(data.summary.assets.size)}` : 'Không có'}</Descriptions.Item>
          </Descriptions>
          <b>Phiếu bảo hành mới nhất</b>
          <Table size="small" rowKey={(r) => r.id || r.soChungTu || `${r.khachHang || ''}-${r.soSeri || ''}`} dataSource={data.preview.warranties} pagination={false} scroll={{ x: 800, y: 220 }} columns={[
            { title: 'Số chứng từ', dataIndex: 'soChungTu', width: 140 },
            { title: 'Khách hàng', dataIndex: 'khachHang', width: 160 },
            { title: 'Tên hàng', dataIndex: 'tenHang', width: 220, ellipsis: true },
            { title: 'Serial', dataIndex: 'soSeri', width: 140 },
            { title: 'Trạng thái', dataIndex: 'trangThai', width: 130, render: renderWarrantyStatus },
          ]} />
          <b>Khách hàng</b>
          <Table size="small" rowKey={(r) => r.key || r.id || r.maKhachHang || `${r.khachHang || ''}-${r.soDienThoai || ''}`} dataSource={data.preview.customers} pagination={false} scroll={{ x: 780, y: 180 }} columns={[
            { title: 'Mã KH', dataIndex: 'maKhachHang', width: 100 },
            { title: 'Khách hàng', dataIndex: 'khachHang', width: 180 },
            { title: 'SĐT', dataIndex: 'soDienThoai', width: 140 },
            { title: 'Địa chỉ', dataIndex: 'diaChi', width: 220, ellipsis: true },
            { title: 'Số phiếu', dataIndex: 'totalWarranties', width: 100 },
          ]} />
          <b>Nhà cung cấp</b>
          <Table size="small" rowKey={(r) => r.id || r.code || r.name} dataSource={data.preview.suppliers} pagination={false} scroll={{ x: 700, y: 180 }} columns={[
            { title: 'Mã', dataIndex: 'code', width: 120 },
            { title: 'Tên NCC', dataIndex: 'name', width: 220 },
            { title: 'SĐT', dataIndex: 'phone', width: 140 },
            { title: 'Trạng thái', dataIndex: 'isActive', width: 110, render: v => v === false ? <Tag color="red">Tắt</Tag> : <Tag color="green">Hoạt động</Tag> },
          ]} />
          <b>Nhân viên</b>
          <Table size="small" rowKey={(r) => r.id || r.maNV || r.tenNV} dataSource={data.preview.nhanVien} pagination={false} scroll={{ x: 500, y: 180 }} columns={[
            { title: 'Mã NV', dataIndex: 'maNV', width: 120 },
            { title: 'Tên NV', dataIndex: 'tenNV', width: 220 },
            { title: 'Vai trò', dataIndex: 'role', width: 120 },
            { title: 'Hoạt động', dataIndex: 'active', width: 100, render: v => v === false ? 'Không' : 'Có' },
          ]} />
        </Space>,
      });
    } catch (err) {
      message.error(err.response?.data?.message || 'Không xem được backup');
    }
  };

  const editMetadata = (row) => {
    let pinned = !!row.pinned;
    let note = row.note || '';
    modal.confirm({
      title: 'Giữ lại / Ghi chú backup',
      content: <Space direction="vertical" style={{ width: '100%' }}>
        <Button icon={<PushpinOutlined />} onClick={() => { pinned = !pinned; message.info(pinned ? 'Sẽ giữ lại backup' : 'Sẽ bỏ giữ lại'); }}>
          Bấm để đổi trạng thái giữ lại hiện tại: {row.pinned ? 'Đang giữ lại' : 'Chưa giữ'}
        </Button>
        <Input.TextArea rows={3} defaultValue={note} placeholder="Ghi chú" onChange={e => { note = e.target.value; }} />
      </Space>,
      okText: 'Lưu',
      cancelText: 'Hủy',
      onOk: async () => {
        await backupService.metadata(row.relativePath, pinned, note);
        message.success('Đã lưu metadata backup');
        await loadAll();
      },
    });
  };

  const backupColumns = [
    { title: 'Loại', dataIndex: 'type', width: 120, render: v => <Tag color={v === 'manual' ? 'blue' : v === 'restore-safety' ? 'red' : v === 'monthly' ? 'purple' : 'green'}>{v}</Tag> },
    { title: 'File', dataIndex: 'filename', ellipsis: true, render: (_, r) => <Space direction="vertical" size={0}><span>{r.filename}</span>{r.pinned && <Tag color="gold">Giữ lại</Tag>}{r.note && <small>{r.note}</small>}</Space> },
    { title: 'Thời gian', dataIndex: 'createdAt', width: 170, render: fmtTime },
    { title: 'Dung lượng', dataIndex: 'size', width: 110, render: fmtSize },
    { title: 'Ảnh', width: 130, render: (_, r) => r.assets?.exists ? <Tag color="cyan">{r.assets.count ?? '?'} file · {fmtSize(r.assets.size)}</Tag> : <Tag>Không</Tag> },
    { title: 'SHA256', dataIndex: 'sha256', ellipsis: true, render: v => v ? <span title={v}>{v.slice(0, 12)}...</span> : '-' },
    { title: 'Hành động', width: 230, render: (_, r) => <Space size={6}>
      <Tooltip title="Xem backup"><Button size="small" shape="circle" icon={<EyeOutlined />} onClick={() => viewBackup(r.relativePath)} /></Tooltip>
      <Tooltip title="Tải backup"><Button size="small" shape="circle" href={backupService.downloadUrl(r.relativePath)} icon={<CloudDownloadOutlined />} /></Tooltip>
      {r.assets?.exists && <Tooltip title="Tải gói ảnh"><Button size="small" shape="circle" href={backupService.downloadAssetsUrl(r.relativePath)} icon={<FileImageOutlined />} /></Tooltip>}
      <Tooltip title="Giữ lại / Ghi chú"><Button size="small" shape="circle" icon={<PushpinOutlined />} onClick={() => editMetadata(r)} /></Tooltip>
      <Tooltip title="Khôi phục backup"><Button size="small" shape="circle" danger icon={<RollbackOutlined />} onClick={() => confirmRestore(r.relativePath)} /></Tooltip>
      {r.type !== 'restore-safety' && !r.pinned && <Tooltip title="Xóa backup"><Button size="small" shape="circle" danger icon={<DeleteOutlined />} onClick={() => deleteBackup(r.relativePath)} /></Tooltip>}
    </Space> },
  ];

  const historyColumns = [
    { title: 'Thời gian', dataIndex: 'createdAt', width: 170, render: fmtTime },
    { title: 'Hành động', dataIndex: 'action', width: 130 },
    { title: 'Loại', dataIndex: 'type', width: 110, render: v => v ? <Tag>{v}</Tag> : '-' },
    { title: 'Trạng thái', dataIndex: 'status', width: 110, render: v => <Tag color={v === 'success' ? 'success' : v === 'failed' ? 'error' : 'warning'}>{v}</Tag> },
    { title: 'Nguồn/Safety', render: (_, r) => r.sourcePath || r.relativePath || r.safetyBackupPath || r.deletedPath || '-' },
    { title: 'Thông báo', dataIndex: 'message', ellipsis: true },
  ];

  return <Card title={<Space><SafetyOutlined /> Sao lưu / Khôi phục dữ liệu</Space>} style={{ marginTop: 16 }}>
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Alert type="info" showIcon message="Backup tự động lưu JSON nhẹ và gói ảnh .assets.tgz riêng. Khi restore backup trên máy khác, restore JSON trước rồi upload gói ảnh nếu cần." />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Descriptions bordered size="small" column={1} title="Trạng thái">
            <Descriptions.Item label="DB">{status?.dbPath || 'api/db.json'}</Descriptions.Item>
            <Descriptions.Item label="Dung lượng">{fmtSize(status?.dbSize)}</Descriptions.Item>
            <Descriptions.Item label="Cập nhật DB">{fmtTime(status?.dbUpdatedAt)}</Descriptions.Item>
            <Descriptions.Item label="Backup mới nhất">{status?.latestBackup?.relativePath || '-'}</Descriptions.Item>
            <Descriptions.Item label="Tự động">{status?.scheduler?.enabled ? <Tag color="success">Đang chạy</Tag> : <Tag>Chưa chạy</Tag>}</Descriptions.Item>
          </Descriptions>
        </Col>
        <Col xs={24} lg={12}>
          <Space wrap>
            <Button type="primary" icon={<SafetyOutlined />} loading={loading} onClick={createBackup}>Tạo backup ngay</Button>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={loadAll}>Tải lại</Button>
            <Upload accept=".json,application/json" showUploadList={false} beforeUpload={uploadRestore}>
              <Button danger icon={<UploadOutlined />}>Upload backup để restore</Button>
            </Upload>
            <Upload accept=".tgz,.assets.tgz,application/gzip,application/x-gzip" showUploadList={false} beforeUpload={uploadAssets}>
              <Button danger icon={<FileImageOutlined />}>Upload gói ảnh</Button>
            </Upload>
          </Space>
        </Col>
      </Row>

      <Table title={() => 'Danh sách backup'} rowKey="relativePath" loading={loading} dataSource={backups} columns={backupColumns} size="small" scroll={{ x: 1120, y: 420 }} pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100], showTotal: total => `Tổng ${total} backup` }} />
      <Table title={() => 'Lịch sử backup/restore'} rowKey="id" loading={loading} dataSource={history} columns={historyColumns} size="small" scroll={{ x: 900 }} pagination={{ pageSize: 10 }} />
    </Space>
  </Card>;
}

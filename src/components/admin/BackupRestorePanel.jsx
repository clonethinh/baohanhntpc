import { useEffect, useState } from 'react';
import { Alert, App, Button, Card, Col, Descriptions, Input, Row, Space, Table, Tag, Tooltip, Upload } from 'antd';
import { CloudDownloadOutlined, DeleteOutlined, EyeOutlined, FileImageOutlined, PushpinOutlined, ReloadOutlined, RollbackOutlined, SafetyOutlined, UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      message.error(err.response?.data?.message || t('backup.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const createBackup = async () => {
    setLoading(true);
    try {
      await backupService.create();
      message.success(t('backup.createSuccess'));
      await loadAll();
    } catch (err) {
      message.error(err.response?.data?.message || t('backup.createError'));
    } finally {
      setLoading(false);
    }
  };

  const confirmRestore = (relativePath) => {
    let value = '';
    modal.confirm({
      title: t('backup.restoreTitle'),
      content: <Space direction="vertical" style={{ width: '100%' }}>
        <Alert type="warning" showIcon message={t('backup.restoreWarning')} />
        <div>{t('backup.enterRestorePrefix')} <b>RESTORE</b> {t('backup.enterRestoreSuffix')}</div>
        <Input onChange={e => { value = e.target.value; }} placeholder="RESTORE" />
      </Space>,
      okText: t('backup.restoreOk'),
      okType: 'danger',
      cancelText: t('button.huy'),
      onOk: async () => {
        if (value !== 'RESTORE') throw new Error(t('backup.needRestore'));
        await backupService.restore(relativePath);
        message.success(t('backup.restoreSuccess'));
        await loadAll();
      },
    });
  };

  const uploadRestore = async (file) => {
    let value = '';
    modal.confirm({
      title: t('backup.uploadRestoreTitle'),
      content: <Space direction="vertical" style={{ width: '100%' }}>
        <Alert type="warning" showIcon message={t('backup.uploadRestoreWarning')} />
        <div>{t('backup.fileLabel')} <b>{file.name}</b></div>
        <div>{t('backup.enterRestorePrefix')} <b>RESTORE</b> {t('backup.enterRestoreSuffix')}</div>
        <Input onChange={e => { value = e.target.value; }} placeholder="RESTORE" />
      </Space>,
      okText: t('backup.uploadRestoreOk'),
      okType: 'danger',
      cancelText: t('button.huy'),
      onOk: async () => {
        if (value !== 'RESTORE') throw new Error(t('backup.needRestore'));
        const text = await file.text();
        const data = JSON.parse(text);
        await backupService.uploadRestore(file.name, data);
        message.success(t('backup.uploadRestoreSuccess'));
        await loadAll();
      },
    });
    return false;
  };

  const uploadAssets = async (file) => {
    let value = '';
    modal.confirm({
      title: t('backup.uploadAssetsTitle'),
      content: <Space direction="vertical" style={{ width: '100%' }}>
        <Alert type="warning" showIcon message={t('backup.uploadAssetsWarning')} />
        <div>{t('backup.fileLabel')} <b>{file.name}</b></div>
        <div>{t('backup.enterRestorePrefix')} <b>RESTORE</b> {t('backup.enterRestoreSuffix')}</div>
        <Input onChange={e => { value = e.target.value; }} placeholder="RESTORE" />
      </Space>,
      okText: t('backup.uploadAssetsOk'),
      okType: 'danger',
      cancelText: t('button.huy'),
      onOk: async () => {
        if (value !== 'RESTORE') throw new Error(t('backup.needRestore'));
        await backupService.uploadAssets(file.name, file);
        message.success(t('backup.uploadAssetsSuccess'));
        await loadAll();
      },
    });
    return false;
  };

  const deleteBackup = async (relativePath) => {
    modal.confirm({
      title: t('backup.deleteTitle'),
      content: relativePath,
      okText: t('button.xoa'),
      okType: 'danger',
      cancelText: t('button.huy'),
      onOk: async () => {
        await backupService.delete(relativePath);
        message.success(t('backup.deleteSuccess'));
        await loadAll();
      },
    });
  };

  const viewBackup = async (relativePath) => {
    try {
      const res = await backupService.view(relativePath, 20);
      const data = res.data.data;
      modal.info({
        title: t('backup.viewTitle', { path: relativePath }),
        width: 900,
        content: <Space direction="vertical" style={{ width: '100%' }}>
          <Descriptions size="small" bordered column={2}>
            <Descriptions.Item label={t('backup.warranties')}>{data.summary.warranties}</Descriptions.Item>
            <Descriptions.Item label={t('field.khachHang')}>{data.summary.customers}</Descriptions.Item>
            <Descriptions.Item label={t('field.nhaCungCap')}>{data.summary.suppliers}</Descriptions.Item>
            <Descriptions.Item label={t('field.nhanVien')}>{data.summary.nhanVien}</Descriptions.Item>
            <Descriptions.Item label={t('backup.assets')}>{data.summary.assets?.exists ? `${data.summary.assets.count ?? '-'} file - ${fmtSize(data.summary.assets.size)}` : t('backup.none')}</Descriptions.Item>
          </Descriptions>
          <b>{t('backup.latestWarranties')}</b>
          <Table size="small" rowKey={(r) => r.id || r.soChungTu || `${r.khachHang || ''}-${r.soSeri || ''}`} dataSource={data.preview.warranties} pagination={false} scroll={{ x: 800, y: 220 }} columns={[
            { title: t('field.soChungTu'), dataIndex: 'soChungTu', width: 140 },
            { title: t('field.khachHang'), dataIndex: 'khachHang', width: 160 },
            { title: t('field.tenHang'), dataIndex: 'tenHang', width: 220, ellipsis: true },
            { title: t('field.serial'), dataIndex: 'soSeri', width: 140 },
            { title: t('field.trangThai'), dataIndex: 'trangThai', width: 130, render: renderWarrantyStatus },
          ]} />
          <b>{t('field.khachHang')}</b>
          <Table size="small" rowKey={(r) => r.key || r.id || r.maKhachHang || `${r.khachHang || ''}-${r.soDienThoai || ''}`} dataSource={data.preview.customers} pagination={false} scroll={{ x: 780, y: 180 }} columns={[
            { title: t('backup.maKH'), dataIndex: 'maKhachHang', width: 100 },
            { title: t('field.khachHang'), dataIndex: 'khachHang', width: 180 },
            { title: t('field.sdt'), dataIndex: 'soDienThoai', width: 140 },
            { title: t('field.diaChi'), dataIndex: 'diaChi', width: 220, ellipsis: true },
            { title: t('backup.soPhieu'), dataIndex: 'totalWarranties', width: 100 },
          ]} />
          <b>{t('field.nhaCungCap')}</b>
          <Table size="small" rowKey={(r) => r.id || r.code || r.name} dataSource={data.preview.suppliers} pagination={false} scroll={{ x: 700, y: 180 }} columns={[
            { title: t('backup.ma'), dataIndex: 'code', width: 120 },
            { title: t('backup.tenNCC'), dataIndex: 'name', width: 220 },
            { title: t('field.sdt'), dataIndex: 'phone', width: 140 },
            { title: t('field.trangThai'), dataIndex: 'isActive', width: 110, render: v => v === false ? <Tag color="red">{t('backup.tat')}</Tag> : <Tag color="green">{t('backup.hoatDong')}</Tag> },
          ]} />
          <b>{t('field.nhanVien')}</b>
          <Table size="small" rowKey={(r) => r.id || r.maNV || r.tenNV} dataSource={data.preview.nhanVien} pagination={false} scroll={{ x: 500, y: 180 }} columns={[
            { title: t('backup.maNV'), dataIndex: 'maNV', width: 120 },
            { title: t('backup.tenNV'), dataIndex: 'tenNV', width: 220 },
            { title: t('backup.vaiTro'), dataIndex: 'role', width: 120 },
            { title: t('backup.hoatDongCol'), dataIndex: 'active', width: 100, render: v => v === false ? t('backup.khong') : t('backup.co') },
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
      title: t('backup.metadataTitle'),
      content: <Space direction="vertical" style={{ width: '100%' }}>
        <Button icon={<PushpinOutlined />} onClick={() => { pinned = !pinned; message.info(pinned ? t('backup.willPin') : t('backup.willUnpin')); }}>
          {t('backup.togglePinPrefix')} {row.pinned ? t('backup.pinned') : t('backup.notPinned')}
        </Button>
        <Input.TextArea rows={3} defaultValue={note} placeholder={t('field.ghiChu')} onChange={e => { note = e.target.value; }} />
      </Space>,
      okText: t('button.luu'),
      cancelText: t('button.huy'),
      onOk: async () => {
        await backupService.metadata(row.relativePath, pinned, note);
        message.success(t('backup.metadataSuccess'));
        await loadAll();
      },
    });
  };

  const backupColumns = [
    { title: t('backup.colType'), dataIndex: 'type', width: 120, render: v => <Tag color={v === 'manual' ? 'blue' : v === 'restore-safety' ? 'red' : v === 'monthly' ? 'purple' : 'green'}>{v}</Tag> },
    { title: t('backup.colFile'), dataIndex: 'filename', ellipsis: true, render: (_, r) => <Space direction="vertical" size={0}><span>{r.filename}</span>{r.pinned && <Tag color="gold">{t('backup.pinnedTag')}</Tag>}{r.note && <small>{r.note}</small>}</Space> },
    { title: t('backup.colTime'), dataIndex: 'createdAt', width: 170, render: fmtTime },
    { title: t('backup.colSize'), dataIndex: 'size', width: 110, render: fmtSize },
    { title: t('backup.colImage'), width: 130, render: (_, r) => r.assets?.exists ? <Tag color="cyan">{r.assets.count ?? '?'} file · {fmtSize(r.assets.size)}</Tag> : <Tag>{t('backup.none')}</Tag> },
    { title: t('backup.colSha'), dataIndex: 'sha256', ellipsis: true, render: v => v ? <span title={v}>{v.slice(0, 12)}...</span> : '-' },
    { title: t('backup.colAction'), width: 230, render: (_, r) => <Space size={6}>
      <Tooltip title={t('backup.viewBackup')}><Button size="small" shape="circle" icon={<EyeOutlined />} onClick={() => viewBackup(r.relativePath)} /></Tooltip>
      <Tooltip title={t('backup.downloadBackup')}><Button size="small" shape="circle" href={backupService.downloadUrl(r.relativePath)} icon={<CloudDownloadOutlined />} /></Tooltip>
      {r.assets?.exists && <Tooltip title={t('backup.downloadAssets')}><Button size="small" shape="circle" href={backupService.downloadAssetsUrl(r.relativePath)} icon={<FileImageOutlined />} /></Tooltip>}
      <Tooltip title={t('backup.pinNote')}><Button size="small" shape="circle" icon={<PushpinOutlined />} onClick={() => editMetadata(r)} /></Tooltip>
      <Tooltip title={t('backup.restoreBackup')}><Button size="small" shape="circle" danger icon={<RollbackOutlined />} onClick={() => confirmRestore(r.relativePath)} /></Tooltip>
      {r.type !== 'restore-safety' && !r.pinned && <Tooltip title={t('backup.deleteBackup')}><Button size="small" shape="circle" danger icon={<DeleteOutlined />} onClick={() => deleteBackup(r.relativePath)} /></Tooltip>}
    </Space> },
  ];

  const historyColumns = [
    { title: t('backup.colTime'), dataIndex: 'createdAt', width: 170, render: fmtTime },
    { title: t('backup.colAction'), dataIndex: 'action', width: 130 },
    { title: t('backup.colType'), dataIndex: 'type', width: 110, render: v => v ? <Tag>{v}</Tag> : '-' },
    { title: t('field.trangThai'), dataIndex: 'status', width: 110, render: v => <Tag color={v === 'success' ? 'success' : v === 'failed' ? 'error' : 'warning'}>{v}</Tag> },
    { title: t('backup.colSource'), render: (_, r) => r.sourcePath || r.relativePath || r.safetyBackupPath || r.deletedPath || '-' },
    { title: t('backup.colMessage'), dataIndex: 'message', ellipsis: true },
  ];

  return <Card title={<Space><SafetyOutlined /> {t('backup.cardTitle')}</Space>} style={{ marginTop: 16 }}>
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Alert type="info" showIcon message={t('backup.infoBanner')} />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Descriptions bordered size="small" column={1} title={t('backup.statusTitle')}>
            <Descriptions.Item label="DB">{status?.dbPath || 'api/db.json'}</Descriptions.Item>
            <Descriptions.Item label={t('backup.colSize')}>{fmtSize(status?.dbSize)}</Descriptions.Item>
            <Descriptions.Item label={t('backup.dbUpdated')}>{fmtTime(status?.dbUpdatedAt)}</Descriptions.Item>
            <Descriptions.Item label={t('backup.latestBackup')}>{status?.latestBackup?.relativePath || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('backup.auto')}>{status?.scheduler?.enabled ? <Tag color="success">{t('backup.running')}</Tag> : <Tag>{t('backup.notRunning')}</Tag>}</Descriptions.Item>
          </Descriptions>
        </Col>
        <Col xs={24} lg={12}>
          <Space wrap>
            <Button type="primary" icon={<SafetyOutlined />} loading={loading} onClick={createBackup}>{t('backup.createNow')}</Button>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={loadAll}>{t('button.taiLai')}</Button>
            <Upload accept=".json,application/json" showUploadList={false} beforeUpload={uploadRestore}>
              <Button danger icon={<UploadOutlined />}>{t('backup.uploadToRestore')}</Button>
            </Upload>
            <Upload accept=".tgz,.assets.tgz,application/gzip,application/x-gzip" showUploadList={false} beforeUpload={uploadAssets}>
              <Button danger icon={<FileImageOutlined />}>{t('backup.uploadAssetsBtn')}</Button>
            </Upload>
          </Space>
        </Col>
      </Row>

      <Table title={() => t('backup.backupList')} rowKey="relativePath" loading={loading} dataSource={backups} columns={backupColumns} size="small" scroll={{ x: 1120, y: 420 }} pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100], showTotal: total => t('backup.totalBackup', { total }) }} />
      <Table title={() => t('backup.historyList')} rowKey="id" loading={loading} dataSource={history} columns={historyColumns} size="small" scroll={{ x: 900 }} pagination={{ pageSize: 10 }} />
    </Space>
  </Card>;
}

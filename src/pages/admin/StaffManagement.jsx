import { useEffect, useState } from 'react';
import { App, Card, Typography, Form, Input, Button, Space, Table, Popconfirm, Skeleton, Tag, Modal, Select, Avatar } from 'antd';
import {
  TeamOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  PlusOutlined,
  KeyOutlined,
  DeleteOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { authService, nhanVienService } from '../../services/warrantyService';

const { Title } = Typography;

export default function StaffManagement() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [staffs, setStaffs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [addForm] = Form.useForm();
  const [pwdForm] = Form.useForm();
  const [resetForm] = Form.useForm();

  const loadStaff = async () => {
    setLoading(true);
    try {
      const res = await nhanVienService.getList();
      if (res.data.success) setStaffs(res.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleAdd = async (values) => {
    try {
      const res = await nhanVienService.create(values);
      if (res.data.success) {
        message.success(t('adminStaff.addSuccess'));
        addForm.resetFields();
        loadStaff();
      }
    } catch (err) {
      message.error(err?.response?.data?.error?.message || t('adminStaff.addError'));
    }
  };

  const handleDelete = async (maNV) => {
    try {
      const res = await nhanVienService.remove(maNV);
      if (res.data.success) {
        const key = `delete-staff-${maNV}-${Date.now()}`;
        message.success({
          content: (
            <span>
              {t('adminStaff.deleteSuccess')}{' '}
              <Button
                type="link"
                size="small"
                style={{ padding: 0, height: 'auto', fontWeight: 600 }}
                onClick={async () => {
                  message.destroy(key);
                  try {
                    await nhanVienService.restore(maNV);
                    message.success(t('adminStaff.restoreSuccess'));
                    loadStaff();
                  } catch (err) {
                    message.error(err?.response?.data?.error?.message || t('adminStaff.restoreError'));
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
        loadStaff();
      }
    } catch (err) {
      message.error(err?.response?.data?.error?.message || t('adminStaff.deleteError'));
    }
  };

  const handleChangePassword = async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error(t('adminStaff.passwordMismatch'));
      return;
    }
    try {
      const res = await authService.changePassword(values.currentPassword, values.newPassword);
      if (res.data.success) {
        message.success(t('adminStaff.passwordSuccess'));
        pwdForm.resetFields();
      }
    } catch (err) {
      message.error(err?.response?.data?.error?.message || t('adminStaff.passwordError'));
    }
  };

  const handleResetPassword = async (values) => {
    if (!resetTarget) return;
    if (values.newPassword !== values.confirmPassword) {
      message.error(t('adminStaff.passwordMismatch'));
      return;
    }
    try {
      const res = await nhanVienService.resetPassword(resetTarget.maNV, values.newPassword);
      if (res.data.success) {
        message.success(t('adminStaff.resetPasswordSuccess'));
        resetForm.resetFields();
        setResetTarget(null);
        loadStaff();
      }
    } catch (err) {
      message.error(err?.response?.data?.error?.message || t('adminStaff.resetPasswordError'));
    }
  };

  const totalStaff = staffs.length;
  const adminCount = staffs.filter((s) => s.role === 'admin').length;
  const staffCount = totalStaff - adminCount;

  const roleTag = (role) => (
    role === 'admin'
      ? <Tag color="geekblue" icon={<SafetyCertificateOutlined />}>{t('adminStaff.roleAdmin')}</Tag>
      : <Tag color="green" icon={<UserOutlined />}>{t('adminStaff.roleStaff')}</Tag>
  );

  const rowActions = (row) => (
    <Space>
      {row.role !== 'admin' && (
        <Button size="small" icon={<KeyOutlined />} onClick={() => setResetTarget(row)}>
          {t('adminStaff.resetPassword')}
        </Button>
      )}
      <Popconfirm title={t('adminStaff.deleteConfirm', { code: row.maNV })} onConfirm={() => handleDelete(row.maNV)}>
        <Button danger size="small" icon={<DeleteOutlined />}>{t('button.xoa')}</Button>
      </Popconfirm>
    </Space>
  );

  const roleOptions = [
    { value: 'staff', label: t('adminStaff.roleStaff') },
    { value: 'admin', label: t('adminStaff.roleAdmin') },
  ];

  return (
    <div className="staff-page">
      <div className="staff-kpi-strip">
        <div className="staff-kpi">
          <span className="staff-kpi-icon total"><TeamOutlined /></span>
          <div className="staff-kpi-body">
            <span className="staff-kpi-label">{t('adminStaff.summaryTotal')}</span>
            <b className="staff-kpi-value">{totalStaff}</b>
          </div>
        </div>
        <div className="staff-kpi">
          <span className="staff-kpi-icon admin"><SafetyCertificateOutlined /></span>
          <div className="staff-kpi-body">
            <span className="staff-kpi-label">{t('adminStaff.summaryAdmin')}</span>
            <b className="staff-kpi-value">{adminCount}</b>
          </div>
        </div>
        <div className="staff-kpi">
          <span className="staff-kpi-icon staff"><UserOutlined /></span>
          <div className="staff-kpi-body">
            <span className="staff-kpi-label">{t('adminStaff.summaryStaff')}</span>
            <b className="staff-kpi-value">{staffCount}</b>
          </div>
        </div>
      </div>

      <Card className="staff-card" title={<Space><PlusOutlined />{t('adminStaff.addStaff')}</Space>}>
        <Form form={addForm} layout="vertical" onFinish={handleAdd} className="staff-add-form">
          <div className="staff-add-grid">
            <Form.Item name="maNV" label={t('adminStaff.staffCode')} rules={[{ required: true, message: t('adminStaff.staffCodeRequired') }]}>
              <Input placeholder={t('adminStaff.staffCodePlaceholder')} />
            </Form.Item>
            <Form.Item name="tenNV" label={t('adminStaff.staffName')} rules={[{ required: true, message: t('adminStaff.staffNameRequired') }]}>
              <Input placeholder={t('adminStaff.staffNamePlaceholder')} />
            </Form.Item>
            <Form.Item name="matKhau" label={t('adminStaff.password')} rules={[{ required: true, message: t('adminStaff.passwordRequired') }, { min: 8, message: t('adminStaff.minPassword') }]}>
              <Input.Password placeholder={t('adminStaff.password')} autoComplete="new-password" />
            </Form.Item>
            <Form.Item name="role" label={t('adminStaff.role')} initialValue="staff">
              <Select options={roleOptions} placeholder={t('adminStaff.rolePlaceholder')} />
            </Form.Item>
          </div>
          <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>{t('adminStaff.add')}</Button>
        </Form>
      </Card>

      <Card className="staff-card" title={<Space><TeamOutlined />{t('adminStaff.staffList')}</Space>}>
        <div className="desktop-only">
          <Table
            rowKey="maNV"
            loading={loading}
            dataSource={staffs}
            pagination={false}
            locale={{ emptyText: t('adminStaff.emptyStaff') }}
            columns={[
              {
                title: t('adminStaff.staffName'),
                dataIndex: 'tenNV',
                render: (name, row) => (
                  <Space>
                    <Avatar style={{ backgroundColor: row.role === 'admin' ? '#3b5bdb' : '#2f9e44' }} icon={<UserOutlined />} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{name}</div>
                      <div style={{ fontSize: 12, color: '#8a948a' }}>{row.maNV}</div>
                    </div>
                  </Space>
                ),
              },
              { title: t('adminStaff.role'), dataIndex: 'role', width: 160, render: roleTag },
              { title: t('adminStaff.action'), width: 260, render: (_, row) => rowActions(row) },
            ]}
          />
        </div>

        <div className="mobile-only staff-mobile-list">
          {staffs.length === 0 ? (
            <div className="staff-mobile-empty">{t('adminStaff.emptyStaff')}</div>
          ) : staffs.map((row) => (
            <div key={row.maNV} className="staff-mobile-card">
              <div className="staff-mobile-top">
                <Avatar size={40} style={{ backgroundColor: row.role === 'admin' ? '#3b5bdb' : '#2f9e44' }} icon={<UserOutlined />} />
                <div className="staff-mobile-info">
                  <b>{row.tenNV}</b>
                  <span>{row.maNV}</span>
                </div>
                {roleTag(row.role)}
              </div>
              <div className="staff-mobile-actions">{rowActions(row)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="staff-card" title={<Space><LockOutlined />{t('adminStaff.changeMyPassword')}</Space>}>
        <Form form={pwdForm} layout="vertical" onFinish={handleChangePassword} className="staff-pwd-form">
          <Form.Item label={t('adminStaff.currentPassword')} name="currentPassword" rules={[{ required: true, message: t('adminStaff.currentPasswordRequired') }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item label={t('adminStaff.newPassword')} name="newPassword" rules={[{ required: true, message: t('adminStaff.newPasswordRequired') }, { min: 8, message: t('adminStaff.minPassword') }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item label={t('adminStaff.confirmPassword')} name="confirmPassword" rules={[{ required: true, message: t('adminStaff.confirmPasswordRequired') }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<LockOutlined />}>{t('adminStaff.changePassword')}</Button>
        </Form>
      </Card>

      <Modal
        open={!!resetTarget}
        title={t('adminStaff.resetPasswordTitle', { maNV: resetTarget?.maNV || '' })}
        onCancel={() => {
          resetForm.resetFields();
          setResetTarget(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={resetForm} layout="vertical" onFinish={handleResetPassword}>
          <Form.Item name="newPassword" label={t('adminStaff.newPassword')} rules={[{ required: true, message: t('adminStaff.newPasswordRequired') }, { min: 8, message: t('adminStaff.minPassword') }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="confirmPassword" label={t('adminStaff.confirmPassword')} rules={[{ required: true, message: t('adminStaff.confirmPasswordRequired') }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block icon={<KeyOutlined />}>{t('adminStaff.resetPassword')}</Button>
        </Form>
      </Modal>
    </div>
  );
}

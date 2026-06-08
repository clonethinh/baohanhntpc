import { useEffect, useState } from 'react';
import { Card, Typography, Form, Input, Button, Space, Table, Popconfirm, message, Tag, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { authService, nhanVienService } from '../../services/warrantyService';

const { Title } = Typography;

export default function StaffManagement() {
  const { t } = useTranslation();
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
        message.success(t('adminStaff.deleteSuccess'));
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

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Title level={4}>Đổi mật khẩu tài khoản hiện tại</Title>
        <Form form={pwdForm} layout="vertical" onFinish={handleChangePassword}>
          <Form.Item label={t('adminStaff.currentPassword')} name="currentPassword" rules={[{ required: true, message: t('adminStaff.currentPasswordRequired') }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item label={t('adminStaff.newPassword')} name="newPassword" rules={[{ required: true, message: t('adminStaff.newPasswordRequired') }, { min: 8, message: t('adminStaff.minPassword') }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item label={t('adminStaff.confirmPassword')} name="confirmPassword" rules={[{ required: true, message: t('adminStaff.confirmPasswordRequired') }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit">{t('adminStaff.changePassword')}</Button>
        </Form>
      </Card>

      <Card>
        <Title level={4}>{t('adminStaff.addStaff')}</Title>
        <Form form={addForm} layout="inline" onFinish={handleAdd}>
          <Form.Item name="maNV" rules={[{ required: true, message: t('adminStaff.staffCodeRequired') }]}>
            <Input placeholder={t('adminStaff.staffCodePlaceholder')} />
          </Form.Item>
          <Form.Item name="tenNV" rules={[{ required: true, message: t('adminStaff.staffNameRequired') }]}>
            <Input placeholder={t('adminStaff.staffNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="matKhau" rules={[{ required: true, message: t('adminStaff.passwordRequired') }, { min: 8, message: t('adminStaff.minPassword') }]}>
            <Input.Password placeholder={t('adminStaff.password')} style={{ width: 160 }} autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="role" initialValue="staff">
            <Input placeholder="Role: staff/admin" style={{ width: 120 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">{t('adminStaff.add')}</Button>
          </Form.Item>
        </Form>
      </Card>

      <Card>
        <Title level={4}>{t('adminStaff.staffList')}</Title>
        <Table
          rowKey="maNV"
          loading={loading}
          dataSource={staffs}
          pagination={false}
          columns={[
            { title: t('adminStaff.staffCode'), dataIndex: 'maNV' },
            { title: t('adminStaff.staffName'), dataIndex: 'tenNV' },
            {
              title: 'Role',
              dataIndex: 'role',
              render: (role) => <Tag color={role === 'admin' ? 'geekblue' : 'default'}>{role}</Tag>,
            },
            {
              title: t('adminStaff.action'),
              render: (_, row) => (
                <Space>
                  {row.role !== 'admin' ? (
                    <Button size="small" onClick={() => setResetTarget(row)}>Đặt lại mật khẩu</Button>
                  ) : null}
                  <Popconfirm title={t('adminStaff.deleteConfirm', { code: row.maNV })} onConfirm={() => handleDelete(row.maNV)}>
                    <Button danger size="small">{t('button.xoa')}</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
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
          <Button type="primary" htmlType="submit" block>Đặt lại mật khẩu</Button>
        </Form>
      </Modal>
    </Space>
  );
}

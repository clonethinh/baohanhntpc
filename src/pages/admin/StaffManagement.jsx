import { useEffect, useState } from 'react';
import { Card, Typography, Form, Input, Button, Space, Table, Popconfirm, message, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { adminSecurityService, nhanVienService } from '../../services/warrantyService';

const { Title } = Typography;

export default function StaffManagement() {
  const { t } = useTranslation();
  const [staffs, setStaffs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addForm] = Form.useForm();
  const [pwdForm] = Form.useForm();

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
      const res = await adminSecurityService.changePassword(values.currentPassword, values.newPassword);
      if (res.data.success) {
        message.success(t('adminStaff.passwordSuccess'));
        pwdForm.resetFields();
      }
    } catch (err) {
      message.error(err?.response?.data?.error?.message || t('adminStaff.passwordError'));
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Title level={4}>{t('adminStaff.changeAdminPassword')}</Title>
        <Form form={pwdForm} layout="vertical" onFinish={handleChangePassword}>
          <Form.Item label={t('adminStaff.currentPassword')} name="currentPassword" rules={[{ required: true, message: t('adminStaff.currentPasswordRequired') }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item label={t('adminStaff.newPassword')} name="newPassword" rules={[{ required: true, message: t('adminStaff.newPasswordRequired') }, { min: 8, message: t('adminStaff.minPassword') }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item label={t('adminStaff.confirmPassword')} name="confirmPassword" rules={[{ required: true, message: t('adminStaff.confirmPasswordRequired') }]}>
            <Input.Password />
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
          <Form.Item name="role" initialValue="staff">
            <Input placeholder="Role: staff/admin" />
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
                <Popconfirm title={t('adminStaff.deleteConfirm', { code: row.maNV })} onConfirm={() => handleDelete(row.maNV)}>
                  <Button danger size="small">{t('button.xoa')}</Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}

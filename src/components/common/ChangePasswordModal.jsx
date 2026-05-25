import { Button, Form, Input, Modal, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { authService } from '../../services/warrantyService';

export default function ChangePasswordModal({ open, onClose }) {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  const handleFinish = async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error(t('adminStaff.passwordMismatch'));
      return;
    }

    try {
      const res = await authService.changePassword(values.currentPassword, values.newPassword);
      if (res.data?.success) {
        message.success(t('adminStaff.passwordSuccess'));
        form.resetFields();
        onClose?.();
      }
    } catch (err) {
      message.error(err?.response?.data?.error?.message || t('adminStaff.passwordError'));
    }
  };

  return (
    <Modal
      open={open}
      title="Đổi mật khẩu"
      onCancel={() => {
        form.resetFields();
        onClose?.();
      }}
      footer={null}
      width={420}
      destroyOnClose
      centered
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          label={t('adminStaff.currentPassword')}
          name="currentPassword"
          rules={[{ required: true, message: t('adminStaff.currentPasswordRequired') }]}
        >
          <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          label={t('adminStaff.newPassword')}
          name="newPassword"
          rules={[{ required: true, message: t('adminStaff.newPasswordRequired') }, { min: 8, message: t('adminStaff.minPassword') }]}
        >
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          label={t('adminStaff.confirmPassword')}
          name="confirmPassword"
          rules={[{ required: true, message: t('adminStaff.confirmPasswordRequired') }]}
        >
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block>
          {t('adminStaff.changePassword')}
        </Button>
      </Form>
    </Modal>
  );
}

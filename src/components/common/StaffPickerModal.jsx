import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Typography, Input, Form, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';

export default function StaffPickerModal({
  open,
  mode = 'initialPick',
  onClose,
  onPicked,
}) {
  const { t } = useTranslation();
  const { currentStaff, login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const isSwitchMode = mode === 'switchStaff';
  const shouldOpen = typeof open === 'boolean' ? open : !currentStaff;
  const hideWhenPicked = !isSwitchMode && !!currentStaff;

  useEffect(() => {
    if (shouldOpen) form.resetFields();
  }, [form, shouldOpen]);

  const title = useMemo(() => (
    isSwitchMode
      ? t('action.doiNhanVien', { defaultValue: 'Đổi nhân viên' })
      : t('staffPicker.title', { defaultValue: 'Đăng nhập nhân viên' })
  ), [isSwitchMode, t]);

  if (hideWhenPicked || !shouldOpen) return null;

  const handleFinish = async (values) => {
    setLoading(true);
    try {
      const staff = await login(values.maNV, values.matKhau);
      onPicked?.(staff);
      if (isSwitchMode) onClose?.();
    } catch (err) {
      message.error(err?.response?.data?.error?.message || t('adminStaff.loginError', { defaultValue: 'Mã nhân viên hoặc mật khẩu không đúng.' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={shouldOpen}
      title={title}
      closable={isSwitchMode}
      maskClosable={isSwitchMode}
      onCancel={isSwitchMode ? onClose : undefined}
      footer={null}
      width={420}
      centered
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: -4 }}>
        {t('staffPicker.subtitle', { defaultValue: 'Nhập mã nhân viên và mật khẩu để tiếp tục.' })}
      </Typography.Paragraph>
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          label={t('adminStaff.staffCode', { defaultValue: 'Mã nhân viên' })}
          name="maNV"
          rules={[{ required: true, message: t('adminStaff.staffCodeRequired', { defaultValue: 'Nhập mã nhân viên' }) }]}
        >
          <Input autoFocus autoComplete="username" />
        </Form.Item>
        <Form.Item
          label={t('adminStaff.password', { defaultValue: 'Mật khẩu' })}
          name="matKhau"
          rules={[{ required: true, message: t('adminStaff.passwordRequired', { defaultValue: 'Nhập mật khẩu' }) }]}
        >
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Button type="primary" block size="large" htmlType="submit" loading={loading}>
          {t('button.xacNhan')}
        </Button>
      </Form>
    </Modal>
  );
}

import { useState } from 'react';
import { Modal, Input, Typography, Button, Alert, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { adminSecurityService } from '../../services/warrantyService';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminPasswordModal() {
  const { t } = useTranslation();
  const { adminUnlocked, setAdminUnlocked } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUnlock = async () => {
    if (!password) {
      setError(t('adminPassword.required'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await adminSecurityService.verify(password);
      if (res.data.success) {
        setAdminUnlocked(true);
        setPassword('');
      }
    } catch {
      setError(t('adminPassword.invalid'));
    } finally {
      setLoading(false);
    }
  };

  if (adminUnlocked) return null;

  return (
    <Modal open closable={false} maskClosable={false} footer={null} width={420} centered>
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Typography.Title level={4} style={{ margin: 0 }}>{t('adminPassword.title')}</Typography.Title>
        <Typography.Text type="secondary">Nhập mật khẩu để truy cập</Typography.Text>
        <Input.Password
          value={password}
          onChange={e => {
            setPassword(e.target.value);
            setError('');
          }}
          onPressEnter={handleUnlock}
          placeholder={t('adminPassword.placeholder')}
        />
        {error && <Alert type="error" showIcon message={error} />}
        <Button type="primary" loading={loading} onClick={handleUnlock} block>
          {t('button.xacNhan')}
        </Button>
      </Space>
    </Modal>
  );
}

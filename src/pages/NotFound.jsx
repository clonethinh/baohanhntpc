import { Result, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <Result
      status="404"
      title="404"
      subTitle={t('notFound.title')}
      extra={[
        <Button type="primary" key="home" onClick={() => navigate('/')}>{t('button.veTrangChu')}</Button>,
        <Button key="admin" onClick={() => navigate('/admin')}>{t('button.vaoAdmin')}</Button>,
      ]}
    />
  );
}

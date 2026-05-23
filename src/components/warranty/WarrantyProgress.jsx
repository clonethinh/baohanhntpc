import { Progress } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

export default function WarrantyProgress({ baoHanh, ngayMua }) {
  const { t } = useTranslation('print');
  const match = baoHanh?.match(/(\d+)/);
  if (!match || !ngayMua) return null;

  const totalMonths = parseInt(match[1]);
  const start = dayjs(ngayMua);
  const now = dayjs();
  const elapsed = now.diff(start, 'month');
  const remaining = Math.max(0, totalMonths - elapsed);
  const pct = Math.min(100, Math.round((elapsed / totalMonths) * 100));

  return (
    <Progress
      percent={pct}
      format={() => t('progress', { remaining, total: totalMonths })}
      strokeColor={remaining <= 3 ? '#ff4d4f' : '#1677ff'}
    />
  );
}

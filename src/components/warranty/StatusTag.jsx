import { Tag } from 'antd';
import { STATUS } from '../../constants/statusConfig';

export default function StatusTag({ status }) {
  const config = STATUS[status] || STATUS.da_nhan;
  const Icon = config.icon;
  return (
    <Tag color={config.color} icon={<Icon />}>
      {config.label}
    </Tag>
  );
}

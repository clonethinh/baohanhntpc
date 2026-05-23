import { Tag as MobileTag } from 'antd-mobile';
import { STATUS, STATUS_LABELS } from '../../constants/statusConfig';
import { getStatusBadgeColor } from '../../constants/badgeConfig';

export default function MobileStatusTag({ status, children, ...props }) {
  const config = STATUS[status];
  const label = children || config?.label || STATUS_LABELS[status] || status || '-';
  const color = config?.mobileColor || getStatusBadgeColor(status, 'mobile');

  return (
    <MobileTag color={color} {...props}>
      {label}
    </MobileTag>
  );
}

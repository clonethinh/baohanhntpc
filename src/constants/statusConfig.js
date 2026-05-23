import { CheckCircleOutlined, CloseCircleOutlined, SyncOutlined } from '@ant-design/icons';
import i18n from '../i18n/index.js';
import { getStatusBadgeColor } from './badgeConfig.js';

const label = (key) => i18n.t(`status:trangThai.${key}`);

export const STATUS = {
  da_nhan: {
    label: label('da_nhan'),
    color: getStatusBadgeColor('da_nhan'),
    mobileColor: getStatusBadgeColor('da_nhan', 'mobile'),
    icon: CheckCircleOutlined,
    next: ['dang_xu_ly', 'huy'],
  },
  dang_xu_ly: {
    label: label('dang_xu_ly'),
    color: getStatusBadgeColor('dang_xu_ly'),
    mobileColor: getStatusBadgeColor('dang_xu_ly', 'mobile'),
    icon: SyncOutlined,
    next: ['da_tra', 'huy'],
  },
  da_tra: {
    label: label('da_tra'),
    color: getStatusBadgeColor('da_tra'),
    mobileColor: getStatusBadgeColor('da_tra', 'mobile'),
    icon: CheckCircleOutlined,
    next: [],
  },
  huy: {
    label: label('huy'),
    color: getStatusBadgeColor('huy'),
    mobileColor: getStatusBadgeColor('huy', 'mobile'),
    icon: CloseCircleOutlined,
    next: [],
  },
};

export const STATUS_LABELS = {
  da_nhan: label('da_nhan'),
  dang_xu_ly: label('dang_xu_ly'),
  da_tra: label('da_tra'),
  huy: label('huy'),
  cho_xu_ly: label('cho_xu_ly'),
  cho_lien_he: label('cho_lien_he'),
};

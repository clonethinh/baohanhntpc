export const BADGE_COLORS = {
  status: {
    da_nhan: { desktop: 'blue', mobile: 'primary' },
    cho_xu_ly: { desktop: 'blue', mobile: 'primary' },
    dang_xu_ly: { desktop: 'orange', mobile: 'warning' },
    cho_lien_he: { desktop: 'orange', mobile: 'warning' },
    da_tra: { desktop: 'green', mobile: 'success' },
    huy: { desktop: 'red', mobile: 'danger' },
  },
  priority: { desktop: 'red', mobile: 'danger' },
  overdue: { desktop: 'red', mobile: 'danger' },
  warning: { desktop: 'orange', mobile: 'warning' },
  info: { desktop: 'blue', mobile: 'primary' },
  success: { desktop: 'green', mobile: 'success' },
  error: { desktop: 'red', mobile: 'danger' },
  neutral: { desktop: 'default', mobile: 'default' },
};

export function getStatusBadgeColor(status, target = 'desktop') {
  return BADGE_COLORS.status[status]?.[target] || BADGE_COLORS.neutral[target];
}

export function getBadgeColor(type, target = 'desktop') {
  return BADGE_COLORS[type]?.[target] || BADGE_COLORS.neutral[target];
}

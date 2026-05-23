export function formatVND(amount) {
  if (!amount && amount !== 0) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

export function maskName(name) {
  if (!name || name.length <= 2) return name;
  const parts = name.split(' ');
  if (parts.length === 1) return parts[0][0] + '*'.repeat(parts[0].length - 1);
  const last = parts[parts.length - 1];
  return parts.slice(0, -1).join(' ') + ' ' + last[0] + '*';
}

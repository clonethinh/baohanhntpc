const legacy = (escaped) => JSON.parse(`"${escaped}"`);

const REPLACEMENTS = [
  [legacy('Import t\\u00e1\\u00bb\\u00ab Excel'), 'Import từ Excel'],
  ['Import t? Excel', 'Import từ Excel'],
  [legacy('Import t\\ufffd Excel'), 'Import từ Excel'],
  ['Xoa mem', 'Xóa mềm'],
  ['Xóa m?m', 'Xóa mềm'],
  [legacy('X\\u00c3\\u00b3a m\\u00e1\\u00bb\\u0081m'), 'Xóa mềm'],
  ['Ðánh d?u uu tiên', 'Đánh dấu ưu tiên'],
  ['Ðánh dấu uu tiên', 'Đánh dấu ưu tiên'],
  ['Dánh d?u uu tiên', 'Đánh dấu ưu tiên'],
  ['Danh dau uu tien', 'Đánh dấu ưu tiên'],
  ['B? uu tiên', 'Bỏ ưu tiên'],
  ['Bo uu tien', 'Bỏ ưu tiên'],
  ['Da gui bao hanh NCC:', 'Đã gửi bảo hành nhà cung cấp:'],
  ['Da nhan lai tu NCC:', 'Đã nhận lại từ nhà cung cấp:'],
  ['Da gui bao hanh nha cung cap:', 'Đã gửi bảo hành nhà cung cấp:'],
  ['Da nhan lai tu nha cung cap:', 'Đã nhận lại từ nhà cung cấp:'],
  ['Ðã g?i b?o hành nhà cung c?p:', 'Đã gửi bảo hành nhà cung cấp:'],
  ['Ðã nh?n l?i t? nhà cung c?p:', 'Đã nhận lại từ nhà cung cấp:'],
  [legacy('\\ufffd\\ufffd g?i b?o h\\ufffdnh nh\\ufffd cung c?p:'), 'Đã gửi bảo hành nhà cung cấp:'],
  [legacy('\\ufffd\\ufffd nh?n l?i t? nh\\ufffd cung c?p:'), 'Đã nhận lại từ nhà cung cấp:'],

  // dashboard/history common mojibake
  ['Th?m 1 ?nh ??nh k?m', 'Thêm 1 ảnh đính kèm'],
  ['Th?m', 'Thêm'],
  ['?nh', 'ảnh'],
  ['??nh k?m', 'đính kèm'],
];

export function normalizeVietnameseText(text) {
  if (!text) return '';
  return REPLACEMENTS.reduce((out, [oldText, newText]) => out.replaceAll(oldText, newText), String(text));
}

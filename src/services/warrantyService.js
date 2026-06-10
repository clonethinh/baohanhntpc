import api from '../lib/axios';

export const warrantyService = {
  getList: (params) => api.get('/warranties', { params }),
  getById: (id) => api.get(`/warranties/${id}`),
  getNextCode: () => api.get('/warranties/next-code'),
  create: (data) => api.post('/warranties', data),
  update: (id, data) => api.put(`/warranties/${id}`, data),
  transferCustomer: (id, customerKey) => api.patch(`/warranties/${id}/customer`, { customerKey }),
  updateStatus: (id, data) => api.patch(`/warranties/${id}/status`, data),
  traHang: (id, data) => api.patch(`/warranties/${id}/tra-hang`, data),
  exchangeReturn: (id, data) => api.patch(`/warranties/${id}/exchange-return`, data),
  logProgress: (id, note) => api.patch(`/warranties/${id}/log`, { note }),
  setPriority: (id, uuTien) => api.patch(`/warranties/${id}/priority`, { uuTien }),
  delete: (id) => api.delete(`/warranties/${id}`),
  importWarranties: (rows) => api.post('/warranties/import', { rows }),
  exportWarranties: (params) => api.get('/warranties/export', { params, responseType: 'blob' }),
  downloadTemplate: () => api.get('/warranties/template', { responseType: 'blob' }),
  getSupplierLogs: (id) => api.get(`/warranties/${id}/supplier-logs`),
  updateSupplierLogNote: (id, logId, data) => api.patch(`/warranties/${id}/supplier-logs/${logId}`, typeof data === 'string' ? { note: data } : data),
  deleteSupplierLog: (id, logId) => api.delete(`/warranties/${id}/supplier-logs/${logId}`),
  sendToSupplier: (id, data) => api.post(`/warranties/${id}/supplier-send`, data),
  returnFromSupplier: (id, data) => api.post(`/warranties/${id}/supplier-return`, data),
  addAttachments: (id, attachmentsInput) => api.post(`/warranties/${id}/attachments`, { attachmentsInput }),
  deleteAttachment: (id, attachmentId) => api.delete(`/warranties/${id}/attachments/${attachmentId}`),
  deleteHistory: (id, historyIndex) => api.delete(`/warranties/${id}/history/${historyIndex}`),
};

export const customerService = {
  list: () => api.get('/customers/list'),
  unassigned: () => api.get('/customers/unassigned'),
  suggest: (q) => api.get('/customers/suggest', { params: { q } }),
  lookup: (q) => api.get('/customers/lookup', { params: { q } }),
  lookupByKey: (key) => api.get('/customers/lookup', { params: { key } }),
  update: (data) => api.put('/customers/update', data),
  deleteCustomer: (key) => api.post('/customers/delete', { key }),
};

export const statsService = {
  summary: () => api.get('/stats/summary'),
  byDate: (params) => api.get('/stats/by-date', { params }),
  topProducts: (params) => api.get('/stats/top-products', { params }),
  topCustomers: (params) => api.get('/stats/top-customers', { params }),
  distribution: (params) => api.get('/stats/distribution', { params }),
};

export const publicService = {
  track: (soChungTu) => api.get(`/public/track/${soChungTu}`),
  search: (q) => api.get('/public/track', { params: { q } }),
  getCustomerNotifications: () => api.get('/public/customer-notifications'),
};

export const customerNotificationService = {
  list: (params) => api.get('/customer-notifications', { params }),
  summary: (params) => api.get('/customer-notifications/summary', { params }),
  create: (data) => api.post('/customer-notifications', data),
  update: (id, data) => api.put(`/customer-notifications/${id}`, data),
  setStatus: (id, isActive) => api.patch(`/customer-notifications/${id}/status`, { isActive }),
  remove: (id) => api.delete(`/customer-notifications/${id}`),
};

export const supplierService = {
  getList: (params) => api.get('/suppliers', { params }),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  setStatus: (id, isActive) => api.patch(`/suppliers/${id}/status`, { isActive }),
  getWarranties: (id, params) => api.get(`/suppliers/${id}/warranties`, { params }),
};

export const nhanVienService = {
  getList: () => api.get('/nhan-vien'),
  create: (data) => api.post('/nhan-vien', data),
  resetPassword: (maNV, newPassword) => api.patch(`/nhan-vien/${maNV}/password`, { newPassword }),
  remove: (maNV) => api.delete(`/nhan-vien/${maNV}`),
  verifyPassword: (maNV, matKhau) => api.post('/auth/login', { maNV, matKhau }),
};

export const authService = {
  login: (maNV, matKhau) => api.post('/auth/login', { maNV, matKhau }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword, newPassword) => api.post('/auth/change-password', { currentPassword, newPassword }),
};

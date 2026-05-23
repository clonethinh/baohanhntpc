import api from '../lib/axios';

export const backupService = {
  status: () => api.get('/admin/backups/status'),
  list: () => api.get('/admin/backups'),
  history: (limit = 200) => api.get(`/admin/backups/history?limit=${limit}`),
  create: () => api.post('/admin/backups', { type: 'manual' }),
  restore: (path) => api.post('/admin/backups/restore', { path, confirm: 'RESTORE' }),
  uploadRestore: (filename, data) => api.post('/admin/backups/upload-restore', { filename, data, confirm: 'RESTORE' }),
  delete: (path) => api.delete('/admin/backups', { data: { path } }),
  view: (path, limit = 50) => api.get(`/admin/backups/view?path=${encodeURIComponent(path)}&limit=${limit}`),
  metadata: (path, pinned, note) => api.patch('/admin/backups/metadata', { path, pinned, note }),
  downloadUrl: (path) => `/api/admin/backups/download?path=${encodeURIComponent(path)}`,
};

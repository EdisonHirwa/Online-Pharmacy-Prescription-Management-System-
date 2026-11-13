import api from './axiosInstance';
export const laboratoryService = {
  dashboard: () => api.get('/laboratory/dashboard'),
  options: () => api.get('/laboratory/options'),
  list: (params, signal) => api.get('/laboratory/tests', { params, signal }),
  get: (id) => api.get(`/laboratory/tests/${id}`),
  action: (id, action) => api.post(`/laboratory/tests/${id}/${action}`),
  save: (id, resultSummary) => api.put(`/laboratory/tests/${id}/results`, { result_summary: resultSummary }),
  complete: (id, resultSummary) => api.post(`/laboratory/tests/${id}/complete`, { result_summary: resultSummary }),
  upload: (id, file, progress) => {
    const data = new FormData(); data.append('report', file);
    return api.post(`/laboratory/tests/${id}/reports`, data, {
      headers: { 'Content-Type': undefined },
      onUploadProgress: (event) => { if (event.total) progress(Math.round(event.loaded / event.total * 100)); },
    });
  },
  removeReport: (id) => api.delete(`/laboratory/reports/${id}`),
  preview: async (id) => {
    try { return await api.get(`/laboratory/reports/${id}/preview`, { responseType: 'blob' }); }
    catch (error) { await parseBlobError(error); throw error; }
  },
  download: async (report) => {
    try {
      const response = await api.get(`/laboratory/reports/${report.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = report.name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { await parseBlobError(error); throw error; }
  },
};
async function parseBlobError(error) {
  if (error.response?.data instanceof Blob) {
    try { error.response.data = JSON.parse(await error.response.data.text()); } catch { /* Preserve non-JSON responses. */ }
  }
}
export const laboratoryError = (error) => Object.values(error.response?.data?.errors || {}).flat().join(' ') || error.response?.data?.message || 'Unable to reach the server. Please try again.';
export const laboratoryLabel = (value) => value?.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || '—';

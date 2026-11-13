import api from './axiosInstance';
export const doctorService = {
  list: (resource, params, signal) => api.get(`/doctor/${resource}`, { params, signal }),
  get: (resource, id) => api.get(`/doctor/${resource}/${id}`),
  profile: () => api.get('/doctor/profile'),
  options: () => api.get('/doctor/options'),
  dashboard: () => api.get('/doctor/dashboard'),
  save: (resource, data, id) => id ? api.put(`/doctor/${resource}/${id}`, data) : api.post(`/doctor/${resource}`, data),
  action: (path, data = {}) => api.post(`/doctor/${path}`, data),
  deleteSchedule: (id) => api.delete(`/doctor/schedules/${id}`),
  download: async (path, filename) => {
    try {
      const response = await api.get(`/doctor/${path}`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (error.response?.data instanceof Blob) {
        try { error.response.data = JSON.parse(await error.response.data.text()); } catch { /* Preserve the original error if the download response is not JSON. */ }
      }
      throw error;
    }
  },
};
export const doctorError = (error) => error.response?.data?.message || 'Unable to reach the server. Please try again.';

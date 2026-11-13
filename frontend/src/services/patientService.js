import api from './axiosInstance';
export const patientService = {
  dashboard: () => api.get('/patient/dashboard'),
  directory: () => api.get('/patient/directory'),
  doctors: (params, signal) => api.get('/patient/doctors', { params, signal }),
  slots: (id, date, appointmentId, signal) => api.get(`/patient/doctors/${id}/slots`, { params: { date, appointment_id: appointmentId || undefined }, signal }),
  list: (resource, params, signal) => api.get(`/patient/${resource}`, { params, signal }),
  get: (resource, id) => api.get(`/patient/${resource}/${id}`),
  profile: () => api.get('/patient/profile'),
  updateProfile: (data) => api.put('/patient/profile', data),
  history: () => api.get('/patient/history'),
  book: (data, id) => id ? api.put(`/patient/appointments/${id}`, data) : api.post('/patient/appointments', data),
  cancel: (id, reason) => api.post(`/patient/appointments/${id}/cancel`, { cancellation_reason: reason }),
  download: async (path, filename) => {
    try {
      const response = await api.get(`/patient/${path}`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (error.response?.data instanceof Blob) {
        try { error.response.data = JSON.parse(await error.response.data.text()); } catch { /* Preserve non-JSON error responses. */ }
      }
      throw error;
    }
  },
};
export const patientError = (error) => error.response?.data?.message || 'Unable to reach the server. Please try again.';
export const patientLabel = (value) => value?.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '—';

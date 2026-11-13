import api from './axiosInstance';
export const pharmacyService = {
  dashboard: () => api.get('/pharmacy/dashboard'),
  list: (resource, params) => api.get(`/pharmacy/${resource}`, { params }),
  prescription: (id) => api.get(`/pharmacy/prescriptions/${id}`),
  dispense: (id, data) => api.post(`/pharmacy/prescriptions/${id}/dispense`, data),
  medicine: (data, id) => id ? api.put(`/pharmacy/medicines/${id}`, data) : api.post('/pharmacy/medicines', data),
  stock: (id, data) => api.post(`/pharmacy/medicines/${id}/stock`, data),
};
export const pharmacyError = (error) => Object.values(error.response?.data?.errors || {}).flat().join(' ') || error.response?.data?.message || 'Unable to reach the server. Please try again.';
export const pharmacyLabel = (value) => value?.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || '—';

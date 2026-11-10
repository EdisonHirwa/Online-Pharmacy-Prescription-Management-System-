import axiosInstance from './axiosInstance';

export const authService = {
  login: async (credentials) => {
    const response = await axiosInstance.post('/auth/login', credentials);
    return response.data;
  },

  register: async (patientData) => {
    const response = await axiosInstance.post('/auth/register', patientData);
    return response.data;
  },

  logout: async () => {
    const response = await axiosInstance.post('/auth/logout');
    return response.data;
  },

  getProfile: async () => {
    const response = await axiosInstance.get('/auth/me');
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await axiosInstance.put('/auth/profile', profileData);
    return response.data;
  },

  forgotPassword: async (email) => {
    const response = await axiosInstance.post('/auth/forgot-password', { email });
    return response.data;
  },
};

export default authService;

import axios from 'axios';
import {
  MOCK_USERS,
  MOCK_DEPARTMENTS,
  MOCK_SPECIALIZATIONS,
  MOCK_DOCTORS,
  MOCK_PATIENTS,
  MOCK_APPOINTMENTS,
  MOCK_MEDICINES,
  MOCK_LAB_TEST_TYPES,
  MOCK_LAB_TESTS,
  MOCK_WARDS,
  MOCK_BEDS,
  MOCK_INVOICES,
  MOCK_NOTIFICATIONS,
  MOCK_AUDIT_LOGS,
  MOCK_LOGIN_ATTEMPTS,
} from './mockData';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || true; // defaults to mock if backend not yet running

const axiosInstance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 10000,
});

// Request Interceptor: Attach Sanctum Bearer token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('medicare_auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Standardized error parsing & session expiration
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response ? error.response.status : null;

    if (status === 401) {
      // Session expired / unauthenticated
      localStorage.removeItem('medicare_auth_token');
      localStorage.removeItem('medicare_auth_user');
      window.dispatchEvent(new CustomEvent('medicare:session-expired', { detail: { message: 'Your session has expired. Please sign in again.' } }));
    } else if (status === 403) {
      window.dispatchEvent(new CustomEvent('medicare:forbidden', { detail: { message: 'You do not have permission to perform this action.' } }));
    }

    return Promise.reject(error);
  }
);

/**
 * High-fidelity Mock API Layer
 * Emulates Laravel Sanctum authentication & Laravel API Resource responses
 */
if (USE_MOCK) {
  // Save mock state in memory/localStorage so mutations persist across requests
  const getStored = (key, fallback) => {
    try {
      const data = localStorage.getItem(`medicare_mock_${key}`);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  };

  const setStored = (key, data) => {
    try {
      localStorage.setItem(`medicare_mock_${key}`, JSON.stringify(data));
    } catch (e) {
      console.warn('Storage failed', e);
    }
  };

  // Replace default adapter with custom mock handler
  axiosInstance.defaults.adapter = async (config) => {
    // Artificial latency for realism
    await new Promise((r) => setTimeout(r, 200));

    const url = config.url ? config.url.replace(/^\/api/, '') : '';
    const method = (config.method || 'get').toLowerCase();
    const data = config.data ? (typeof config.data === 'string' ? JSON.parse(config.data) : config.data) : {};

    // Helper: standard Laravel response
    const ok = (payload, status = 200) => ({
      data: payload,
      status,
      statusText: 'OK',
      headers: {},
      config,
    });

    const error = (status, message, errors = {}) => {
      const err = new Error(message);
      err.response = {
        status,
        statusText: status === 422 ? 'Unprocessable Content' : 'Error',
        data: { message, errors },
        headers: {},
        config,
      };
      throw err;
    };

    // 1. AUTH ROUTES
    if (url.includes('/auth/login') && method === 'post') {
      const { email, password } = data;
      const user = MOCK_USERS.find((u) => u.email.toLowerCase() === (email || '').toLowerCase());
      if (!user) {
        return error(422, 'These credentials do not match our records.', { email: ['No registered user found with this email.'] });
      }
      return ok({
        message: 'Signed in successfully.',
        token: `sanctum_mock_token_${user.id}_${Date.now()}`,
        user,
      });
    }

    if (url.includes('/auth/register') && method === 'post') {
      const { email, phone_number, name } = data;
      // Duplicate validation check
      const emailExists = MOCK_USERS.some((u) => u.email.toLowerCase() === (email || '').toLowerCase());
      if (emailExists) {
        return error(422, 'The given data was invalid.', { email: ['The email address is already taken.'] });
      }
      const phoneExists = MOCK_USERS.some((u) => u.phone_number === phone_number);
      if (phoneExists) {
        return error(422, 'The given data was invalid.', { phone_number: ['The phone number is already registered to another patient.'] });
      }

      const newUser = {
        id: Date.now(),
        name,
        email,
        phone_number,
        role: 'patient',
        account_status: 'active',
        patient_profile: {
          id: Date.now(),
          patient_number: `PAT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
          date_of_birth: data.date_of_birth || '1995-01-01',
          gender: data.gender || 'Other',
          blood_group: data.blood_group || 'O+',
          address: data.address || '',
          emergency_contact_name: data.emergency_contact_name || '',
          emergency_contact_phone: data.emergency_contact_phone || '',
        },
        permissions: ['view_own_records', 'book_appointments', 'view_prescriptions', 'view_invoices'],
      };
      return ok({
        message: 'Patient registered successfully. Welcome to MediCare!',
        token: `sanctum_mock_token_${newUser.id}_${Date.now()}`,
        user: newUser,
      }, 201);
    }

    if (url.includes('/auth/logout') && method === 'post') {
      return ok({ message: 'Signed out successfully.' });
    }

    if (url.includes('/auth/me') && method === 'get') {
      const storedUser = localStorage.getItem('medicare_auth_user');
      const user = storedUser ? JSON.parse(storedUser) : MOCK_USERS[0];
      return ok({ data: user });
    }

    // 2. DASHBOARD KPI & CHARTS
    if (url.includes('/dashboard/stats')) {
      return ok({
        data: {
          total_patients: 1284,
          total_doctors: 42,
          pending_lab_tests: 17,
          outstanding_invoices: 23,
          revenue_trend: [
            { period: 'Jan', actual: 4200, projected: 3800 },
            { period: 'Feb', actual: 5100, projected: 4100 },
            { period: 'Mar', actual: 4800, projected: 4300 },
            { period: 'Apr', actual: 6400, projected: 4700 },
            { period: 'May', actual: 6100, projected: 4900 },
            { period: 'Jun', actual: 7800, projected: 5400 },
            { period: 'Jul', actual: 7500, projected: 5700 },
            { period: 'Aug', actual: 8600, projected: 6200 },
          ],
          appointments_by_status: [
            { name: 'Done', count: 48, fill: '#0E7C86' },
            { name: 'Pending', count: 28, fill: '#12263F' },
            { name: 'Cancelled', count: 14, fill: '#8E9FB7' },
          ],
          recent_appointments: MOCK_APPOINTMENTS.slice(0, 5),
        },
      });
    }

    // 3. APPOINTMENTS
    if (url.includes('/appointments')) {
      const appointments = getStored('appointments', MOCK_APPOINTMENTS);
      if (method === 'get') {
        return ok({ data: appointments });
      }
      if (method === 'post') {
        const newApt = {
          id: Date.now(),
          appointment_number: `APT-${Math.floor(1000 + Math.random() * 9000)}`,
          patient_name: data.patient_name || 'Aline Uwase',
          doctor_name: data.doctor_name || 'Dr. Mugisha',
          department: data.department || 'Pediatrics',
          appointment_date: data.appointment_date,
          appointment_time: data.appointment_time,
          reason: data.reason,
          status: 'pending',
          ...data,
        };
        const updated = [newApt, ...appointments];
        setStored('appointments', updated);
        return ok({ message: 'Appointment booked successfully.', data: newApt }, 201);
      }
    }

    // 4. PATIENTS
    if (url.includes('/patients')) {
      const patients = getStored('patients', MOCK_PATIENTS);
      if (method === 'get') {
        return ok({ data: patients });
      }
      if (method === 'post') {
        const newPat = {
          id: Date.now(),
          patient_number: `PAT-${Math.floor(1000 + Math.random() * 9000)}`,
          allergies: [],
          medical_histories: [],
          ...data,
        };
        const updated = [newPat, ...patients];
        setStored('patients', updated);
        return ok({ message: 'Patient profile created successfully.', data: newPat }, 201);
      }
    }

    // 5. DOCTORS & DEPARTMENTS
    if (url.includes('/doctors')) {
      return ok({ data: MOCK_DOCTORS });
    }
    if (url.includes('/departments')) {
      return ok({ data: MOCK_DEPARTMENTS });
    }
    if (url.includes('/specializations')) {
      return ok({ data: MOCK_SPECIALIZATIONS });
    }

    // 6. MEDICINES & PHARMACY
    if (url.includes('/medicines')) {
      const meds = getStored('medicines', MOCK_MEDICINES);
      if (method === 'get') {
        return ok({ data: meds });
      }
      if (method === 'post') {
        const newMed = { id: Date.now(), medicine_code: `MED-${Date.now().toString().slice(-4)}`, ...data };
        const updated = [newMed, ...meds];
        setStored('medicines', updated);
        return ok({ message: 'Medicine added to inventory.', data: newMed }, 201);
      }
    }

    // 7. LAB TESTS
    if (url.includes('/lab-tests')) {
      const tests = getStored('lab_tests', MOCK_LAB_TESTS);
      if (method === 'get') {
        return ok({ data: tests });
      }
      if (method === 'post') {
        const newTest = {
          id: Date.now(),
          status: 'requested',
          reports: [],
          ...data,
        };
        const updated = [newTest, ...tests];
        setStored('lab_tests', updated);
        return ok({ message: 'Lab investigation ordered.', data: newTest }, 201);
      }
    }

    // 8. WARDS & BEDS
    if (url.includes('/wards')) {
      return ok({ data: MOCK_WARDS });
    }
    if (url.includes('/beds')) {
      return ok({ data: MOCK_BEDS });
    }

    // 9. INVOICES & PAYMENTS
    if (url.includes('/invoices')) {
      return ok({ data: MOCK_INVOICES });
    }

    // 10. NOTIFICATIONS
    if (url.includes('/notifications')) {
      return ok({ data: MOCK_NOTIFICATIONS });
    }

    // 11. AUDIT & LOGS
    if (url.includes('/audit-logs')) {
      return ok({ data: MOCK_AUDIT_LOGS });
    }
    if (url.includes('/login-attempts')) {
      return ok({ data: MOCK_LOGIN_ATTEMPTS });
    }

    // Default fallback
    return ok({ data: [] });
  };
}

export default axiosInstance;

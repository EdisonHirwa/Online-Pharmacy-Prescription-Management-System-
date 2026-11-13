import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

// Layouts
import DashboardLayout from '../layouts/DashboardLayout';

// Route Guards
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';

// Auth Pages
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';

// Shared Pages
import ForbiddenPage from '../pages/shared/ForbiddenPage';
import NotFoundPage from '../pages/shared/NotFoundPage';

// Role Dashboards & Modules
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminWorkspace from '../pages/admin/AdminWorkspace';
import ProfilePage from '../pages/shared/ProfilePage';

import DoctorDashboard from '../pages/doctor/DoctorDashboard';
import DoctorWorkspace from '../pages/doctor/DoctorWorkspace';
import DoctorProfilePage from '../pages/doctor/DoctorProfilePage';
import PatientDashboard from '../pages/patient/PatientDashboard';
import BookAppointmentPage from '../pages/patient/BookAppointmentPage';
import PatientRecordsPage from '../pages/patient/PatientRecordsPage';
import PatientProfilePage from '../pages/patient/PatientProfilePage';
import LabDashboard from '../pages/lab/LabDashboard';
import PharmacyDashboard from '../pages/pharmacy/PharmacyDashboard';

export const AppRoutes = () => {
  const { user, isAuthenticated } = useAuth();

  // Root redirect based on active role
  const getHomeRedirect = () => {
    if (!isAuthenticated) return '/login';
    if (user?.role === 'admin') return '/admin/dashboard';
    if (user?.role === 'doctor') return '/doctor/dashboard';
    if (user?.role === 'patient') return '/patient/dashboard';
    if (user?.role === 'lab_tech') return '/lab/dashboard';
    if (user?.role === 'pharmacist') return '/pharmacy/dashboard';
    return '/login';
  };

  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to={getHomeRedirect()} replace />} />

      {/* Public Auth Routes */}
      <Route path="/login" element={isAuthenticated ? <Navigate to={getHomeRedirect()} replace /> : <LoginPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to={getHomeRedirect()} replace /> : <RegisterPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* Shared Error Routes */}
      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="/404" element={<NotFoundPage />} />

      {/* ADMIN PORTAL */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['admin']}>
              <DashboardLayout />
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<AdminWorkspace key="users" resources={['users']} />} />
        <Route path="organization" element={<AdminWorkspace key="organization" resources={['departments','specializations','services']} />} />
        <Route path="patients" element={<AdminWorkspace key="patients" resources={['patients']} />} />
        <Route path="doctors" element={<AdminWorkspace key="doctors" resources={['doctors','doctor-schedules']} />} />
        <Route path="appointments" element={<AdminWorkspace key="appointments" resources={['appointments']} />} />
        <Route path="laboratory" element={<AdminWorkspace key="laboratory" resources={['lab-test-types','lab-tests','lab-reports']} />} />
        <Route path="pharmacy" element={<AdminWorkspace key="pharmacy" resources={['medicines','stock-movements','prescriptions']} />} />
        <Route path="wards-beds" element={<AdminWorkspace key="wards-beds" resources={['wards','beds','admissions']} />} />
        <Route path="billing" element={<AdminWorkspace key="billing" resources={['invoices','payments']} />} />
        <Route path="reports" element={<AdminWorkspace key="reports" reporting resources={['patients','appointments','doctor-performance','consultations','prescriptions','medicines','stock-movements','dispensations','lab-tests','laboratory-revenue','admissions','beds','invoices','payments','revenue','audit-logs','login-attempts']} />} />
        <Route path="audit-logs" element={<AdminWorkspace key="audit-logs" resources={['audit-logs','login-attempts']} />} />
        <Route path="settings" element={<AdminWorkspace key="settings" resources={['settings']} />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* DOCTOR PORTAL */}
      <Route
        path="/doctor"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['doctor']}>
              <DashboardLayout />
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/doctor/dashboard" replace />} />
        <Route path="dashboard" element={<DoctorDashboard />} />
        <Route path="schedules" element={<DoctorWorkspace key="doctor-schedules" resource="schedules" />} />
        <Route path="appointments" element={<DoctorWorkspace key="doctor-appointments" resource="appointments" />} />
        <Route path="patients" element={<DoctorWorkspace key="doctor-patients" resource="patients" />} />
        <Route path="consultations" element={<DoctorWorkspace key="doctor-consultations" resource="consultations" />} />
        <Route path="prescriptions" element={<DoctorWorkspace key="doctor-prescriptions" resource="prescriptions" />} />
        <Route path="lab-requests" element={<DoctorWorkspace key="doctor-labs" resource="lab-requests" />} />
        <Route path="profile" element={<DoctorProfilePage />} />
      </Route>

      {/* PATIENT PORTAL */}
      <Route
        path="/patient"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['patient']}>
              <DashboardLayout />
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/patient/dashboard" replace />} />
        <Route path="dashboard" element={<PatientDashboard />} />
        <Route path="book-appointment" element={<BookAppointmentPage />} />
        <Route path="doctors" element={<BookAppointmentPage />} />
        <Route path="appointments" element={<PatientRecordsPage key="patient-appointments" resources={['appointments']} />} />
        <Route path="medical-records" element={<PatientRecordsPage key="patient-medical" medical resources={['consultations','admissions']} />} />
        <Route path="prescriptions" element={<PatientRecordsPage key="patient-prescriptions" resources={['prescriptions']} />} />
        <Route path="lab-reports" element={<PatientRecordsPage key="patient-laboratory" resources={['lab-tests']} />} />
        <Route path="invoices" element={<PatientRecordsPage key="patient-billing" resources={['invoices','payments']} />} />
        <Route path="profile" element={<PatientProfilePage />} />
      </Route>

      {/* LAB TECHNICIAN PORTAL */}
      <Route
        path="/lab"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['lab_tech']}>
              <DashboardLayout />
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/lab/dashboard" replace />} />
        <Route path="dashboard" element={<LabDashboard />} />
        <Route path="queue" element={<LabDashboard />} />
        <Route path="process" element={<LabDashboard />} />
        <Route path="reports" element={<LabDashboard />} />
      </Route>

      {/* PHARMACIST PORTAL */}
      <Route
        path="/pharmacy"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['pharmacist']}>
              <DashboardLayout />
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/pharmacy/dashboard" replace />} />
        <Route path="dashboard" element={<PharmacyDashboard />} />
        <Route path="queue" element={<PharmacyDashboard />} />
        <Route path="dispense" element={<PharmacyDashboard />} />
        <Route path="inventory" element={<PharmacyDashboard />} />
        <Route path="movements" element={<PharmacyDashboard />} />
      </Route>

      {/* Fallback to 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default AppRoutes;

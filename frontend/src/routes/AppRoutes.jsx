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

// Shared Pages
import ForbiddenPage from '../pages/shared/ForbiddenPage';
import NotFoundPage from '../pages/shared/NotFoundPage';

// Role Dashboards & Modules
import AdminDashboard from '../pages/admin/AdminDashboard';
import PatientsPage from '../pages/admin/PatientsPage';
import DoctorsPage from '../pages/admin/DoctorsPage';
import WardsBedsPage from '../pages/admin/WardsBedsPage';
import BillingPage from '../pages/admin/BillingPage';
import AuditLogsPage from '../pages/admin/AuditLogsPage';
import ReportsPage from '../pages/admin/ReportsPage';

import DoctorDashboard from '../pages/doctor/DoctorDashboard';
import PatientDashboard from '../pages/patient/PatientDashboard';
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
        <Route path="patients" element={<PatientsPage />} />
        <Route path="doctors" element={<DoctorsPage />} />
        <Route path="appointments" element={<AdminDashboard />} />
        <Route path="laboratory" element={<LabDashboard />} />
        <Route path="pharmacy" element={<PharmacyDashboard />} />
        <Route path="wards-beds" element={<WardsBedsPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
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
        <Route path="schedules" element={<DoctorsPage />} />
        <Route path="appointments" element={<DoctorDashboard />} />
        <Route path="patients" element={<PatientsPage />} />
        <Route path="prescriptions" element={<PharmacyDashboard />} />
        <Route path="lab-requests" element={<LabDashboard />} />
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
        <Route path="book-appointment" element={<PatientDashboard />} />
        <Route path="appointments" element={<PatientDashboard />} />
        <Route path="medical-records" element={<PatientsPage />} />
        <Route path="prescriptions" element={<PharmacyDashboard />} />
        <Route path="lab-reports" element={<PatientDashboard />} />
        <Route path="invoices" element={<BillingPage />} />
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

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export const RoleRoute = ({ allowedRoles = [], children }) => {
  const { user, isAuthenticated, hasRole } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0 && !hasRole(allowedRoles)) {
    return <Navigate to="/403" state={{ deniedRole: user?.role, requiredRoles: allowedRoles }} replace />;
  }

  return children;
};

export default RoleRoute;

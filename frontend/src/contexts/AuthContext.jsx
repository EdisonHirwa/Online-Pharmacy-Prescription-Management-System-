import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

const AUTH_TOKEN_KEY = 'medicare_auth_token';
const AUTH_USER_KEY = 'medicare_auth_user';

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY) || null);
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(AUTH_USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState(null);

  // Sync token & user to localStorage
  const saveAuthSession = useCallback((newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    if (newToken) {
      localStorage.setItem(AUTH_TOKEN_KEY, newToken);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
    if (newUser) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await authService.logout().catch(() => {});
      }
    } finally {
      saveAuthSession(null, null);
    }
  }, [token, saveAuthSession]);

  // Session expired event handler
  useEffect(() => {
    const handleSessionExpired = (e) => {
      saveAuthSession(null, null);
      setSessionExpiredMessage(e.detail?.message || 'Your session has expired. Please sign in again.');
    };

    window.addEventListener('medicare:session-expired', handleSessionExpired);
    return () => window.removeEventListener('medicare:session-expired', handleSessionExpired);
  }, [saveAuthSession]);

  const login = useCallback(
    async (email, password) => {
      setLoading(true);
      setSessionExpiredMessage(null);
      try {
        const response = await authService.login({ email, password });
        saveAuthSession(response.token, response.user);
        return response.user;
      } finally {
        setLoading(false);
      }
    },
    [saveAuthSession]
  );

  const register = useCallback(
    async (patientData) => {
      setLoading(true);
      try {
        const response = await authService.register(patientData);
        saveAuthSession(response.token, response.user);
        return response.user;
      } finally {
        setLoading(false);
      }
    },
    [saveAuthSession]
  );

  const updateUser = useCallback(
    (updatedFields) => {
      setUser((prev) => {
        const next = { ...prev, ...updatedFields };
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const hasRole = useCallback(
    (allowedRoles) => {
      if (!user) return false;
      if (!allowedRoles || allowedRoles.length === 0) return true;
      if (Array.isArray(allowedRoles)) {
        return allowedRoles.includes(user.role);
      }
      return user.role === allowedRoles;
    },
    [user]
  );

  const hasPermission = useCallback(
    (perm) => {
      if (!user) return false;
      if (user.role === 'admin' || (user.permissions && user.permissions.includes('all'))) return true;
      return user.permissions ? user.permissions.includes(perm) : false;
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      token,
      role: user?.role || null,
      isAuthenticated: Boolean(token && user),
      loading,
      sessionExpiredMessage,
      clearSessionExpiredMessage: () => setSessionExpiredMessage(null),
      login,
      register,
      logout,
      updateUser,
      hasRole,
      hasPermission,
    }),
    [user, token, loading, sessionExpiredMessage, login, register, logout, updateUser, hasRole, hasPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

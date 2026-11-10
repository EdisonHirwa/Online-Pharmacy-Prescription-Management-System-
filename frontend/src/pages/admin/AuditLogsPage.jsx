import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import {
  Security as SecurityIcon,
  Fingerprint as FingerprintIcon,
  Shield as ShieldIcon,
} from '@mui/icons-material';
import DataTable from '../../components/DataTable';
import StatusChip from '../../components/StatusChip';
import axiosInstance from '../../services/axiosInstance';
import { brandColors } from '../../theme/palette';

export const AuditLogsPage = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loginAttempts, setLoginAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axiosInstance.get('/audit-logs'),
      axiosInstance.get('/login-attempts'),
    ]).then(([aRes, lRes]) => {
      setAuditLogs(aRes.data.data || []);
      setLoginAttempts(lRes.data.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const auditColumns = [
    { id: 'created_at', label: 'Timestamp', render: (r) => new Date(r.created_at).toLocaleString() },
    { id: 'user_name', label: 'User Identity', render: (r) => <strong>{r.user_name}</strong> },
    {
      id: 'action',
      label: 'Operation Action',
      render: (r) => (
        <Chip
          label={r.action}
          size="small"
          sx={{
            bgcolor: brandColors.navy[50],
            color: 'secondary.main',
            fontWeight: 700,
            fontSize: '0.72rem',
          }}
        />
      ),
    },
    { id: 'affected_table', label: 'Target Table' },
    { id: 'activity_details', label: 'Activity Description' },
    { id: 'ip_address', label: 'Client IP' },
  ];

  const loginColumns = [
    { id: 'attempt_date', label: 'Attempt Date & Time', render: (r) => new Date(r.attempt_date).toLocaleString() },
    { id: 'email', label: 'Target Email Address' },
    { id: 'ip_address', label: 'IP Address' },
    {
      id: 'attempt_status',
      label: 'Security Status',
      render: (r) => {
        if (r.attempt_status === 'suspicious_lockout') {
          return (
            <Chip
              label="Suspicious Lockout"
              size="small"
              sx={{
                bgcolor: brandColors.coral[50],
                color: brandColors.coral.main,
                border: `1px solid ${brandColors.coral[200]}`,
                fontWeight: 700,
              }}
            />
          );
        }
        return <StatusChip status="completed" customLabel="Verified" />;
      },
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'secondary.main' }}>
          Hospital Audit Trails & Security Logging
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Immutable activity tracking, table mutation audits, and authentication anomaly detection.
        </Typography>
      </Box>

      {/* Audit Logs Table */}
      <DataTable
        title="Clinical & System Audit Trail"
        columns={auditColumns}
        data={auditLogs}
        loading={loading}
        searchPlaceholder="Filter audit records by user, action, or table..."
      />

      {/* Login Attempts & Suspicious Activity */}
      <DataTable
        title="Login Attempts & Anomaly Detection"
        columns={loginColumns}
        data={loginAttempts}
        loading={loading}
        footerCaption="Multiple failed authentication attempts automatically trigger security lockouts to safeguard patient confidentiality."
      />
    </Box>
  );
};

export default AuditLogsPage;

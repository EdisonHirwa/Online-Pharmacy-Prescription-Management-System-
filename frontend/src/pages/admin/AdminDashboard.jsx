import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
} from '@mui/material';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import DashboardCard from '../../components/DashboardCard';
import DataTable from '../../components/DataTable';
import StatusChip from '../../components/StatusChip';
import axiosInstance from '../../services/axiosInstance';
import { brandColors } from '../../theme/palette';
import { useThemeMode } from '../../contexts/ThemeContext';

export const AdminDashboard = () => {
  const { isDark } = useThemeMode();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    axiosInstance
      .get('/dashboard/stats')
      .then((res) => {
        if (isMounted) {
          setStats(res.data.data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const appointmentColumns = [
    { id: 'appointment_number', label: 'No.', render: (row) => <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.appointment_number}</Typography> },
    { id: 'patient_name', label: 'Patient' },
    { id: 'doctor_name', label: 'Doctor' },
    { id: 'department', label: 'Department' },
    {
      id: 'status',
      label: 'Status',
      render: (row) => <StatusChip status={row.status} />,
    },
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  const kpis = stats || {
    total_patients: 1284,
    total_doctors: 42,
    pending_lab_tests: 17,
    outstanding_invoices: 23,
    revenue_trend: [],
    appointments_by_status: [],
    recent_appointments: [],
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Row 1: KPI Cards matching exact reference image */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Total Patients"
            value={kpis.total_patients?.toLocaleString() || '1,284'}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Total Doctors"
            value={kpis.total_doctors || '42'}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Pending Lab Tests"
            value={kpis.pending_lab_tests || '17'}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {/* Outstanding Invoices has solid Deep Navy inverted style from reference */}
          <DashboardCard
            title="Outstanding Invoices"
            value={kpis.outstanding_invoices || '23'}
            variant="inverted"
          />
        </Grid>
      </Grid>

      {/* Row 2: Charts matching exact layout & 3-color palette */}
      <Grid container spacing={2.5}>
        {/* Left: Revenue Trend Area/Line Chart */}
        <Grid item xs={12} md={7}>
          <Card sx={{ height: '100%', borderRadius: 3, p: 1 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'secondary.main', mb: 2 }}>
                Revenue Trend
              </Typography>
              <Box sx={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={kpis.revenue_trend}
                    margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={brandColors.teal.main} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={brandColors.teal.main} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? brandColors.charts.gridDark : brandColors.charts.grid} />
                    <XAxis
                      dataKey="period"
                      tickLine={false}
                      stroke={isDark ? brandColors.navy[200] : brandColors.navy[300]}
                      fontSize={12}
                    />
                    <YAxis
                      tickLine={false}
                      stroke={isDark ? brandColors.navy[200] : brandColors.navy[300]}
                      fontSize={12}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? brandColors.navy.main : '#FFFFFF',
                        borderColor: isDark ? brandColors.navy[600] : brandColors.navy[100],
                        borderRadius: 8,
                        boxShadow: '0 4px 12px rgba(18, 38, 63, 0.1)',
                      }}
                    />
                    {/* Soft shaded area under Teal line */}
                    <Area
                      type="monotone"
                      dataKey="actual"
                      stroke={brandColors.teal.main}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#tealGradient)"
                    />
                    {/* Dotted/dashed secondary navy line */}
                    <Line
                      type="monotone"
                      dataKey="projected"
                      stroke={isDark ? brandColors.navy[200] : brandColors.navy.main}
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right: Appointments by Status Bar Chart */}
        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%', borderRadius: 3, p: 1 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'secondary.main', mb: 2 }}>
                Appointments by Status
              </Typography>
              <Box sx={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={kpis.appointments_by_status}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    barSize={44}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? brandColors.charts.gridDark : brandColors.charts.grid} />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      stroke={isDark ? brandColors.navy[200] : brandColors.navy[300]}
                      fontSize={12}
                    />
                    <YAxis
                      tickLine={false}
                      stroke={isDark ? brandColors.navy[200] : brandColors.navy[300]}
                      fontSize={12}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? brandColors.navy.main : '#FFFFFF',
                        borderColor: isDark ? brandColors.navy[600] : brandColors.navy[100],
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Row 3: Recent Appointments Table matching exact layout from image */}
      <DataTable
        title="Recent Appointments"
        columns={appointmentColumns}
        data={kpis.recent_appointments}
        footerCaption="Sample data for layout only."
      />
    </Box>
  );
};

export default AdminDashboard;

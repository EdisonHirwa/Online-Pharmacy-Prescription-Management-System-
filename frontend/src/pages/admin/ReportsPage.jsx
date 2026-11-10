import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { brandColors } from '../../theme/palette';
import { useThemeMode } from '../../contexts/ThemeContext';

export const ReportsPage = () => {
  const { isDark } = useThemeMode();

  const patientTrends = [
    { month: 'Jan', registered: 65, active: 110 },
    { month: 'Feb', registered: 85, active: 145 },
    { month: 'Mar', registered: 110, active: 190 },
    { month: 'Apr', registered: 130, active: 240 },
    { month: 'May', registered: 175, active: 310 },
    { month: 'Jun', registered: 210, active: 390 },
  ];

  const deptDistribution = [
    { department: 'Pediatrics', appointments: 140 },
    { department: 'Gen. Med', appointments: 260 },
    { department: 'Dentistry', appointments: 95 },
    { department: 'Surgery', appointments: 80 },
    { department: 'Cardiology', appointments: 115 },
  ];

  const bedOccupancyData = [
    { name: 'Occupied Beds', value: 34, fill: brandColors.navy.main },
    { name: 'Available Beds', value: 16, fill: brandColors.teal.main },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'secondary.main' }}>
          Hospital Operational & Clinical Analytics
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Aggregated reporting metrics across patient intake, clinical workload, bed occupancy, and revenue.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Patient Intake Trend */}
        <Grid item xs={12} md={7}>
          <Card sx={{ height: '100%', borderRadius: 3, p: 1 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'secondary.main', mb: 2 }}>
                Patient Registration & Growth Trends
              </Typography>
              <Box sx={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={patientTrends}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? brandColors.charts.gridDark : brandColors.charts.grid} />
                    <XAxis dataKey="month" stroke={isDark ? brandColors.navy[200] : brandColors.navy[300]} />
                    <YAxis stroke={isDark ? brandColors.navy[200] : brandColors.navy[300]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? brandColors.navy.main : '#FFFFFF',
                        borderRadius: 8,
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="registered" stroke={brandColors.teal.main} strokeWidth={2.5} name="New Registrations" />
                    <Line type="monotone" dataKey="active" stroke={isDark ? brandColors.navy[200] : brandColors.navy.main} strokeWidth={2.5} name="Active Patients" />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Bed Occupancy Donut */}
        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%', borderRadius: 3, p: 1 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'secondary.main', mb: 2 }}>
                Inpatient Bed Capacity
              </Typography>
              <Box sx={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={bedOccupancyData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                    >
                      {bedOccupancyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? brandColors.navy.main : '#FFFFFF',
                        borderRadius: 8,
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Department Volume */}
        <Grid item xs={12}>
          <Card sx={{ borderRadius: 3, p: 1 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'secondary.main', mb: 2 }}>
                Consultations Completed by Department
              </Typography>
              <Box sx={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptDistribution} barSize={42}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? brandColors.charts.gridDark : brandColors.charts.grid} />
                    <XAxis dataKey="department" stroke={isDark ? brandColors.navy[200] : brandColors.navy[300]} />
                    <YAxis stroke={isDark ? brandColors.navy[200] : brandColors.navy[300]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? brandColors.navy.main : '#FFFFFF',
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="appointments" fill={brandColors.teal.main} radius={[6, 6, 0, 0]} name="Appointments" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ReportsPage;

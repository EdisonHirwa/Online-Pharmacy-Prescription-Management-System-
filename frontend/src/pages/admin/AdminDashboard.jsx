import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, Typography } from '@mui/material';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import DashboardCard from '../../components/DashboardCard';
import DataTable from '../../components/DataTable';
import StatusChip from '../../components/StatusChip';
import api from '../../services/axiosInstance';
import { brandColors } from '../../theme/palette';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try { const response = await api.get('/dashboard/stats'); if (active) { setStats(response.data.data); setError(''); } }
      catch { if (active) setError('Unable to load dashboard statistics.'); }
    };
    load(); const timer = setInterval(load, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [refresh]);
  if (!stats && !error) return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}><CircularProgress /></Box>;
  const cards = stats ? [
    ['Total Patients', stats.total_patients], ['Total Doctors', stats.total_doctors], ['Pending Lab Tests', stats.pending_lab_tests],
    ['Outstanding Invoices', stats.outstanding_invoices], ['Occupied Beds', stats.occupied_beds], ['Available Beds', stats.available_beds],
    ['Low Stock Medicines', stats.low_stock_medicines], ['Expired Medicines', stats.expired_medicines],
  ] : [];
  const chart = (title, data, x, y, area = false) => <Card><CardContent>
    <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>{title}</Typography>
    <Box sx={{ height: 260, minWidth: 0 }}>
      {!data?.length ? <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}><Typography color="text.secondary">No records yet.</Typography></Box> : <ResponsiveContainer width="100%" height="100%">
        {area ? <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey={x} tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Area type="monotone" dataKey={y} stroke={brandColors.teal.main} fill={brandColors.teal.main} fillOpacity={0.15} /></AreaChart> : <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey={x} tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey={y} fill={brandColors.teal.main} radius={[4, 4, 0, 0]} /></BarChart>}
      </ResponsiveContainer>}
    </Box>
  </CardContent></Card>;
  return <Stack spacing={3} sx={{ minWidth: 0 }}>
    {error && <Alert severity="error" action={<Button onClick={() => setRefresh((v) => v + 1)}>Retry</Button>}>{error}</Alert>}
    {stats && <>
      <Stack direction="row" sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}><Box><Typography variant="h5" fontWeight={700}>{stats.hospital_name || 'Hospital Overview'}</Typography><Typography variant="body2" color="text.secondary">Outstanding balance: {Number(stats.outstanding_balance).toLocaleString()} {stats.currency || 'RWF'}</Typography></Box><Button onClick={() => setRefresh((v) => v + 1)}>Refresh statistics</Button></Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>{cards.map(([title, value]) => <DashboardCard key={title} title={title} value={Number(value).toLocaleString()} />)}</Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 3 }}>
        {chart(`Revenue (${stats.currency || 'RWF'})`, stats.revenue_trend, 'period', 'actual', true)}
        {chart('Appointments by Status', stats.appointments_by_status, 'name', 'count')}
        {chart('Patient Registrations', stats.patient_trend, 'period', 'count', true)}
        {chart('Bed Occupancy', stats.beds_by_status, 'name', 'count')}
      </Box>
      <DataTable title="Recent Appointments" columns={[
        { id: 'appointment_number', label: 'Number' }, { id: 'patient_name', label: 'Patient' }, { id: 'doctor_name', label: 'Doctor' }, { id: 'department', label: 'Department' },
        { id: 'status', label: 'Status', render: (row) => <StatusChip status={row.status} /> },
      ]} data={stats.recent_appointments} footerCaption="Latest appointments from hospital records." />
    </>}
  </Stack>;
}

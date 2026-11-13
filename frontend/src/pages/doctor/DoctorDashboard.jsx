import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, Typography } from '@mui/material';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import DashboardCard from '../../components/DashboardCard';
import DataTable from '../../components/DataTable';
import StatusChip from '../../components/StatusChip';
import { doctorService as service, doctorError } from '../../services/doctorService';
import { brandColors } from '../../theme/palette';
export default function DoctorDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const load = async () => { try { const response = await service.dashboard(); if (active) { setStats(response.data.data); setError(''); } } catch (err) { if (active) setError(doctorError(err)); } };
    load(); const timer = setInterval(load, 30000); return () => { active = false; clearInterval(timer); };
  }, [revision]);
  if (!stats && !error) return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '50vh' }}><CircularProgress /></Box>;
  return <Stack spacing={3} sx={{ minWidth: 0 }}>
    <Typography variant="h5" fontWeight={700}>Doctor Overview</Typography>
    {error && <Alert severity="error" action={<Button onClick={() => setRevision((v) => v + 1)}>Retry</Button>}>{error}</Alert>}
    {stats && <>
      {stats.professional_status !== 'active' && <Alert severity="warning">Your professional status is {stats.professional_status.replaceAll('_', ' ')}. Clinical actions require an active professional status; contact administration if this needs updating.</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
        {[["Today's Appointments", stats.today_appointments], ['Patients Consulted', stats.patients_consulted], ['Pending Laboratory Results', stats.pending_laboratory], ['Upcoming Appointments', stats.upcoming_appointments]].map(([title, value]) => <DashboardCard key={title} title={title} value={Number(value).toLocaleString()} />)}
      </Box>
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}><Button component={Link} to="/doctor/appointments" variant="contained">Open appointments</Button><Button component={Link} to="/doctor/consultations">Consultation records</Button><Button component={Link} to="/doctor/schedules">Manage schedule</Button><Button onClick={() => setRevision((v) => v + 1)}>Refresh</Button></Stack>
      <Card><CardContent><Typography variant="h6" sx={{ mb: 2 }}>My Appointments by Status</Typography><Box sx={{ height: 260 }}>
        {stats.appointments_by_status.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={stats.appointments_by_status}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill={brandColors.teal.main} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <Typography color="text.secondary">No appointments assigned yet.</Typography>}
      </Box></CardContent></Card>
      <DataTable title="Assigned Appointment Queue" data={stats.recent_appointments.map((row) => ({ ...row, patient_name: row.patient?.user?.name }))} columns={[
        { id: 'appointment_number', label: 'Appointment' }, { id: 'patient_name', label: 'Patient', render: (row) => row.patient?.user?.name },
        { id: 'appointment_date', label: 'Date', render: (row) => row.appointment_date?.slice(0, 10) }, { id: 'appointment_time', label: 'Time' },
        { id: 'status', label: 'Status', render: (row) => <StatusChip status={row.status} /> },
      ]} footerCaption="Open My Appointments to confirm requests, review patient history, or record a consultation." />
    </>}
  </Stack>;
}

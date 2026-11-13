import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, Typography } from '@mui/material';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import DashboardCard from '../../components/DashboardCard';
import DataTable from '../../components/DataTable';
import StatusChip from '../../components/StatusChip';
import { patientService as service, patientError } from '../../services/patientService';
import { brandColors } from '../../theme/palette';
export default function PatientDashboard() {
  const [stats, setStats] = useState(null); const [error, setError] = useState(''); const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const load = async () => { try { const response = await service.dashboard(); if (active) { setStats(response.data.data); setError(''); } } catch (err) { if (active) setError(patientError(err)); } };
    load(); const timer = setInterval(load, 30000); return () => { active = false; clearInterval(timer); };
  }, [revision]);
  if (!stats && !error) return <CircularProgress />;
  return <Stack spacing={3} sx={{ minWidth: 0 }}>
    <Typography variant="h5" fontWeight={700}>My Health Overview</Typography>
    {error && <Alert severity="error" action={<Button onClick={() => setRevision((value) => value + 1)}>Retry</Button>}>{error}</Alert>}
    {stats && <>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
        {[
          ['Upcoming Appointments', stats.upcoming_appointments], ['Active Prescriptions', stats.active_prescriptions], ['Available Lab Reports', stats.available_lab_reports], ['Outstanding Balance', stats.outstanding_balance],
        ].map(([title, value]) => <DashboardCard key={title} title={title} value={value === null ? 'Restricted' : `${Number(value).toLocaleString()}${title === 'Outstanding Balance' ? ` ${stats.currency}` : ''}`} />)}
      </Box>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button component={Link} to="/patient/book-appointment" variant="contained">Find a doctor</Button>
        {stats.permissions.view_own_records && <Button component={Link} to="/patient/medical-records">My medical records</Button>}
        <Button component={Link} to="/patient/profile">My profile</Button><Button onClick={() => setRevision((value) => value + 1)}>Refresh overview</Button>
      </Stack>
      {stats.permissions.view_own_records && <>
        <Card><CardContent><Typography variant="h6" sx={{ mb: 2 }}>My Appointments by Status</Typography><Box sx={{ height: 240 }}>{stats.appointments_by_status.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={stats.appointments_by_status}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill={brandColors.teal.main} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <Typography color="text.secondary">You have no appointments yet.</Typography>}</Box></CardContent></Card>
        <DataTable title="Next Appointments" data={stats.next_appointments.map((row) => ({ ...row, doctor_name: row.doctor?.name }))} columns={[
          { id: 'appointment_number', label: 'Reference' }, { id: 'doctor_name', label: 'Doctor' }, { id: 'appointment_date', label: 'Date', render: (row) => row.appointment_date?.slice(0, 10) },
          { id: 'appointment_time', label: 'Time', render: (row) => row.appointment_time?.slice(0, 5) }, { id: 'status', label: 'Status', render: (row) => <StatusChip status={row.status} /> },
        ]} footerCaption={`Consultation times are shown in ${stats.timezone}.`} />
      </>}
    </>}
  </Stack>;
}

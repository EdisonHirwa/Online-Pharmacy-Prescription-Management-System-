import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import DashboardCard from '../../components/DashboardCard';
import { pharmacyService, pharmacyError } from '../../services/pharmacyService';
export default function PharmacyDashboard() {
  const [data, setData] = useState(null); const [error, setError] = useState('');
  useEffect(() => { let active = true; const load = async () => { try { const response = await pharmacyService.dashboard(); if (active) { setData(response.data.data); setError(''); } } catch (err) { if (active) setError(pharmacyError(err)); } }; load(); const timer = setInterval(load, 30000); return () => { active = false; clearInterval(timer); }; }, []);
  return <Stack spacing={3}>
    <Typography variant="h5" fontWeight={700}>Pharmacy Dashboard</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    {!data ? !error && <CircularProgress /> : <>
      {!data.can_manage && <Alert severity="info">Your account has read-only pharmacy access. Ask an administrator to grant pharmacy management permission to make changes.</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
        <DashboardCard title="Pending Prescriptions" value={data.pending} />
        <DashboardCard title="Partially Dispensed" value={data.partial} />
        <DashboardCard title="Today's Dispensations" value={data.dispensed_today} />
        <DashboardCard title="Medicine Catalog" value={data.medicines} />
        <DashboardCard title="Low Stock" value={data.low_stock} subtitle="Active medicines at reorder level" />
        <DashboardCard title="Expired Medicines" value={data.expired} subtitle="Blocked from dispensing" />
        <DashboardCard title="Expiring Within 30 Days" value={data.expiring} />
      </Box>
      <Paper variant="outlined" sx={{ p: 3 }}><Stack spacing={2}><Typography variant="h6">Process a Prescription</Typography><Typography color="text.secondary">Review the prescribed medicines and recorded allergies, enter quantities, and confirm dispensing. Stock, prescription status, and patient charges update together.</Typography><Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}><Button component={Link} to="/pharmacy/queue" variant="contained">Prescription queue</Button><Button component={Link} to="/pharmacy/inventory" variant="outlined">Medicine inventory</Button><Button component={Link} to="/pharmacy/history">Dispensing history</Button></Stack></Stack></Paper>
    </>}
  </Stack>;
}

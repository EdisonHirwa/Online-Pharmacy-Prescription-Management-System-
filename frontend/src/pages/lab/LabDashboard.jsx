import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import DashboardCard from '../../components/DashboardCard';
import { laboratoryService, laboratoryError } from '../../services/laboratoryService';

export default function LabDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = async () => {
      try { const response = await laboratoryService.dashboard(); if (active) { setData(response.data.data); setError(''); } }
      catch (err) { if (active) setError(laboratoryError(err)); }
    };
    load(); const timer = setInterval(load, 30000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  return <Stack spacing={3}>
    <Typography variant="h5" fontWeight={700}>Laboratory Dashboard</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    {!data ? !error && <CircularProgress /> : <>
      {!data.can_manage && <Alert severity="info">Your account has read-only laboratory access. An administrator can grant laboratory management permission.</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
        <DashboardCard title="Unassigned Requests" value={data.unassigned_requests} subtitle="Available to claim" />
        <DashboardCard title="Assigned to Me" value={data.assigned_to_me} subtitle="Ready to begin" />
        <DashboardCard title="Processing" value={data.processing} subtitle="My active investigations" />
        <DashboardCard title="Completed" value={data.completed} subtitle={`${data.completed_today} completed today`} />
      </Box>
      <Paper variant="outlined" sx={{ p: 3 }}><Stack spacing={2}>
        <Typography variant="h6">Investigation Workflow</Typography>
        <Typography color="text.secondary">Claim a requested investigation, start processing, save draft findings, and attach reports. Finalize reviewed results to make them available to the doctor and patient.</Typography>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}><Button component={Link} to="/lab/queue" variant="contained">Investigation queue</Button><Button component={Link} to="/lab/process" variant="outlined">My work</Button><Button component={Link} to="/lab/history">Completed history</Button></Stack>
      </Stack></Paper>
      <Paper variant="outlined" sx={{ p: 3 }}><Typography variant="h6" sx={{ mb: 2 }}>My Completed Investigations</Typography><Stack spacing={2}>{data.completion_trend.map((month) => <Box key={month.period} sx={{ display: 'grid', gridTemplateColumns: '85px 1fr 35px', alignItems: 'center', gap: 2 }}><Typography variant="body2">{month.period}</Typography><Box sx={{ bgcolor: 'action.hover', height: 16, borderRadius: 1 }}><Box sx={{ bgcolor: 'primary.main', borderRadius: 1, height: '100%', width: `${month.count / Math.max(1, ...data.completion_trend.map((item) => item.count)) * 100}%` }} /></Box><Typography variant="body2">{month.count}</Typography></Box>)}</Stack></Paper>
    </>}
  </Stack>;
}

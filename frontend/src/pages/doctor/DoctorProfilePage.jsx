import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Divider, Paper, Stack, TextField, Typography } from '@mui/material';
import ProfilePage from '../shared/ProfilePage';
import api from '../../services/axiosInstance';
import { doctorService as service, doctorError } from '../../services/doctorService';
export default function DoctorProfilePage() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ bio: '', room_number: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const load = () => service.profile().then((response) => { const data = response.data.data; setProfile(data); setForm({ bio: data.bio || '', room_number: data.room_number || '' }); setError(''); }).catch((err) => setError(doctorError(err)));
  useEffect(() => { let active = true; service.profile().then((response) => { if (active) { const data = response.data.data; setProfile(data); setForm({ bio: data.bio || '', room_number: data.room_number || '' }); } }).catch((err) => { if (active) setError(doctorError(err)); }); return () => { active = false; }; }, []);
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try { const response = await api.put('/doctor/profile', form); setProfile(response.data.data); setNotice('Professional profile updated.'); }
    catch (err) { setError(Object.values(err.response?.data?.errors || {}).flat().join(' ') || doctorError(err)); }
    finally { setSaving(false); }
  };
  return <Stack spacing={3}>
    {error && <Alert severity="error" action={!profile && <Button onClick={load}>Retry</Button>}>{error}</Alert>}
    {notice && <Alert severity="success">{notice}</Alert>}
    {!profile && !error && <CircularProgress />}
    {profile && <Paper variant="outlined" sx={{ p: 3 }}><Stack spacing={2} component="form" onSubmit={submit}>
      <Typography variant="h5">Professional Profile</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>{[['Department', profile.department?.name], ['Specialization', profile.specialization?.name], ['License number', profile.license_number], ['Consultation fee', profile.consultation_fee], ['Professional status', profile.professional_status]].map(([key, value]) => <Box key={key}><Typography variant="caption" color="text.secondary">{key}</Typography><Typography>{value || 'Not recorded'}</Typography></Box>)}</Box>
      <Alert severity="info">Department, specialization, license, fees, and professional status are managed by administration. Update your availability under My Schedule.</Alert>
      <TextField label="Room number" value={form.room_number} onChange={(e) => setForm({ ...form, room_number: e.target.value })} slotProps={{ htmlInput: { maxLength: 50 } }} />
      <TextField label="Professional biography" multiline minRows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} slotProps={{ htmlInput: { maxLength: 5000 } }} />
      <Button variant="contained" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save professional profile'}</Button>
    </Stack></Paper>}
    <Divider /><ProfilePage />
  </Stack>;
}

import { useEffect, useState } from 'react';
import { Alert, Button, CircularProgress, Divider, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import ProfilePage from '../shared/ProfilePage';
import { patientService as service, patientError } from '../../services/patientService';
export default function PatientProfilePage() {
  const [profile, setProfile] = useState(null); const [form, setForm] = useState({}); const [errors, setErrors] = useState({});
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [saving, setSaving] = useState(false); const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; setError('');
    service.profile().then((response) => { if (!active) return; const data = response.data.data; setProfile(data); setForm(Object.fromEntries(['date_of_birth','gender','blood_group','address','emergency_contact_name','emergency_contact_phone'].map((key) => [key, data[key] || '']))); }).catch((err) => { if (active) setError(patientError(err)); });
    return () => { active = false; };
  }, [revision]);
  const submit = async (event) => {
    event.preventDefault(); setError(''); setNotice(''); const invalid = {};
    ['date_of_birth','gender','address','emergency_contact_name','emergency_contact_phone'].forEach((key) => { if (!form[key]?.trim()) invalid[key] = ['This field is required.']; });
    if (form.emergency_contact_phone && !/^\+?[0-9]{9,15}$/.test(form.emergency_contact_phone)) invalid.emergency_contact_phone = ['Use 9–15 digits, optionally starting with +.'];
    setErrors(invalid); if (Object.keys(invalid).length) { setError('Please correct the highlighted fields.'); return; }
    setSaving(true);
    try { const response = await service.updateProfile(form); setProfile(response.data.data); setNotice('Patient profile updated.'); }
    catch (err) { setError(patientError(err)); setErrors(err.response?.data?.errors || {}); }
    finally { setSaving(false); }
  };
  return <Stack spacing={3}>
    {error && <Alert severity="error" action={!profile && <Button onClick={() => setRevision((value) => value + 1)}>Retry</Button>}>{error}</Alert>}{notice && <Alert severity="success">{notice}</Alert>}
    {!profile && !error && <CircularProgress />}
    {profile && <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}><Stack component="form" onSubmit={submit} noValidate spacing={2}>
      <Typography variant="h5">Patient Profile</Typography><Typography color="text.secondary">Patient number: {profile.patient_number}</Typography>
      {[
        ['date_of_birth','Date of birth','date'], ['gender','Gender','select'], ['blood_group','Blood group','select'], ['address','Residential address','text'], ['emergency_contact_name','Emergency contact name','text'], ['emergency_contact_phone','Emergency contact phone','tel'],
      ].map(([key, label, type]) => <TextField fullWidth key={key} label={label} value={form[key] || ''} onChange={(event) => setForm({ ...form, [key]: event.target.value })} required={key !== 'blood_group'} type={type === 'select' ? 'text' : type} select={type === 'select'} multiline={key === 'address'} minRows={key === 'address' ? 2 : undefined} slotProps={{ inputLabel: type === 'date' ? { shrink: true } : {} }} error={Boolean(errors[key])} helperText={errors[key]?.[0]}>{type === 'select' && [<MenuItem key="empty" value="">Not specified</MenuItem>, ...(key === 'gender' ? ['Male','Female','Other'] : ['A+','A-','B+','B-','AB+','AB-','O+','O-']).map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)]}</TextField>)}
      <Button variant="contained" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save patient profile'}</Button>
    </Stack></Paper>}
    <Divider /><ProfilePage />
  </Stack>;
}

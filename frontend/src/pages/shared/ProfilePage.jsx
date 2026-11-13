import { useState } from 'react';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import useAuth from '../../hooks/useAuth';
import authService from '../../services/authService';
export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ name: user.name, email: user.email, phone_number: user.phone_number, current_password: '', password: '', password_confirmation: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErrors({}); setError(''); setMessage('');
    try { const response = await authService.updateProfile(form); updateUser(response.data); setMessage('Profile updated.'); setForm({ ...form, password: '', current_password: '', password_confirmation: '' }); }
    catch (err) { setError(err.response?.data?.message || 'Could not update profile.'); setErrors(err.response?.data?.errors || {}); }
    finally { setBusy(false); }
  };
  return <Stack component="form" onSubmit={save} spacing={2} sx={{ maxWidth: 650 }}>
    <Typography variant="h5">My Profile</Typography>
    {message && <Alert severity="success">{message}</Alert>}{error && <Alert severity="error">{error}</Alert>}
    {Object.keys(form).map((key) => <TextField key={key} label={key.replaceAll('_', ' ')} type={key.includes('password') ? 'password' : key === 'email' ? 'email' : 'text'} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} error={Boolean(errors[key])} helperText={errors[key]?.[0] || (key === 'password' ? 'Optional. Use at least 8 characters with uppercase, lowercase, a number, and a symbol.' : '')} autoComplete={key.includes('password') ? 'new-password' : undefined} />)}
    <Button type="submit" variant="contained" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</Button>
  </Stack>;
}

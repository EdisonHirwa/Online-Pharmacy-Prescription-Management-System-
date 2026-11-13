import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import api from '../../services/axiosInstance';
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [form, setForm] = useState({ token: params.get('token') || '', email: params.get('email') || '', password: '', password_confirmation: '' });
  const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { const response = await api.post('/auth/reset-password', form); setMessage(response.data.message); }
    catch (err) { setError(Object.values(err.response?.data?.errors || {}).flat().join(' ') || err.response?.data?.message || 'Unable to reset password.'); }
    finally { setBusy(false); }
  };
  return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}><Paper sx={{ p: 4, width: '100%', maxWidth: 460 }}><Stack component="form" spacing={2} onSubmit={submit}>
    <Typography variant="h5">Reset Password</Typography>{error && <Alert severity="error">{error}</Alert>}{message && <Alert severity="success">{message}</Alert>}
    {!message && <>{['email', 'password', 'password_confirmation'].map((key) => <TextField required key={key} label={key.replaceAll('_', ' ')} type={key === 'email' ? 'email' : 'password'} value={form[key]} autoComplete={key === 'email' ? 'username' : 'new-password'} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />)}<Button type="submit" variant="contained" disabled={busy}>Reset password</Button></>}
    <Button component={Link} to="/login">Return to login</Button>
  </Stack></Paper></Box>;
}

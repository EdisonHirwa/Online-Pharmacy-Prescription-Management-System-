import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Alert, Box, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import useAuth from '../../hooks/useAuth';
const phone = yup.string().required('Phone number is required').matches(/^\+?[0-9]{9,15}$/, 'Use 9–15 digits, optionally starting with +.');
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const schema = yup.object({
  name: yup.string().trim().min(3, 'Enter at least 3 characters.').required('Full name is required'), email: yup.string().trim().email('Enter a valid email address').required('Email is required'), phone_number: phone,
  password: yup.string().required('Password is required').min(8, 'Use at least 8 characters').matches(/[A-Z]/, 'Include an uppercase letter').matches(/[a-z]/, 'Include a lowercase letter').matches(/[0-9]/, 'Include a number').matches(/[^A-Za-z0-9]/, 'Include a symbol'),
  password_confirmation: yup.string().required('Confirm your password').oneOf([yup.ref('password')], 'Passwords must match'),
  date_of_birth: yup.string().required('Date of birth is required').matches(/^\d{4}-\d{2}-\d{2}$/, 'Select a valid date').test('past', 'Date of birth cannot be in the future', (value) => !value || value <= localDate(new Date())),
  gender: yup.string().oneOf(['Male','Female','Other'], 'Choose your gender').required('Gender is required'), blood_group: yup.string(), address: yup.string().trim().required('Address is required'), emergency_contact_name: yup.string().trim().required('Emergency contact name is required'), emergency_contact_phone: phone,
});
const fields = [
  ['name','Full name','text'], ['email','Email address','email'], ['phone_number','Phone number','tel'], ['password','Password','password'], ['password_confirmation','Confirm password','password'], ['date_of_birth','Date of birth','date'], ['gender','Gender','select'], ['blood_group','Blood group (optional)','select'], ['address','Residential address','text'], ['emergency_contact_name','Emergency contact name','text'], ['emergency_contact_phone','Emergency contact phone','tel'],
];
export default function RegisterPage() {
  const { register: registerPatient } = useAuth(); const navigate = useNavigate(); const [error, setError] = useState('');
  const { control, handleSubmit, setError: setFieldError, formState: { isSubmitting } } = useForm({ resolver: yupResolver(schema), defaultValues: Object.fromEntries(fields.map(([key]) => [key, ''])) });
  const submit = async (data) => {
    setError('');
    try { await registerPatient(data); navigate('/patient/dashboard'); }
    catch (err) { const errors = err.response?.data?.errors || {}; Object.entries(errors).forEach(([key, messages]) => setFieldError(key, { message: messages[0] })); setError(err.response?.data?.message || 'Registration could not be completed. Please try again.'); }
  };
  return <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 4, px: 2, display: 'grid', placeItems: 'center' }}><Card sx={{ width: '100%', maxWidth: 800 }}><CardContent sx={{ p: { xs: 2, sm: 4 } }}><Stack component="form" onSubmit={handleSubmit(submit)} noValidate spacing={3}>
    <Box><Typography variant="h5" fontWeight={700}>Create Your Patient Account</Typography><Typography color="text.secondary">Book appointments and access your personal medical records securely.</Typography></Box>
    {error && <Alert severity="error">{error}</Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
      {fields.map(([key, label, type]) => <Controller key={key} name={key} control={control} render={({ field, fieldState }) => <TextField {...field} fullWidth label={label} required={key !== 'blood_group'} type={type === 'select' ? 'text' : type} select={type === 'select'} multiline={key === 'address'} minRows={key === 'address' ? 2 : undefined} error={Boolean(fieldState.error)} helperText={fieldState.error?.message || (key === 'password' ? 'At least 8 characters with uppercase, lowercase, a number, and a symbol.' : '')} autoComplete={key.includes('password') ? 'new-password' : key === 'email' ? 'email' : key === 'name' ? 'name' : undefined} slotProps={{ inputLabel: type === 'date' ? { shrink: true } : {}, htmlInput: type === 'date' ? { max: localDate(new Date()) } : {} }}>{type === 'select' && [<MenuItem key="empty" value="">Choose {key === 'gender' ? 'gender' : 'blood group'}</MenuItem>, ...(key === 'gender' ? ['Male','Female','Other'] : ['A+','A-','B+','B-','AB+','AB-','O+','O-']).map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)]}</TextField>} />)}
    </Box>
    <Button type="submit" variant="contained" disabled={isSubmitting}>{isSubmitting ? 'Creating account…' : 'Create patient account'}</Button><Button component={RouterLink} to="/login">Already registered? Sign in</Button>
  </Stack></CardContent></Card></Box>;
}

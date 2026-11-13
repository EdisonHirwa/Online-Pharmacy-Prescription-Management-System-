import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Alert, Box, Button, Chip, Divider, IconButton, InputAdornment, Link, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { ArrowForward, CheckCircleOutlined, LocalPharmacyOutlined, LockOutlined, Visibility, VisibilityOff } from '@mui/icons-material';
import useAuth from '../../hooks/useAuth';
const phone = yup.string().trim().required('Phone number is required.').matches(/^\+?[0-9]{9,15}$/, 'Use 9–15 digits, optionally starting with +.');
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const passwordRules = [
  ['8+ characters', (value) => value.length >= 8],
  ['Upper & lowercase', (value) => /[A-Z]/.test(value) && /[a-z]/.test(value)],
  ['A number', (value) => /[0-9]/.test(value)],
  ['A symbol', (value) => /[^A-Za-z0-9]/.test(value)],
];
const schema = yup.object({
  name: yup.string().trim().min(3, 'Enter at least 3 characters.').max(255).required('Full name is required.'),
  email: yup.string().trim().email('Enter a valid email address.').required('Email is required.'), phone_number: phone,
  password: yup.string().required('Password is required.').min(8, 'Use at least 8 characters.').matches(/[A-Z]/, 'Include an uppercase letter.').matches(/[a-z]/, 'Include a lowercase letter.').matches(/[0-9]/, 'Include a number.').matches(/[^A-Za-z0-9]/, 'Include a symbol.'),
  password_confirmation: yup.string().required('Confirm your password.').oneOf([yup.ref('password')], 'Passwords must match.'),
  date_of_birth: yup.string().required('Date of birth is required.').test('valid-date', 'Select a valid date of birth.', (value) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value)).test('past', 'Date of birth cannot be in the future.', (value) => !value || value <= localDate(new Date())),
  gender: yup.string().oneOf(['Male','Female','Other'], 'Choose your gender.').required('Gender is required.'),
  blood_group: yup.string().oneOf(['','A+','A-','B+','B-','AB+','AB-','O+','O-']),
  address: yup.string().trim().max(5000).required('Address is required.'),
  emergency_contact_name: yup.string().trim().max(255).required('Emergency contact name is required.'), emergency_contact_phone: phone,
});
const sections = [
  { title: 'Account details', description: 'Use an email address you can access.', fields: [
    ['name','Full name','text','name'], ['email','Email address','email','email'], ['phone_number','Phone number','tel','tel'], ['password','Password','password','new-password'], ['password_confirmation','Confirm password','password','new-password'],
  ] },
  { title: 'Personal information', description: 'These details help identify your patient record.', fields: [
    ['date_of_birth','Date of birth','date','bday'], ['gender','Gender','select','sex'], ['blood_group','Blood group','select',undefined], ['address','Residential address','text','street-address'],
  ] },
  { title: 'Emergency contact', description: 'Someone we can contact when you need assistance.', fields: [
    ['emergency_contact_name','Contact full name','text','section-emergency name'], ['emergency_contact_phone','Contact phone number','tel','section-emergency tel'],
  ] },
];
export default function RegisterPage() {
  const { register: registerPatient } = useAuth(); const navigate = useNavigate();
  const [error, setError] = useState(''); const [visible, setVisible] = useState({});
  const { control, handleSubmit, setError: setFieldError, setFocus, formState: { isSubmitting, errors, isSubmitted } } = useForm({ resolver: yupResolver(schema), mode: 'onTouched', defaultValues: Object.fromEntries(sections.flatMap((section) => section.fields.map(([key]) => [key, '']))) });
  const password = useWatch({ control, name: 'password' }) || '';
  const submit = async (data) => {
    setError('');
    try { await registerPatient(data); navigate('/patient/dashboard', { replace: true }); }
    catch (err) {
      const serverErrors = err.response?.data?.errors || {};
      Object.entries(serverErrors).forEach(([key, messages]) => setFieldError(key, { type: 'server', message: messages[0] }));
      const firstField = sections.flatMap((section) => section.fields.map(([key]) => key)).find((key) => serverErrors[key]);
      if (firstField) setFocus(firstField);
      setError(err.response?.data?.message || 'Registration could not be completed. Please try again.');
    }
  };
  return <Box component="main" sx={{ minHeight: '100vh', bgcolor: 'background.default', px: { xs: 2, sm: 4 }, py: { xs: 3, md: 5 } }}>
    <Box sx={{ maxWidth: 1160, mx: 'auto', display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '310px minmax(0, 1fr)' }, gap: { xs: 3, md: 5 }, alignItems: 'start' }}>
      <Stack component="aside" spacing={3} sx={{ position: { md: 'sticky' }, top: 40, pt: { md: 2 } }}>
        <Stack component={RouterLink} to="/login" direction="row" spacing={1.25} sx={{ alignItems: 'center', textDecoration: 'none', color: 'text.primary' }}><Box sx={{ width: 42, height: 42, bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 2, display: 'grid', placeItems: 'center' }}><LocalPharmacyOutlined /></Box><Typography variant="h5" fontWeight={800}>Online Pharmacy</Typography></Stack>
        <Box><Chip label="PATIENT REGISTRATION" size="small" variant="outlined" sx={{ mb: 2, color: 'primary.main', letterSpacing: 1, fontSize: 10, fontWeight: 700 }} /><Typography variant="h3" sx={{ fontSize: { xs: 30, md: 38 }, fontWeight: 800, lineHeight: 1.15, mb: 2 }}>Your care, all in one place.</Typography><Typography color="text.secondary">Create your account to manage prescriptions, book appointments, and keep track of your care.</Typography></Box>
        <Stack spacing={2} sx={{ display: { xs: 'none', md: 'flex' } }}>{['View your prescriptions and dispensing status','Access completed laboratory reports','Track invoices and payment history'].map((text) => <Stack direction="row" spacing={1.25} key={text}><CheckCircleOutlined sx={{ color: 'primary.main', fontSize: 21, mt: 0.2 }} /><Typography variant="body2" color="text.secondary">{text}</Typography></Stack>)}</Stack>
        <Typography variant="body2" color="text.secondary">Already have an account? <Link component={RouterLink} to="/login" fontWeight={700}>Sign in</Link></Typography>
      </Stack>
      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 12px 40px rgba(18, 38, 63, 0.04)' }}>
        <Box sx={{ px: { xs: 2.5, sm: 4 }, py: 3, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}><Typography component="h1" variant="h5" fontWeight={700}>Create your patient account</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>Fields marked * are required. Blood group is optional.</Typography></Box>
        <Stack component="form" onSubmit={handleSubmit(submit)} noValidate spacing={3} sx={{ p: { xs: 2.5, sm: 4 } }}>
          {error && <Alert severity="error" role="alert">{error}</Alert>}
          {isSubmitted && Object.keys(errors).length > 0 && !error && <Alert severity="error" role="alert">Please correct the highlighted fields before creating your account.</Alert>}
          {sections.map((section, index) => <Box component="section" aria-labelledby={`register-section-${index}`} key={section.title}>
            {index > 0 && <Divider sx={{ mb: 3 }} />}
            <Stack direction="row" spacing={1.5} sx={{ mb: 2.5, alignItems: 'center' }}><Box sx={{ width: 30, height: 30, flexShrink: 0, bgcolor: 'action.selected', color: 'primary.main', display: 'grid', placeItems: 'center', borderRadius: '50%', fontSize: 13, fontWeight: 700 }}>{index + 1}</Box><Box><Typography id={`register-section-${index}`} fontWeight={700}>{section.title}</Typography><Typography variant="caption" color="text.secondary">{section.description}</Typography></Box></Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2.25 }}>
              {section.fields.map(([key, label, type, autoComplete]) => <Controller key={key} name={key} control={control} render={({ field: { ref, ...field }, fieldState }) => <Box sx={{ gridColumn: ['phone_number','address'].includes(key) ? '1 / -1' : undefined, minWidth: 0 }}>
                <TextField {...field} inputRef={ref} fullWidth label={label} required={key !== 'blood_group'} disabled={isSubmitting} type={type === 'select' ? 'text' : type === 'password' && visible[key] ? 'text' : type} select={type === 'select'} multiline={key === 'address'} minRows={key === 'address' ? 2 : undefined} error={Boolean(fieldState.error)} helperText={fieldState.error?.message || (type === 'tel' ? 'Example: +250788123456' : key === 'blood_group' ? 'Leave blank if unknown.' : undefined)} autoComplete={autoComplete} slotProps={{ inputLabel: type === 'date' ? { shrink: true } : undefined, htmlInput: { max: type === 'date' ? localDate(new Date()) : undefined, maxLength: key === 'address' ? 5000 : type === 'tel' ? 16 : key.includes('name') ? 255 : undefined, inputMode: type === 'tel' ? 'tel' : undefined }, input: type === 'password' ? { endAdornment: <InputAdornment position="end"><IconButton type="button" disabled={isSubmitting} onClick={() => setVisible((previous) => ({ ...previous, [key]: !previous[key] }))} onMouseDown={(event) => event.preventDefault()} aria-label={`${visible[key] ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={Boolean(visible[key])} edge="end">{visible[key] ? <VisibilityOff /> : <Visibility />}</IconButton></InputAdornment> } : undefined }}>
                  {type === 'select' && [<MenuItem key="empty" value="">{key === 'gender' ? 'Choose gender' : 'Unknown / not provided'}</MenuItem>, ...(key === 'gender' ? ['Male','Female','Other'] : ['A+','A-','B+','B-','AB+','AB-','O+','O-']).map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)]}
                </TextField>
                {key === 'password' && <Box id="password-requirements" sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>{passwordRules.map(([text, valid]) => <Chip key={text} size="small" label={`${valid(password) ? '✓ ' : ''}${text}`} variant="outlined" sx={{ fontSize: 10, height: 23, color: valid(password) ? 'primary.main' : 'text.secondary', borderColor: valid(password) ? 'primary.main' : 'divider' }} />)}</Box>}
              </Box>} />)}
            </Box>
          </Box>)}
          <Divider />
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><LockOutlined sx={{ fontSize: 17, color: 'primary.main' }} /><Typography variant="caption" color="text.secondary">Your account gives you access to your personal patient records.</Typography></Stack>
          <Button type="submit" size="large" variant="contained" disabled={isSubmitting} endIcon={!isSubmitting && <ArrowForward />} sx={{ py: 1.5 }}>{isSubmitting ? 'Creating your account…' : 'Create patient account'}</Button>
          <Typography variant="body2" color="text.secondary" textAlign="center">Already registered? <Link component={RouterLink} to="/login" fontWeight={600}>Sign in to Online Pharmacy</Link></Typography>
        </Stack>
      </Paper>
    </Box>
  </Box>;
}

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  MenuItem,
  Grid,
  Divider,
} from '@mui/material';
import { LocalHospital, ArrowBack, HowToReg } from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { brandColors } from '../../theme/palette';

const registerSchema = yup.object().shape({
  name: yup.string().required('Full name is required').min(3, 'At least 3 characters'),
  email: yup.string().email('Enter a valid email address').required('Email is required'),
  phone_number: yup
    .string()
    .required('Phone number is required')
    .matches(/^[+]?[0-9]{9,15}$/, 'Enter a valid numeric phone number (e.g. +250788111222)'),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Must contain at least one uppercase letter')
    .matches(/[0-9]/, 'Must contain at least one number')
    .matches(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  password_confirmation: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password'), null], 'Passwords must match'),
  date_of_birth: yup
    .date()
    .typeError('Select a valid date of birth')
    .required('Date of birth is required')
    .max(new Date(), 'Date of birth cannot be in the future'),
  gender: yup.string().required('Select your gender'),
  blood_group: yup.string().required('Select blood group'),
  address: yup.string().required('Residential address is required'),
  emergency_contact_name: yup.string().required('Emergency contact name is required'),
  emergency_contact_phone: yup
    .string()
    .required('Emergency contact phone is required')
    .matches(/^[+]?[0-9]{9,15}$/, 'Valid phone number required'),
});

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register: registerPatient } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [backendErrors, setBackendErrors] = useState({});
  const [generalError, setGeneralError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      phone_number: '',
      password: '',
      password_confirmation: '',
      date_of_birth: '1998-01-01',
      gender: 'Female',
      blood_group: 'O+',
      address: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
    },
  });

  const onSubmit = async (data) => {
    setSubmitting(true);
    setBackendErrors({});
    setGeneralError('');
    try {
      const formattedData = {
        ...data,
        date_of_birth: data.date_of_birth instanceof Date ? data.date_of_birth.toISOString().split('T')[0] : data.date_of_birth,
      };
      await registerPatient(formattedData);
      navigate('/patient/dashboard');
    } catch (err) {
      if (err.response?.status === 422 && err.response.data?.errors) {
        setBackendErrors(err.response.data.errors);
      } else {
        setGeneralError(err.response?.data?.message || 'Registration failed. Please check your data.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        py: 4,
        px: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Card
        sx={{
          maxWidth: 780,
          width: '100%',
          p: { xs: 2, sm: 4 },
          borderRadius: 3,
          boxShadow: '0 8px 30px rgba(18, 38, 63, 0.08)',
        }}
      >
        <CardContent sx={{ p: 0 }}>
          {/* Top Brand Banner */}
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '8px',
                bgcolor: 'primary.main',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LocalHospital sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'secondary.main' }}>
                MediCare Patient Registration
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Create your patient portal account for electronic prescriptions, appointments and medical records
              </Typography>
            </Box>
          </Stack>

          <Divider sx={{ my: 3 }} />

          {generalError && (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                bgcolor: brandColors.coral[50],
                color: brandColors.coral.main,
                border: `1px solid ${brandColors.coral[200]}`,
              }}
            >
              {generalError}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Grid container spacing={2.5}>
              {/* Account Credentials */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ color: 'primary.main', fontWeight: 600 }}>
                  1. Login & Account Credentials
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Full Name"
                  placeholder="e.g. Marie Claire Uwase"
                  {...register('name')}
                  error={Boolean(errors.name || backendErrors.name)}
                  helperText={errors.name?.message || backendErrors.name?.[0]}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email Address"
                  placeholder="patient@example.com"
                  {...register('email')}
                  error={Boolean(errors.email || backendErrors.email)}
                  helperText={errors.email?.message || backendErrors.email?.[0]}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  placeholder="+250788000000"
                  {...register('phone_number')}
                  error={Boolean(errors.phone_number || backendErrors.phone_number)}
                  helperText={errors.phone_number?.message || backendErrors.phone_number?.[0]}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Date of Birth"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  {...register('date_of_birth')}
                  error={Boolean(errors.date_of_birth || backendErrors.date_of_birth)}
                  helperText={errors.date_of_birth?.message || backendErrors.date_of_birth?.[0]}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Password (min 8, uppercase, number & symbol)"
                  type="password"
                  {...register('password')}
                  error={Boolean(errors.password || backendErrors.password)}
                  helperText={errors.password?.message || backendErrors.password?.[0]}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Confirm Password"
                  type="password"
                  {...register('password_confirmation')}
                  error={Boolean(errors.password_confirmation)}
                  helperText={errors.password_confirmation?.message}
                />
              </Grid>

              {/* Medical & Personal Details */}
              <Grid item xs={12} sx={{ mt: 1 }}>
                <Typography variant="subtitle2" sx={{ color: 'primary.main', fontWeight: 600 }}>
                  2. Medical Demographics & Residential Info
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="Gender"
                  defaultValue="Female"
                  {...register('gender')}
                  error={Boolean(errors.gender)}
                  helperText={errors.gender?.message}
                >
                  {GENDER_OPTIONS.map((g) => (
                    <MenuItem key={g} value={g}>
                      {g}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="Blood Group"
                  defaultValue="O+"
                  {...register('blood_group')}
                  error={Boolean(errors.blood_group)}
                  helperText={errors.blood_group?.message}
                >
                  {BLOOD_GROUPS.map((bg) => (
                    <MenuItem key={bg} value={bg}>
                      {bg}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Residential Address"
                  placeholder="Street / District / City"
                  {...register('address')}
                  error={Boolean(errors.address)}
                  helperText={errors.address?.message}
                />
              </Grid>

              {/* Emergency Contact */}
              <Grid item xs={12} sx={{ mt: 1 }}>
                <Typography variant="subtitle2" sx={{ color: 'primary.main', fontWeight: 600 }}>
                  3. Emergency Contact
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Emergency Contact Name"
                  placeholder="Next of kin full name"
                  {...register('emergency_contact_name')}
                  error={Boolean(errors.emergency_contact_name)}
                  helperText={errors.emergency_contact_name?.message}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Emergency Contact Phone"
                  placeholder="+250788000000"
                  {...register('emergency_contact_phone')}
                  error={Boolean(errors.emergency_contact_phone)}
                  helperText={errors.emergency_contact_phone?.message}
                />
              </Grid>

              <Grid item xs={12} sx={{ mt: 2 }}>
                <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
                  <Button
                    component={RouterLink}
                    to="/login"
                    startIcon={<ArrowBack />}
                    sx={{ color: 'text.secondary' }}
                  >
                    Back to Sign In
                  </Button>

                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    size="large"
                    disabled={submitting}
                    startIcon={<HowToReg />}
                    sx={{ px: 4, py: 1.2, fontWeight: 600 }}
                  >
                    {submitting ? 'Registering...' : 'Complete Registration'}
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default RegisterPage;

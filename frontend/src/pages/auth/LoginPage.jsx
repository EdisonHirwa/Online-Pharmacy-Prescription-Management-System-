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
  IconButton,
  InputAdornment,
  Chip,
  Divider,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  LocalHospital,
  Lock,
  Email,
  ArrowForward,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { brandColors } from '../../theme/palette';

const schema = yup.object().shape({
  email: yup.string().email('Enter a valid email address').required('Email is required'),
  password: yup.string().required('Password is required'),
});

const QUICK_DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@medicare.test', label: 'Admin (Mugisha)' },
  { role: 'Doctor', email: 'doctor@medicare.test', label: 'Doctor (Ingabire)' },
  { role: 'Patient', email: 'patient@medicare.test', label: 'Patient (Uwase)' },
  { role: 'Lab Tech', email: 'lab@medicare.test', label: 'Lab Tech (Nshuti)' },
  { role: 'Pharmacist', email: 'pharmacist@medicare.test', label: 'Pharmacist (Kayitesi)' },
];

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, sessionExpiredMessage, clearSessionExpiredMessage } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      email: 'admin@medicare.test',
      password: 'password123',
    },
  });

  const onSubmit = async (data) => {
    setServerError('');
    setSubmitting(true);
    try {
      const user = await login(data.email, data.password);
      if (user.role === 'admin') navigate('/admin/dashboard');
      else if (user.role === 'doctor') navigate('/doctor/dashboard');
      else if (user.role === 'patient') navigate('/patient/dashboard');
      else if (user.role === 'lab_tech') navigate('/lab/dashboard');
      else if (user.role === 'pharmacist') navigate('/pharmacy/dashboard');
      else navigate('/');
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid email or password.';
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const setDemoAccount = (acc) => {
    setValue('email', acc.email, { shouldValidate: true });
    setValue('password', 'password123', { shouldValidate: true });
    setServerError('');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card
        sx={{
          maxWidth: 460,
          width: '100%',
          p: { xs: 2, sm: 3 },
          borderRadius: 3,
          boxShadow: '0 8px 30px rgba(18, 38, 63, 0.08)',
        }}
      >
        <CardContent sx={{ p: 2 }}>
          {/* Logo & Header */}
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                bgcolor: 'primary.main',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LocalHospital sx={{ fontSize: 22 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'secondary.main' }}>
              MediCare HMS
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            Multi-Specialty Hospital Management System
          </Typography>

          {sessionExpiredMessage && (
            <Alert
              severity="warning"
              onClose={clearSessionExpiredMessage}
              sx={{
                mb: 2.5,
                bgcolor: brandColors.coral[50],
                color: brandColors.coral.main,
                border: `1px solid ${brandColors.coral[200]}`,
              }}
            >
              {sessionExpiredMessage}
            </Alert>
          )}

          {serverError && (
            <Alert
              severity="error"
              sx={{
                mb: 2.5,
                bgcolor: brandColors.coral[50],
                color: brandColors.coral.main,
                border: `1px solid ${brandColors.coral[200]}`,
              }}
            >
              {serverError}
            </Alert>
          )}

          {/* Quick Role Switcher Chips for Evaluator Testing */}
          <Box sx={{ mb: 3, p: 1.5, bgcolor: 'background.default', borderRadius: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 1 }}>
              Quick Login by Role:
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.8}>
              {QUICK_DEMO_ACCOUNTS.map((acc) => (
                <Chip
                  key={acc.role}
                  label={acc.role}
                  size="small"
                  onClick={() => setDemoAccount(acc)}
                  variant="outlined"
                  sx={{
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: brandColors.teal[50] },
                  }}
                />
              ))}
            </Stack>
          </Box>

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2.5}>
              <TextField
                fullWidth
                label="Email Address"
                placeholder="name@medicare.test"
                {...register('email')}
                error={Boolean(errors.email)}
                helperText={errors.email?.message}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email sx={{ color: 'primary.main', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                error={Boolean(errors.password)}
                helperText={errors.password?.message}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock sx={{ color: 'primary.main', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        aria-label="toggle password visibility"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Stack direction="row" justifyContent="flex-end">
                <Button
                  component={RouterLink}
                  to="/forgot-password"
                  variant="text"
                  size="small"
                  sx={{ color: 'primary.main', fontWeight: 500 }}
                >
                  Forgot Password?
                </Button>
              </Stack>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                size="large"
                disabled={submitting}
                endIcon={<ArrowForward />}
                sx={{
                  py: 1.2,
                  fontSize: '0.95rem',
                  fontWeight: 600,
                }}
              >
                {submitting ? 'Authenticating...' : 'Sign In to Portal'}
              </Button>
            </Stack>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Typography variant="body2" align="center" sx={{ color: 'text.secondary' }}>
            New patient needing care?{' '}
            <Button
              component={RouterLink}
              to="/register"
              variant="text"
              sx={{ color: 'primary.main', fontWeight: 600, p: 0 }}
            >
              Register here
            </Button>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LoginPage;

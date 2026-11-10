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
  InputAdornment,
} from '@mui/material';
import { Email, ArrowBack, Send } from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Link as RouterLink } from 'react-router-dom';
import authService from '../../services/authService';
import { brandColors } from '../../theme/palette';

const schema = yup.object().shape({
  email: yup.string().email('Enter a valid email address').required('Email address is required'),
});

export const ForgotPasswordPage = () => {
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await authService.forgotPassword(data.email);
      setSuccessMsg('Password reset link has been dispatched to your email address.');
    } catch {
      setErrorMsg('Unable to process password reset. Please verify your email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Card
        sx={{
          maxWidth: 440,
          width: '100%',
          p: 3,
          borderRadius: 3,
          boxShadow: '0 8px 30px rgba(18, 38, 63, 0.08)',
        }}
      >
        <CardContent sx={{ p: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'secondary.main', mb: 1 }}>
            Reset Password
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            Enter your registered hospital email address to receive password recovery instructions.
          </Typography>

          {successMsg && (
            <Alert
              severity="success"
              sx={{
                mb: 2.5,
                bgcolor: brandColors.teal[50],
                color: brandColors.teal.main,
                border: `1px solid ${brandColors.teal[200]}`,
              }}
            >
              {successMsg}
            </Alert>
          )}

          {errorMsg && (
            <Alert
              severity="error"
              sx={{
                mb: 2.5,
                bgcolor: brandColors.coral[50],
                color: brandColors.coral.main,
                border: `1px solid ${brandColors.coral[200]}`,
              }}
            >
              {errorMsg}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2.5}>
              <TextField
                fullWidth
                label="Email Address"
                placeholder="name@example.com"
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

              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                disabled={loading}
                endIcon={<Send />}
                sx={{ py: 1.2, fontWeight: 600 }}
              >
                {loading ? 'Sending Link...' : 'Send Recovery Link'}
              </Button>

              <Button
                component={RouterLink}
                to="/login"
                startIcon={<ArrowBack />}
                sx={{ color: 'text.secondary', textTransform: 'none' }}
              >
                Return to Login
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ForgotPasswordPage;

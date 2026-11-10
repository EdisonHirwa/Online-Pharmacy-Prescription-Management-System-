import React from 'react';
import { Box, Typography, Button, Paper, Stack } from '@mui/material';
import { Security as SecurityIcon, Home as HomeIcon } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { brandColors } from '../../theme/palette';

export const ForbiddenPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const required = location.state?.requiredRoles?.join(', ');

  const handleReturn = () => {
    if (user?.role === 'admin') navigate('/admin/dashboard');
    else if (user?.role === 'doctor') navigate('/doctor/dashboard');
    else if (user?.role === 'patient') navigate('/patient/dashboard');
    else if (user?.role === 'lab_tech') navigate('/lab/dashboard');
    else if (user?.role === 'pharmacist') navigate('/pharmacy/dashboard');
    else navigate('/login');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 3,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 500,
          width: '100%',
          p: 5,
          textAlign: 'center',
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            width: 80,
            height: 80,
            mx: 'auto',
            mb: 3,
            borderRadius: '50%',
            bgcolor: brandColors.coral[50],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: brandColors.coral.main,
          }}
        >
          <SecurityIcon sx={{ fontSize: 44 }} />
        </Box>

        <Typography variant="h4" sx={{ fontWeight: 700, color: 'secondary.main', mb: 1 }}>
          403 – Access Forbidden
        </Typography>

        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
          You do not have administrative or role clearance to access this hospital resource.
          {required && (
            <Typography variant="caption" display="block" sx={{ mt: 1, color: brandColors.coral.main }}>
              Restricted to: {required}
            </Typography>
          )}
        </Typography>

        <Stack direction="row" spacing={2} justifyContent="center">
          <Button
            variant="contained"
            color="primary"
            startIcon={<HomeIcon />}
            onClick={handleReturn}
          >
            Back to Safe Dashboard
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default ForbiddenPage;

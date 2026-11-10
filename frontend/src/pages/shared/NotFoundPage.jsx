import React from 'react';
import { Box, Typography, Button, Paper, Stack } from '@mui/material';
import { SearchOff as SearchOffIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { brandColors } from '../../theme/palette';

export const NotFoundPage = () => {
  const navigate = useNavigate();

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
          maxWidth: 480,
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
            bgcolor: brandColors.navy[50],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'secondary.main',
          }}
        >
          <SearchOffIcon sx={{ fontSize: 44 }} />
        </Box>

        <Typography variant="h3" sx={{ fontWeight: 800, color: 'secondary.main', mb: 1 }}>
          404
        </Typography>

        <Typography variant="h6" sx={{ color: 'text.primary', mb: 1 }}>
          Page Not Found
        </Typography>

        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          The requested page or record could not be found or may have been relocated.
        </Typography>

        <Stack direction="row" spacing={2} justifyContent="center">
          <Button
            variant="contained"
            color="primary"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
          >
            Go Back
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default NotFoundPage;

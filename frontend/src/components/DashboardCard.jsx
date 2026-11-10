import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { WarningAmber as WarningIcon } from '@mui/icons-material';
import { brandColors } from '../theme/palette';

export const DashboardCard = ({
  title,
  value,
  variant = 'default', // 'default' | 'inverted' | 'accent'
  icon = null,
  subtitle = null,
}) => {
  const isInverted = variant === 'inverted';

  return (
    <Card
      sx={{
        borderRadius: 3,
        bgcolor: isInverted ? brandColors.navy.main : 'background.paper',
        color: isInverted ? '#FFFFFF' : 'text.primary',
        border: '1px solid',
        borderColor: isInverted ? brandColors.navy.main : 'divider',
        boxShadow: isInverted
          ? '0 6px 20px rgba(18, 38, 63, 0.25)'
          : '0 2px 10px rgba(18, 38, 63, 0.04)',
        transition: 'transform 0.15s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {isInverted && <WarningIcon sx={{ fontSize: 18, color: brandColors.coral.main }} />}
          {!isInverted && icon}
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              color: isInverted ? 'rgba(255, 255, 255, 0.85)' : 'text.secondary',
              fontSize: '0.875rem',
            }}
          >
            {title}
          </Typography>
        </Box>

        <Typography
          variant="h3"
          sx={{
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: isInverted ? '#FFFFFF' : 'secondary.main',
            fontSize: { xs: '2rem', sm: '2.4rem' },
          }}
        >
          {value}
        </Typography>

        {subtitle && (
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 0.5,
              color: isInverted ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary',
            }}
          >
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default DashboardCard;

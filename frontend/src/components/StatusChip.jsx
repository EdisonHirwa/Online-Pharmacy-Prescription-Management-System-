import React from 'react';
import { Chip } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  AccessTime as AccessTimeIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  HourglassEmpty as ProcessingIcon,
} from '@mui/icons-material';
import { brandColors } from '../theme/palette';

/**
 * StatusChip adheres strictly to the 3-brand color design rules:
 * Completed/Active = filled Medical Teal + check icon
 * Pending/Requested = outlined Teal/Navy + clock icon
 * Cancelled/Rejected/Low-stock/Overdue = Coral + warning/close icon
 * Processing/Assigned = soft Teal tint
 */
export const StatusChip = ({ status, label: customLabel, size = 'small', sx = {} }) => {
  const norm = (status || '').toLowerCase().trim();

  // Completed / Active / Dispensed / Admitted
  if (['completed', 'active', 'dispensed', 'paid', 'success', 'available'].includes(norm)) {
    return (
      <Chip
        icon={<CheckCircleIcon sx={{ fontSize: 16, color: '#FFFFFF !important' }} />}
        label={customLabel || norm.charAt(0).toUpperCase() + norm.slice(1)}
        size={size}
        sx={{
          bgcolor: brandColors.teal.main,
          color: '#FFFFFF',
          fontWeight: 600,
          borderRadius: 1.5,
          px: 0.5,
          ...sx,
        }}
      />
    );
  }

  // Pending / Requested / Unpaid / Preliminary
  if (['pending', 'requested', 'unpaid', 'partially_paid', 'partially_dispensed'].includes(norm)) {
    return (
      <Chip
        icon={<AccessTimeIcon sx={{ fontSize: 15, color: `${brandColors.teal.main} !important` }} />}
        label={customLabel || (norm === 'partially_paid' ? 'Partially Paid' : norm.charAt(0).toUpperCase() + norm.slice(1))}
        size={size}
        variant="outlined"
        sx={{
          borderColor: brandColors.teal.main,
          color: brandColors.teal.main,
          fontWeight: 600,
          borderRadius: 2,
          px: 0.5,
          bgcolor: 'transparent',
          ...sx,
        }}
      />
    );
  }

  // Processing / Confirmed / Occupied
  if (['processing', 'confirmed', 'occupied', 'assigned'].includes(norm)) {
    return (
      <Chip
        icon={<ProcessingIcon sx={{ fontSize: 15, color: `${brandColors.navy.main} !important` }} />}
        label={customLabel || norm.charAt(0).toUpperCase() + norm.slice(1)}
        size={size}
        sx={{
          bgcolor: brandColors.navy[50],
          color: brandColors.navy.main,
          border: `1px solid ${brandColors.navy[200]}`,
          fontWeight: 600,
          borderRadius: 1.5,
          px: 0.5,
          ...sx,
        }}
      />
    );
  }

  // Cancelled / Rejected / Low Stock / Unavailable / Inactive / Failed / Suspicious
  return (
    <Chip
      icon={<CloseIcon sx={{ fontSize: 15, color: '#FFFFFF !important' }} />}
      label={customLabel || norm.charAt(0).toUpperCase() + norm.slice(1)}
      size={size}
      sx={{
        bgcolor: brandColors.navy.main,
        color: '#FFFFFF',
        fontWeight: 600,
        borderRadius: 1.5,
        px: 0.5,
        border: `1px solid ${brandColors.coral.main}`,
        ...sx,
      }}
    />
  );
};

export default StatusChip;

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { brandColors } from '../theme/palette';

export const ConfirmDialog = ({
  open,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  loading = false,
  onConfirm,
  onClose,
}) => {
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      PaperProps={{
        sx: {
          borderRadius: 3,
          p: 1,
          maxWidth: 440,
          width: '100%',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
        {isDestructive && (
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              bgcolor: brandColors.coral[50],
              color: brandColors.coral.main,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <WarningIcon sx={{ fontSize: 20 }} />
          </Box>
        )}
        {title}
      </DialogTitle>

      <DialogContent>
        <DialogContentText sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
          {message}
        </DialogContentText>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          sx={{ color: 'text.secondary', textTransform: 'none' }}
        >
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          variant="contained"
          sx={{
            bgcolor: isDestructive ? brandColors.coral.main : brandColors.teal.main,
            color: '#FFFFFF',
            textTransform: 'none',
            fontWeight: 600,
            '&:hover': {
              bgcolor: isDestructive ? brandColors.coral[700] : brandColors.teal[700],
            },
          }}
        >
          {loading ? 'Processing...' : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;

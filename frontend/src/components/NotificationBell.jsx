import React, { useState } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button,
} from '@mui/material';
import { Notifications as NotificationsIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { brandColors } from '../theme/palette';
import { MOCK_NOTIFICATIONS } from '../services/mockData';

export const NotificationBell = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <Button
        variant="outlined"
        onClick={handleClick}
        sx={{
          borderRadius: 2,
          borderColor: 'divider',
          color: 'text.primary',
          textTransform: 'none',
          px: 1.5,
          py: 0.6,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 0.8,
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'action.hover',
          },
        }}
        aria-label="notifications"
      >
        <Badge
          badgeContent={unreadCount}
          sx={{
            '& .MuiBadge-badge': {
              bgcolor: brandColors.teal.main,
              color: '#FFFFFF',
              fontSize: '0.7rem',
              height: 18,
              minWidth: 18,
            },
          }}
        >
          <NotificationsIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        </Badge>
        <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8125rem' }}>
          Bell
        </Typography>
      </Button>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: 360,
            maxHeight: 460,
            borderRadius: 3,
            boxShadow: '0 10px 30px rgba(18, 38, 63, 0.15)',
            border: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'secondary.main' }}>
            Notifications ({unreadCount} unread)
          </Typography>
          {unreadCount > 0 && (
            <Button
              size="small"
              onClick={markAllRead}
              startIcon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
              sx={{ color: 'primary.main', fontSize: '0.75rem' }}
            >
              Mark all read
            </Button>
          )}
        </Box>
        <Divider />
        <List sx={{ p: 0, overflowY: 'auto', maxHeight: 350 }}>
          {notifications.map((item) => (
            <ListItem
              key={item.id}
              sx={{
                py: 1.5,
                px: 2,
                bgcolor: item.is_read ? 'transparent' : brandColors.teal[50],
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <ListItemText
                primary={
                  <Typography variant="body2" sx={{ fontWeight: item.is_read ? 500 : 700, color: 'text.primary' }}>
                    {item.title}
                  </Typography>
                }
                secondary={
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                    {item.message}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>
      </Popover>
    </>
  );
};

export default NotificationBell;

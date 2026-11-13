import React, { useEffect, useState } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  InputAdornment,
  Button,
  Avatar,
  Menu,
  MenuItem,
  IconButton,
  Divider,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  Menu as MenuIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import api from '../services/axiosInstance';
import { useThemeMode } from '../contexts/ThemeContext';
import NotificationBell from '../components/NotificationBell';
import { brandColors } from '../theme/palette';

const SIDEBAR_WIDTH = 260;

// Nav items per role matching database modules
const ROLE_NAV_ITEMS = {
  admin: [
    { label: 'Dashboard', path: '/admin/dashboard' },
    { label: 'Users & Access', path: '/admin/users' },
    { label: 'Organization & Services', path: '/admin/organization' },
    { label: 'Patients', path: '/admin/patients' },
    { label: 'Doctors & Schedules', path: '/admin/doctors' },
    { label: 'Appointments', path: '/admin/appointments' },
    { label: 'Laboratory', path: '/admin/laboratory' },
    { label: 'Pharmacy', path: '/admin/pharmacy' },
    { label: 'Wards & Beds', path: '/admin/wards-beds' },
    { label: 'Billing & Payments', path: '/admin/billing' },
    { label: 'Reports', path: '/admin/reports' },
    { label: 'Audit Logs', path: '/admin/audit-logs' },
    { label: 'Hospital Settings', path: '/admin/settings' },
    { label: 'My Profile', path: '/admin/profile' },
  ],
  doctor: [
    { label: 'Dashboard', path: '/doctor/dashboard' },
    { label: 'My Schedule', path: '/doctor/schedules' },
    { label: 'My Appointments', path: '/doctor/appointments' },
    { label: 'Patient History', path: '/doctor/patients' },
    { label: 'Prescriptions', path: '/doctor/prescriptions' },
    { label: 'Lab Requests', path: '/doctor/lab-requests' },
  ],
  patient: [
    { label: 'Dashboard', path: '/patient/dashboard' },
    { label: 'Book Appointment', path: '/patient/book-appointment' },
    { label: 'My Appointments', path: '/patient/appointments' },
    { label: 'Medical Records', path: '/patient/medical-records' },
    { label: 'Prescriptions', path: '/patient/prescriptions' },
    { label: 'Lab Reports', path: '/patient/lab-reports' },
    { label: 'Invoices & Payments', path: '/patient/invoices' },
  ],
  lab_tech: [
    { label: 'Dashboard', path: '/lab/dashboard' },
    { label: 'Investigation Queue', path: '/lab/queue' },
    { label: 'Process Tests', path: '/lab/process' },
    { label: 'Report Upload', path: '/lab/reports' },
  ],
  pharmacist: [
    { label: 'Dashboard', path: '/pharmacy/dashboard' },
    { label: 'Prescription Queue', path: '/pharmacy/queue' },
    { label: 'Dispense Screen', path: '/pharmacy/dispense' },
    { label: 'Medicine Inventory', path: '/pharmacy/inventory' },
    { label: 'Stock Movements', path: '/pharmacy/movements' },
  ],
};

const getRoleTitle = (role) => {
  switch (role) {
    case 'admin':
      return 'Admin Dashboard';
    case 'doctor':
      return 'Doctor Consultation Portal';
    case 'patient':
      return 'Patient Health Portal';
    case 'lab_tech':
      return 'Laboratory Investigation Portal';
    case 'pharmacist':
      return 'Pharmacy & Dispensing Portal';
    default:
      return 'Hospital Management System';
  }
};

const getUserInitials = (name, role) => {
  if (role === 'admin') return 'AD';
  if (!name) return 'MC';
  const parts = name.replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.)\s*/i, '').trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

export const DashboardLayout = () => {
  const [globalSearch, setGlobalSearch] = useState('');
  const [hospitalName, setHospitalName] = useState('MediCare HMS');
  useEffect(() => {
    const load = () => api.get('/configuration').then((response) => setHospitalName(response.data.data.hospital_name || 'MediCare HMS')).catch(() => {});
    load(); window.addEventListener('hospital:configuration-updated', load);
    return () => window.removeEventListener('hospital:configuration-updated', load);
  }, []);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarAnchor, setAvatarAnchor] = useState(null);

  const { user, role, logout } = useAuth();
  const { isDark, toggleTheme } = useThemeMode();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = ROLE_NAV_ITEMS[role] || ROLE_NAV_ITEMS.admin;

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavClick = (path) => {
    navigate(path);
    if (isMobile) setMobileOpen(false);
  };

  const handleLogout = async () => {
    setAvatarAnchor(null);
    await logout();
    navigate('/login');
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 3 }}>
      {/* Brand Logo in exact layout from reference */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 4,
          cursor: 'pointer',
        }}
        onClick={() => navigate(`/${role}/dashboard`)}
      >
        <Typography
          variant="h5"
          component="span"
          sx={{
            color: 'primary.main',
            fontWeight: 700,
            lineHeight: 1,
            fontSize: '1.6rem',
          }}
        >
          +
        </Typography>
        <Typography
          variant="h6"
          component="span"
          sx={{
            fontWeight: 700,
            color: isDark ? '#FFFFFF' : brandColors.navy.main,
            letterSpacing: '-0.02em',
            fontSize: '1.15rem',
          }}
        >
          {hospitalName}
        </Typography>
      </Box>

      {/* Navigation Links */}
      <List sx={{ p: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== `/${role}/dashboard` && location.pathname.startsWith(item.path));
          return (
            <ListItemButton
              key={item.label}
              onClick={() => handleNavClick(item.path)}
              sx={{
                borderRadius: 2,
                px: 2,
                py: 1,
                bgcolor: isActive
                  ? isDark
                    ? brandColors.teal.main
                    : brandColors.navy.main
                  : 'transparent',
                color: isActive
                  ? '#FFFFFF'
                  : isDark
                  ? brandColors.navy[200]
                  : '#546B89',
                fontWeight: isActive ? 600 : 500,
                '&:hover': {
                  bgcolor: isActive
                    ? isDark
                      ? brandColors.teal[700]
                      : brandColors.navy[700]
                    : 'action.hover',
                  color: isActive ? '#FFFFFF' : 'text.primary',
                },
              }}
            >
              <ListItemText
                primary={item.label}
                slotProps={{ primary: { sx: { color: 'inherit', fontSize: '0.9rem', fontWeight: isActive ? 600 : 500 } } }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ mt: 'auto', pt: 2 }}>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
          Logged in as:
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', textTransform: 'capitalize' }}>
          {user?.name || 'User'} ({role?.replace('_', ' ')})
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { xs: '100%', md: `calc(100% - ${SIDEBAR_WIDTH}px)` },
          ml: { md: `${SIDEBAR_WIDTH}px` },
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          color: 'text.primary',
          boxShadow: 'none',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, sm: 4 }, py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {isMobile && (
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ mr: 1 }}
              >
                <MenuIcon />
              </IconButton>
            )}
            <Typography variant="h5" sx={{ fontWeight: 700, color: isDark ? '#FFFFFF' : 'secondary.main', fontSize: { xs: '1.1rem', sm: '1.4rem' } }}>
              {navItems.find((item) => location.pathname === item.path)?.label || getRoleTitle(role)}
            </Typography>
          </Box>

          {/* Right Header Controls matching reference design */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1.5 }, flexShrink: 0 }}>
            <TextField
              size="small"
              placeholder="Search patients…"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && role === 'admin') navigate(`/admin/patients?search=${encodeURIComponent(globalSearch)}`); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                display: { xs: 'none', sm: 'block' },
                width: 240,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: isDark ? 'background.default' : '#FFFFFF',
                  fontSize: '0.8125rem',
                },
              }}
            />

            {/* Theme Toggle Pill Button */}
            <Button
              variant="outlined"
              onClick={toggleTheme}
              startIcon={isDark ? <LightModeIcon sx={{ fontSize: 16 }} /> : <DarkModeIcon sx={{ fontSize: 16 }} />}
              sx={{
                borderRadius: 2,
                borderColor: 'divider',
                color: 'text.primary',
                textTransform: 'none',
                px: 1.5,
                py: 0.6,
                fontSize: '0.8125rem',
                minWidth: 0,
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover',
                },
              }}
            >
              {isDark ? 'Light' : 'Dark'}
            </Button>

            {/* Notification Bell */}
            <NotificationBell />

            {/* User Avatar Chip */}
            <IconButton
              onClick={(e) => setAvatarAnchor(e.currentTarget)}
              sx={{ p: 0 }}
              aria-label="user profile menu"
            >
              <Avatar
                sx={{
                  bgcolor: brandColors.navy.main,
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  width: 38,
                  height: 38,
                  border: `2px solid ${isDark ? brandColors.teal.main : brandColors.navy[200]}`,
                }}
              >
                {getUserInitials(user?.name, role)}
              </Avatar>
            </IconButton>

            <Menu
              anchorEl={avatarAnchor}
              open={Boolean(avatarAnchor)}
              onClose={() => setAvatarAnchor(null)}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              PaperProps={{
                sx: { width: 220, borderRadius: 2, mt: 1, p: 0.5 },
              }}
            >
              <Box sx={{ px: 2, py: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {user?.name || 'MediCare User'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {user?.email}
                </Typography>
              </Box>
              <Divider />
              <MenuItem onClick={() => { setAvatarAnchor(null); navigate(role === 'admin' ? '/admin/profile' : `/${role}/dashboard`); }}>
                <PersonIcon sx={{ fontSize: 18, mr: 1, color: 'primary.main' }} /> Profile Info
              </MenuItem>
              <MenuItem onClick={handleLogout} sx={{ color: brandColors.coral.main }}>
                <LogoutIcon sx={{ fontSize: 18, mr: 1 }} /> Sign Out
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Responsive Navigation Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: SIDEBAR_WIDTH }, flexShrink: { md: 0 } }}
        aria-label="hospital navigation folders"
      >
        {isMobile ? (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: SIDEBAR_WIDTH,
                bgcolor: 'background.paper',
              },
            }}
          >
            {drawerContent}
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            sx={{
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: SIDEBAR_WIDTH,
                bgcolor: 'background.paper',
                borderRight: '1px solid',
                borderColor: 'divider',
              },
            }}
            open
          >
            {drawerContent}
          </Drawer>
        )}
      </Box>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          p: { xs: 2, sm: 3, md: 4 },
          width: { xs: '100%', md: `calc(100% - ${SIDEBAR_WIDTH}px)` },
          mt: 8,
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default DashboardLayout;

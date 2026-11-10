import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
} from '@mui/material';
import {
  AddCircle as AddIcon,
  EventNote as EventNoteIcon,
  People as PeopleIcon,
  Science as ScienceIcon,
} from '@mui/icons-material';
import DashboardCard from '../../components/DashboardCard';
import DataTable from '../../components/DataTable';
import StatusChip from '../../components/StatusChip';
import axiosInstance from '../../services/axiosInstance';
import { brandColors } from '../../theme/palette';

export const DoctorDashboard = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [consultationDialogOpen, setConsultationDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  useEffect(() => {
    axiosInstance.get('/appointments').then((res) => {
      setAppointments(res.data.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleOpenConsultation = (row) => {
    setSelectedAppointment(row);
    setConsultationDialogOpen(true);
  };

  const columns = [
    { id: 'appointment_number', label: 'Apt No.', render: (r) => <strong>{r.appointment_number}</strong> },
    { id: 'patient_name', label: 'Patient Name' },
    { id: 'appointment_date', label: 'Date' },
    { id: 'appointment_time', label: 'Time' },
    { id: 'reason', label: 'Clinical Reason' },
    { id: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
    {
      id: 'actions',
      label: 'Actions',
      render: (r) => (
        <Button
          size="small"
          variant="contained"
          color="primary"
          onClick={() => handleOpenConsultation(r)}
          sx={{ textTransform: 'none', py: 0.5, fontSize: '0.75rem' }}
        >
          Consult
        </Button>
      ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* KPI Row */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Today's Appointments"
            value="8"
            icon={<EventNoteIcon sx={{ color: 'primary.main', fontSize: 20 }} />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Patients Consulted"
            value="3"
            icon={<PeopleIcon sx={{ color: 'primary.main', fontSize: 20 }} />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Pending Lab Results"
            value="4"
            icon={<ScienceIcon sx={{ color: 'primary.main', fontSize: 20 }} />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Next Available Slot"
            value="14:30"
            subtitle="Pediatric Cardiology Clinic"
          />
        </Grid>
      </Grid>

      {/* Appointment Consultation Queue */}
      <DataTable
        title="My Patient Consultation Queue"
        columns={columns}
        data={appointments}
        loading={loading}
        footerCaption="Doctors can initiate clinical notes, prescriptions, and lab requests directly from each queue entry."
      />

      {/* Consultation Dialog */}
      <Dialog
        open={consultationDialogOpen}
        onClose={() => setConsultationDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'secondary.main' }}>
          Record Consultation: {selectedAppointment?.patient_name} ({selectedAppointment?.appointment_number})
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            fullWidth
            label="Clinical Diagnosis"
            placeholder="Primary diagnostic finding"
            multiline
            rows={2}
          />
          <TextField
            fullWidth
            label="Consultation Notes & Symptoms"
            placeholder="Patient reported symptoms, vitals, physical examination..."
            multiline
            rows={3}
          />
          <TextField
            fullWidth
            label="Treatment Recommendations & Follow-Up"
            placeholder="Care instructions, lifestyle advice, follow-up period..."
            multiline
            rows={2}
          />
          <TextField
            fullWidth
            type="date"
            label="Follow-Up Date (Optional)"
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setConsultationDialogOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              alert('Consultation recorded successfully!');
              setConsultationDialogOpen(false);
            }}
          >
            Save & Finalize Consultation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DoctorDashboard;

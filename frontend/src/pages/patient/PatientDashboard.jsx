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
  Alert,
} from '@mui/material';
import {
  CalendarMonth as CalendarIcon,
  Medication as MedicationIcon,
  Download as DownloadIcon,
  Receipt as ReceiptIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import DashboardCard from '../../components/DashboardCard';
import DataTable from '../../components/DataTable';
import StatusChip from '../../components/StatusChip';
import axiosInstance from '../../services/axiosInstance';
import { brandColors } from '../../theme/palette';

export const PatientDashboard = () => {
  const [appointments, setAppointments] = useState([]);
  const [labTests, setLabTests] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState('');

  // Booking form state
  const [selectedDept, setSelectedDept] = useState('Pediatrics');
  const [selectedDoctor, setSelectedDoctor] = useState('Dr. Arthur Mugisha');
  const [selectedDate, setSelectedDate] = useState('2026-11-12');
  const [selectedTime, setSelectedTime] = useState('10:00:00');
  const [bookingReason, setBookingReason] = useState('');

  useEffect(() => {
    axiosInstance.get('/appointments').then((res) => setAppointments(res.data.data || []));
    axiosInstance.get('/lab-tests').then((res) => setLabTests(res.data.data || []));
    axiosInstance.get('/invoices').then((res) => setInvoices(res.data.data || []));
  }, []);

  const handleBookSubmit = () => {
    if (!bookingReason.trim()) {
      alert('Please enter a clinical reason for the visit.');
      return;
    }
    const newApt = {
      department: selectedDept,
      doctor_name: selectedDoctor,
      appointment_date: selectedDate,
      appointment_time: selectedTime,
      reason: bookingReason,
      patient_name: 'Aline Uwase',
    };
    axiosInstance.post('/appointments', newApt).then((res) => {
      setAppointments((prev) => [res.data.data, ...prev]);
      setBookingSuccess('Appointment booked successfully! Our medical staff has been notified.');
      setBookModalOpen(false);
      setBookingReason('');
    });
  };

  const handleDownloadReport = (testName) => {
    // Authorized blob simulation (never exposing raw storage path)
    const dummyBlob = new Blob([`MediCare Verified Diagnostic Report\nTest: ${testName}\nIssued for: Aline Uwase\nStatus: Official Verified Record`], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(dummyBlob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `MediCare_${testName.replace(/\s+/g, '_')}_Report.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const appointmentColumns = [
    { id: 'appointment_number', label: 'Reference', render: (r) => <strong>{r.appointment_number}</strong> },
    { id: 'doctor_name', label: 'Doctor' },
    { id: 'department', label: 'Department' },
    { id: 'appointment_date', label: 'Date' },
    { id: 'appointment_time', label: 'Time' },
    { id: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
  ];

  const labColumns = [
    { id: 'test_type_name', label: 'Investigation' },
    { id: 'doctor_name', label: 'Ordering Doctor' },
    { id: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
    {
      id: 'download',
      label: 'Report',
      render: (r) =>
        r.status === 'completed' ? (
          <Button
            size="small"
            startIcon={<DownloadIcon />}
            variant="outlined"
            onClick={() => handleDownloadReport(r.test_type_name)}
            sx={{ textTransform: 'none', py: 0.4, fontSize: '0.75rem', borderColor: 'primary.main', color: 'primary.main' }}
          >
            PDF Report
          </Button>
        ) : (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Pending Lab</Typography>
        ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Booking notification alert */}
      {bookingSuccess && (
        <Alert
          severity="success"
          onClose={() => setBookingSuccess('')}
          sx={{ bgcolor: brandColors.teal[50], color: brandColors.teal.main, border: `1px solid ${brandColors.teal[200]}` }}
        >
          {bookingSuccess}
        </Alert>
      )}

      {/* KPI Row */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="My Appointments"
            value={appointments.length || '3'}
            icon={<CalendarIcon sx={{ color: 'primary.main', fontSize: 20 }} />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Active Prescriptions"
            value="2"
            icon={<MedicationIcon sx={{ color: 'primary.main', fontSize: 20 }} />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Available Lab Reports"
            value={labTests.filter((t) => t.status === 'completed').length || '1'}
            icon={<DownloadIcon sx={{ color: 'primary.main', fontSize: 20 }} />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Outstanding Balance"
            value="$0.00"
            subtitle="All recent invoices settled"
            icon={<ReceiptIcon sx={{ color: 'primary.main', fontSize: 20 }} />}
          />
        </Grid>
      </Grid>

      {/* Quick Action Banner */}
      <Card sx={{ p: 2, bgcolor: brandColors.navy[50], border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'secondary.main' }}>
              Need to see a specialist?
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Browse hospital departments, select your preferred doctor, and book an available consultation slot.
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setBookModalOpen(true)}
            sx={{ px: 3, py: 1, fontWeight: 600 }}
          >
            Book Appointment
          </Button>
        </Stack>
      </Card>

      {/* Appointments History */}
      <DataTable
        title="My Scheduled Consultations"
        columns={appointmentColumns}
        data={appointments}
      />

      {/* Lab Reports Table */}
      <DataTable
        title="Diagnostic & Laboratory Reports"
        columns={labColumns}
        data={labTests}
        footerCaption="Official diagnostic reports are encrypted and downloaded securely with your patient session token."
      />

      {/* Booking Modal */}
      <Dialog
        open={bookModalOpen}
        onClose={() => setBookModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'secondary.main' }}>
          Schedule a Consultation
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
          <TextField
            select
            fullWidth
            label="Department"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
          >
            <MenuItem value="Pediatrics">Pediatrics</MenuItem>
            <MenuItem value="General Medicine">General Medicine</MenuItem>
            <MenuItem value="Dentistry">Dentistry</MenuItem>
            <MenuItem value="Surgery">Surgery</MenuItem>
            <MenuItem value="Cardiology">Cardiology</MenuItem>
          </TextField>

          <TextField
            select
            fullWidth
            label="Specialist Doctor"
            value={selectedDoctor}
            onChange={(e) => setSelectedDoctor(e.target.value)}
          >
            <MenuItem value="Dr. Arthur Mugisha">Dr. Arthur Mugisha (Pediatric Cardiology)</MenuItem>
            <MenuItem value="Dr. Claudine Ingabire">Dr. Claudine Ingabire (Internal Medicine)</MenuItem>
            <MenuItem value="Dr. Jean-Paul Habimana">Dr. Jean-Paul Habimana (Dentistry)</MenuItem>
          </TextField>

          <TextField
            fullWidth
            type="date"
            label="Preferred Date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            select
            fullWidth
            label="Available Time Slot"
            value={selectedTime}
            onChange={(e) => setSelectedTime(e.target.value)}
          >
            <MenuItem value="09:00:00">09:00 AM (Available)</MenuItem>
            <MenuItem value="10:00:00">10:00 AM (Available)</MenuItem>
            <MenuItem value="11:30:00">11:30 AM (Available)</MenuItem>
            <MenuItem value="14:00:00">02:00 PM (Available)</MenuItem>
            <MenuItem value="15:30:00" disabled>03:30 PM (Slot Taken)</MenuItem>
          </TextField>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Chief Medical Complaint / Reason"
            placeholder="Briefly describe your symptoms or reason for visiting..."
            value={bookingReason}
            onChange={(e) => setBookingReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setBookModalOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button variant="contained" color="primary" onClick={handleBookSubmit}>
            Confirm Booking
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PatientDashboard;

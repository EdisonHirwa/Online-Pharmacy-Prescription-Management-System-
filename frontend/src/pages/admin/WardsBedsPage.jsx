import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
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
  Hotel as BedIcon,
  CheckCircle as AvailableIcon,
  MeetingRoom as WardIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import DataTable from '../../components/DataTable';
import StatusChip from '../../components/StatusChip';
import ConfirmDialog from '../../components/ConfirmDialog';
import axiosInstance from '../../services/axiosInstance';
import { brandColors } from '../../theme/palette';

export const WardsBedsPage = () => {
  const [wards, setWards] = useState([]);
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dischargeDialogOpen, setDischargeDialogOpen] = useState(false);
  const [admitDialogOpen, setAdmitDialogOpen] = useState(false);
  const [selectedBed, setSelectedBed] = useState(null);
  const [patientName, setPatientName] = useState('');
  const [admissionError, setAdmissionError] = useState('');

  useEffect(() => {
    Promise.all([
      axiosInstance.get('/wards'),
      axiosInstance.get('/beds'),
    ]).then(([wRes, bRes]) => {
      setWards(wRes.data.data || []);
      setBeds(bRes.data.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleOpenAdmit = (bed) => {
    if (bed.availability_status === 'occupied') {
      setAdmissionError(`Bed ${bed.bed_number} currently has an active admitted patient (${bed.current_patient}). A bed cannot have two active admissions.`);
      return;
    }
    setAdmissionError('');
    setSelectedBed(bed);
    setPatientName('');
    setAdmitDialogOpen(true);
  };

  const handleConfirmAdmit = () => {
    if (!patientName.trim()) {
      alert('Please enter a patient name for admission.');
      return;
    }
    setBeds((prev) =>
      prev.map((b) =>
        b.id === selectedBed.id
          ? { ...b, availability_status: 'occupied', current_patient: patientName }
          : b
      )
    );
    setAdmitDialogOpen(false);
  };

  const handleOpenDischarge = (bed) => {
    setSelectedBed(bed);
    setDischargeDialogOpen(true);
  };

  const handleConfirmDischarge = () => {
    setBeds((prev) =>
      prev.map((b) =>
        b.id === selectedBed.id
          ? { ...b, availability_status: 'available', current_patient: null }
          : b
      )
    );
    setDischargeDialogOpen(false);
  };

  const columns = [
    { id: 'bed_number', label: 'Bed No.', render: (r) => <strong>{r.bed_number}</strong> },
    { id: 'ward_name', label: 'Ward Name' },
    { id: 'bed_type', label: 'Bed Type' },
    {
      id: 'availability_status',
      label: 'Status',
      render: (r) => <StatusChip status={r.availability_status} />,
    },
    {
      id: 'current_patient',
      label: 'Current Occupant',
      render: (r) => r.current_patient || <Typography variant="caption" sx={{ color: 'text.secondary' }}>Vacant</Typography>,
    },
    {
      id: 'actions',
      label: 'Admission Actions',
      render: (r) => (
        <Stack direction="row" spacing={1}>
          {r.availability_status === 'available' ? (
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={() => handleOpenAdmit(r)}
              sx={{ textTransform: 'none', py: 0.4, fontSize: '0.75rem' }}
            >
              Admit Patient
            </Button>
          ) : r.availability_status === 'occupied' ? (
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleOpenDischarge(r)}
              sx={{
                textTransform: 'none',
                py: 0.4,
                fontSize: '0.75rem',
                borderColor: brandColors.coral.main,
                color: brandColors.coral.main,
                '&:hover': { bgcolor: brandColors.coral[50] },
              }}
            >
              Discharge Patient
            </Button>
          ) : (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Maintenance</Typography>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'secondary.main' }}>
          Hospital Wards & Bed Admissions
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Monitor inpatient ward capacity, bed availability status, and patient admissions and discharge workflow.
        </Typography>
      </Box>

      {admissionError && (
        <Alert
          severity="error"
          onClose={() => setAdmissionError('')}
          sx={{ bgcolor: brandColors.coral[50], color: brandColors.coral.main, border: `1px solid ${brandColors.coral[200]}` }}
        >
          {admissionError}
        </Alert>
      )}

      {/* Ward Capacity Cards */}
      <Grid container spacing={2.5}>
        {wards.map((w) => (
          <Grid item xs={12} sm={6} md={3} key={w.id}>
            <Card sx={{ borderRadius: 3, p: 1, border: '1px solid', borderColor: 'divider' }}>
              <CardContent>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 0.5 }}>
                  {w.name}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                  {w.ward_type}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: 'secondary.main' }}>
                  {w.occupied_beds} / {w.total_beds}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Beds Occupied ({( (w.occupied_beds / w.total_beds) * 100).toFixed(0)}% capacity)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Hospital Beds DataTable */}
      <DataTable
        title="Bed Census & Inpatient Allocation"
        columns={columns}
        data={beds}
        loading={loading}
        footerCaption="Admissions enforce strict 1-to-1 patient-to-bed allocation rules. Discharge requires recorded medical clearance."
      />

      {/* Admit Dialog */}
      <Dialog
        open={admitDialogOpen}
        onClose={() => setAdmitDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'secondary.main' }}>
          Admit Patient to Bed {selectedBed?.bed_number}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Ward: <strong>{selectedBed?.ward_name}</strong> | Type: <strong>{selectedBed?.bed_type}</strong>
          </Typography>

          <TextField
            fullWidth
            label="Patient Name"
            placeholder="e.g. Aline Uwase"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
          />
          <TextField
            fullWidth
            multiline
            rows={2}
            label="Admission Medical Note"
            placeholder="Admission reason, attending physician..."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setAdmitDialogOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button variant="contained" color="primary" onClick={handleConfirmAdmit}>
            Admit Patient
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Discharge Dialog */}
      <ConfirmDialog
        open={dischargeDialogOpen}
        title="Discharge Patient"
        message={`Are you sure you want to discharge ${selectedBed?.current_patient} from bed ${selectedBed?.bed_number}? Discharge date will be recorded and bed marked as available.`}
        confirmText="Confirm Discharge"
        isDestructive={true}
        onConfirm={handleConfirmDischarge}
        onClose={() => setDischargeDialogOpen(false)}
      />
    </Box>
  );
};

export default WardsBedsPage;

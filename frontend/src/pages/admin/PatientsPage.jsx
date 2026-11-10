import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Stack,
  Typography,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import DataTable from '../../components/DataTable';
import StatusChip from '../../components/StatusChip';
import axiosInstance from '../../services/axiosInstance';
import { brandColors } from '../../theme/palette';

export const PatientsPage = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // New patient state
  const [newPatient, setNewPatient] = useState({
    name: '',
    email: '',
    phone_number: '',
    date_of_birth: '1995-01-01',
    gender: 'Female',
    blood_group: 'O+',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  });

  useEffect(() => {
    axiosInstance.get('/patients').then((res) => {
      setPatients(res.data.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleOpenDetails = (patient) => {
    setSelectedPatient(patient);
    setDetailsOpen(true);
  };

  const handleAddPatient = () => {
    if (!newPatient.name || !newPatient.email || !newPatient.phone_number) {
      alert('Please fill in required patient fields.');
      return;
    }
    axiosInstance.post('/patients', newPatient).then((res) => {
      setPatients((prev) => [res.data.data, ...prev]);
      setAddOpen(false);
      setNewPatient({
        name: '',
        email: '',
        phone_number: '',
        date_of_birth: '1995-01-01',
        gender: 'Female',
        blood_group: 'O+',
        address: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
      });
    });
  };

  const columns = [
    { id: 'patient_number', label: 'Patient No.', render: (r) => <strong>{r.patient_number}</strong> },
    { id: 'name', label: 'Full Name' },
    { id: 'gender', label: 'Gender' },
    { id: 'blood_group', label: 'Blood Group', render: (r) => <Chip label={r.blood_group} size="small" sx={{ fontWeight: 700 }} /> },
    { id: 'phone_number', label: 'Contact Phone' },
    { id: 'emergency_contact_name', label: 'Emergency Contact' },
    {
      id: 'actions',
      label: 'Medical Record',
      render: (r) => (
        <Button
          size="small"
          variant="outlined"
          startIcon={<ViewIcon />}
          onClick={() => handleOpenDetails(r)}
          sx={{ textTransform: 'none', py: 0.4, fontSize: '0.75rem', borderColor: 'primary.main', color: 'primary.main' }}
        >
          View Chart
        </Button>
      ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'secondary.main' }}>
            Patient Electronic Health Records (EHR)
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Comprehensive demographics, allergies, medical history and clinical tracking.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setAddOpen(true)}
          sx={{ fontWeight: 600 }}
        >
          Register Patient
        </Button>
      </Stack>

      <DataTable
        columns={columns}
        data={patients}
        loading={loading}
        searchPlaceholder="Search patients by name, number, or phone..."
      />

      {/* View Chart / Allergies Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'secondary.main' }}>
          Clinical Chart: {selectedPatient?.name} ({selectedPatient?.patient_number})
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
          <Box sx={{ p: 2, bgcolor: brandColors.navy[50], borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ color: 'secondary.main', fontWeight: 700, mb: 1 }}>
              Patient Demographics:
            </Typography>
            <Typography variant="body2">
              DOB: {selectedPatient?.date_of_birth} | Gender: {selectedPatient?.gender} | Blood Group: <strong>{selectedPatient?.blood_group}</strong>
            </Typography>
            <Typography variant="body2">
              Address: {selectedPatient?.address} | Phone: {selectedPatient?.phone_number}
            </Typography>
            <Typography variant="body2">
              Emergency Contact: {selectedPatient?.emergency_contact_name} ({selectedPatient?.emergency_contact_phone})
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'secondary.main', mb: 1 }}>
              Recorded Patient Allergies:
            </Typography>
            {selectedPatient?.allergies && selectedPatient.allergies.length > 0 ? (
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {selectedPatient.allergies.map((alg) => (
                  <Chip
                    key={alg.id}
                    icon={<WarningIcon sx={{ color: `${brandColors.coral.main} !important` }} />}
                    label={`${alg.allergy_name} (${alg.severity}): ${alg.reaction_description}`}
                    sx={{
                      bgcolor: brandColors.coral[50],
                      color: brandColors.coral.main,
                      border: `1px solid ${brandColors.coral[200]}`,
                      fontWeight: 600,
                    }}
                  />
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No known drug or dietary allergies recorded for this patient.
              </Typography>
            )}
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'secondary.main', mb: 1 }}>
              Medical History & Chronic Conditions:
            </Typography>
            {selectedPatient?.medical_histories && selectedPatient.medical_histories.length > 0 ? (
              selectedPatient.medical_histories.map((hist) => (
                <Box key={hist.id} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {hist.condition} (Diagnosed: {hist.recorded_date})
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {hist.diagnosis_details}
                  </Typography>
                  {hist.treatment_history && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                      Treatment: {hist.treatment_history}
                    </Typography>
                  )}
                </Box>
              ))
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No past medical conditions on file.
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDetailsOpen(false)} variant="contained" color="primary">
            Close Chart
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Patient Dialog */}
      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'secondary.main' }}>
          New Patient Admission & Chart
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            fullWidth
            label="Full Name"
            value={newPatient.name}
            onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
          />
          <TextField
            fullWidth
            label="Email Address"
            value={newPatient.email}
            onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
          />
          <TextField
            fullWidth
            label="Phone Number"
            value={newPatient.phone_number}
            onChange={(e) => setNewPatient({ ...newPatient, phone_number: e.target.value })}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              select
              fullWidth
              label="Gender"
              value={newPatient.gender}
              onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
            >
              <MenuItem value="Male">Male</MenuItem>
              <MenuItem value="Female">Female</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </TextField>
            <TextField
              select
              fullWidth
              label="Blood Group"
              value={newPatient.blood_group}
              onChange={(e) => setNewPatient({ ...newPatient, blood_group: e.target.value })}
            >
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                <MenuItem key={bg} value={bg}>{bg}</MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField
            fullWidth
            label="Residential Address"
            value={newPatient.address}
            onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              fullWidth
              label="Emergency Contact Name"
              value={newPatient.emergency_contact_name}
              onChange={(e) => setNewPatient({ ...newPatient, emergency_contact_name: e.target.value })}
            />
            <TextField
              fullWidth
              label="Emergency Phone"
              value={newPatient.emergency_contact_phone}
              onChange={(e) => setNewPatient({ ...newPatient, emergency_contact_phone: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setAddOpen(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleAddPatient}>Save Patient</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PatientsPage;

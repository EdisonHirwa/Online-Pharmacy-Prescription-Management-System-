import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';
import {
  MedicalServices as MedicalServicesIcon,
  Schedule as ScheduleIcon,
  Room as RoomIcon,
} from '@mui/icons-material';
import DataTable from '../../components/DataTable';
import StatusChip from '../../components/StatusChip';
import axiosInstance from '../../services/axiosInstance';
import { brandColors } from '../../theme/palette';

export const DoctorsPage = () => {
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  useEffect(() => {
    Promise.all([
      axiosInstance.get('/doctors'),
      axiosInstance.get('/departments'),
    ]).then(([docRes, deptRes]) => {
      setDoctors(docRes.data.data || []);
      setDepartments(deptRes.data.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleOpenSchedule = (doc) => {
    setSelectedDoctor(doc);
    setScheduleModalOpen(true);
  };

  const columns = [
    { id: 'name', label: 'Doctor Name', render: (r) => <strong>{r.name}</strong> },
    { id: 'department_name', label: 'Department' },
    { id: 'specialization_name', label: 'Specialization' },
    { id: 'license_number', label: 'License' },
    { id: 'consultation_fee', label: 'Consultation Fee', render: (r) => `$${Number(r.consultation_fee).toFixed(2)}` },
    { id: 'room_number', label: 'Room' },
    { id: 'professional_status', label: 'Status', render: (r) => <StatusChip status={r.professional_status} /> },
    {
      id: 'actions',
      label: 'Schedules',
      render: (r) => (
        <Button
          size="small"
          variant="outlined"
          startIcon={<ScheduleIcon />}
          onClick={() => handleOpenSchedule(r)}
          sx={{ textTransform: 'none', py: 0.4, fontSize: '0.75rem', borderColor: 'primary.main', color: 'primary.main' }}
        >
          View Timetable
        </Button>
      ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'secondary.main' }}>
          Doctors & Clinical Schedules
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Manage medical specialists, departments, consultation fees, and recurring shift timetables.
        </Typography>
      </Box>

      {/* Hospital Departments Cards */}
      <Grid container spacing={2}>
        {departments.map((dept) => (
          <Grid item xs={12} sm={6} md={2.4} key={dept.id}>
            <Card sx={{ borderRadius: 2, height: '100%', border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  {dept.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                  {dept.doctor_count} Physicians On Staff
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Doctors Table */}
      <DataTable
        columns={columns}
        data={doctors}
        loading={loading}
        title="Active Medical Practitioners"
        searchPlaceholder="Search doctors by name or specialization..."
      />

      {/* Doctor Schedule Dialog */}
      <Dialog
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'secondary.main' }}>
          Consultation Timetable: {selectedDoctor?.name}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {selectedDoctor?.department_name} – {selectedDoctor?.specialization_name} ({selectedDoctor?.room_number})
          </Typography>

          <Divider />

          {selectedDoctor?.schedules && selectedDoctor.schedules.length > 0 ? (
            <Stack spacing={1.5}>
              {selectedDoctor.schedules.map((sch) => (
                <Box
                  key={sch.id}
                  sx={{
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    bgcolor: brandColors.navy[50],
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'secondary.main' }}>
                      {sch.day_of_week}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {sch.start_time} - {sch.end_time} ({sch.slot_duration} min slots)
                    </Typography>
                  </Box>
                  <StatusChip status={sch.is_available ? 'active' : 'inactive'} customLabel={sch.is_available ? 'Active' : 'Off'} />
                </Box>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No custom recurring schedule loaded for this physician.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setScheduleModalOpen(false)} variant="contained" color="primary">
            Close Timetable
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DoctorsPage;

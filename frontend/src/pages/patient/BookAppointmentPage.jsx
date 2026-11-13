import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, MenuItem, Paper, Stack, TextField, Typography, Pagination } from '@mui/material';
import ConfirmDialog from '../../components/ConfirmDialog';
import { patientService as service, patientError } from '../../services/patientService';

export default function BookAppointmentPage() {
  const [params] = useSearchParams(); const appointmentId = params.get('appointment'); const navigate = useNavigate();
  const [directory, setDirectory] = useState(null);
  const [departments, setDepartments] = useState(''); const [specialization, setSpecialization] = useState('');
  const [search, setSearch] = useState(params.get('search') || ''); const [query, setQuery] = useState(params.get('search') || ''); const [page, setPage] = useState(1);
  const [doctors, setDoctors] = useState([]); const [pages, setPages] = useState(1); const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [doctor, setDoctor] = useState(null); const [date, setDate] = useState(''); const [time, setTime] = useState(''); const [reason, setReason] = useState('');
  const [slots, setSlots] = useState([]); const [loadingSlots, setLoadingSlots] = useState(false); const [slotsError, setSlotsError] = useState('');
  const [error, setError] = useState(''); const [errors, setErrors] = useState({}); const [confirm, setConfirm] = useState(false); const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0); const [slotsRevision, setSlotsRevision] = useState(0); const [initializing, setInitializing] = useState(true);
  useEffect(() => {
    let active = true; setInitializing(true); setError('');
    const load = async () => {
      try {
        const response = await service.directory(); if (!active) return; setDirectory(response.data.data);
        if (appointmentId) {
          const appointment = (await service.get('appointments', appointmentId)).data.data; if (!active) return;
          if (!appointment.can_manage) throw new Error('This appointment cannot be rescheduled.');
          setDepartments(appointment.doctor?.department?.id || ''); setSpecialization(appointment.doctor?.specialization?.id || '');
          setDoctor(appointment.doctor); setDate(appointment.appointment_date.slice(0, 10)); setReason(appointment.reason); setTime('');
        }
      } catch (err) { if (active) setError(err.response ? patientError(err) : err.message || patientError(err)); }
      finally { if (active) setInitializing(false); }
    };
    load(); return () => { active = false; };
  }, [appointmentId, revision]);
  useEffect(() => { setSearch(params.get('search') || ''); }, [params]);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    const controller = new AbortController(); setLoadingDoctors(true);
    service.doctors({ department_id: departments || undefined, specialization_id: specialization || undefined, search: query, page, per_page: 6 }, controller.signal)
      .then((response) => { setDoctors(response.data.data); setPages(response.data.meta.last_page); })
      .catch((err) => { if (err.code !== 'ERR_CANCELED') setError(patientError(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoadingDoctors(false); });
    return () => controller.abort();
  }, [departments, specialization, query, page, revision]);
  useEffect(() => {
    setTime(''); setSlots([]); setSlotsError('');
    if (!doctor || !date) { setLoadingSlots(false); return; }
    const controller = new AbortController(); setLoadingSlots(true);
    service.slots(doctor.id, date, appointmentId, controller.signal).then((response) => setSlots(response.data.data))
      .catch((err) => { if (err.code !== 'ERR_CANCELED') setSlotsError(patientError(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoadingSlots(false); });
    return () => controller.abort();
  }, [doctor, date, appointmentId, slotsRevision]);
  const selectDoctor = (record) => { setDoctor(record); setTime(''); setErrors({}); };
  const review = (event) => {
    event.preventDefault(); const invalid = {};
    if (!doctor) invalid.doctor_id = ['Choose a doctor.']; if (!date) invalid.appointment_date = ['Choose an appointment date.'];
    if (!time) invalid.appointment_time = ['Select an available consultation slot.'];
    if (reason.trim().length < 3) invalid.reason = ['Please describe your reason for the appointment.'];
    setErrors(invalid); if (!Object.keys(invalid).length) setConfirm(true);
  };
  const submit = async () => {
    setSaving(true); setError(''); setErrors({});
    try {
      await service.book({ doctor_id: doctor.id, appointment_date: date, appointment_time: time, reason }, appointmentId);
      navigate('/patient/appointments', { replace: true, state: { message: appointmentId ? 'Appointment rescheduled. Your doctor will confirm the new request.' : 'Appointment requested successfully. Your doctor will confirm it.' } });
    } catch (err) {
      setError(patientError(err)); setErrors(err.response?.data?.errors || {}); setConfirm(false);
      if (err.response?.status === 409) setSlotsRevision((value) => value + 1);
    } finally { setSaving(false); }
  };
  if (initializing) return <CircularProgress />;
  return <Stack spacing={3} sx={{ minWidth: 0 }}>
    <Typography variant="h5" fontWeight={700}>{appointmentId ? 'Reschedule Appointment' : 'Find a Doctor & Book an Appointment'}</Typography>
    {error && <Alert severity="error" action={<Button onClick={() => setRevision((value) => value + 1)}>Retry</Button>}>{error}</Alert>}
    {directory && !directory.can_book && <Alert severity="warning">Your account can browse doctors but does not have appointment-booking permission.</Alert>}
    <Paper variant="outlined" sx={{ p: 2 }}><Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2, '& > .MuiTextField-root': { width: { xs: '100%', sm: 230 } } }}>
      <TextField label="Department" select value={departments} onChange={(e) => { setDepartments(e.target.value); setSpecialization(''); setDoctor(null); setPage(1); }}><MenuItem value="">All departments</MenuItem>{directory?.departments.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField>
      <TextField label="Specialization" select value={specialization} onChange={(e) => { setSpecialization(e.target.value); setDoctor(null); setPage(1); }}><MenuItem value="">All specializations</MenuItem>{directory?.specializations.filter((item) => !departments || Number(item.department_id) === Number(departments)).map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField>
      <TextField label="Search doctor" value={search} onChange={(e) => setSearch(e.target.value)} />
    </Stack></Paper>
    {loadingDoctors ? <CircularProgress size={28} /> : doctors.length === 0 ? <Alert severity="info">No available doctors match these filters.</Alert> : <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
      {doctors.map((item) => <Card key={item.id} variant="outlined" sx={{ borderColor: doctor?.id === item.id ? 'primary.main' : 'divider' }}><CardContent><Stack spacing={1.5}>
        <Typography variant="h6">{item.name}</Typography><Typography>{item.department?.name} · {item.specialization?.name}</Typography>
        {item.bio && <Typography color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>{item.bio}</Typography>}
        <Typography>Consultation: {Number(item.consultation_fee).toLocaleString()} {directory?.currency}</Typography>
        <Typography variant="body2">{item.schedules.filter((schedule) => schedule.is_available).map((schedule) => `${schedule.day_of_week} ${schedule.start_time.slice(0, 5)}–${schedule.end_time.slice(0, 5)}`).join(' · ') || 'No consultation periods configured.'}</Typography>
        <Button variant={doctor?.id === item.id ? 'contained' : 'outlined'} onClick={() => selectDoctor(item)} disabled={!directory?.can_book}>{doctor?.id === item.id ? 'Selected doctor' : 'Select doctor'}</Button>
      </Stack></CardContent></Card>)}
    </Box>}
    {pages > 1 && <Pagination count={pages} page={page} onChange={(_, value) => setPage(value)} />}
    <Paper component="form" onSubmit={review} noValidate variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}><Stack spacing={2}>
      <Typography variant="h6">{doctor ? `Appointment with ${doctor.name}` : 'Choose a doctor to see available consultation slots'}</Typography>
      {errors.doctor_id && <Alert severity="error">{errors.doctor_id[0]}</Alert>}
      <TextField fullWidth label="Appointment date" type="date" value={date} disabled={!doctor || !directory?.can_book} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: directory?.today } }} onChange={(e) => setDate(e.target.value)} error={Boolean(errors.appointment_date)} helperText={errors.appointment_date?.[0] || `Times are shown in ${directory?.timezone || 'hospital local time'}.`} />
      {slotsError && <Alert severity="error" action={<Button onClick={() => setSlotsRevision((value) => value + 1)}>Refresh slots</Button>}>{slotsError}</Alert>}
      {loadingSlots ? <CircularProgress size={28} /> : doctor && date && !slotsError && <>
        <Typography fontWeight={600}>Available slots</Typography><Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>{slots.map((slot) => <Chip key={slot.time} label={`${slot.time} · ${slot.duration} min`} variant={time === slot.time ? 'filled' : 'outlined'} color={time === slot.time ? 'primary' : 'default'} onClick={() => setTime(slot.time)} />)}</Stack>
        {slots.length === 0 && <Alert severity="info">No slots are available on this date. Try another date or doctor.</Alert>}
      </>}
      {errors.appointment_time && <Alert severity="error">{errors.appointment_time[0]}</Alert>}
      <TextField fullWidth label="Reason for appointment" multiline minRows={3} value={reason} onChange={(e) => setReason(e.target.value)} error={Boolean(errors.reason)} helperText={errors.reason?.[0]} slotProps={{ htmlInput: { maxLength: 5000 } }} />
      <Alert severity="info">Your appointment will remain pending until the doctor confirms it. Available slots are checked again when you submit.</Alert>
      <Button variant="contained" type="submit" disabled={!directory?.can_book || saving || Boolean(slotsError)}>{appointmentId ? 'Review reschedule request' : 'Review appointment request'}</Button>
    </Stack></Paper>
    {confirm && <ConfirmDialog open title={appointmentId ? 'Confirm reschedule?' : 'Confirm appointment request?'} message={`${doctor?.name} · ${date} at ${time}. The doctor will receive your request for confirmation.`} loading={saving} confirmText="Submit request" onConfirm={submit} onClose={() => setConfirm(false)} />}
  </Stack>;
}

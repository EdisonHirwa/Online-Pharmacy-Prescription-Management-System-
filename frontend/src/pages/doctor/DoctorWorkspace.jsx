import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, Collapse, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, MenuItem, Paper, Stack, Switch, Table, TableBody, TableCell, TableContainer,
  TableHead, TablePagination, TableRow, TableSortLabel, TextField, Typography,
} from '@mui/material';
import ConfirmDialog from '../../components/ConfirmDialog';
import ClinicalRecordView from './ClinicalRecordView';
import { doctorService as service, doctorError } from '../../services/doctorService';

const titles = { schedules: 'My Consultation Schedule', appointments: 'My Appointments', patients: 'Patient History', consultations: 'Consultations', prescriptions: 'Prescriptions', 'lab-requests': 'Laboratory Requests & Results' };
const columns = {
  schedules: [['day_of_week', 'Day'], ['start_time', 'Start'], ['end_time', 'End'], ['slot_duration', 'Slot (minutes)'], ['is_available', 'Available']],
  appointments: [['appointment_number', 'Appointment'], ['patient', 'Patient'], ['appointment_date', 'Date'], ['appointment_time', 'Time'], ['reason', 'Reason'], ['status', 'Status']],
  patients: [['patient_number', 'Patient number'], ['user', 'Name'], ['date_of_birth', 'Date of birth'], ['gender', 'Gender'], ['blood_group', 'Blood group']],
  consultations: [['patient', 'Patient'], ['diagnosis', 'Diagnosis'], ['follow_up_date', 'Follow-up'], ['created_at', 'Recorded']],
  prescriptions: [['id', 'Prescription'], ['patient', 'Patient'], ['issue_date', 'Issued'], ['status', 'Status']],
  'lab-requests': [['patient', 'Patient'], ['test_type', 'Investigation'], ['request_date', 'Requested'], ['status', 'Status']],
};
const statusChoices = { appointments: ['pending', 'confirmed', 'completed', 'cancelled', 'rejected'], prescriptions: ['pending', 'partially_dispensed', 'dispensed', 'cancelled'], 'lab-requests': ['requested', 'assigned', 'processing', 'completed', 'cancelled'] };
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const label = (key) => key.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const newItem = () => ({ medicine_id: '', dosage: '', frequency: '', duration: '', quantity: 1 });

export default function DoctorWorkspace({ resource }) {
  const location = useLocation();
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [search, setSearch] = useState(new URLSearchParams(location.search).get('search') || '');
  const [query, setQuery] = useState(search);
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState(resource === 'appointments' ? 'appointment_date' : 'id');
  const [direction, setDirection] = useState(resource === 'appointments' ? 'asc' : 'desc');
  const [options, setOptions] = useState({ medicines: [], lab_test_types: [], permissions: {} });
  const [consultations, setConsultations] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [dialogError, setDialogError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [view, setView] = useState(null);
  const [patientHistory, setPatientHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const request = useRef(0);
  const activeWorkflow = useRef(0);
  const canWrite = Boolean(options.permissions.manage_consultations);
  const canSchedule = Boolean(options.permissions.manage_schedules);

  const loadOptions = useCallback(async () => {
    const response = await service.options(); setOptions(response.data.data);
  }, []);
  const load = useCallback(async () => {
    const id = ++request.current; setLoading(true);
    try {
      const response = await service.list(resource, { page: page + 1, per_page: size, search: query, sort, direction, ...filters });
      if (id === request.current) { setRecords(response.data.data); setTotal(response.data.meta.total); setError(''); }
    } catch (err) { if (id === request.current) setError(doctorError(err)); }
    finally { if (id === request.current) setLoading(false); }
  }, [resource, page, size, query, sort, direction, filters]);
  useEffect(() => { loadOptions().catch((err) => setError(doctorError(err))); }, [loadOptions]);
  useEffect(() => { load(); const timer = setInterval(load, 30000); return () => { ++request.current; clearInterval(timer); }; }, [load]);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(0); }, 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { setSearch(new URLSearchParams(location.search).get('search') || ''); }, [location.search]);
  const refresh = async () => { await Promise.all([load(), loadOptions()]); };
  const download = async (path, filename) => {
    try { await service.download(path, filename); }
    catch (err) { setError(doctorError(err)); }
  };
  const viewRow = async (row, kind = resource) => {
    setError('');
    try { const response = await service.get(kind, row.id); setView({ resource: kind, record: response.data.data }); }
    catch (err) { setError(doctorError(err)); }
  };
  const open = (kind, row = null) => {
    const workflow = ++activeWorkflow.current;
    setDialog({ kind, row }); setErrors({}); setDialogError(''); setPatientHistory(null); setShowHistory(false);
    if (kind === 'schedule') setForm(row ? { day_of_week: row.day_of_week, start_time: row.start_time.slice(0, 5), end_time: row.end_time.slice(0, 5), slot_duration: row.slot_duration, is_available: Boolean(row.is_available) } : { day_of_week: 'Monday', start_time: '09:00', end_time: '17:00', slot_duration: 30, is_available: true });
    if (kind === 'consultation') {
      setForm({ appointment_id: row.id, diagnosis: '', consultation_notes: '', treatment_recommendations: '', follow_up_date: '' });
      service.get('patients', row.patient_id).then((response) => { if (activeWorkflow.current === workflow) setPatientHistory(response.data.data); }).catch((err) => { if (activeWorkflow.current === workflow) setDialogError(doctorError(err)); });
    }
    if (kind === 'prescription' || kind === 'edit-prescription') {
      setForm(kind === 'edit-prescription' ? { prescription_instructions: row.prescription_instructions || '', items: row.items.map((item) => ({ medicine_id: item.medicine_id, dosage: item.dosage, frequency: item.frequency, duration: item.duration, quantity: item.quantity })) } : { consultation_id: row?.id || '', prescription_instructions: '', items: [newItem()] });
    }
    if (kind === 'laboratory') setForm({ consultation_id: row?.id || '', test_type_ids: [] });
    if (['prescription', 'laboratory'].includes(kind) && !row) {
      service.list('consultations', { per_page: 100 }).then((response) => { if (activeWorkflow.current === workflow) setConsultations(response.data.data); }).catch((err) => { if (activeWorkflow.current === workflow) setDialogError(doctorError(err)); });
    }
    if (kind === 'appointment-status') setForm({ status: row.status === 'pending' ? 'confirmed' : 'cancelled', cancellation_reason: '' });
    if (kind === 'allergy') setForm({ allergy_name: '', severity: 'mild', reaction_description: '' });
    if (kind === 'history') setForm({ condition: '', diagnosis_details: '', treatment_history: '' });
  };
  const close = () => { ++activeWorkflow.current; setDialog(null); };
  const field = (key, text, { type = 'text', required = false, multiline = false, choices = null, helper = '' } = {}) => <TextField
    key={key} fullWidth label={text} value={form[key] ?? ''} type={type} required={required} multiline={multiline} minRows={multiline ? 2 : undefined} select={Boolean(choices)}
    error={Boolean(errors[key])} helperText={errors[key]?.[0] || helper}
    slotProps={{ inputLabel: type === 'date' || type === 'time' ? { shrink: true } : {}, htmlInput: type === 'number' ? { min: 5, max: 240, step: 1 } : {} }}
    onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}>
    {choices?.map((value) => <MenuItem key={value} value={value}>{label(value)}</MenuItem>)}
  </TextField>;
  const validate = () => {
    const invalid = {};
    const required = {
      schedule: ['day_of_week', 'start_time', 'end_time', 'slot_duration'], consultation: ['diagnosis', 'consultation_notes'], prescription: ['consultation_id'], 'edit-prescription': [], laboratory: ['consultation_id'], 'appointment-status': ['status'], allergy: ['allergy_name', 'severity'], history: ['condition', 'diagnosis_details'],
    }[dialog.kind] || [];
    required.forEach((key) => { if (!String(form[key] ?? '').trim()) invalid[key] = ['This field is required.']; });
    if (dialog.kind === 'schedule') {
      if (form.end_time <= form.start_time) invalid.end_time = ['End time must be after start time.'];
      const minutes = (time) => Number(time.split(':')[0]) * 60 + Number(time.split(':')[1]);
      if (form.start_time && form.end_time && Number(form.slot_duration) > minutes(form.end_time) - minutes(form.start_time)) invalid.slot_duration = ['Appointment duration cannot exceed the consultation period.'];
      if (!Number.isInteger(Number(form.slot_duration)) || Number(form.slot_duration) < 5 || Number(form.slot_duration) > 240) invalid.slot_duration = ['Use a whole number from 5 to 240 minutes.'];
    }
    if (dialog.kind.includes('prescription')) {
      if (!form.items?.length) invalid.items = ['Add at least one medicine.'];
      const ids = new Set();
      form.items.forEach((item, i) => {
        ['medicine_id', 'dosage', 'frequency', 'duration'].forEach((key) => { if (!String(item[key]).trim()) invalid[`items.${i}.${key}`] = ['This field is required.']; });
        if (ids.has(item.medicine_id)) invalid[`items.${i}.medicine_id`] = ['Each medicine can appear only once.']; ids.add(item.medicine_id);
        if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 100000) invalid[`items.${i}.quantity`] = ['Use a positive whole quantity, up to 100,000.'];
      });
    }
    if (dialog.kind === 'laboratory' && !form.test_type_ids?.length) invalid.test_type_ids = ['Select at least one investigation.'];
    if (dialog.kind === 'appointment-status' && ['cancelled', 'rejected'].includes(form.status) && !form.cancellation_reason.trim()) invalid.cancellation_reason = ['A reason is required.'];
    return invalid;
  };
  const save = async () => {
    const invalid = validate(); if (Object.keys(invalid).length) { setErrors(invalid); setDialogError('Please correct the highlighted fields.'); return; }
    setSaving(true); setDialogError(''); setErrors({});
    try {
      let response;
      if (dialog.kind === 'schedule') response = await service.save('schedules', form, dialog.row?.id);
      if (dialog.kind === 'consultation') response = await service.save('consultations', form);
      if (dialog.kind.includes('prescription')) response = await service.save('prescriptions', form, dialog.kind === 'edit-prescription' ? dialog.row.id : null);
      if (dialog.kind === 'laboratory') response = await service.save('lab-requests', form);
      if (dialog.kind === 'appointment-status') response = await service.action(`appointments/${dialog.row.id}/status`, form);
      if (dialog.kind === 'allergy' || dialog.kind === 'history') response = await service.action(`patients/${dialog.row.id}/${dialog.kind === 'allergy' ? 'allergies' : 'medical-history'}`, form);
      const completed = dialog.kind === 'consultation' ? response.data.data : null;
      close(); setConfirm(null); setView(null); setNotice('Saved successfully.');
      await refresh();
      if (completed) await viewRow(completed, 'consultations');
    } catch (err) { setDialogError(doctorError(err)); setErrors(err.response?.data?.errors || {}); setConfirm(null); }
    finally { setSaving(false); }
  };
  const submit = (event) => {
    event.preventDefault(); const invalid = validate();
    if (Object.keys(invalid).length) { setErrors(invalid); setDialogError('Please correct the highlighted fields.'); return; }
    if (dialog.kind === 'consultation') setConfirm({ kind: 'finalize' }); else save();
  };
  const confirmAction = async () => {
    if (confirm.kind === 'finalize') { await save(); return; }
    setSaving(true); setError('');
    try {
      if (confirm.kind === 'delete') await service.deleteSchedule(confirm.row.id);
      else await service.action(`${confirm.kind === 'cancel-prescription' ? 'prescriptions' : 'lab-requests'}/${confirm.row.id}/cancel`);
      setConfirm(null); setView(null); setNotice('Action completed.'); await refresh();
    } catch (err) { setError(doctorError(err)); setConfirm(null); }
    finally { setSaving(false); }
  };
  const cell = (row, key) => {
    if (key === 'patient') return row.patient?.user?.name || 'Patient unavailable';
    if (key === 'user') return row.user?.name || 'Name unavailable';
    if (key === 'test_type') return row.test_type?.name || 'Test unavailable';
    if (key === 'status') return <Chip size="small" variant="outlined" label={label(row.status)} />;
    if (key === 'is_available') return row.is_available ? 'Yes' : 'No';
    if (['appointment_date', 'date_of_birth', 'follow_up_date'].includes(key)) return row[key]?.slice(0, 10) || '—';
    if (['created_at', 'issue_date', 'request_date'].includes(key)) return row[key] ? new Date(row[key]).toLocaleString() : '—';
    return row[key] ?? '—';
  };
  const actions = (row) => <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, minWidth: 140 }}>
    <Button size="small" onClick={() => viewRow(row)}>View</Button>
    {resource === 'schedules' && canSchedule && <><Button size="small" onClick={() => open('schedule', row)}>Edit</Button><Button size="small" color="error" onClick={() => setConfirm({ kind: 'delete', row })}>Delete</Button></>}
    {resource === 'appointments' && <>
      <Button size="small" onClick={() => viewRow({ id: row.patient_id }, 'patients')}>History</Button>
      {canWrite && ['pending', 'confirmed'].includes(row.status) && <Button size="small" onClick={() => open('appointment-status', row)}>Change status</Button>}
      {canWrite && row.status === 'confirmed' && (!options.today || row.appointment_date.slice(0, 10) <= options.today) && <Button size="small" variant="contained" onClick={() => open('consultation', row)}>Consult</Button>}
    </>}
    {resource === 'consultations' && canWrite && <><Button size="small" onClick={() => open('prescription', row)}>Prescribe</Button><Button size="small" onClick={() => open('laboratory', row)}>Request tests</Button></>}
    {resource === 'patients' && canWrite && <><Button size="small" onClick={() => open('allergy', row)}>Add allergy</Button><Button size="small" onClick={() => open('history', row)}>Add history</Button></>}
    {resource === 'prescriptions' && <>
      <Button size="small" onClick={() => download(`prescriptions/${row.id}/download`, `prescription-${row.id}.pdf`)}>PDF</Button>
      {canWrite && row.status === 'pending' && <><Button size="small" onClick={() => open('edit-prescription', row)}>Edit</Button><Button size="small" color="error" onClick={() => setConfirm({ kind: 'cancel-prescription', row })}>Cancel</Button></>}
    </>}
    {resource === 'lab-requests' && canWrite && row.status === 'requested' && <Button size="small" color="error" onClick={() => setConfirm({ kind: 'cancel-lab', row })}>Cancel request</Button>}
  </Stack>;
  return <Stack spacing={3} sx={{ minWidth: 0, width: '100%' }}>
    <Typography variant="h5" fontWeight={700}>{titles[resource]}</Typography>
    {error && <Alert severity="error" action={<Button onClick={refresh}>Retry</Button>}>{error}</Alert>}
    {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, '& > .MuiTextField-root': { width: { xs: '100%', sm: 180 }, flexShrink: 0 } }}>
      <TextField label={resource === 'schedules' ? 'Search day' : 'Search patient'} size="small" value={search} onChange={(e) => setSearch(e.target.value)} />
      {statusChoices[resource] && <TextField label="Status" select size="small" value={filters.status || ''} onChange={(e) => { setFilters({ ...filters, status: e.target.value || undefined }); setPage(0); }}><MenuItem value="">All statuses</MenuItem>{statusChoices[resource].map((value) => <MenuItem key={value} value={value}>{label(value)}</MenuItem>)}</TextField>}
      {['start_date', 'end_date'].map((key) => <TextField key={key} label={key === 'start_date' ? 'From' : 'To'} type="date" size="small" value={filters[key] || ''} slotProps={{ inputLabel: { shrink: true } }} onChange={(e) => { setFilters({ ...filters, [key]: e.target.value || undefined }); setPage(0); }} />)}
      <Button onClick={refresh}>Refresh</Button>
      {resource === 'schedules' && canSchedule && <Button variant="contained" onClick={() => open('schedule')}>Add schedule</Button>}
      {resource === 'prescriptions' && canWrite && <Button variant="contained" onClick={() => open('prescription')}>Issue prescription</Button>}
      {resource === 'lab-requests' && canWrite && <Button variant="contained" onClick={() => open('laboratory')}>Request laboratory tests</Button>}
    </Stack>
    {resource === 'schedules' && <Alert severity="info">Schedules repeat weekly. Resolve upcoming appointments on a consultation day before changing or removing its schedule.</Alert>}
    {resource === 'patients' && <Alert severity="info">Patient records are limited to your assigned care relationships. Medical history access is recorded in the audit log.</Alert>}
    {resource === 'consultations' && <Alert severity="info">Complete a confirmed appointment to record a consultation. Finalized clinical notes are preserved. Use an existing consultation to issue prescriptions or request investigations.</Alert>}
    <Paper variant="outlined" sx={{ width: '100%', overflow: 'hidden', minWidth: 0 }}><TableContainer><Table size="small" aria-label={titles[resource]}>
      <TableHead><TableRow>{columns[resource].map(([key, text]) => <TableCell key={key}><TableSortLabel disabled={['patient', 'test_type', 'diagnosis', 'reason', 'follow_up_date', 'is_available', 'slot_duration', 'end_time'].includes(key)} active={sort === key} direction={sort === key ? direction : 'asc'} onClick={() => { setSort(key); setDirection(sort === key && direction === 'asc' ? 'desc' : 'asc'); setPage(0); }}>{text}</TableSortLabel></TableCell>)}<TableCell>Actions</TableCell></TableRow></TableHead>
      <TableBody>{loading ? <TableRow><TableCell align="center" colSpan={columns[resource].length + 1} sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow> : records.length === 0 ? <TableRow><TableCell align="center" colSpan={columns[resource].length + 1} sx={{ py: 5 }}>No records found.</TableCell></TableRow> : records.map((row) => <TableRow key={row.id} hover>{columns[resource].map(([key]) => <TableCell key={key} sx={{ minWidth: key === 'patient' ? 160 : 80, maxWidth: 260, overflowWrap: 'anywhere' }}>{cell(row, key)}</TableCell>)}<TableCell>{actions(row)}</TableCell></TableRow>)}</TableBody>
    </Table></TableContainer><TablePagination component="div" count={total} page={page} rowsPerPage={size} rowsPerPageOptions={[10, 25, 50, 100]} onPageChange={(_, value) => setPage(value)} onRowsPerPageChange={(e) => { setSize(Number(e.target.value)); setPage(0); }} /></Paper>
    <Dialog open={Boolean(view)} onClose={() => setView(null)} fullWidth maxWidth="md"><DialogTitle>{view ? titles[view.resource] : ''}</DialogTitle><DialogContent dividers>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}<ClinicalRecordView resource={view?.resource} record={view?.record} download={download} canWrite={canWrite} prescribe={(record) => open('prescription', record)} requestLab={(record) => open('laboratory', record)} /></DialogContent><DialogActions><Button onClick={() => setView(null)}>Close</Button></DialogActions></Dialog>
    <Dialog open={Boolean(dialog)} onClose={() => !saving && close()} fullWidth maxWidth="md">
      <Box component="form" onSubmit={submit} noValidate>
        <DialogTitle>{dialog ? { schedule: `${dialog.row ? 'Edit' : 'Add'} schedule`, consultation: 'Record consultation', prescription: 'Issue prescription', 'edit-prescription': 'Edit prescription', laboratory: 'Request laboratory investigations', 'appointment-status': 'Change appointment status', allergy: 'Record patient allergy', history: 'Add medical history' }[dialog.kind] : ''}</DialogTitle>
        <DialogContent dividers><Stack spacing={2}>
          {dialogError && <Alert severity="error">{dialogError}{Object.entries(errors).map(([key, value]) => <Typography variant="body2" key={key}>{label(key)}: {value.join(' ')}</Typography>)}</Alert>}
          {dialog?.kind === 'schedule' && <>{field('day_of_week', 'Consultation day', { choices: days, required: true })}{field('start_time', 'Start time', { type: 'time', required: true })}{field('end_time', 'End time', { type: 'time', required: true })}{field('slot_duration', 'Appointment duration (minutes)', { type: 'number', required: true })}<FormControlLabel label="Available for booking" control={<Switch checked={Boolean(form.is_available)} onChange={(e) => setForm({ ...form, is_available: e.target.checked })} />} /></>}
          {dialog?.kind === 'consultation' && <>
            <Typography fontWeight={700}>{dialog.row.patient?.user?.name} · {dialog.row.appointment_number}</Typography>
            <Alert severity="warning">Finalizing completes this appointment and records its consultation charge. Review the patient history before saving; finalized clinical notes cannot be overwritten.</Alert>
            {patientHistory && <><Alert severity={patientHistory.allergies?.length ? 'warning' : 'info'}>{patientHistory.allergies?.length ? `Recorded allergies: ${patientHistory.allergies.map((item) => `${item.allergy_name} (${item.severity})`).join(', ')}` : 'No allergies are recorded for this patient.'}</Alert><Button onClick={() => setShowHistory(!showHistory)}>{showHistory ? 'Hide patient history' : 'Review patient history'}</Button><Collapse in={showHistory}><ClinicalRecordView resource="patients" record={patientHistory} download={download} /></Collapse></>}
            {field('diagnosis', 'Diagnosis', { required: true, multiline: true })}{field('consultation_notes', 'Consultation notes & findings', { required: true, multiline: true })}{field('treatment_recommendations', 'Treatment recommendations', { multiline: true })}{field('follow_up_date', 'Follow-up date', { type: 'date' })}
          </>}
          {['prescription', 'laboratory'].includes(dialog?.kind) && (!dialog.row ? <TextField fullWidth select label="Consultation" value={form.consultation_id || ''} error={Boolean(errors.consultation_id)} helperText={errors.consultation_id?.[0] || 'Latest 100 consultations. Older records can be selected from the Consultations page.'} onChange={(e) => setForm({ ...form, consultation_id: e.target.value })}><MenuItem value="">Select a consultation</MenuItem>{consultations.map((item) => <MenuItem key={item.id} value={item.id}>#{item.id} · {item.patient?.user?.name} · {item.created_at?.slice(0, 10)}</MenuItem>)}</TextField> : <Typography>Consultation #{dialog.row.id} · {dialog.row.patient?.user?.name}</Typography>)}
          {dialog?.kind?.includes('prescription') && <>
            <Alert severity="info">Confirming sends this prescription to pharmacy. Quantities and availability are verified again when dispensing. Medicine prices come from the server.</Alert>
            {!options.medicines.length && <Alert severity="warning">No active, unexpired medicines are available. Ask administration to configure the medicine catalogue.</Alert>}
            {(form.items || []).map((item, index) => <Paper key={index} variant="outlined" sx={{ p: 2 }}><Stack spacing={2}>
              <TextField fullWidth select label="Medicine" required value={item.medicine_id} error={Boolean(errors[`items.${index}.medicine_id`])} helperText={errors[`items.${index}.medicine_id`]?.[0]} onChange={(e) => setForm({ ...form, items: form.items.map((value, i) => i === index ? { ...value, medicine_id: e.target.value } : value) })}><MenuItem value="">Select medicine</MenuItem>{options.medicines.map((medicine) => <MenuItem key={medicine.id} value={medicine.id}>{medicine.name} ({medicine.unit}) · Stock: {medicine.available_stock}</MenuItem>)}</TextField>
              {['dosage', 'frequency', 'duration', 'quantity'].map((key) => <TextField fullWidth required key={key} label={label(key)} type={key === 'quantity' ? 'number' : 'text'} slotProps={{ htmlInput: key === 'quantity' ? { min: 1, max: 100000, step: 1 } : { maxLength: 100 } }} value={item[key]} error={Boolean(errors[`items.${index}.${key}`])} helperText={errors[`items.${index}.${key}`]?.[0]} onChange={(e) => setForm({ ...form, items: form.items.map((value, i) => i === index ? { ...value, [key]: e.target.value } : value) })} />)}
              <Button color="error" disabled={form.items.length === 1} onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== index) })}>Remove medicine</Button>
            </Stack></Paper>)}
            <Button disabled={(form.items?.length || 0) >= 50} onClick={() => setForm({ ...form, items: [...form.items, newItem()] })}>Add medicine</Button>{field('prescription_instructions', 'Additional prescription instructions', { multiline: true })}
          </>}
          {dialog?.kind === 'laboratory' && <><Alert severity="info">Investigations will be sent to the laboratory and their charges added to billing.</Alert><TextField select fullWidth label="Investigations" value={form.test_type_ids || []} slotProps={{ select: { multiple: true } }} error={Boolean(errors.test_type_ids)} helperText={errors.test_type_ids?.[0]} onChange={(e) => setForm({ ...form, test_type_ids: e.target.value })}>{options.lab_test_types.map((type) => <MenuItem key={type.id} value={type.id}>{type.name} · {type.expected_turnaround_time}</MenuItem>)}</TextField>{!options.lab_test_types.length && <Alert severity="warning">No active test types are configured.</Alert>}</>}
          {dialog?.kind === 'appointment-status' && <>{field('status', 'New status', { choices: dialog.row.status === 'pending' ? ['confirmed', 'cancelled', 'rejected'] : ['cancelled'], required: true })}{['cancelled', 'rejected'].includes(form.status) && field('cancellation_reason', 'Reason for this change', { multiline: true, required: true })}</>}
          {dialog?.kind === 'allergy' && <>{field('allergy_name', 'Allergen', { required: true })}{field('severity', 'Severity', { required: true, choices: ['mild', 'moderate', 'severe'] })}{field('reaction_description', 'Reaction description', { multiline: true })}</>}
          {dialog?.kind === 'history' && <>{field('condition', 'Condition', { required: true })}{field('diagnosis_details', 'Diagnosis details', { required: true, multiline: true })}{field('treatment_history', 'Treatment history', { multiline: true })}</>}
        </Stack></DialogContent>
        <DialogActions><Button disabled={saving} onClick={close}>Cancel</Button><Button variant="contained" type="submit" disabled={saving}>{saving ? 'Saving…' : dialog?.kind === 'consultation' ? 'Review & finalize' : 'Confirm & save'}</Button></DialogActions>
      </Box>
    </Dialog>
    <ConfirmDialog open={Boolean(confirm)} title={confirm?.kind === 'finalize' ? 'Finalize consultation?' : confirm?.kind === 'delete' ? 'Delete schedule?' : 'Cancel this request?'} message={confirm?.kind === 'finalize' ? 'Confirm that the clinical notes are accurate. This completes the appointment and records its consultation fee.' : 'This action updates the stored record and notifies the relevant users where required.'} isDestructive={confirm?.kind !== 'finalize'} loading={saving} onConfirm={confirmAction} onClose={() => setConfirm(null)} />
  </Stack>;
}

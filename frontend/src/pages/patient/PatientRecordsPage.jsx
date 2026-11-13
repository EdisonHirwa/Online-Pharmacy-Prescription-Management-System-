import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TableSortLabel, TextField, Typography } from '@mui/material';
import PatientRecordView from './PatientRecordView';
import { patientService as service, patientError, patientLabel } from '../../services/patientService';
const titles = { appointments: 'My Appointments', consultations: 'Consultation Records', prescriptions: 'My Prescriptions', 'lab-tests': 'Laboratory Results', invoices: 'My Invoices', payments: 'Payment History', admissions: 'Admission History' };
const columns = {
  appointments: [['appointment_number', 'Reference'], ['doctor', 'Doctor'], ['appointment_date', 'Date'], ['appointment_time', 'Time'], ['status', 'Status']],
  consultations: [['doctor', 'Doctor'], ['diagnosis', 'Diagnosis'], ['follow_up_date', 'Follow-up'], ['created_at', 'Recorded']],
  prescriptions: [['id', 'Prescription'], ['doctor', 'Doctor'], ['issue_date', 'Issued'], ['status', 'Status']],
  'lab-tests': [['test_type', 'Investigation'], ['doctor', 'Doctor'], ['request_date', 'Requested'], ['status', 'Status']],
  invoices: [['invoice_number', 'Invoice'], ['total_amount', 'Total'], ['amount_paid', 'Paid'], ['outstanding_balance', 'Outstanding'], ['status', 'Status']],
  payments: [['payment_reference', 'Reference'], ['invoice_number', 'Invoice'], ['amount', 'Amount'], ['payment_method', 'Method'], ['transaction_status', 'Status'], ['payment_date', 'Date']],
  admissions: [['ward', 'Ward'], ['admission_date', 'Admitted'], ['discharge_date', 'Discharged'], ['status', 'Status']],
};
const statuses = { appointments: ['pending', 'confirmed', 'completed', 'cancelled', 'rejected'], prescriptions: ['pending', 'partially_dispensed', 'dispensed', 'cancelled'], 'lab-tests': ['requested', 'assigned', 'processing', 'completed', 'cancelled'], invoices: ['unpaid', 'partially_paid', 'paid', 'cancelled'], payments: ['completed', 'pending', 'failed'], admissions: ['admitted', 'discharged'] };
export default function PatientRecordsPage({ resources = ['appointments'], medical = false }) {
  const navigate = useNavigate(); const location = useLocation();
  const [tab, setTab] = useState(0); const resource = resources[tab];
  const [rows, setRows] = useState([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(0); const [size, setSize] = useState(10);
  const [search, setSearch] = useState(''); const [query, setQuery] = useState(''); const [filters, setFilters] = useState({}); const [sort, setSort] = useState('id'); const [direction, setDirection] = useState('desc');
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState(location.state?.message || '');
  const [currency, setCurrency] = useState('RWF'); const [history, setHistory] = useState(null); const [historyError, setHistoryError] = useState('');
  const [view, setView] = useState(null); const [cancel, setCancel] = useState(null); const [reason, setReason] = useState(''); const [cancelError, setCancelError] = useState(''); const [saving, setSaving] = useState(false);
  const currentRequest = useRef(0);
  useEffect(() => { let active = true; service.directory().then((response) => { if (active) setCurrency(response.data.data.currency); }).catch(() => {}); return () => { active = false; }; }, []);
  const loadHistory = useCallback(async () => {
    if (!medical) return;
    try { const response = await service.history(); setHistory(response.data.data); setHistoryError(''); }
    catch (err) { setHistoryError(patientError(err)); }
  }, [medical]);
  useEffect(() => { loadHistory(); }, [loadHistory]);
  const load = useCallback(async () => {
    const id = ++currentRequest.current; setLoading(true);
    try { const response = await service.list(resource, { page: page + 1, per_page: size, search: query, sort, direction, ...filters }); if (id === currentRequest.current) { setRows(response.data.data); setTotal(response.data.meta.total); setError(''); } }
    catch (err) { if (id === currentRequest.current) { setError(patientError(err)); setRows([]); setTotal(0); } }
    finally { if (id === currentRequest.current) setLoading(false); }
  }, [resource, page, size, query, filters, sort, direction]);
  useEffect(() => { load(); const timer = setInterval(load, 30000); return () => { ++currentRequest.current; clearInterval(timer); }; }, [load]);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(0); }, 300); return () => clearTimeout(timer); }, [search]);
  const download = async (path, filename) => { try { await service.download(path, filename); } catch (err) { setError(patientError(err)); } };
  const show = async (row) => { try { const response = await service.get(resource, row.id); setView({ resource, record: response.data.data }); } catch (err) { setError(patientError(err)); } };
  const cancelAppointment = async (event) => {
    event.preventDefault(); setCancelError(''); if (reason.trim().length < 3) { setCancelError('Please provide a reason for cancellation.'); return; }
    setSaving(true);
    try { await service.cancel(cancel.id, reason); setCancel(null); setView(null); setNotice('Appointment cancelled. Your doctor has been notified.'); await load(); }
    catch (err) { setCancelError(err.response?.data?.errors?.cancellation_reason?.[0] || patientError(err)); }
    finally { setSaving(false); }
  };
  const cell = (row, key) => {
    if (key === 'doctor') return row.doctor?.name || 'Unavailable'; if (key === 'test_type') return row.test_type?.name || 'Unavailable';
    if (['status', 'transaction_status', 'payment_method'].includes(key)) return patientLabel(row[key]);
    if (['amount', 'total_amount', 'amount_paid', 'outstanding_balance'].includes(key)) return `${Number(row[key]).toLocaleString()} ${currency}`;
    if (['appointment_date', 'follow_up_date'].includes(key)) return row[key]?.slice(0, 10) || '—';
    return row[key] ?? '—';
  };
  return <Stack spacing={3} sx={{ width: '100%', minWidth: 0 }}>
    <Typography variant="h5" fontWeight={700}>{medical ? 'My Medical Records' : resources.length > 1 ? 'Invoices & Payment History' : titles[resource]}</Typography>
    {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}{error && <Alert severity="error" action={<Button onClick={load}>Retry</Button>}>{error}</Alert>}
    {medical && <>
      {historyError && <Alert severity="error" action={<Button onClick={loadHistory}>Retry</Button>}>{historyError}</Alert>}
      {history && <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h6" sx={{ mb: 1 }}>Recorded Allergies</Typography>{history.allergies.length ? history.allergies.map((item) => <Box key={item.id} sx={{ mb: 2 }}><Typography fontWeight={700}>{item.allergy_name} · {patientLabel(item.severity)}</Typography><Typography>{item.reaction_description || 'No reaction details recorded.'}</Typography></Box>) : <Typography color="text.secondary">No allergies are recorded.</Typography>}</Paper>
        <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h6" sx={{ mb: 1 }}>Medical History</Typography>{history.medical_histories.length ? history.medical_histories.map((item) => <Box key={item.id} sx={{ mb: 2 }}><Typography fontWeight={700}>{item.condition} · {item.recorded_date}</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{item.diagnosis_details}</Typography>{item.treatment_history && <Typography>{item.treatment_history}</Typography>}</Box>) : <Typography color="text.secondary">No medical history is recorded.</Typography>}</Paper>
      </Box>}
      <Alert severity="info">Medical records are recorded by your care team. Contact your doctor if an allergy or clinical detail needs updating.</Alert>
    </>}
    {resources.length > 1 && <Tabs value={tab} variant="scrollable" scrollButtons="auto" onChange={(_, value) => { setTab(value); setPage(0); setSearch(''); setQuery(''); setFilters({}); setSort('id'); }}>{resources.map((item) => <Tab key={item} label={titles[item]} />)}</Tabs>}
    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, '& > .MuiTextField-root': { width: { xs: '100%', sm: 180 }, flexShrink: 0 } }}>
      {resource !== 'admissions' && <TextField size="small" label={resource === 'invoices' ? 'Search invoice' : resource === 'payments' ? 'Search payment reference' : 'Search doctor'} value={search} onChange={(event) => setSearch(event.target.value)} />}
      {statuses[resource] && <TextField size="small" select label="Status" value={filters.status || ''} onChange={(event) => { setFilters({ ...filters, status: event.target.value || undefined }); setPage(0); }}><MenuItem value="">All statuses</MenuItem>{statuses[resource].map((value) => <MenuItem key={value} value={value}>{patientLabel(value)}</MenuItem>)}</TextField>}
      {['start_date', 'end_date'].map((key) => <TextField size="small" type="date" label={key === 'start_date' ? 'From' : 'To'} key={key} value={filters[key] || ''} slotProps={{ inputLabel: { shrink: true } }} onChange={(event) => { setFilters({ ...filters, [key]: event.target.value || undefined }); setPage(0); }} />)}
      <Button onClick={load}>Refresh</Button>{resource === 'appointments' && <Button variant="contained" onClick={() => navigate('/patient/book-appointment')}>Book appointment</Button>}
    </Stack>
    {resource === 'invoices' && <Alert severity="info">Payments are recorded by authorized hospital staff. Your recorded payments and remaining balance are shown here.</Alert>}
    <Paper variant="outlined" sx={{ width: '100%', overflow: 'hidden', minWidth: 0 }}><TableContainer><Table size="small" aria-label={titles[resource]}>
      <TableHead><TableRow>{columns[resource].map(([key, label]) => <TableCell key={key}><TableSortLabel disabled={['appointment_number', 'doctor', 'test_type', 'diagnosis', 'follow_up_date', 'ward', 'discharge_date', 'invoice_number', 'payment_reference'].includes(key) && !(resource === 'invoices' && key === 'invoice_number')} active={sort === key} direction={sort === key ? direction : 'asc'} onClick={() => { setSort(key); setDirection(sort === key && direction === 'asc' ? 'desc' : 'asc'); setPage(0); }}>{label}</TableSortLabel></TableCell>)}<TableCell>Actions</TableCell></TableRow></TableHead>
      <TableBody>{loading ? <TableRow><TableCell colSpan={columns[resource].length + 1} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow> : rows.length === 0 ? <TableRow><TableCell colSpan={columns[resource].length + 1} align="center" sx={{ py: 5 }}>No records found.</TableCell></TableRow> : rows.map((row) => <TableRow hover key={row.id}>{columns[resource].map(([key]) => <TableCell key={key} sx={{ minWidth: 90, maxWidth: 240, overflowWrap: 'anywhere' }}>{cell(row, key)}</TableCell>)}<TableCell><Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, minWidth: 110 }}>
        <Button size="small" onClick={() => show(row)}>View</Button>
        {resource === 'appointments' && row.can_manage && <><Button size="small" onClick={() => navigate(`/patient/book-appointment?appointment=${row.id}`)}>Reschedule</Button><Button size="small" color="error" onClick={() => { setCancel(row); setCancelError(''); setReason(''); }}>Cancel</Button></>}
        {['prescriptions', 'invoices'].includes(resource) && <Button size="small" onClick={() => download(`${resource}/${row.id}/download`, `${resource === 'invoices' ? row.invoice_number : `prescription-${row.id}`}.pdf`)}>Download PDF</Button>}
      </Stack></TableCell></TableRow>)}</TableBody>
    </Table></TableContainer><TablePagination component="div" count={total} page={page} rowsPerPage={size} rowsPerPageOptions={[10, 25, 50, 100]} onPageChange={(_, value) => setPage(value)} onRowsPerPageChange={(event) => { setSize(Number(event.target.value)); setPage(0); }} /></Paper>
    {view && <Dialog open onClose={() => setView(null)} fullWidth maxWidth="md"><DialogTitle>{titles[view.resource]}</DialogTitle><DialogContent dividers>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}<PatientRecordView resource={view.resource} record={view.record} download={download} currency={currency} /></DialogContent><DialogActions><Button onClick={() => setView(null)}>Close</Button></DialogActions></Dialog>}
    {cancel && <Dialog open onClose={() => !saving && setCancel(null)} fullWidth maxWidth="sm"><Box component="form" onSubmit={cancelAppointment} noValidate><DialogTitle>Cancel appointment?</DialogTitle><DialogContent dividers><Stack spacing={2}><Alert severity="warning">This cancels appointment {cancel.appointment_number} and notifies your doctor.</Alert>{cancelError && <Alert severity="error">{cancelError}</Alert>}<TextField label="Reason for cancellation" fullWidth multiline minRows={2} value={reason} onChange={(event) => setReason(event.target.value)} slotProps={{ htmlInput: { maxLength: 1000 } }} /></Stack></DialogContent><DialogActions><Button disabled={saving} onClick={() => setCancel(null)}>Keep appointment</Button><Button type="submit" color="error" variant="contained" disabled={saving}>{saving ? 'Cancelling…' : 'Confirm cancellation'}</Button></DialogActions></Box></Dialog>}
  </Stack>;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, MenuItem, Paper, Stack, Switch, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead, TablePagination,
  TableRow, TableSortLabel, TextField, Typography,
} from '@mui/material';
import api from '../../services/axiosInstance';
import { useLocation } from 'react-router-dom';

const titles = {
  users: 'Users & Access', departments: 'Departments', specializations: 'Specializations', patients: 'Patients',
  doctors: 'Doctors', 'doctor-schedules': 'Consultation Schedules', appointments: 'Appointments',
  wards: 'Wards', beds: 'Beds', admissions: 'Admissions & Discharges', services: 'Hospital Services',
  invoices: 'Invoices', payments: 'Payments', medicines: 'Medicine Inventory', 'stock-movements': 'Stock Movements',
  'lab-test-types': 'Laboratory Test Types', 'lab-tests': 'Laboratory Investigations', 'lab-reports': 'Laboratory Reports',
  prescriptions: 'Prescriptions', 'audit-logs': 'Audit Activity', 'login-attempts': 'Login Attempts', settings: 'Hospital Settings',
  consultations: 'Consultations', dispensations: 'Pharmacy Dispensing', 'doctor-performance': 'Doctor Performance', 'laboratory-revenue': 'Laboratory Charges', revenue: 'Revenue',
};
const label = (key) => key.replace(/_id$/, '').replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const display = (value) => value === null || value === undefined ? '—' : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : Array.isArray(value) ? value.join(', ') : String(value);
const errorMessage = (error) => error.response?.data?.message || 'Could not reach the server. Check your connection and try again.';
const analytics = ['doctor-performance', 'laboratory-revenue', 'revenue'];
const readonlyColumns = {
  'doctor-performance': ['doctor', 'department', 'appointments', 'consultations', 'professional_status'],
  'laboratory-revenue': ['service', 'quantity', 'total_billed'],
  revenue: ['date', 'payment_method', 'transactions', 'revenue'],
  appointments: ['appointment_number', 'patient', 'doctor', 'appointment_date', 'appointment_time', 'status'],
  admissions: ['patient', 'bed', 'admission_date', 'discharge_date', 'status'],
  invoices: ['invoice_number', 'patient', 'total_amount', 'amount_paid', 'outstanding_balance', 'status'],
  payments: ['payment_reference', 'invoice', 'amount', 'payment_method', 'transaction_status', 'payment_date'],
  'lab-tests': ['patient', 'doctor', 'test_type', 'request_date', 'status', 'result_summary'],
  'lab-reports': ['lab_test_id', 'file_type', 'upload_date', 'report_status'],
  prescriptions: ['patient', 'doctor', 'issue_date', 'status'],
  'stock-movements': ['medicine', 'movement_type', 'quantity', 'previous_stock', 'resulting_stock', 'reason'],
  'audit-logs': ['user', 'action', 'affected_table', 'affected_record_id', 'activity_details', 'ip_address', 'created_at'],
  'login-attempts': ['email', 'ip_address', 'attempt_status', 'attempt_date'],
  consultations: ['patient', 'doctor', 'diagnosis', 'consultation_notes', 'created_at'],
  dispensations: ['prescription_id', 'pharmacist_id', 'dispensing_date', 'dispensing_status'],
};

export default function AdminWorkspace({ resources = ['users'], reporting = false }) {
  const location = useLocation();
  const requestId = useRef(0);
  const [tab, setTab] = useState(0);
  const resource = resources[tab] || resources[0];
  const [catalog, setCatalog] = useState({});
  const [options, setOptions] = useState({});
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => { const value = new URLSearchParams(location.search).get('search') || ''; setSearch(value); setQuery(value); setPage(0); }, [location.search]);
  const [sort, setSort] = useState('id');
  const [direction, setDirection] = useState('desc');
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const definition = analytics.includes(resource) ? { readonly: true } : catalog[resource] || {};
  const fields = definition.fields || {};
  const columns = readonlyColumns[resource] || [
    ...(resource === 'patients' ? ['patient_number'] : []),
    ...Object.keys(fields).filter((f) => !['password', 'permissions', 'bio', 'description'].includes(f)),
    ...(resource === 'medicines' ? ['available_stock'] : []),
  ];
  const params = { page: page + 1, per_page: size, search: query, sort, direction, ...filters };
  const loadOptions = useCallback(async () => {
    const [c, o] = await Promise.all([api.get('/admin/catalog'), api.get('/admin/options')]);
    setCatalog(c.data.data); setOptions(o.data.data);
  }, []);
  useEffect(() => { loadOptions().catch((e) => setError(errorMessage(e))); }, [loadOptions]);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(0); }, 300); return () => clearTimeout(timer); }, [search]);
  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true); setError('');
    try {
      const response = await api.get(analytics.includes(resource) ? `/admin/analytics/${resource}` : `/admin/${resource}`, { params: { page: page + 1, per_page: size, search: query, sort, direction, ...filters } });
      if (currentRequest === requestId.current) { setRecords(response.data.data); setTotal(response.data.total); }
    } catch (e) { if (currentRequest === requestId.current) setError(errorMessage(e)); }
    finally { if (currentRequest === requestId.current) setLoading(false); }
  }, [resource, page, size, query, sort, direction, filters]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const timer = setInterval(load, 30000); return () => clearInterval(timer); }, [load]);

  const resourceLabel = (r, id) => options[r]?.find((o) => Number(o.id) === Number(id))?.label || id;
  const cell = (row, key) => {
    if (key.endsWith('_id') && fields[key]?.resource) return resourceLabel(fields[key].resource, row[key]);
    const value = row[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) return value.name || value.user?.name || value.bed_number || value.invoice_number || value.id;
    if (['status', 'account_status', 'availability_status', 'attempt_status'].includes(key)) return <Chip size="small" label={display(value)} variant="outlined" />;
    return display(value);
  };
  const open = (kind, row = null, path = '', workflowFields = {}) => {
    if (kind === 'view' && !analytics.includes(resource)) {
      api.get(`/admin/${resource}/${row.id}`).then((response) => setDialog((current) => current?.row?.id === row.id ? { ...current, row: response.data.data } : current)).catch((e) => setDialogError(errorMessage(e)));
    }
    setFieldErrors({}); setDialogError('');
    if (resource === 'doctors' && kind === 'edit') loadOptions().catch((e) => setDialogError(errorMessage(e)));
    const initial = {};
    const specs = kind === 'edit' ? fields : workflowFields;
    Object.entries(specs).forEach(([key, spec]) => {
      initial[key] = row?.[key] ?? (spec.type === 'boolean' ? true : spec.type === 'multiselect' ? [] : spec.type === 'select' ? spec.options[0] : '');
      if (spec.type === 'time') initial[key] = initial[key]?.slice(0, 5) || '';
      if (spec.type === 'password') initial[key] = '';
    });
    if (kind === 'pay') { initial.amount = row.outstanding_balance; initial.payment_reference = `PAY-${crypto.randomUUID()}`; }
    setForm(initial); setDialog({ kind, row, path, fields: specs });
  };
  const validateForm = () => {
    const errors = {};
    if (['view', 'delete', 'cancel invoice'].includes(dialog.kind)) return errors;
    for (const [key, spec] of Object.entries(dialog.fields)) {
      const value = form[key];
      const blank = value === '' || value === null || value === undefined;
      const optional = spec.optional || (spec.type === 'password' && dialog.row);
      if (blank) { if (!optional) errors[key] = [`${label(key)} is required.`]; continue; }
      if (spec.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[key] = ['Enter a valid email address.'];
      if (spec.type === 'phone' && !/^\+?[0-9]{9,15}$/.test(value)) errors[key] = ['Use 9–15 digits, optionally starting with +.'];
      if (spec.type === 'password' && (value.length < 8 || !/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value) || !/[^a-zA-Z0-9]/.test(value))) errors[key] = ['Use at least 8 characters with uppercase, lowercase, a number, and a symbol.'];
      if (['integer', 'money'].includes(spec.type)) {
        const number = Number(value);
        if (!Number.isFinite(number) || (spec.type === 'integer' && !Number.isInteger(number))) errors[key] = ['Enter a valid number.'];
        if (spec.type === 'money' && (number < 0 || Math.abs(number * 100 - Math.round(number * 100)) > 0.000001)) errors[key] = ['Enter a positive amount with no more than two decimal places.'];
        if (spec.min !== undefined && number < spec.min) errors[key] = [`Minimum: ${spec.min}.`];
        if (spec.max !== undefined && number > spec.max) errors[key] = [`Maximum: ${spec.max}.`];
      }
    }
    if (form.start_time && form.end_time && form.end_time <= form.start_time) errors.end_time = ['End time must be after start time.'];
    if (dialog.kind === 'pay' && (Number(form.amount) <= 0 || Number(form.amount) > Number(dialog.row.outstanding_balance))) errors.amount = ['Enter an amount greater than zero and within the outstanding balance.'];
    if (dialog.kind === 'adjust stock' && !Number(form.quantity)) errors.quantity = ['Enter a non-zero stock addition or deduction.'];
    if (dialog.kind === 'update appointment' && ['cancelled', 'rejected'].includes(form.status) && !form.cancellation_reason?.trim()) errors.cancellation_reason = ['Provide a reason for this change.'];
    if (dialog.kind === 'invoice' && form.items.some((item) => !item.service_description.trim() || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.unit_price) <= 0)) errors.items = ['Every charge needs a description, positive quantity, and positive price.'];
    return errors;
  };
  const save = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length) { setFieldErrors(errors); setDialogError('Please correct the highlighted fields.'); return; }
    setSaving(true); setFieldErrors({}); setDialogError('');
    try {
      let response;
      if (dialog.kind === 'delete') response = await api.delete(`/admin/${resource}/${dialog.row.id}`);
      else if (dialog.kind === 'edit') {
        const payload = { ...form };
        Object.entries(fields).forEach(([key, spec]) => { if (spec.type === 'password' && !payload[key]) delete payload[key]; });
        response = dialog.row ? await api.put(`/admin/${resource}/${dialog.row.id}`, payload) : await api.post(`/admin/${resource}`, payload);
      } else if (dialog.kind === 'invoice') {
        response = await api.post('/admin/invoices', { patient_id: form.patient_id, items: form.items });
      } else response = await api.post(dialog.path, form);
      if (resource === 'settings') window.dispatchEvent(new Event('hospital:configuration-updated'));
      setNotice(response.data.message || 'Saved successfully.'); setDialog(null);
      await Promise.all([load(), loadOptions()]);
    } catch (e) {
      setFieldErrors(e.response?.data?.errors || {}); setDialogError(errorMessage(e));
    } finally { setSaving(false); }
  };
  const exportFile = async (format) => {
    setError('');
    try {
      const response = await api.get(`/admin/reports/${resource}`, { params: { ...params, format }, responseType: 'blob' });
      download(response.data, `${resource}.${format}`);
    } catch (e) {
      if (e.response?.data instanceof Blob) { try { setError(JSON.parse(await e.response.data.text()).message); } catch { setError(errorMessage(e)); } }
      else setError(errorMessage(e));
    }
  };
  const download = (data, filename) => {
    const url = URL.createObjectURL(data); const link = document.createElement('a');
    link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const downloadReport = async (row) => {
    try { const response = await api.get(`/admin/lab-reports/${row.id}/download`, { responseType: 'blob' }); download(response.data, `lab-report-${row.id}.${row.file_type === 'application/pdf' ? 'pdf' : row.file_type.split('/').pop()}`); }
    catch (e) { setError(errorMessage(e)); }
  };
  const changeFilter = (key, value) => { setFilters((prev) => ({ ...prev, [key]: value || undefined })); setPage(0); };
  const renderField = (key, spec) => {
    if (spec.type === 'boolean') return <FormControlLabel key={key} label={label(key)} control={<Switch checked={Boolean(form[key])} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />} />;
    let items = spec.options?.map((v) => ({ id: v, label: label(v) })) || [];
    if (spec.type === 'reference') {
      items = (options[spec.resource] || []).filter((o) => (dialog.kind !== 'admit' || spec.resource !== 'beds' || o.status === 'available') && (!spec.role || o.role === spec.role) && (key !== 'specialization_id' || !form.department_id || Number(o.department_id) === Number(form.department_id)));
    }
    const select = ['select', 'reference', 'multiselect'].includes(spec.type);
    return <TextField key={key} disabled={(key === 'user_id' && Boolean(dialog.row) && dialog.kind === 'edit') || (key === 'patient_id' && dialog.kind === 'reschedule') || (key === 'specialization_id' && !form.department_id)} fullWidth select={select} label={label(key)} required={!spec.optional && !(key === 'password' && dialog.row)}
      value={form[key] ?? (spec.type === 'multiselect' ? [] : '')}
      type={['email', 'password', 'date', 'time'].includes(spec.type) ? spec.type : ['money', 'integer'].includes(spec.type) ? 'number' : 'text'}
      multiline={spec.type === 'textarea'} minRows={spec.type === 'textarea' ? 2 : undefined}
      slotProps={{ inputLabel: { shrink: ['date', 'time'].includes(spec.type) ? true : undefined }, htmlInput: { step: spec.type === 'money' ? '0.01' : spec.type === 'integer' ? '1' : undefined }, select: spec.type === 'multiselect' ? { multiple: true } : {} }}
      error={Boolean(fieldErrors[key])} helperText={fieldErrors[key]?.[0] || (key === 'specialization_id' ? (!form.department_id ? 'Choose a department first.' : items.length ? 'Select a specialization for this department.' : 'No specializations for this department. Add one in Organization & Services → Specializations.') : key === 'user_id' ? `Create a ${spec.role} user in Users & Access first.` : key === 'password' && dialog.row ? 'Leave blank to retain the password. Account edits revoke existing sessions.' : '')}
      onChange={(e) => setForm({ ...form, [key]: e.target.value, ...(key === 'department_id' ? { specialization_id: '' } : {}) })}>
      {select && spec.type !== 'multiselect' && <MenuItem value="">Select {label(key).toLowerCase()}</MenuItem>}
      {key === 'specialization_id' && form.department_id && items.length === 0 && <MenuItem disabled>No specializations available for this department</MenuItem>}
      {select && items.map((o) => <MenuItem key={o.id} value={o.id}>{o.label}</MenuItem>)}
    </TextField>;
  };
  const workflowButtons = (row) => <Stack direction="row" spacing={1}>
    <Button size="small" onClick={() => open('view', row)}>View</Button>
    {!definition.readonly && <><Button size="small" onClick={() => open('edit', row)}>Edit</Button><Button size="small" color="error" onClick={() => open('delete', row)}>Delete</Button></>}
    {resource === 'admissions' && row.status === 'admitted' && <Button size="small" onClick={() => open('discharge', row, `/admin/admissions/${row.id}/discharge`, { discharge_summary: { type: 'textarea' } })}>Discharge</Button>}
    {resource === 'invoices' && ['unpaid', 'partially_paid'].includes(row.status) && <Button size="small" onClick={() => open('pay', row, `/admin/invoices/${row.id}/payments`, { amount: { type: 'money' }, payment_method: { type: 'select', options: ['cash', 'card', 'mobile_money'] }, payment_reference: { type: 'text' } })}>Record payment</Button>}
    {resource === 'invoices' && row.status === 'unpaid' && <Button size="small" color="error" onClick={() => open('cancel invoice', row, `/admin/invoices/${row.id}/cancel`)}>Cancel</Button>}
    {resource === 'medicines' && <Button size="small" onClick={() => open('adjust stock', row, `/admin/medicines/${row.id}/stock`, { quantity: { type: 'integer' }, reason: { type: 'textarea' } })}>Adjust stock</Button>}
    {resource === 'appointments' && ['pending', 'confirmed'].includes(row.status) && <Button size="small" onClick={() => open('reschedule', row, `/admin/appointments/${row.id}/reschedule`, { patient_id: { type: 'reference', resource: 'patients' }, doctor_id: { type: 'reference', resource: 'doctors' }, appointment_date: { type: 'date' }, appointment_time: { type: 'time' }, reason: { type: 'textarea' } })}>Reschedule</Button>}
    {resource === 'appointments' && ['pending', 'confirmed'].includes(row.status) && <Button size="small" onClick={() => open('update appointment', row, `/admin/appointments/${row.id}/status`, { status: { type: 'select', options: row.status === 'pending' ? ['confirmed', 'cancelled', 'rejected'] : ['cancelled'] }, cancellation_reason: { type: 'textarea', optional: true } })}>Change status</Button>}
    {resource === 'lab-reports' && <Button size="small" onClick={() => downloadReport(row)}>Download</Button>}
  </Stack>;
  return <Stack spacing={3} sx={{ minWidth: 0, width: '100%' }}>
    <Typography variant="h5" fontWeight={700}>{reporting ? 'Reports & Exports' : titles[resource]}</Typography>
    {resources.length > 1 && <Tabs variant="scrollable" scrollButtons="auto" value={tab} onChange={(_, v) => { setTab(v); setPage(0); setSearch(''); setQuery(''); setFilters({}); setSort('id'); setNotice(''); }}>{resources.map((r) => <Tab key={r} label={titles[r]} />)}</Tabs>}
    {error && <Alert severity="error" action={<Button onClick={load}>Retry</Button>}>{error}</Alert>}
    {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, '& > .MuiTextField-root': { width: { xs: '100%', sm: 180 }, flexShrink: 0 }, '& > .MuiButton-root': { flexShrink: 0, whiteSpace: 'nowrap' } }}>
      <TextField size="small" label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
      <TextField size="small" type="date" label="From" value={filters.start_date || ''} slotProps={{ inputLabel: { shrink: true } }} onChange={(e) => changeFilter('start_date', e.target.value)} />
      <TextField size="small" type="date" label="To" value={filters.end_date || ''} slotProps={{ inputLabel: { shrink: true } }} onChange={(e) => changeFilter('end_date', e.target.value)} />
      {(['users'].includes(resource) ? ['role', 'account_status'] : resource === 'doctors' ? ['professional_status'] : resource === 'beds' ? ['availability_status'] : resource === 'login-attempts' ? ['attempt_status'] : ['appointments','admissions','invoices','lab-tests','prescriptions'].includes(resource) ? ['status'] : []).map((key) => {
        const choices = fields[key]?.options || (key === 'availability_status' ? ['available','occupied','unavailable'] : key === 'attempt_status' ? ['success','failed','suspicious_lockout'] : { appointments: ['pending','confirmed','completed','cancelled','rejected'], admissions: ['admitted','discharged'], invoices: ['unpaid','partially_paid','paid','cancelled'], 'lab-tests': ['requested','assigned','processing','completed','cancelled'], prescriptions: ['pending','partially_dispensed','dispensed','cancelled'] }[resource]) || [];
        return <TextField key={key} select size="small" label={label(key)} value={filters[key] || ''} onChange={(e) => changeFilter(key, e.target.value)}><MenuItem value="">All</MenuItem>{choices.map((value) => <MenuItem key={value} value={value}>{label(value)}</MenuItem>)}</TextField>;
      })}
      {(resource === 'doctors' ? ['department_id', 'specialization_id'] : resource === 'specializations' ? ['department_id'] : resource === 'doctor-schedules' ? ['doctor_id'] : ['appointments', 'consultations', 'lab-tests', 'prescriptions'].includes(resource) ? ['patient_id', 'doctor_id', 'department_id'] : resource === 'admissions' ? ['patient_id', 'ward_id'] : resource === 'invoices' ? ['patient_id'] : resource === 'beds' ? ['ward_id'] : []).map((key) => {
        const lookup = { department_id: 'departments', specialization_id: 'specializations', doctor_id: 'doctors', patient_id: 'patients', ward_id: 'wards' }[key];
        return <TextField key={key} select size="small" label={label(key)} value={filters[key] || ''} sx={{ minWidth: 150 }} onChange={(e) => changeFilter(key, e.target.value)}><MenuItem value="">All</MenuItem>{(options[lookup] || []).map((o) => <MenuItem key={o.id} value={o.id}>{o.label}</MenuItem>)}</TextField>;
      })}
      {resource === 'payments' && <TextField select size="small" label="Payment method" value={filters.payment_method || ''} onChange={(e) => changeFilter('payment_method', e.target.value)} sx={{ minWidth: 150 }}><MenuItem value="">All methods</MenuItem>{['cash', 'card', 'mobile_money'].map((v) => <MenuItem key={v} value={v}>{label(v)}</MenuItem>)}</TextField>}
      {resource === 'medicines' && <><FormControlLabel label="Low stock" control={<Switch checked={Boolean(filters.low_stock)} onChange={(e) => changeFilter('low_stock', e.target.checked ? 1 : undefined)} />} /><FormControlLabel label="Expired / expires within 30 days" control={<Switch checked={Boolean(filters.expiring)} onChange={(e) => changeFilter('expiring', e.target.checked ? 1 : undefined)} />} /></>}
      <Button onClick={load}>Refresh</Button><Button onClick={() => exportFile('csv')}>Export CSV</Button><Button onClick={() => exportFile('pdf')}>Export PDF</Button>
      {!reporting && !definition.readonly && catalog[resource] && <Button variant="contained" onClick={() => open('edit', null, '', fields)}>Add {titles[resource]}</Button>}
      {!reporting && resource === 'admissions' && <Button variant="contained" onClick={() => open('admit', null, '/admin/admissions', { patient_id: { type: 'reference', resource: 'patients' }, bed_id: { type: 'reference', resource: 'beds' }, admission_notes: { type: 'textarea', optional: true } })}>Admit patient</Button>}
      {!reporting && resource === 'appointments' && <Button variant="contained" onClick={() => open('book appointment', null, '/admin/appointments', { patient_id: { type: 'reference', resource: 'patients' }, doctor_id: { type: 'reference', resource: 'doctors' }, appointment_date: { type: 'date' }, appointment_time: { type: 'time' }, reason: { type: 'textarea' } })}>Book appointment</Button>}
      {!reporting && resource === 'invoices' && <Button variant="contained" onClick={() => { open('invoice', null, '', { patient_id: { type: 'reference', resource: 'patients' } }); setForm({ patient_id: '', items: [{ service_description: '', service_type: 'consultation', quantity: 1, unit_price: '' }] }); }}>Create invoice</Button>}
    </Stack>
    {resource === 'laboratory-revenue' && <Alert severity="info">Laboratory charges billed on active invoices. Cash received is reported under Revenue.</Alert>}
    {resource === 'users' && <Alert severity="info">Administrators have full management access. Staff permissions are assigned to their role-specific workflows. Editing an account ends its existing sessions.</Alert>}
    {resource === 'medicines' && <Alert severity="info">Use Adjust stock to add or deduct inventory. Every change records its reason and previous balance.</Alert>}
    <Paper variant="outlined" sx={{ minWidth: 0, width: '100%', overflow: 'hidden' }}><TableContainer sx={{ overflowX: 'auto' }}><Table size="small" aria-label={titles[resource]}>
      <TableHead><TableRow>{columns.map((key) => <TableCell key={key}><TableSortLabel disabled={analytics.includes(resource) || ['patient', 'doctor', 'user', 'bed', 'invoice', 'medicine', 'test_type'].includes(key)} active={sort === key} direction={sort === key ? direction : 'asc'} onClick={() => { setSort(key); setDirection(sort === key && direction === 'asc' ? 'desc' : 'asc'); setPage(0); }}>{label(key)}</TableSortLabel></TableCell>)}<TableCell>Actions</TableCell></TableRow></TableHead>
      <TableBody>{loading ? <TableRow><TableCell colSpan={columns.length + 1} align="center"><CircularProgress size={28} sx={{ m: 3 }} /></TableCell></TableRow> : records.length === 0 ? <TableRow><TableCell colSpan={columns.length + 1} align="center" sx={{ py: 5 }}>No records found.</TableCell></TableRow> : records.map((row) => <TableRow key={row.id} hover>{columns.map((key) => <TableCell key={key} sx={{ maxWidth: 240, overflowWrap: 'anywhere' }}>{cell(row, key)}</TableCell>)}<TableCell>{workflowButtons(row)}</TableCell></TableRow>)}</TableBody>
    </Table></TableContainer><TablePagination component="div" count={total} page={page} rowsPerPage={size} rowsPerPageOptions={[10, 25, 50, 100]} onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setSize(Number(e.target.value)); setPage(0); }} /></Paper>
    <Dialog open={Boolean(dialog)} onClose={() => !saving && setDialog(null)} fullWidth maxWidth="md">
      <DialogTitle>{dialog?.kind === 'edit' ? `${dialog.row ? 'Edit' : 'Add'} ${titles[resource]}` : label(dialog?.kind || '')}</DialogTitle>
      <DialogContent dividers><Stack spacing={2} sx={{ pt: 1 }}>
        {dialogError && <Alert severity="error">{dialogError}{Object.entries(fieldErrors).map(([key, values]) => <Typography key={key} variant="body2">{label(key)}: {values.join(' ')}</Typography>)}</Alert>}
        {dialog?.kind === 'view' ? Object.entries(dialog.row).filter(([key]) => !['password', 'remember_token', 'file_path', 'deleted_at'].includes(key)).map(([key, value]) => <Box key={key}><Typography fontWeight={700} variant="body2">{label(key)}</Typography><Typography component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'inherit', m: 0 }}>{value && typeof value === 'object' ? JSON.stringify(value, null, 2) : display(value)}</Typography></Box>) : dialog?.kind === 'delete' ? <Alert severity="warning">Delete this record? Records with operational history may need to be retained.</Alert> : <>
          {['pay', 'discharge', 'cancel invoice', 'adjust stock', 'update appointment'].includes(dialog?.kind) && <Alert severity="warning">Review the details before confirming this action. {dialog?.kind === 'adjust stock' && 'Enter a negative quantity for deductions.'}</Alert>}
          {Object.entries(dialog?.fields || {}).map(([key, spec]) => renderField(key, spec))}
          {dialog?.kind === 'invoice' && <>
            {(form.items || []).map((item, i) => <Paper variant="outlined" key={i} sx={{ p: 2 }}><Stack spacing={2}>
              {['service_description', 'service_type', 'quantity', 'unit_price'].map((key) => <TextField key={key} label={label(key)} select={key === 'service_type'} type={['quantity', 'unit_price'].includes(key) ? 'number' : 'text'} value={item[key]} slotProps={{ htmlInput: { step: key === 'unit_price' ? '0.01' : '1', min: key === 'quantity' ? 1 : undefined } }} onChange={(e) => setForm({ ...form, items: form.items.map((v, j) => j === i ? { ...v, [key]: e.target.value } : v) })}>{key === 'service_type' && ['consultation', 'lab_test', 'medicine', 'admission'].map((v) => <MenuItem key={v} value={v}>{label(v)}</MenuItem>)}</TextField>)}
              <Button color="error" disabled={form.items.length === 1} onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })}>Remove charge</Button>
            </Stack></Paper>)}
            <Button onClick={() => setForm({ ...form, items: [...form.items, { service_description: '', service_type: 'consultation', quantity: 1, unit_price: '' }] })}>Add charge</Button>
            <Typography fontWeight={700}>Total: {form.items.reduce((sum, item) => sum + Math.round(Number(item.unit_price || 0) * 100) * Number(item.quantity || 0), 0) / 100}</Typography>
          </>}
        </>}
      </Stack></DialogContent>
      <DialogActions><Button disabled={saving} onClick={() => setDialog(null)}>{dialog?.kind === 'view' ? 'Close' : 'Cancel'}</Button>{dialog?.kind !== 'view' && <Button variant="contained" color={dialog?.kind === 'delete' ? 'error' : 'primary'} disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Confirm'}</Button>}</DialogActions>
    </Dialog>
  </Stack>;
}

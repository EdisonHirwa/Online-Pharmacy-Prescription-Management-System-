import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, LinearProgress, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TablePagination, TableRow, TableSortLabel, TextField, Typography,
} from '@mui/material';
import ConfirmDialog from '../../components/ConfirmDialog';
import ReportPreview from './ReportPreview';
import { laboratoryService as service, laboratoryError, laboratoryLabel as label } from '../../services/laboratoryService';
const titles = { queue: 'Requested Investigations', work: 'My Laboratory Work', reports: 'Reports & Uploads', history: 'Completed Investigations' };
const statuses = { queue: [], work: ['assigned','processing'], reports: ['processing','completed'], history: [] };
const Field = ({ label, value }) => <Box><Typography variant="caption" color="text.secondary">{label}</Typography><Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value || 'Not recorded'}</Typography></Box>;
export default function LaboratoryWorkspace({ mode = 'queue' }) {
  const location = useLocation(); const requestId = useRef(0);
  const [rows, setRows] = useState([]); const [page, setPage] = useState(0); const [size, setSize] = useState(10); const [total, setTotal] = useState(0);
  const [search, setSearch] = useState(new URLSearchParams(location.search).get('search') || ''); const [query, setQuery] = useState(search);
  const [filters, setFilters] = useState({}); const [sort, setSort] = useState(mode === 'history' ? 'updated_at' : 'request_date'); const [direction, setDirection] = useState(mode === 'history' ? 'desc' : 'asc');
  const [options, setOptions] = useState({ test_types: [], can_manage: false });
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [record, setRecord] = useState(null); const [summary, setSummary] = useState(''); const [dialogError, setDialogError] = useState('');
  const [file, setFile] = useState(null); const [fileError, setFileError] = useState(''); const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false); const [busyRow, setBusyRow] = useState(null); const [uploading, setUploading] = useState(false); const [progress, setProgress] = useState(0); const [confirm, setConfirm] = useState(null);
  const load = useCallback(async () => {
    const id = ++requestId.current; setLoading(true);
    try { const response = await service.list({ mode, page: page + 1, per_page: size, search: query, sort, direction, ...filters }); if (id === requestId.current) { setRows(response.data.data); setTotal(response.data.meta.total); setError(''); } }
    catch (err) { if (id === requestId.current) { setError(laboratoryError(err)); setRows([]); setTotal(0); } }
    finally { if (id === requestId.current) setLoading(false); }
  }, [mode, page, size, query, sort, direction, filters]);
  useEffect(() => { let active = true; service.options().then((response) => { if (active) setOptions(response.data.data); }).catch((err) => { if (active) setError(laboratoryError(err)); }); return () => { active = false; }; }, []);
  useEffect(() => { load(); const timer = setInterval(load, 30000); return () => { ++requestId.current; clearInterval(timer); }; }, [load]);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(0); }, 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { setSearch(new URLSearchParams(location.search).get('search') || ''); }, [location.search]);
  const open = async (row) => {
    setBusyRow(row.id); setError('');
    try { const response = await service.get(row.id); setRecord(response.data.data); setSummary(response.data.data.result_summary || ''); setFile(null); setFileError(''); setDialogError(''); setPreview(null); }
    catch (err) { setError(laboratoryError(err)); }
    finally { setBusyRow(null); }
  };
  const close = () => { if (!busy && !uploading) { setRecord(null); setFile(null); setPreview(null); } };
  const action = async (row, kind) => {
    setBusyRow(row.id); setError(''); setDialogError('');
    try {
      const response = await service.action(row.id, kind);
      setNotice(kind === 'claim' ? 'Investigation assigned to you. Open My Work to begin processing.' : kind === 'start' ? 'Processing started. You can enter findings and upload reports.' : 'Assignment released to the requested-investigations queue.');
      if (record?.id === row.id) { setRecord(response.data.data); if (kind === 'release') close(); }
      await load();
    } catch (err) { if (record) setDialogError(laboratoryError(err)); else setError(laboratoryError(err)); }
    finally { setBusyRow(null); }
  };
  const selectFile = (event) => {
    const selected = event.target.files?.[0]; event.target.value = ''; setFileError(''); setFile(null);
    if (!selected) return;
    const extension = selected.name.split('.').pop().toLowerCase(); const mime = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }[extension];
    if (!mime || selected.type !== mime) { setFileError('Select a PDF, JPEG, or PNG file whose extension matches its contents.'); return; }
    if (selected.size > 2 * 1024 * 1024) { setFileError('Reports must not exceed 2 MB.'); return; }
    if (selected.size === 0) { setFileError('The selected file is empty.'); return; }
    setFile(selected);
  };
  const upload = async () => {
    if (!file) return; setUploading(true); setProgress(0); setDialogError('');
    try { await service.upload(record.id, file, setProgress); const response = await service.get(record.id); setRecord(response.data.data); setFile(null); setNotice('Draft report uploaded. It will be released when the investigation is finalized.'); await load(); }
    catch (err) { setDialogError(laboratoryError(err)); }
    finally { setUploading(false); }
  };
  const previewReport = async (report) => {
    setDialogError('');
    try { const response = await service.preview(report.id); setPreview({ file: response.data, name: report.name }); }
    catch (err) { setDialogError(laboratoryError(err)); }
  };
  const download = async (report) => { try { await service.download(report); } catch (err) { setDialogError(laboratoryError(err)); } };
  const validSummary = () => {
    if (!summary.trim()) { setDialogError('Enter the laboratory findings before saving or finalizing.'); return false; }
    if (summary.length > 10000) { setDialogError('Findings must not exceed 10,000 characters.'); return false; }
    return true;
  };
  const saveDraft = async () => {
    if (!validSummary()) return; setBusy(true); setDialogError('');
    try { const response = await service.save(record.id, summary); setRecord(response.data.data); setSummary(response.data.data.result_summary); setNotice('Draft findings saved. Results have not been published.'); await load(); }
    catch (err) { setDialogError(laboratoryError(err)); }
    finally { setBusy(false); }
  };
  const reviewCompletion = () => {
    if (!validSummary()) return;
    if (file) { setDialogError('Upload or remove the selected report before finalizing.'); return; }
    setConfirm({ kind: 'complete' });
  };
  const confirmAction = async () => {
    setBusy(true); setDialogError('');
    try {
      if (confirm.kind === 'complete') { const response = await service.complete(record.id, summary); setRecord(response.data.data); setNotice('Investigation completed. The doctor and patient have been notified.'); }
      if (confirm.kind === 'remove') { await service.removeReport(confirm.report.id); setRecord((await service.get(record.id)).data.data); setPreview(null); setNotice('Draft report removed.'); }
      if (confirm.kind === 'release') { await service.action(record.id, 'release'); setRecord(null); setFile(null); setPreview(null); setNotice('Assignment released to the queue.'); }
      setConfirm(null); await load();
    } catch (err) { setDialogError(laboratoryError(err)); setConfirm(null); }
    finally { setBusy(false); }
  };
  const filter = (key, value) => { setFilters((prev) => ({ ...prev, [key]: value || undefined })); setPage(0); };
  return <Stack spacing={3} sx={{ width: '100%', minWidth: 0 }}>
    <Typography variant="h5" fontWeight={700}>{titles[mode]}</Typography>
    {error && <Alert severity="error" action={<Button onClick={load}>Retry</Button>}>{error}</Alert>}
    {notice && <Alert severity="success" onClose={() => setNotice('')} action={mode === 'queue' ? <Button component={Link} to="/lab/process">My work</Button> : undefined}>{notice}</Alert>}
    <Alert severity="info">{mode === 'queue' ? 'Claim an unassigned request to add it to your work. Requests already assigned to another technician are private.' : mode === 'history' ? 'Completed findings and reports are preserved. Open a record to review or download its reports.' : 'Start your assigned investigation, save draft findings, and upload permitted reports. Finalize only after reviewing the results.'}</Alert>
    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, '& > .MuiTextField-root': { width: { xs: '100%', sm: 190 }, flexShrink: 0 } }}>
      <TextField size="small" label="Search patient or investigation" value={search} onChange={(event) => setSearch(event.target.value)} />
      <TextField size="small" select label="Investigation type" value={filters.test_type_id || ''} onChange={(event) => filter('test_type_id', event.target.value)}><MenuItem value="">All types</MenuItem>{options.test_types.map((type) => <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>)}</TextField>
      {statuses[mode].length > 0 && <TextField size="small" select label="Status" value={filters.status || ''} onChange={(event) => filter('status', event.target.value)}><MenuItem value="">All statuses</MenuItem>{statuses[mode].map((status) => <MenuItem key={status} value={status}>{label(status)}</MenuItem>)}</TextField>}
      {['start_date','end_date'].map((key) => <TextField key={key} size="small" label={`${mode === 'history' ? 'Completed' : 'Requested'} ${key === 'start_date' ? 'from' : 'to'}`} type="date" value={filters[key] || ''} slotProps={{ inputLabel: { shrink: true } }} onChange={(event) => filter(key, event.target.value)} />)}
      <Button onClick={load}>Refresh</Button>
    </Stack>
    <Paper variant="outlined" sx={{ width: '100%', overflow: 'hidden', minWidth: 0 }}><TableContainer><Table size="small" aria-label={titles[mode]}>
      <TableHead><TableRow>{[['id','Reference'],['patient','Patient'],['test_type','Investigation'],['doctor','Doctor'],[mode === 'history' ? 'updated_at' : 'request_date',mode === 'history' ? 'Completed' : 'Requested'],['status','Status']].map(([key,text]) => <TableCell key={key}><TableSortLabel disabled={key === 'doctor'} active={sort === key} direction={sort === key ? direction : 'asc'} onClick={() => { setSort(key); setDirection(sort === key && direction === 'asc' ? 'desc' : 'asc'); setPage(0); }}>{text}</TableSortLabel></TableCell>)}<TableCell>Actions</TableCell></TableRow></TableHead>
      <TableBody>{loading ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow> : rows.length === 0 ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5 }}>No investigations found.</TableCell></TableRow> : rows.map((row) => <TableRow key={row.id} hover><TableCell>#{row.id}</TableCell><TableCell sx={{ minWidth: 150 }}>{row.patient.name}<Typography variant="caption" display="block" color="text.secondary">{row.patient.patient_number}</Typography></TableCell><TableCell>{row.test_type?.name}</TableCell><TableCell>{row.doctor.name}</TableCell><TableCell>{new Date(mode === 'history' ? row.completed_at : row.request_date).toLocaleString()}</TableCell><TableCell><Chip size="small" variant="outlined" label={label(row.status)} /></TableCell><TableCell><Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, minWidth: 130 }}>
        <Button size="small" disabled={busyRow === row.id} onClick={() => open(row)}>View</Button>
        {row.actions.claim && <Button size="small" variant="contained" disabled={busyRow === row.id} onClick={() => action(row,'claim')}>Claim request</Button>}
        {row.actions.start && <Button size="small" disabled={busyRow === row.id} onClick={() => action(row,'start')}>Start processing</Button>}
        {row.actions.edit && <Button size="small" variant="contained" disabled={busyRow === row.id} onClick={() => open(row)}>Enter findings</Button>}
      </Stack></TableCell></TableRow>)}</TableBody>
    </Table></TableContainer><TablePagination component="div" count={total} page={page} rowsPerPage={size} rowsPerPageOptions={[10,25,50,100]} onPageChange={(_,value) => setPage(value)} onRowsPerPageChange={(event) => { setSize(Number(event.target.value)); setPage(0); }} /></Paper>
    {record && <Dialog open onClose={close} maxWidth="md" fullWidth><DialogTitle>Investigation #{record.id} · {record.test_type?.name}</DialogTitle><DialogContent dividers><Stack spacing={2}>
      {dialogError && <Alert severity="error">{dialogError}</Alert>}{notice && <Alert severity="success">{notice}</Alert>}
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}><Chip label={label(record.status)} variant="outlined" /><Typography>{record.patient.name} · {record.patient.patient_number}</Typography></Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}><Field label="Date of birth" value={record.patient.date_of_birth} /><Field label="Gender" value={record.patient.gender} /><Field label="Requested by" value={record.doctor.name} /><Field label="Requested" value={record.request_date} /><Field label="Expected turnaround" value={record.test_type?.expected_turnaround_time} /><Field label="Clinical context" value={record.clinical_context} /></Box>
      {record.test_type?.description && <Field label="Investigation details" value={record.test_type.description} />}
      {record.actions.start && <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}><Button variant="contained" disabled={busyRow !== null} onClick={() => action(record,'start')}>Start processing</Button><Button disabled={busy} onClick={() => setConfirm({ kind: 'release' })}>Release assignment</Button></Stack>}
      {record.actions.edit ? <TextField label="Laboratory findings / result summary" multiline minRows={5} fullWidth value={summary} onChange={(event) => setSummary(event.target.value)} slotProps={{ htmlInput: { maxLength: 10000 } }} helperText="Draft findings remain private until finalization." /> : record.assigned_to_me && <Field label="Laboratory findings" value={record.result_summary} />}
      {record.status === 'completed' && <Alert severity="info">This investigation is completed. Findings and reports are read-only and available to the authorized doctor and patient.</Alert>}
      <Divider /><Typography variant="h6">Report Files</Typography>
      {record.reports.length === 0 && <Typography color="text.secondary">No report files uploaded.</Typography>}
      {record.reports.map((report) => <Paper key={report.id} variant="outlined" sx={{ p: 2 }}><Stack spacing={1}><Typography fontWeight={700}>{report.name} · {label(report.report_status)}</Typography><Typography variant="body2">{Math.ceil(report.file_size / 1024)} KB · {new Date(report.upload_date).toLocaleString()}</Typography><Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}><Button onClick={() => previewReport(report)}>Preview</Button><Button onClick={() => download(report)}>Download</Button>{record.actions.edit && report.report_status === 'preliminary' && <Button color="error" disabled={busy || uploading} onClick={() => setConfirm({ kind: 'remove', report })}>Remove draft</Button>}</Stack></Stack></Paper>)}
      {preview && <><Button onClick={() => setPreview(null)}>Close preview</Button><ReportPreview file={preview.file} name={preview.name} /></>}
      {record.actions.edit && <>
        <Alert severity="info">Upload PDF, JPEG, or PNG files up to 2 MB each. Uploads remain preliminary until the investigation is finalized. Attachments are optional when the result summary is sufficient.</Alert>
        {fileError && <Alert severity="error">{fileError}</Alert>}
        <Button component="label" variant="outlined" disabled={busy || uploading}>Choose report file<input hidden type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={selectFile} /></Button>
        {file && <><Typography>{file.name} · {Math.ceil(file.size / 1024)} KB</Typography><ReportPreview file={file} name={file.name} /><Stack direction="row" spacing={1}><Button variant="contained" disabled={busy || uploading} onClick={upload}>{uploading ? 'Uploading…' : 'Upload report'}</Button><Button disabled={uploading} onClick={() => setFile(null)}>Remove selected file</Button></Stack></>}
        {uploading && <Box><LinearProgress variant="determinate" value={progress} /><Typography variant="caption">Upload: {progress}%</Typography></Box>}
      </>}
    </Stack></DialogContent><DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}><Button disabled={busy || uploading || busyRow !== null} onClick={close}>Close</Button>{record.actions.edit && <><Button disabled={busy || uploading} onClick={saveDraft}>Save draft findings</Button><Button variant="contained" disabled={busy || uploading} onClick={reviewCompletion}>Review & finalize</Button></>}</DialogActions></Dialog>}
    {confirm && <ConfirmDialog open title={confirm.kind === 'complete' ? 'Finalize laboratory investigation?' : confirm.kind === 'remove' ? 'Remove this draft report?' : 'Release this assignment?'} message={confirm.kind === 'complete' ? `Publish the findings and reports for ${record?.patient.name}. The doctor and patient will be notified, and this investigation becomes read-only.` : confirm.kind === 'remove' ? 'This removes the preliminary file. Completed reports cannot be removed.' : 'This returns the unstarted investigation to the queue for another technician.'} confirmText={confirm.kind === 'complete' ? 'Finalize investigation' : 'Confirm'} isDestructive={confirm.kind === 'remove'} loading={busy} onConfirm={confirmAction} onClose={() => setConfirm(null)} />}
  </Stack>;
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material';
import ConfirmDialog from '../../components/ConfirmDialog';
import PharmacyTable, { PharmacyFilters, usePharmacyList } from './PharmacyTable';
import { pharmacyService as service, pharmacyError, pharmacyLabel as label } from '../../services/pharmacyService';
export default function PharmacyPrescriptions({ all = false }) {
  const state = usePharmacyList('prescriptions', all ? 'all' : 'queue');
  const [record, setRecord] = useState(null); const [quantities, setQuantities] = useState({}); const [reviewed, setReviewed] = useState(false); const [notes, setNotes] = useState('');
  const [currency, setCurrency] = useState('RWF'); const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [opening, setOpening] = useState(null); const [confirmation, setConfirmation] = useState(null); const [key, setKey] = useState('');
  useEffect(() => { let active = true; service.dashboard().then((response) => { if (active) setCurrency(response.data.data.currency); }).catch(() => {}); return () => { active = false; }; }, []);
  const changed = () => setKey(crypto.randomUUID());
  const open = async (row) => {
    setOpening(row.id); state.setError('');
    try { const response = await service.prescription(row.id); setRecord(response.data.data); setQuantities({}); setReviewed(false); setNotes(''); setError(''); setKey(crypto.randomUUID()); }
    catch (err) { state.setError(pharmacyError(err)); }
    finally { setOpening(null); }
  };
  const selected = record?.items.filter((item) => Number(quantities[item.id]) > 0) || [];
  const total = selected.reduce((sum, item) => sum + Number(quantities[item.id]) * Math.round(Number(item.unit_price) * 100), 0) / 100;
  const review = () => {
    setError('');
    if (!reviewed) { setError('Review the prescription and recorded allergy information, then tick the acknowledgement.'); return; }
    if (!selected.length) { setError('Enter a quantity for at least one prescribed medicine.'); return; }
    if (Object.values(quantities).some((value) => value !== '' && (!Number.isInteger(Number(value)) || Number(value) < 0))) { setError('Enter whole quantities of zero or more.'); return; }
    if (selected.some((item) => !item.available || Number(quantities[item.id]) > Math.min(item.remaining_quantity, item.available_stock))) { setError('Quantities must fit the remaining prescription allowance and available stock.'); return; }
    setConfirmation({ request_key: key, version: record.version, allergies_reviewed: true, notes, items: selected.map((item) => ({ prescription_item_id: item.id, quantity: Number(quantities[item.id]) })) });
  };
  const dispense = async () => {
    setBusy(true); setError('');
    try { const response = await service.dispense(record.id, confirmation); setNotice(`Dispensation #${response.data.data.id} recorded. Charges: ${response.data.data.total} ${currency}.`); setRecord(null); setConfirmation(null); await state.load(); }
    catch (err) { setError(pharmacyError(err)); setConfirmation(null); }
    finally { setBusy(false); }
  };
  const columns = [
    { key: 'id', label: 'Prescription', sort: true, render: (row) => `#${row.id}` },
    { key: 'patient', label: 'Patient', render: (row) => <>{row.patient.name}<Typography variant="caption" display="block">{row.patient.patient_number}</Typography></> },
    { key: 'doctor_name', label: 'Doctor' }, { key: 'issue_date', label: 'Issued', sort: true, render: (row) => new Date(row.issue_date).toLocaleString() },
    { key: 'status', label: 'Status', sort: true, render: (row) => <Chip size="small" label={label(row.status)} /> },
    { key: 'actions', label: 'Actions', render: (row) => <Button disabled={opening !== null} onClick={() => open(row)}>{row.can_dispense ? 'Review & dispense' : 'View prescription'}</Button> },
  ];
  return <Stack spacing={3} sx={{ minWidth: 0 }}>
    <Typography variant="h5" fontWeight={700}>{all ? 'Prescriptions & Dispensing' : 'Prescription Queue'}</Typography>
    <Alert severity="info">Review the prescription and allergy information before dispensing. You can dispense part of an allowance and return for the remaining quantity.</Alert>
    {state.error && <Alert severity="error" action={<Button onClick={state.load}>Retry</Button>}>{state.error}</Alert>}
    {notice && <Alert severity="success" onClose={() => setNotice('')} action={<Button component={Link} to="/pharmacy/history">History</Button>}>{notice}</Alert>}
    <PharmacyFilters state={state} statuses={all ? ['pending','partially_dispensed','dispensed','cancelled'] : ['pending','partially_dispensed']} />
    <PharmacyTable state={state} columns={columns} title="Prescriptions" />
    {record && <Dialog open fullWidth maxWidth="md" onClose={() => { if (!busy) setRecord(null); }}><DialogTitle>Prescription #{record.id}</DialogTitle><DialogContent dividers><Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      <Typography fontWeight={700}>{record.patient.name} · {record.patient.patient_number}</Typography>
      <Typography variant="body2">Doctor: {record.doctor_name} · Issued: {new Date(record.issue_date).toLocaleString()}</Typography><Chip label={label(record.status)} sx={{ alignSelf: 'start' }} />
      <Typography sx={{ whiteSpace: 'pre-wrap' }}>Instructions: {record.prescription_instructions || 'No additional instructions recorded.'}</Typography>
      <Typography variant="h6">Recorded Allergies</Typography>
      {record.allergies.length ? record.allergies.map((allergy, index) => <Alert key={index} severity={allergy.severity === 'severe' ? 'error' : 'warning'}><strong>{allergy.allergy_name}</strong> · {label(allergy.severity)}{allergy.reaction_description && ` · ${allergy.reaction_description}`}</Alert>) : <Alert severity="info">No allergies are recorded. Confirm allergy information with the patient before dispensing.</Alert>}
      <Divider /><Typography variant="h6">Prescribed Medicines</Typography>
      {record.items.map((item) => <Paper key={item.id} variant="outlined" sx={{ p: 2 }}><Stack spacing={1}>
        <Typography fontWeight={700}>{item.medicine_name} · {item.medicine_code || 'Unavailable'}</Typography>
        <Typography variant="body2">{item.dosage} · {item.frequency} · {item.duration}</Typography>
        <Typography variant="body2">Prescribed: {item.quantity} · Dispensed: {item.dispensed_quantity} · Remaining: {item.remaining_quantity} {item.unit}</Typography>
        <Typography variant="body2">In stock: {item.available_stock} · Expiry: {item.expiry_date || 'Unavailable'} · Prescribed price: {Number(item.unit_price).toFixed(2)} {currency}</Typography>
        {!item.available && <Alert severity="warning">This medicine is unavailable, inactive, or expired and cannot be dispensed.</Alert>}
        {record.can_dispense && item.remaining_quantity > 0 && <TextField type="number" label={`Quantity to dispense: ${item.medicine_name}`} value={quantities[item.id] ?? ''} disabled={!item.available || item.available_stock <= 0 || busy} onChange={(event) => { changed(); setQuantities((previous) => ({ ...previous, [item.id]: event.target.value })); }} slotProps={{ htmlInput: { min: 0, max: Math.min(item.remaining_quantity, item.available_stock), step: 1 } }} helperText={`Leave blank or use 0 to skip. Maximum: ${Math.min(item.remaining_quantity, item.available_stock)}.`} />}
      </Stack></Paper>)}
      {record.can_dispense && <><TextField multiline minRows={2} label="Dispensing notes" value={notes} disabled={busy} onChange={(event) => { changed(); setNotes(event.target.value); }} slotProps={{ htmlInput: { maxLength: 5000 } }} /><FormControlLabel control={<Checkbox checked={reviewed} disabled={busy} onChange={(event) => { changed(); setReviewed(event.target.checked); }} />} label="I have reviewed the prescribed medicines and the patient's allergy information." /><Typography fontWeight={700}>Selected medicine charges: {total.toFixed(2)} {currency}</Typography></>}
      {record.dispensations?.length > 0 && <><Divider /><Typography variant="h6">Dispensing History</Typography>{record.dispensations.map((transaction) => <Paper variant="outlined" key={transaction.id} sx={{ p: 2 }}><Typography>#{transaction.id} · {label(transaction.dispensing_status)} · {new Date(transaction.dispensing_date).toLocaleString()}</Typography><Typography variant="body2">Pharmacist: {transaction.pharmacist_name}</Typography>{transaction.items.map((item) => <Typography variant="body2" key={item.id}>{item.medicine_name}: {item.quantity_dispensed} · {item.subtotal} {currency}</Typography>)}<Typography sx={{ whiteSpace: 'pre-wrap' }}>{transaction.notes}</Typography></Paper>)}</>}
    </Stack></DialogContent><DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}><Button disabled={busy} onClick={() => setRecord(null)}>Close</Button>{record.can_dispense && <Button variant="contained" disabled={busy} onClick={review}>Review dispensing</Button>}</DialogActions></Dialog>}
    {confirmation && <ConfirmDialog open loading={busy} title="Confirm medicine dispensing?" message={`Record the selected quantities for ${record?.patient.name} and charge ${total.toFixed(2)} ${currency}. Stock and prescription status will update together. Verify the quantities before confirming.`} confirmText="Confirm dispensing" onConfirm={dispense} onClose={() => setConfirmation(null)} />}
  </Stack>;
}

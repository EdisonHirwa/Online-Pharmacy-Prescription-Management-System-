import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import ConfirmDialog from '../../components/ConfirmDialog';
import PharmacyTable, { PharmacyFilters, usePharmacyList } from './PharmacyTable';
import { pharmacyService as service, pharmacyError } from '../../services/pharmacyService';
const fields = ['medicine_code','name','category','unit','unit_price','reorder_level','expiry_date','status','description'];
const empty = { medicine_code: '', name: '', category: '', unit: 'tablet', unit_price: '', reorder_level: 10, expiry_date: '', status: 'active', description: '' };
export default function PharmacyInventory() {
  const state = usePharmacyList('medicines'); const [config, setConfig] = useState({ can_manage: false, currency: 'RWF', today: '' });
  const [editing, setEditing] = useState(null); const [form, setForm] = useState(empty); const [stock, setStock] = useState(null); const [adjustment, setAdjustment] = useState({ quantity: '', reason: '' });
  const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [errors, setErrors] = useState({}); const [busy, setBusy] = useState(false); const [confirmation, setConfirmation] = useState(null);
  useEffect(() => { let active = true; service.dashboard().then((response) => { if (active) setConfig(response.data.data); }).catch((err) => { if (active) state.setError(pharmacyError(err)); }); return () => { active = false; }; }, []);
  const edit = (row = {}) => { setEditing(row); setForm(row.id ? Object.fromEntries(fields.map((field) => [field, row[field] ?? ''])) : empty); setError(''); setErrors({}); };
  const openStock = (row) => { setStock(row); setAdjustment({ quantity: '', reason: '' }); setError(''); setErrors({}); };
  const reviewStock = (event) => {
    event.preventDefault(); setError(''); const quantity = Number(adjustment.quantity);
    if (!Number.isInteger(quantity) || quantity === 0 || Math.abs(quantity) > 1000000) { setError('Enter a nonzero whole quantity between -1,000,000 and 1,000,000.'); return; }
    if (stock.available_stock + quantity < 0 || stock.available_stock + quantity > 1000000000) { setError('The resulting stock must be between zero and 1,000,000,000.'); return; }
    setConfirmation({ kind: 'stock', data: { quantity, reason: adjustment.reason } });
  };
  const save = async () => {
    setBusy(true); setError(''); setErrors({});
    try {
      if (confirmation.kind === 'stock') { await service.stock(stock.id, confirmation.data); setStock(null); setNotice('Stock updated and movement recorded.'); }
      else { await service.medicine(form, editing.id); setEditing(null); setNotice('Medicine saved. Use Adjust stock to record inventory changes.'); }
      setConfirmation(null); await state.load();
    } catch (err) { setError(pharmacyError(err)); setErrors(err.response?.data?.errors || {}); setConfirmation(null); }
    finally { setBusy(false); }
  };
  const columns = [
    { key: 'medicine_code', label: 'Code' }, { key: 'name', label: 'Medicine', sort: true }, { key: 'category', label: 'Category' },
    { key: 'available_stock', label: 'Stock', sort: true, render: (row) => <Stack spacing={0.5}><Typography variant="body2">{row.available_stock} {row.unit}</Typography>{row.available_stock <= row.reorder_level && <Chip size="small" label="Low stock" color="warning" />}</Stack> },
    { key: 'reorder_level', label: 'Reorder level', sort: true }, { key: 'unit_price', label: 'Unit price', sort: true, render: (row) => `${Number(row.unit_price).toFixed(2)} ${config.currency}` },
    { key: 'expiry_date', label: 'Expiry', sort: true, render: (row) => <>{row.expiry_date}{row.expiry_date < config.today && <Chip size="small" label="Expired" color="error" />}</> },
    { key: 'status', label: 'Status' }, { key: 'actions', label: 'Actions', render: (row) => config.can_manage ? <Stack direction="row" sx={{ flexWrap: 'wrap' }}><Button onClick={() => edit(row)}>Edit medicine</Button><Button onClick={() => openStock(row)}>Adjust stock</Button></Stack> : 'Read-only' },
  ];
  return <Stack spacing={3} sx={{ minWidth: 0 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}><Typography variant="h5" fontWeight={700}>Medicine Inventory</Typography>{config.can_manage && <Button variant="contained" onClick={() => edit()}>Add medicine</Button>}</Box>
    <Alert severity="info">New medicines start with zero stock. Record additions and deductions with a reason. Use inactive status to retire a medicine while preserving its history.</Alert>
    {state.error && <Alert severity="error" action={<Button onClick={state.load}>Retry</Button>}>{state.error}</Alert>}{notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
    <PharmacyFilters state={state} statuses={['active','inactive']} dates={false} inventory /><PharmacyTable state={state} columns={columns} title="Medicine inventory" />
    {editing && <Dialog open fullWidth maxWidth="sm" onClose={() => { if (!busy) setEditing(null); }}><Box component="form" onSubmit={(event) => { event.preventDefault(); setConfirmation({ kind: 'medicine' }); }}><DialogTitle>{editing.id ? 'Edit Medicine' : 'Add Medicine'}</DialogTitle><DialogContent dividers><Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      {fields.map((field) => <TextField key={field} label={field === 'unit_price' ? `Unit price (${config.currency})` : field.replaceAll('_',' ').replace(/^\w/, (letter) => letter.toUpperCase())} required={field !== 'description'} disabled={busy} value={form[field]} onChange={(event) => setForm((previous) => ({ ...previous, [field]: event.target.value }))} type={['unit_price','reorder_level'].includes(field) ? 'number' : field === 'expiry_date' ? 'date' : 'text'} select={field === 'status'} multiline={field === 'description'} minRows={field === 'description' ? 3 : undefined} error={Boolean(errors[field])} helperText={errors[field]?.[0]} slotProps={{ inputLabel: field === 'expiry_date' ? { shrink: true } : undefined, htmlInput: { min: 0, max: field === 'unit_price' ? 99999999.99 : field === 'reorder_level' ? 1000000000 : undefined, step: field === 'unit_price' ? '0.01' : 1, maxLength: field === 'description' ? 5000 : ['medicine_code','category'].includes(field) ? 100 : field === 'unit' ? 50 : 255 } }}>{field === 'status' && ['active','inactive'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>)}
    </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={() => setEditing(null)}>Cancel</Button><Button variant="contained" disabled={busy} type="submit">Review medicine</Button></DialogActions></Box></Dialog>}
    {stock && <Dialog open fullWidth maxWidth="sm" onClose={() => { if (!busy) setStock(null); }}><Box component="form" onSubmit={reviewStock}><DialogTitle>Adjust Stock · {stock.name}</DialogTitle><DialogContent dividers><Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}<Typography>Current stock: {stock.available_stock} {stock.unit}</Typography><Alert severity="info">Use a positive quantity for received stock and a negative quantity for corrections or removals. This records inventory changes; prescribed dispensing is handled from the prescription queue.</Alert>
      <TextField label="Stock adjustment quantity" type="number" required disabled={busy} value={adjustment.quantity} onChange={(event) => setAdjustment((previous) => ({ ...previous, quantity: event.target.value }))} slotProps={{ htmlInput: { min: -1000000, max: 1000000, step: 1 } }} error={Boolean(errors.quantity)} helperText={errors.quantity?.[0]} />
      <TextField label="Reason for stock adjustment" required multiline minRows={2} disabled={busy} value={adjustment.reason} onChange={(event) => setAdjustment((previous) => ({ ...previous, reason: event.target.value }))} slotProps={{ htmlInput: { minLength: 3, maxLength: 1000 } }} error={Boolean(errors.reason)} helperText={errors.reason?.[0]} />
      <Typography>Expected stock after adjustment: {stock.available_stock + Number(adjustment.quantity || 0)}</Typography>
    </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={() => setStock(null)}>Cancel</Button><Button type="submit" variant="contained" disabled={busy}>Review stock adjustment</Button></DialogActions></Box></Dialog>}
    {confirmation && <ConfirmDialog open loading={busy} title={confirmation.kind === 'stock' ? 'Confirm stock adjustment?' : 'Save medicine details?'} message={confirmation.kind === 'stock' ? `Record ${confirmation.data.quantity > 0 ? '+' : ''}${confirmation.data.quantity} units for ${stock.name}. The current stock will be checked again before saving.` : 'Save these medicine details? Existing prescribed prices and dispensing history are preserved.'} confirmText={confirmation.kind === 'stock' ? 'Confirm adjustment' : 'Save medicine'} onConfirm={save} onClose={() => setConfirmation(null)} />}
  </Stack>;
}

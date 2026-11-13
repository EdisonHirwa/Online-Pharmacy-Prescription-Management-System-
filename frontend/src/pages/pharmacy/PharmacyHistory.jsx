import { useEffect, useState } from 'react';
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import PharmacyTable, { PharmacyFilters, usePharmacyList } from './PharmacyTable';
import { pharmacyService, pharmacyLabel as label } from '../../services/pharmacyService';
export default function PharmacyHistory({ movements = false }) {
  const state = usePharmacyList(movements ? 'movements' : 'history');
  const [record, setRecord] = useState(null); const [currency, setCurrency] = useState('RWF');
  useEffect(() => { let active = true; pharmacyService.dashboard().then((response) => { if (active) setCurrency(response.data.data.currency); }).catch(() => {}); return () => { active = false; }; }, []);
  const columns = movements ? [
    { key: 'id', label: 'Movement', sort: true }, { key: 'medicine', label: 'Medicine', render: (row) => row.medicine?.name || 'Unavailable medicine' },
    { key: 'movement_type', label: 'Type', render: (row) => label(row.movement_type) }, { key: 'quantity', label: 'Quantity', sort: true }, { key: 'previous_stock', label: 'Previous' }, { key: 'resulting_stock', label: 'Resulting' },
    { key: 'user', label: 'Recorded by', render: (row) => row.user?.name }, { key: 'reason', label: 'Reason' }, { key: 'created_at', label: 'Recorded', sort: true, render: (row) => new Date(row.created_at).toLocaleString() },
  ] : [
    { key: 'id', label: 'Transaction', sort: true }, { key: 'prescription_id', label: 'Prescription', render: (row) => `#${row.prescription_id}` }, { key: 'patient_name', label: 'Patient' }, { key: 'pharmacist_name', label: 'Pharmacist' },
    { key: 'dispensing_date', label: 'Dispensed', sort: true, render: (row) => new Date(row.dispensing_date).toLocaleString() }, { key: 'dispensing_status', label: 'Status', sort: true, render: (row) => <Chip size="small" label={label(row.dispensing_status)} /> },
    { key: 'total', label: 'Medicine charges', render: (row) => `${row.total} ${currency}` }, { key: 'actions', label: 'Actions', render: (row) => <Button onClick={() => setRecord(row)}>View transaction</Button> },
  ];
  return <Stack spacing={3} sx={{ minWidth: 0 }}><Typography variant="h5" fontWeight={700}>{movements ? 'Medicine Stock Movements' : 'Dispensing History'}</Typography><Alert severity="info">{movements ? 'Every stock addition, deduction, and dispensing is recorded with the responsible user and resulting balance.' : 'Dispensing transactions are preserved as read-only history. Charges reflect the medicine quantities recorded in each transaction.'}</Alert>{state.error && <Alert severity="error" action={<Button onClick={state.load}>Retry</Button>}>{state.error}</Alert>}<PharmacyFilters state={state} movements={movements} statuses={movements ? [] : ['completed','partially_completed']} /><PharmacyTable state={state} columns={columns} title={movements ? 'Stock movements' : 'Dispensing transactions'} />
    {record && <Dialog open fullWidth maxWidth="sm" onClose={() => setRecord(null)}><DialogTitle>Dispensation #{record.id}</DialogTitle><DialogContent dividers><Stack spacing={2}><Typography>{record.patient_name} · {record.patient_number}</Typography><Typography>Prescription #{record.prescription_id} · {label(record.dispensing_status)}</Typography><Typography>Pharmacist: {record.pharmacist_name}</Typography>{record.items.map((item) => <Typography key={item.id}>{item.medicine_name}: {item.quantity_dispensed} × {item.unit_price} = {item.subtotal} {currency}</Typography>)}<Typography fontWeight={700}>Total: {record.total} {currency}</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{record.notes || 'No notes recorded.'}</Typography></Stack></DialogContent><DialogActions><Button onClick={() => setRecord(null)}>Close</Button></DialogActions></Dialog>}
  </Stack>;
}

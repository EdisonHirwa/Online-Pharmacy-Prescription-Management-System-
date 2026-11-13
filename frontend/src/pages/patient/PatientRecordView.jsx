import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { patientLabel } from '../../services/patientService';
const Field = ({ label, value }) => <Box><Typography variant="caption" color="text.secondary">{label}</Typography><Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value ?? 'Not recorded'}</Typography></Box>;
export default function PatientRecordView({ resource, record, download, currency = 'RWF' }) {
  if (!record) return null;
  const money = (value) => `${Number(value).toLocaleString()} ${currency}`;
  return <Stack spacing={2}>
    {record.doctor && <><Typography variant="h6">{record.doctor.name}</Typography><Typography color="text.secondary">{record.doctor.department?.name} · {record.doctor.specialization?.name}</Typography></>}
    {record.status && <Chip variant="outlined" label={patientLabel(record.status)} sx={{ alignSelf: 'flex-start' }} />}
    {resource === 'appointments' && <><Field label="Reference" value={record.appointment_number} /><Field label="Appointment date" value={record.appointment_date?.slice(0, 10)} /><Field label="Time" value={record.appointment_time?.slice(0, 5)} /><Field label="Reason" value={record.reason} />{record.cancellation_reason && <Field label="Cancellation / rejection details" value={record.cancellation_reason} />}</>}
    {resource === 'consultations' && <><Field label="Recorded" value={record.created_at ? new Date(record.created_at).toLocaleString() : null} /><Field label="Diagnosis" value={record.diagnosis} /><Field label="Consultation notes" value={record.consultation_notes} /><Field label="Treatment recommendations" value={record.treatment_recommendations} /><Field label="Follow-up date" value={record.follow_up_date?.slice(0, 10)} /></>}
    {resource === 'prescriptions' && <>
      <Field label="Issued" value={record.issue_date} />{record.items.map((item) => <Paper key={item.id} variant="outlined" sx={{ p: 2 }}><Stack spacing={1}><Typography fontWeight={700}>{item.medicine_name}</Typography><Field label="Dosage" value={item.dosage} /><Field label="Frequency" value={item.frequency} /><Field label="Duration" value={item.duration} /><Field label="Prescribed quantity" value={`${item.quantity} ${item.unit || ''}`} /></Stack></Paper>)}
      <Field label="Additional instructions" value={record.prescription_instructions} /><Button onClick={() => download(`prescriptions/${record.id}/download`, `prescription-${record.id}.pdf`)}>Download prescription PDF</Button>
    </>}
    {resource === 'lab-tests' && <>
      <Typography variant="h6">{record.test_type?.name}</Typography><Field label="Requested" value={record.request_date} />
      {record.status === 'completed' ? <><Field label="Result summary" value={record.result_summary} />{record.reports.length === 0 && <Typography color="text.secondary">No completed report file has been uploaded.</Typography>}{record.reports.map((report) => <Button key={report.id} onClick={() => download(`lab-reports/${report.id}/download`, `laboratory-report-${report.id}.${report.file_type?.includes('pdf') ? 'pdf' : report.file_type?.includes('png') ? 'png' : 'jpg'}`)}>Download report #{report.id}</Button>)}</> : <Typography color="text.secondary">Results will be available once the laboratory completes this investigation.</Typography>}
    </>}
    {resource === 'invoices' && <>
      <Typography variant="h6">{record.invoice_number}</Typography><Field label="Issue date" value={record.issue_date?.slice(0, 10)} />
      {record.items.map((item) => <Paper key={item.id} variant="outlined" sx={{ p: 2 }}><Typography fontWeight={700}>{item.service_description}</Typography><Typography>{item.quantity} × {money(item.unit_price)} = {money(item.subtotal)}</Typography></Paper>)}
      <Field label="Total charges" value={money(record.total_amount)} /><Field label="Amount paid" value={money(record.amount_paid)} /><Field label="Outstanding balance" value={money(record.outstanding_balance)} />
      <Typography variant="h6">Recorded payments</Typography>{record.payments.length ? record.payments.map((payment) => <Paper variant="outlined" key={payment.id} sx={{ p: 2 }}><Typography>{money(payment.amount)} · {patientLabel(payment.payment_method)} · {patientLabel(payment.transaction_status)}</Typography><Typography variant="body2">{payment.payment_reference} · {payment.payment_date}</Typography></Paper>) : <Typography color="text.secondary">No payments have been recorded for this invoice.</Typography>}
      <Button onClick={() => download(`invoices/${record.id}/download`, `${record.invoice_number}.pdf`)}>Download invoice PDF</Button>
    </>}
    {resource === 'payments' && <><Field label="Payment reference" value={record.payment_reference} /><Field label="Invoice" value={record.invoice_number} /><Field label="Amount" value={money(record.amount)} /><Field label="Method" value={patientLabel(record.payment_method)} /><Field label="Status" value={patientLabel(record.transaction_status)} /><Field label="Payment date" value={record.payment_date} /></>}
    {resource === 'admissions' && <><Field label="Ward" value={record.ward} /><Field label="Bed" value={record.bed_number} /><Field label="Admitted" value={record.admission_date} /><Field label="Discharged" value={record.discharge_date} /><Field label="Admission notes" value={record.admission_notes} /><Field label="Discharge summary" value={record.discharge_summary} /></>}
  </Stack>;
}

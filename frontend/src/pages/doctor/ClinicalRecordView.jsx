import { Box, Button, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
const Field = ({ name, value }) => <Box><Typography variant="caption" color="text.secondary">{name}</Typography><Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value || 'Not recorded'}</Typography></Box>;
const Section = ({ title, children }) => <Stack spacing={1.5}><Typography variant="h6">{title}</Typography>{children}</Stack>;
export default function ClinicalRecordView({ resource, record, download, prescribe, requestLab, canWrite = false }) {
  if (!record) return null;
  const consultation = (item) => <Paper variant="outlined" key={item.id} sx={{ p: 2 }}><Stack spacing={1.5}>
    <Typography fontWeight={700}>Consultation #{item.id} · {item.doctor?.user?.name || ''} · {item.created_at?.slice(0, 10)}</Typography>
    <Field name="Diagnosis" value={item.diagnosis} /><Field name="Consultation notes" value={item.consultation_notes} /><Field name="Treatment recommendations" value={item.treatment_recommendations} /><Field name="Follow-up" value={item.follow_up_date?.slice(0, 10)} />
  </Stack></Paper>;
  const prescription = (item) => <Paper key={item.id} variant="outlined" sx={{ p: 2 }}><Stack spacing={1.5}>
    <Typography fontWeight={700}>Prescription #{item.id} · {item.status}</Typography>
    {(item.items || []).map((medicine) => <Box key={medicine.id}><Typography fontWeight={600}>{medicine.medicine?.name || 'Medicine unavailable'}</Typography><Typography variant="body2">{medicine.dosage} · {medicine.frequency} · {medicine.duration} · Quantity: {medicine.quantity}</Typography></Box>)}
    <Field name="Instructions" value={item.prescription_instructions} />
  </Stack></Paper>;
  const laboratory = (item) => <Paper key={item.id} variant="outlined" sx={{ p: 2 }}><Stack spacing={1.5}>
    <Typography fontWeight={700}>{item.test_type?.name || 'Laboratory investigation'} · {item.status}</Typography>
    <Field name="Requested" value={item.request_date} /><Field name="Results" value={item.result_summary} />
    {(item.reports || []).filter((report) => report.report_status === 'completed' && item.status === 'completed').map((report) => <Button key={report.id} onClick={() => download(`lab-reports/${report.id}/download`, `lab-report-${report.id}.${report.file_type?.includes('pdf') ? 'pdf' : report.file_type?.includes('png') ? 'png' : 'jpg'}`)}>Download report #{report.id}</Button>)}
  </Stack></Paper>;
  return <Stack spacing={3}>
    {resource === 'patients' ? <>
      <Section title={record.user?.name || 'Patient'}><Typography color="text.secondary">{record.patient_number}</Typography><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        <Field name="Date of birth" value={record.date_of_birth?.slice(0, 10)} /><Field name="Gender" value={record.gender} /><Field name="Blood group" value={record.blood_group} /><Field name="Phone" value={record.user?.phone_number} /><Field name="Address" value={record.address} /><Field name="Emergency contact" value={`${record.emergency_contact_name} · ${record.emergency_contact_phone}`} />
      </Box></Section>
      <Section title="Allergies">{record.allergies?.length ? record.allergies.map((item) => <Paper key={item.id} variant="outlined" sx={{ p: 2 }}><Stack spacing={1}><Box><Chip size="small" color="warning" variant="outlined" label={item.severity} /> <strong>{item.allergy_name}</strong></Box><Typography>{item.reaction_description || 'No reaction details recorded.'}</Typography></Stack></Paper>) : <Typography color="text.secondary">No allergies recorded.</Typography>}</Section>
      <Section title="Medical history">{record.medical_histories?.length ? record.medical_histories.map((item) => <Paper variant="outlined" key={item.id} sx={{ p: 2 }}><Stack spacing={1}><Typography fontWeight={700}>{item.condition} · {item.recorded_date}</Typography><Field name="Diagnosis details" value={item.diagnosis_details} /><Field name="Treatment history" value={item.treatment_history} /></Stack></Paper>) : <Typography color="text.secondary">No medical history recorded.</Typography>}</Section>
      <Section title="Consultation history">{record.consultations?.length ? record.consultations.map(consultation) : <Typography color="text.secondary">No consultation history.</Typography>}</Section>
      <Section title="Prescriptions">{record.prescriptions?.length ? record.prescriptions.map(prescription) : <Typography color="text.secondary">No prescriptions recorded.</Typography>}</Section>
      <Section title="Completed laboratory results">{record.lab_tests?.length ? record.lab_tests.map(laboratory) : <Typography color="text.secondary">No completed laboratory results.</Typography>}</Section>
      <Section title="Your appointment history">{record.appointments?.map((item) => <Paper variant="outlined" sx={{ p: 2 }} key={item.id}><Typography>{item.appointment_number} · {item.appointment_date?.slice(0, 10)} · {item.appointment_time} · {item.status}</Typography><Typography>{item.reason}</Typography></Paper>)}</Section>
    </> : resource === 'consultations' ? <>
      <Typography variant="h6">{record.patient?.user?.name}</Typography>{consultation(record)}
      {canWrite && <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}><Button variant="contained" onClick={() => prescribe(record)}>Issue prescription</Button><Button variant="outlined" onClick={() => requestLab(record)}>Request laboratory tests</Button></Stack>}
      <Section title="Prescriptions">{record.prescriptions?.length ? record.prescriptions.map(prescription) : <Typography color="text.secondary">No prescriptions issued for this consultation.</Typography>}</Section>
      <Section title="Laboratory requests">{record.lab_tests?.length ? record.lab_tests.map(laboratory) : <Typography color="text.secondary">No laboratory investigations requested.</Typography>}</Section>
    </> : resource === 'prescriptions' ? <><Field name="Patient" value={record.patient?.user?.name} />{prescription(record)}<Button onClick={() => download(`prescriptions/${record.id}/download`, `prescription-${record.id}.pdf`)}>Download prescription PDF</Button></> : resource === 'lab-requests' ? <><Field name="Patient" value={record.patient?.user?.name} />{laboratory(record)}</> : resource === 'appointments' ? <>
      <Field name="Patient" value={record.patient?.user?.name} /><Field name="Appointment" value={record.appointment_number} /><Field name="Date and time" value={`${record.appointment_date?.slice(0, 10)} · ${record.appointment_time}`} /><Field name="Reason" value={record.reason} /><Field name="Status" value={record.status} /><Field name="Cancellation / rejection details" value={record.cancellation_reason} />
    </> : <><Field name="Day" value={record.day_of_week} /><Field name="Working hours" value={`${record.start_time} – ${record.end_time}`} /><Field name="Slot duration" value={`${record.slot_duration} minutes`} /><Field name="Availability" value={record.is_available ? 'Available' : 'Unavailable'} /></>}
    <Divider />
  </Stack>;
}

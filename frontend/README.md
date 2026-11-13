# MediCare Hospital — React frontend

React 19, Material UI, Recharts, React Router, React Hook Form, Yup, Axios, and Vite.

## Run

```bash
npm ci
npm run dev
```

The Laravel API must run at `http://localhost:8000/api`, or set `VITE_API_BASE_URL` in `.env`. API requests always reach Laravel; the previous mock adapter and demo login shortcuts have been removed. See `../backend/README.md` for database setup and initial administrator creation.

## Admin portal

Admin has database-backed pages for users/access, organization/services, patient profiles, doctors/schedules, appointments, laboratory monitoring, medicine inventory, wards/beds/admissions, invoices/payments, reports, audit/security, settings, and profile management.

Tables provide server-side search, filters, sorting, pagination, detail views, and authorized CSV/PDF exports. Workflow dialogs validate inputs and confirm actions. Server validation errors appear beside fields. Sessions are validated on page load, focus, and every minute. Unauthorized sessions redirect to login. Dashboard and notification data refresh every 30 seconds; this uses polling rather than WebSockets.

Create a user with the correct role before linking its patient or doctor profile. Inventory begins at zero; use Adjust stock to record additions and deductions. Private laboratory reports download through the protected API.

The teal, navy, and coral design and light/dark toggle are retained. Laboratory Technician and Pharmacist interfaces remain for subsequent role-by-role backend integration; the completed Admin routes use the shared AdminWorkspace instead of the earlier mock pages.

## Doctor portal

Sign in with a Doctor user linked to its professional profile by Admin. Doctor routes now have dedicated pages for dashboard statistics, weekly schedules, assigned appointments, patient history, consultations, prescriptions, laboratory requests/results, and profiles.

Start with My Appointments: review history, confirm pending requests, then consult a confirmed appointment. Finalization requires explicit confirmation and opens the completed consultation with actions to issue a prescription or request tests. Prescriptions support multiple medicines and PDF downloads; laboratory reports download from protected endpoints. Changes persist through Laravel. Forms show validation errors and the tables provide server-side search, filters, sorting, and pagination. Dashboard and tables refresh every 30 seconds.

Doctor account activation, professional assignments, license, consultation fee, and professional status are managed by Admin. Doctors can change their own contact information, password, biography, room number, and permitted schedules. Clinical write controls reflect backend permissions and professional status; Laravel independently enforces authorization.

## Patient portal

Patients may register and sign in directly, or use an account and Patient profile created by Admin. The dedicated Patient portal includes a live dashboard, doctor directory, slot-based appointment booking, appointment history, medical records, prescriptions, laboratory results, invoices/payment history, and profile management.

Book Appointment filters by department, specialization, and doctor. Select a consultation date and a server-provided slot, then review and confirm the request. New and rescheduled appointments await doctor confirmation. Pending/confirmed appointments can be changed only before they start; cancellation asks for a reason and notifies the doctor.

Medical, laboratory, and financial pages are read-only and restricted to the signed-in patient. Completed laboratory files and prescription/invoice PDFs download through protected Laravel endpoints. Payments are recorded by authorized staff. Patient contact and emergency details can be edited under My Profile; clinical history is maintained by the care team.

Dashboard and record tables refresh every 30 seconds. Tables support filters, search, sorting, and pagination. Registration keeps the chosen birth date as a date string rather than converting it through UTC.

## Build

```bash
npm run build
```

Build output is written to `dist/`. Host with SPA route fallback and configure the API origin when deploying separately.


## Laboratory Technician portal

Sign in with an active `lab_tech` account created by Admin. The portal includes a database-backed dashboard, Investigation Queue, My Work, Reports & Uploads, Completed History, and My Profile. Counts and lists refresh every 30 seconds; lists support search, filters, sorting, and pagination.

Claim a request, open My Work, start processing, and enter findings. Save drafts and optionally attach PDF/JPEG/PNG reports up to 2 MB each, with preview, upload progress, and protected downloads. Review & finalize publishes results to the doctor and patient after confirmation. Completed findings and files are read-only. A custom account permission list must include `manage_laboratory` for editing; otherwise the portal is read-only.


## Pharmacist portal

Sign in with an active `pharmacist` account created by Admin. Dedicated pages include a live dashboard, Prescription Queue, Prescriptions & Dispensing, Medicine Inventory, Stock Movements, Dispensing History, and My Profile. Dashboard and lists refresh every 30 seconds, with server-side search, filtering, sorting, and pagination.

Open a prescription, review its instructions and recorded allergies, enter the quantities to supply, acknowledge review, and confirm dispensing. Partial dispensing retains the remaining allowance in the queue. Stock and patient charges update together, while submission keys prevent duplicate processing on retries. Read-only history shows quantities, prices, responsible pharmacists, and notes.

Add or edit medicine details, monitor low stock and expiry, and record signed stock adjustments with reasons and confirmation. New medicines begin with zero stock. Expired and inactive medicines are blocked from dispensing. Custom permissions must include `manage_pharmacy` for editing.

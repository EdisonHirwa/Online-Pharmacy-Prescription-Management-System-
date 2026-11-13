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

The teal, navy, and coral design and light/dark toggle are retained. Patient, Laboratory Technician, and Pharmacist interfaces remain for subsequent role-by-role backend integration; the completed Admin routes use the shared AdminWorkspace instead of the earlier mock pages.

## Doctor portal

Sign in with a Doctor user linked to its professional profile by Admin. Doctor routes now have dedicated pages for dashboard statistics, weekly schedules, assigned appointments, patient history, consultations, prescriptions, laboratory requests/results, and profiles.

Start with My Appointments: review history, confirm pending requests, then consult a confirmed appointment. Finalization requires explicit confirmation and opens the completed consultation with actions to issue a prescription or request tests. Prescriptions support multiple medicines and PDF downloads; laboratory reports download from protected endpoints. Changes persist through Laravel. Forms show validation errors and the tables provide server-side search, filters, sorting, and pagination. Dashboard and tables refresh every 30 seconds.

Doctor account activation, professional assignments, license, consultation fee, and professional status are managed by Admin. Doctors can change their own contact information, password, biography, room number, and permitted schedules. Clinical write controls reflect backend permissions and professional status; Laravel independently enforces authorization.

## Build

```bash
npm run build
```

Build output is written to `dist/`. Host with SPA route fallback and configure the API origin when deploying separately.

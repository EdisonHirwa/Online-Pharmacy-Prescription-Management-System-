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

The teal, navy, and coral design and light/dark toggle are retained. Doctor, Patient, Laboratory Technician, and Pharmacist interfaces remain for subsequent role-by-role backend integration; the completed Admin routes use the shared AdminWorkspace instead of the earlier mock pages.

## Build

```bash
npm run build
```

Build output is written to `dist/`. Host with SPA route fallback and configure the API origin when deploying separately.

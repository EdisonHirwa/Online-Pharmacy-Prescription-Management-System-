# MediCare Hospital — Laravel API

Laravel 13, Sanctum, PHP 8.3+, and MySQL. The Admin and Doctor portals use real database records. Patient, laboratory processing, and pharmacy dispensing portals remain for subsequent phases.

## Installation

1. Run `composer install` inside `backend`.
2. Copy `.env.example` to `.env` for a new installation. Configure MySQL credentials and create the empty `online_pharmacy_db` database. Preserve an existing `.env`.
3. Run `php artisan key:generate` on a new installation.
4. Run `php artisan migrate` and `php artisan db:seed`. These add missing schema and initial hospital configuration without resetting existing records. A compatibility migration repairs older users tables whose original migration was edited after execution.
5. Create the first administrator:

   ```bash
   php artisan admin:create admin@example.com --phone=+250788123456 --name="Hospital Administrator"
   ```

   The command prints a generated password once and refuses to overwrite an existing account. Change the password through My Profile after signing in.
6. Start the API with `php artisan serve --host=127.0.0.1 --port=8000`.
7. Inside `frontend`, run `npm ci` and `npm run dev`. The frontend's `VITE_API_BASE_URL` defaults to `http://localhost:8000/api`.

Set `FRONTEND_URL=http://localhost:5173` for password recovery links. Configure allowed frontend origins in `config/cors.php` if changing ports. The default development mailer writes recovery messages to `storage/logs/laravel.log`; configure SMTP in `.env` for email delivery. Keep recovery tokens private.

## Admin functionality

- Password-verified authentication, eight-hour Sanctum tokens, logout revocation, account status checks, and failed-login lockouts.
- User CRUD, five roles, permission assignments, account activation/deactivation, and session revocation after administrative account changes. The backend Gate protects all management endpoints. Administrators have full management access; other roles cannot call Admin endpoints.
- Department, specialization, doctor, consultation schedule, service, laboratory test type, medicine, ward, bed, and hospital settings management.
- Patient profiles with appointment, consultation, allergy, and medical history views. Create the patient's or doctor's user account first, then link its profile.
- Appointment booking, confirmation/rejection/cancellation, and rescheduling, with schedule and slot validation.
- Transactional admissions/discharges, invoice creation with multiple charges, payment recording, duplicate payment reference protection, and stock adjustments with movement history.
- Database statistics, operational reports, CSV/PDF exports, login attempts, audit activity, and authorized laboratory file downloads.
- Laravel events/listeners and Notifications persist workflow notifications for the affected patient. Notifications and dashboard figures are polled every 30 seconds in the frontend.

Admin can enter invoice charges. Doctor consultation completion and laboratory requests now create linked charges automatically. Pharmacy dispensing charges remain part of the upcoming pharmacy workflow. Payments record cash, card, and mobile money transactions; no payment gateway is connected. Historical financial records cannot be deleted. Records with clinical dependencies are retained. Occupied beds cannot be edited until discharge.

## Doctor functionality

Create an active user with role `doctor` through Admin → Users & Access, then link that user to a doctor profile under Doctors & Schedules. Sign in using that account's email and password. A doctor account without a linked profile receives a configuration error rather than access to other doctors' data.

- Database-backed dashboard, own schedules, assigned appointments, patient history, consultation records, prescriptions, laboratory requests/results, and professional/account profiles.
- Laravel policies restrict records to their owning doctor. Patient history requires an assigned pending/confirmed/completed appointment or a previous consultation with that doctor. Completed laboratory reports for patients in that care relationship are downloaded through authorized endpoints.
- Confirm/reject/cancel assigned appointments. Finalize confirmed appointments dated today or earlier with diagnosis, notes, treatment recommendations, and an optional follow-up date. Finalized consultations are preserved, not overwritten.
- Issue multi-medicine prescriptions using server-managed prices. Update or cancel only before dispensing activity; prescribing does not deduct inventory. Pharmacy users are notified.
- Request multiple active laboratory test types linked to a consultation. Active duplicate requests are rejected. Cancel only unassigned requests; paid invoice charges must first be resolved by administration. Lab staff and the patient are notified.
- Consultation and laboratory charges are added transactionally to an outstanding appointment invoice. If an earlier invoice is paid, new charges use a separate invoice. Zero-fee services create no charge. Cancellation retains a zero-valued invoice line rather than deleting financial history.
- Add relevant allergy and medical history entries for authorized patients. Access and clinical mutations are audited without copying clinical notes into audit descriptions.
- Doctors may update their biography and room number. Administrative assignments, license, fees, and professional status remain controlled by Admin.

Doctor role defaults allow schedule management and clinical work when no custom permission list is configured (`null` or `[]`). A nonempty custom list limits writes to the selected `manage_schedules` / `manage_consultations` permissions. Professional status must be `active` for clinical writes; schedule management remains available while on leave.

Doctor routes are under `/api/doctor`: `dashboard`, `profile`, `options`, paginated `schedules`, `appointments`, `patients`, `consultations`, `prescriptions`, and `lab-requests`. Schedule CRUD uses its resource endpoints. `POST consultations` finalizes an appointment; `POST/PUT prescriptions` issues/updates prescriptions; `POST lab-requests` accepts a consultation and `test_type_ids[]`. Cancellation endpoints use `POST prescriptions/{id}/cancel` and `POST lab-requests/{id}/cancel`. `GET lab-reports/{id}/download` and `GET prescriptions/{id}/download` serve authorized files. Patient allergy/history entries use `POST patients/{id}/allergies` and `POST patients/{id}/medical-history`.

## API

Requests and responses use JSON. Send `Authorization: Bearer <token>` to protected endpoints.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/login` | Email and password; returns user and token |
| `GET /api/auth/me` | Validate current session |
| `POST /api/auth/logout` | Revoke current token |
| `PUT /api/auth/profile` | Update own details; password changes require current password and confirmation |
| `POST /api/auth/forgot-password` | Request recovery instructions |
| `POST /api/auth/reset-password` | Reset using email, token, and confirmed password |
| `GET /api/dashboard/stats` | Admin statistics |
| `GET /api/admin/catalog` | Allowed resources and validated form fields |
| `GET /api/admin/options` | Reference choices for Admin forms |
| `GET/POST /api/admin/{resource}` | Paginated listing / creation |
| `GET/PUT/DELETE /api/admin/{resource}/{id}` | Detail / update / guarded deletion |
| `POST /api/admin/appointments/{id}/reschedule` | Validate and change an existing appointment slot |
| `POST /api/admin/appointments/{id}/status` | Confirm, cancel, or reject |
| `POST /api/admin/admissions` | Admit patient into an available bed |
| `POST /api/admin/admissions/{id}/discharge` | Record discharge summary and release bed |
| `POST /api/admin/invoices` | Patient and `items[]` with description, type, quantity, and unit price |
| `POST /api/admin/invoices/{id}/payments` | Amount, method, and unique payment reference |
| `POST /api/admin/invoices/{id}/cancel` | Cancel an unpaid invoice |
| `POST /api/admin/medicines/{id}/stock` | Signed quantity and reason |
| `GET /api/admin/reports/{resource}?format=csv` | Export filtered records; also supports `pdf` |
| `GET /api/admin/analytics/{report}` | Doctor performance, laboratory charges, or received revenue |
| `GET /api/admin/lab-reports/{id}/download` | Authorized private file download |
| `GET /api/notifications` | Own notifications |
| `POST /api/notifications/read` | Mark own notifications read |

Listing filters include `search`, `page`, `per_page` (up to 100), `sort`, `direction`, `start_date`, `end_date`, and relevant status, role, patient, doctor, department, ward, or payment method fields. Medicine filters also include `low_stock=1` and `expiring=1`. Financial and workflow records use dedicated endpoints rather than generic CRUD. Duplicate retries with the same payment reference and details return the recorded payment without changing the balance again.

## Verification

Run from `backend`:

```bash
php artisan test --compact
vendor/bin/pint --dirty --format agent
```

Tests use an isolated in-memory SQLite database and do not reset development MySQL records. The Admin feature tests cover authentication, role restrictions, CRUD and validation, protected history, schedules, appointment conflicts and rescheduling, admissions, payments, stock, reports, recovery, and notifications. Build the frontend with `npm run build` from `frontend`.

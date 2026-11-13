# Online Pharmacy

An online pharmacy and prescription management system built with a Laravel API and a React frontend. It connects patient registration, appointments, consultations, prescriptions, laboratory investigations, medicine dispensing, inventory, and billing through five user portals.

## Technology

- **Backend:** Laravel 13, PHP, Laravel Sanctum, MySQL.
- **Frontend:** React 19, Vite 8, Material UI, React Router, Axios, React Hook Form, Yup, and Recharts.
- **Testing:** PHPUnit feature tests with an isolated in-memory SQLite database.

## User portals

| Role | Portal | Main functionality |
| --- | --- | --- |
| Administrator | `/admin/dashboard` | Users and permissions, departments, doctors, patients, appointments, inventory, admissions, billing, payments, reports, settings, and audits. |
| Doctor | `/doctor/dashboard` | Schedules, assigned appointments, consultations, authorized patient histories, prescriptions, and laboratory requests/results. |
| Patient | `/patient/dashboard` | Appointment booking, medical records, prescriptions, completed laboratory reports, invoices, payment history, and profile management. |
| Laboratory Technician | `/lab/dashboard` | Claim requests, process investigations, save draft findings, upload reports, finalize results, and review completed history. |
| Pharmacist | `/pharmacy/dashboard` | Review prescriptions and allergies, dispense medicines partially or fully, manage inventory, and review dispensing and stock history. |

Public registration creates a Patient account and its linked profile. Staff accounts are created by an administrator. All users sign in through `/login` and are directed to their portal.

## Project structure

```text
backend/                  Laravel API, migrations, seeders, and tests
  app/Http/               Controllers, requests, middleware, and resources
  app/Models/             Database models and relationships
  app/Policies/           Record authorization
  app/Services/           Transactional workflow logic
  database/               Schema migrations, factories, and seeders
  routes/api.php          API routes
  tests/Feature/          Backend feature tests
frontend/                 React application
  src/pages/              Authentication and role-specific screens
  src/components/         Shared interface components
  src/services/           API clients
  src/layouts/            Portal layout and navigation
```

## Requirements

- PHP 8.3 or later with Laravel's required extensions and a MySQL PDO driver.
- Composer 2.
- Node.js 22.12 or later and npm.
- A running MySQL server.
- SQLite PDO and GD extensions to run the backend tests, including image-upload tests.

## Local installation

Run these commands from the project root unless a step changes directories. For an existing installation, keep its `.env`, application key, and database; use the update instructions below.

### 1. Configure the backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Create an empty MySQL database:

```sql
CREATE DATABASE online_pharmacy_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Set your database credentials in `backend/.env`:

```dotenv
APP_NAME="Online Pharmacy"
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
APP_TIMEZONE=Africa/Kigali
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=online_pharmacy_db
DB_USERNAME=your_database_user
DB_PASSWORD=your_database_password
```

Apply migrations and seed the initial departments, specializations, services, laboratory test type, wards, and system settings:

```bash
php artisan migrate
php artisan db:seed
```

### 2. Create the first administrator

From `backend`:

```bash
php artisan admin:create admin@example.com --phone=+250788123456 --name="Online Pharmacy Administrator"
```

Use your own email and phone number. The command prints a generated password once and refuses to overwrite an existing account. Save the password and change it under **My Profile** after signing in. There are no shared default login credentials.

### 3. Start the API

From `backend`, keep this terminal running:

```bash
php artisan serve --host=127.0.0.1 --port=8000
```

### 4. Start the frontend

Open another terminal at the project root:

```bash
cd frontend
npm ci
cp .env.example .env
npm run dev
```

The frontend environment should point to the API:

```dotenv
VITE_API_BASE_URL=http://localhost:8000/api
```

Open **http://localhost:5173**. If Vite selects another port, update `FRONTEND_URL` in `backend/.env` to match the browser origin. API requests use the Laravel backend.

## Using the system

1. Sign in as Admin and review organization settings, departments, specializations, services, and prices.
2. Create active staff users under **Users & Access**. Link each Doctor user to a professional profile, then configure consultation schedules. Laboratory Technicians and Pharmacists do not require separate professional profiles.
3. Create medicines and record initial stock through **Adjust stock**. New catalog entries start at zero stock.
4. Register a patient through `/register`, or create a Patient user and link a patient profile through Admin. Registration collects account details, personal information, and an emergency contact; blood group is optional.
5. Book an appointment. The doctor confirms it, records the consultation, and issues prescriptions or requests laboratory investigations as needed.
6. Laboratory staff claim and process requested investigations. Finalization releases findings and completed files to the authorized doctor and patient.
7. Pharmacy staff review prescriptions and recorded allergies, enter quantities, and confirm dispensing. Partial dispensing leaves the remaining allowance available for a later transaction.
8. Authorized administrative staff record payments. Patients view their invoices and payment history through their portal.

Empty/default permission lists use role defaults. Custom permission lists restrict permitted operations; clinical work, laboratory management, and pharmacy management use their corresponding permissions. Backend role and record authorization still apply.

## Workflow rules

- Dispensing checks both remaining prescribed quantities and current stock. Expired, inactive, and unavailable medicines cannot be dispensed.
- Dispensing records, stock deductions, stock movements, prescription status, and medicine charges update in one database transaction. Submission keys protect against duplicate dispensing retries.
- Consultation completion, laboratory requests, and actual dispensed medicine quantities create linked invoice charges. Prescribing alone does not deduct stock or charge for dispensing.
- Laboratory reports accept PDF, JPEG, and PNG files up to **2 MB each**. Draft findings and files remain private until finalization. Completed investigations are read-only.
- Reports are stored privately and downloaded through authenticated, authorized endpoints.
- Important clinical, financial, dispensing, and stock history is preserved. Workflow notifications and audit records support accountability.
- Dashboards, notifications, and relevant lists refresh through polling, generally every **30 seconds**.

## Updating an existing installation

Keep the existing environment and application key. After updating the source, run:

```bash
cd backend
composer install
php artisan migrate
php artisan config:clear
cd ../frontend
npm ci
npm run build
```

The branding migration updates the stored system name to **Online Pharmacy**. Do not use `migrate:fresh` on a database whose records you need to retain.

## Verification

From `backend`:

```bash
php artisan test --compact
vendor/bin/pint --dirty --format agent
```

Tests use the SQLite database configured in `backend/phpunit.xml`, rather than the development MySQL database.

From `frontend`:

```bash
npm run build
```

The frontend production output is generated in `frontend/dist`. A deployed frontend needs SPA route fallback and an API URL configured at build time.

## Configuration notes

- Password recovery uses `FRONTEND_URL` for reset links. The default log mailer writes messages to `backend/storage/logs/laravel.log`; configure SMTP for email delivery.
- Payments record cash, card, and mobile money transactions. An external payment gateway is not connected.
- Inventory currently stores one expiry date per medicine catalog entry.
- Pharmacy allergy review requires professional acknowledgement; the application does not infer drug allergies from medicine names.

For detailed role behavior and API documentation, see the [backend README](backend/README.md) and [frontend README](frontend/README.md).

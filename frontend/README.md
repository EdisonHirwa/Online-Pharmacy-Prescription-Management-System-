# MediCare HMS – Multi-Specialty Hospital Management System Frontend
**Course:** ITLAW701 – Advanced Web Technologies | RP Karongi College  
**Architect:** Senior React.js Frontend Engineer  
**Technology Stack:** React.js (Functional Components + Hooks), Vite, Material UI (MUI v5+), Recharts, React Router v6, Axios, React Hook Form, Yup

---

## 1. Design System: Strict 3-Color Brand Palette
In strict adherence to the project specification, the entire application uses **only three brand colors** across all light and dark modes, charts, chips, and components:

1. **PRIMARY – Medical Teal (`#0E7C86`):**
   - Main action buttons, active navigation states, links, focus rings, primary Recharts series, and verified status badges.
2. **SECONDARY – Deep Navy (`#12263F`):**
   - App bar, sidebar, typography headings, dark mode surfaces, and table headers.
3. **ACCENT – Coral (`#F4795B`):**
   - Alerts, danger/destructive actions, low-stock warnings, unread notification badges, and outstanding balance highlights.

> **Design Rules Enforced:**
> - Zero foreign hues: No green, yellow, purple, blue, or orange.
> - MUI feedback mappings: `success` is mapped to Medical Teal tints; `error` and `warning` are mapped to Coral tints; `info` is mapped to Navy/Teal tints.
> - Table headers use solid Deep Navy (`#12263F`) with white text, exactly matching the reference layout.
> - Semantic status chips show meaning through label text, icons, and filled/outlined styles without introducing new colors.

---

## 2. Roles, Dashboards & Access Control

The frontend enforces role-based navigation and protected routing for five distinct hospital user roles:

| Role | Default Route | Key Modules & Capabilities |
| :--- | :--- | :--- |
| **System Administrator** | `/admin/dashboard` | KPI analytics, Revenue trends, Patient EHR, Doctors & Schedules, Wards & Beds, Billing & Payments, Reports, Audit Logs, Suspicious Login Attempts. |
| **Doctor** | `/doctor/dashboard` | Patient consultation queue, clinical diagnosis recording, treatment history, e-prescriptions, and laboratory order requests. |
| **Patient** | `/patient/dashboard` | Self-service appointment booking (Department → Specialization → Doctor → Slot), medical records, prescription downloads, and invoice payments. |
| **Lab Technician** | `/lab/dashboard` | Diagnostic investigation intake, test result entry, report upload (PDF/JPEG/PNG max 2MB), and turnaround time tracking. |
| **Pharmacist** | `/pharmacy/dashboard` | e-Prescription queue, medication dispensing with stock limit checks, inventory stock levels, low-stock reorder warnings. |

---

## 3. High-Fidelity Mock API Layer
When the Laravel backend is not actively running, the frontend automatically serves a high-fidelity mock API layer configured via `.env` (`VITE_USE_MOCK=true`).
- **Sanctum Authentication:** Bearer token management, 401 session expiration handling, and 422 validation mapping.
- **Quick Demo Login:** One-click role selector chips on the Login screen allowing testing of any of the 5 roles instantly without typing credentials.

---

## 4. Installation & Getting Started

### Prerequisites
- Node.js 18.x or 20.x+
- npm 9.x or later

### Environment Setup
Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```
Contents of `.env`:
```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_USE_MOCK=true
```

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### Production Build
```bash
npm run build
```
Generates production-optimized static assets in the `dist/` directory.

---

## 5. Requirement Verification Summary

1. **3-Color Design Compliance:**
   - Palette configured in [`src/theme/palette.js`](file:///home/edison/Documents/Year3/OOP using PHP/Online-Pharmacy-Prescription-Management-System-/frontend/src/theme/palette.js).
   - Light and Dark modes with persistent local storage and system preference fallback in [`src/contexts/ThemeContext.jsx`](file:///home/edison/Documents/Year3/OOP using PHP/Online-Pharmacy-Prescription-Management-System-/frontend/src/contexts/ThemeContext.jsx).
2. **Dashboard UI Reference Matching:**
   - Admin Dashboard (`/admin/dashboard`) precisely replicates the provided UI screenshot: KPI cards (including the inverted Deep Navy card for outstanding invoices), Revenue Trend area chart, Appointments by Status bar chart, and Recent Appointments table with Deep Navy header.
3. **Form Validation & UX Safety:**
   - React Hook Form + Yup client-side validation for required fields, future DOB prevention, password complexity, and phone regex.
   - Dual error display: client validation feedback and server-side 422 error mappings.
   - Confirmation dialogs before destructive operations (discharge patient, cancel appointment, dispense medicine).
4. **Authorized Report Downloads:**
   - Lab reports and medical records use secured blob responses; raw server storage paths are never exposed.

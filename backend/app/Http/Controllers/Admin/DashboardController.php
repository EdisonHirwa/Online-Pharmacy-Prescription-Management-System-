<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Admission;
use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\HospitalBed;
use App\Models\Invoice;
use App\Models\LabTest;
use App\Models\LoginAttempt;
use App\Models\Medicine;
use App\Models\Patient;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $revenue = [];
        $registrations = [];
        for ($i = 5; $i >= 0; $i--) {
            $start = now()->startOfMonth()->subMonths($i);
            $end = $start->copy()->endOfMonth();
            $revenue[] = ['period' => $start->format('M Y'), 'actual' => (float) Payment::where('transaction_status', 'completed')->whereBetween('payment_date', [$start, $end])->sum('amount')];
            $registrations[] = ['period' => $start->format('M Y'), 'count' => Patient::whereBetween('created_at', [$start, $end])->count()];
        }
        $appointments = Appointment::selectRaw('status, count(*) as count')->groupBy('status')->get()->map(fn ($row): array => ['name' => ucfirst($row->status), 'count' => $row->count, 'fill' => '#0E7C86']);
        $recent = Appointment::with(['patient.user', 'doctor.user', 'doctor.department'])->latest()->limit(5)->get()->map(fn ($a): array => ['id' => $a->id, 'appointment_number' => $a->appointment_number, 'patient_name' => $a->patient?->user?->name ?? 'Unavailable', 'doctor_name' => $a->doctor?->user?->name ?? 'Unavailable', 'department' => $a->doctor?->department?->name ?? 'Unavailable', 'status' => $a->status]);

        return response()->json(['data' => [
            'hospital_name' => config('hospital.hospital_name', 'Hospital Overview'), 'currency' => config('hospital.currency', 'RWF'),
            'beds_by_status' => HospitalBed::selectRaw('availability_status, count(*) as count')->groupBy('availability_status')->get()->map(fn ($row) => ['name' => ucfirst($row->availability_status), 'count' => $row->count]),
            'total_patients' => Patient::count(), 'total_doctors' => Doctor::count(), 'pending_lab_tests' => LabTest::whereNotIn('status', ['completed', 'cancelled'])->count(),
            'outstanding_invoices' => Invoice::whereIn('status', ['unpaid', 'partially_paid'])->count(), 'outstanding_balance' => (float) Invoice::whereIn('status', ['unpaid', 'partially_paid'])->sum('outstanding_balance'),
            'revenue_trend' => $revenue, 'patient_trend' => $registrations, 'appointments_by_status' => $appointments, 'recent_appointments' => $recent,
            'low_stock_medicines' => Medicine::whereColumn('available_stock', '<=', 'reorder_level')->count(), 'expired_medicines' => Medicine::whereDate('expiry_date', '<', today())->count(),
            'occupied_beds' => HospitalBed::where('availability_status', 'occupied')->count(), 'available_beds' => HospitalBed::where('availability_status', 'available')->count(),
            'active_admissions' => Admission::where('status', 'admitted')->count(), 'failed_logins_today' => LoginAttempt::whereDate('attempt_date', today())->where('attempt_status', '!=', 'success')->count(),
        ]]);
    }
}

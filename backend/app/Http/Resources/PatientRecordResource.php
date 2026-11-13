<?php

namespace App\Http\Resources;

use App\Models\Admission;
use App\Models\Appointment;
use App\Models\Consultation;
use App\Models\Doctor;
use App\Models\Invoice;
use App\Models\LabReport;
use App\Models\LabTest;
use App\Models\Patient;
use App\Models\Payment;
use App\Models\Prescription;
use App\Services\PatientAccess;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PatientRecordResource extends JsonResource
{
    private function doctor(?Doctor $doctor): ?array
    {
        if (! $doctor) {
            return null;
        }

        return ['id' => $doctor->id, 'name' => $doctor->user?->name, 'department' => $doctor->department?->only(['id', 'name']), 'specialization' => $doctor->specialization?->only(['id', 'name'])];
    }

    public function toArray(Request $request): array
    {
        $record = $this->resource;
        $base = ['id' => $record->id];
        if ($record instanceof Patient) {
            return $base + $record->only(['patient_number', 'date_of_birth', 'gender', 'blood_group', 'address', 'emergency_contact_name', 'emergency_contact_phone']) + ['user' => $record->user?->only(['name', 'email', 'phone_number'])];
        }
        if ($record instanceof Doctor) {
            return $this->doctor($record) + $record->only(['bio', 'room_number', 'consultation_fee']) + ['schedules' => $record->schedules->map(fn ($s) => $s->only(['id', 'day_of_week', 'start_time', 'end_time', 'slot_duration', 'is_available']))];
        }
        if ($record instanceof Appointment) {
            return $base + $record->only(['appointment_number', 'appointment_date', 'appointment_time', 'reason', 'status', 'cancellation_reason']) + ['doctor' => $this->doctor($record->doctor), 'can_manage' => PatientAccess::can($request->user(), 'book_appointments') && in_array($record->status, ['pending', 'confirmed'], true) && Carbon::parse($record->appointment_date.' '.$record->appointment_time)->isFuture()];
        }
        if ($record instanceof Consultation) {
            return $base + $record->only(['diagnosis', 'consultation_notes', 'treatment_recommendations', 'follow_up_date', 'created_at']) + ['doctor' => $this->doctor($record->doctor)];
        }
        if ($record instanceof Prescription) {
            return $base + $record->only(['prescription_instructions', 'issue_date', 'status']) + ['doctor' => $this->doctor($record->doctor), 'items' => $record->items->map(fn ($item) => $item->only(['id', 'dosage', 'frequency', 'duration', 'quantity', 'unit_price']) + ['medicine_name' => $item->medicine?->name ?? 'Medicine unavailable', 'unit' => $item->medicine?->unit])];
        }
        if ($record instanceof LabTest) {
            $completed = $record->status === 'completed';

            return $base + $record->only(['request_date', 'status']) + ['doctor' => $this->doctor($record->doctor), 'test_type' => $record->test_type?->only(['id', 'name', 'expected_turnaround_time']), 'result_summary' => $completed ? $record->result_summary : null, 'reports' => $completed ? self::collection($record->reports->where('report_status', 'completed'))->resolve($request) : []];
        }
        if ($record instanceof LabReport) {
            return $base + $record->only(['file_type', 'file_size', 'upload_date', 'report_status']);
        }
        if ($record instanceof Invoice) {
            return $base + $record->only(['invoice_number', 'total_amount', 'amount_paid', 'outstanding_balance', 'status', 'issue_date']) + ['items' => $record->items->map(fn ($item) => $item->only(['id', 'service_description', 'service_type', 'quantity', 'unit_price', 'subtotal'])), 'payments' => self::collection($record->payments)->resolve($request)];
        }
        if ($record instanceof Payment) {
            return $base + $record->only(['payment_reference', 'amount', 'payment_method', 'transaction_status', 'payment_date']) + ['invoice_number' => $record->invoice?->invoice_number];
        }
        if ($record instanceof Admission) {
            return $base + $record->only(['admission_date', 'discharge_date', 'admission_notes', 'discharge_summary', 'status']) + ['ward' => $record->bed?->ward?->name, 'bed_number' => $record->bed?->bed_number];
        }

        return $base;
    }
}

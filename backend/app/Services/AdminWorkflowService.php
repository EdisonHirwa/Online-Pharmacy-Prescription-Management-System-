<?php

namespace App\Services;

use App\Events\HospitalActivity;
use App\Models\Admission;
use App\Models\Appointment;
use App\Models\HospitalBed;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Medicine;
use App\Models\MedicineStockMovement;
use App\Models\Patient;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AdminWorkflowService
{
    public function admit(array $data): Admission
    {
        return DB::transaction(function () use ($data): Admission {
            $patient = Patient::lockForUpdate()->findOrFail($data['patient_id']);
            $bed = HospitalBed::lockForUpdate()->findOrFail($data['bed_id']);
            if ($bed->availability_status !== 'available' || $bed->ward->status !== 'active' || Admission::where('bed_id', $bed->id)->where('status', 'admitted')->exists()) {
                abort(409, 'This bed is unavailable.');
            }
            if (Admission::where('patient_id', $patient->id)->where('status', 'admitted')->exists()) {
                abort(409, 'This patient already has an active admission.');
            }
            $record = Admission::create($data + ['admitting_user_id' => auth()->id(), 'admission_date' => now(), 'status' => 'admitted']);
            $bed->update(['availability_status' => 'occupied']);
            AuditService::record('admitted', 'admissions', $record->id);
            HospitalActivity::dispatch($patient->user, 'Admission confirmed', 'Your admission has been recorded.', 'admission');

            return $record;
        }, 3);
    }

    public function discharge(int $id, array $data): Admission
    {
        return DB::transaction(function () use ($id, $data): Admission {
            $record = Admission::lockForUpdate()->findOrFail($id);
            if ($record->status !== 'admitted') {
                abort(409, 'This patient has already been discharged.');
            }
            $bed = HospitalBed::lockForUpdate()->findOrFail($record->bed_id);
            $record->update($data + ['status' => 'discharged', 'discharge_date' => now()]);
            $bed->update(['availability_status' => 'available']);
            AuditService::record('discharged', 'admissions', $record->id);
            HospitalActivity::dispatch($record->patient->user, 'Discharge recorded', 'Your discharge has been recorded.', 'admission');

            return $record;
        }, 3);
    }

    public function invoice(array $data): Invoice
    {
        return DB::transaction(function () use ($data): Invoice {
            $invoice = Invoice::create(['invoice_number' => 'INV-'.Str::ulid(), 'patient_id' => $data['patient_id'], 'issue_date' => today(), 'status' => 'unpaid']);
            $total = 0;
            foreach ($data['items'] as $item) {
                $cents = (int) round((float) $item['unit_price'] * 100);
                $subtotal = $cents * $item['quantity'];
                $total += $subtotal;
                if ($total > 9999999999) {
                    throw ValidationException::withMessages(['items' => 'The invoice total exceeds the supported amount.']);
                }
                InvoiceItem::create($item + ['invoice_id' => $invoice->id, 'subtotal' => $subtotal / 100]);
            }
            if ($total <= 0) {
                throw ValidationException::withMessages(['items' => 'Invoice total must be positive.']);
            }
            $invoice->update(['total_amount' => $total / 100, 'outstanding_balance' => $total / 100]);
            AuditService::record('invoice_created', 'invoices', $invoice->id);
            HospitalActivity::dispatch($invoice->patient->user, 'Invoice issued', 'A new invoice is available in your account.', 'billing');

            return $invoice->load('items');
        });
    }

    public function payment(int $id, array $data): Payment
    {
        return DB::transaction(function () use ($id, $data): Payment {
            $invoice = Invoice::lockForUpdate()->findOrFail($id);
            $existing = Payment::where('payment_reference', $data['payment_reference'])->first();
            if ($existing) {
                if ($existing->invoice_id === $id && (int) round((float) $existing->amount * 100) === (int) round((float) $data['amount'] * 100) && $existing->payment_method === $data['payment_method']) {
                    return $existing;
                }
                abort(409, 'This payment reference has already been used.');
            }
            $cents = (int) round((float) $data['amount'] * 100);
            $balance = (int) round((float) $invoice->outstanding_balance * 100);
            if ($invoice->status === 'cancelled' || $cents <= 0 || $cents > $balance) {
                throw ValidationException::withMessages(['amount' => 'Payment must be positive and cannot exceed the outstanding balance.']);
            }
            $payment = Payment::create($data + ['invoice_id' => $id, 'transaction_status' => 'completed', 'received_by' => auth()->id(), 'payment_date' => now()]);
            $paid = (int) round((float) $invoice->amount_paid * 100) + $cents;
            $invoice->update(['amount_paid' => $paid / 100, 'outstanding_balance' => ($balance - $cents) / 100, 'status' => $balance === $cents ? 'paid' : 'partially_paid']);
            AuditService::record('payment_recorded', 'payments', $payment->id);
            HospitalActivity::dispatch($invoice->patient->user, 'Payment received', 'Your payment has been recorded.', 'payment');

            return $payment;
        });
    }

    public function cancelInvoice(int $id): Invoice
    {
        return DB::transaction(function () use ($id): Invoice {
            $invoice = Invoice::lockForUpdate()->findOrFail($id);
            if ((float) $invoice->amount_paid > 0 || $invoice->status === 'cancelled') {
                abort(409, 'Only an unpaid, active invoice can be cancelled.');
            }
            $invoice->update(['status' => 'cancelled', 'outstanding_balance' => 0]);
            AuditService::record('invoice_cancelled', 'invoices', $id);

            return $invoice;
        });
    }

    public function stock(int $id, array $data): Medicine
    {
        return DB::transaction(function () use ($id, $data): Medicine {
            $medicine = Medicine::lockForUpdate()->findOrFail($id);
            $after = $medicine->available_stock + $data['quantity'];
            if ($after < 0 || $after > 1000000000) {
                throw ValidationException::withMessages(['quantity' => 'Stock cannot become negative or exceed the supported amount.']);
            }
            MedicineStockMovement::create(['medicine_id' => $id, 'user_id' => auth()->id(), 'movement_type' => $data['quantity'] > 0 ? 'addition' : 'deduction', 'quantity' => $data['quantity'], 'previous_stock' => $medicine->available_stock, 'resulting_stock' => $after, 'reason' => $data['reason']]);
            $medicine->update(['available_stock' => $after]);
            AuditService::record('stock_adjusted', 'medicines', $id);

            return $medicine;
        });
    }

    public function appointment(array $data, ?int $id = null): Appointment
    {
        return app(AppointmentBookingService::class)->book($data, $id);
    }

    public function appointmentStatus(int $id, array $data): Appointment
    {
        return DB::transaction(function () use ($id, $data): Appointment {
            $record = Appointment::lockForUpdate()->findOrFail($id);
            $allowed = ['pending' => ['confirmed', 'cancelled', 'rejected'], 'confirmed' => ['cancelled']];
            if (! in_array($data['status'], $allowed[$record->status] ?? [], true)) {
                abort(409, 'This appointment status cannot be changed. Completion requires a clinical consultation.');
            }
            if (in_array($data['status'], ['cancelled', 'rejected'], true)) {
                $data['cancelled_by'] = auth()->id();
            }
            $record->update($data);
            AuditService::record('appointment_'.$data['status'], 'appointments', $id);
            HospitalActivity::dispatch($record->patient->user, 'Appointment updated', 'Your appointment status is now '.$data['status'].'.', 'appointment');
            HospitalActivity::dispatch($record->doctor->user, 'Appointment updated', 'An assigned appointment status is now '.$data['status'].'.', 'appointment');

            return $record;
        }, 3);
    }
}

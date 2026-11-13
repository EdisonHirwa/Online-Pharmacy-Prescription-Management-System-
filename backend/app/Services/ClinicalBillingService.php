<?php

namespace App\Services;

use App\Events\HospitalActivity;
use App\Models\Consultation;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\LabTest;
use Illuminate\Support\Str;

class ClinicalBillingService
{
    public function charge(Consultation $consultation, string $type, int $reference, string $description, string $price): void
    {
        $cents = (int) round((float) $price * 100);
        if ($cents <= 0) {
            return;
        }
        if (InvoiceItem::where('service_type', $type)->where('reference_id', $reference)->whereHas('invoice', fn ($q) => $q->where('status', '!=', 'cancelled'))->exists()) {
            return;
        }
        $invoice = Invoice::where('appointment_id', $consultation->appointment_id)->whereIn('status', ['unpaid', 'partially_paid'])->lockForUpdate()->first();
        if (! $invoice) {
            $invoice = Invoice::create(['invoice_number' => 'INV-'.Str::ulid(), 'patient_id' => $consultation->patient_id, 'appointment_id' => $consultation->appointment_id, 'issue_date' => today(), 'status' => 'unpaid']);
        }
        $total = (int) round((float) $invoice->total_amount * 100) + $cents;
        if ($total > 9999999999) {
            abort(422, 'The invoice total exceeds the supported amount.');
        }
        InvoiceItem::create(['invoice_id' => $invoice->id, 'service_description' => $description, 'service_type' => $type, 'reference_id' => $reference, 'quantity' => 1, 'unit_price' => $price, 'subtotal' => $price]);
        $invoice->update(['total_amount' => $total / 100, 'outstanding_balance' => ($total - (int) round((float) $invoice->amount_paid * 100)) / 100, 'status' => (float) $invoice->amount_paid > 0 ? 'partially_paid' : 'unpaid']);
        AuditService::record('clinical_charge_added', 'invoices', $invoice->id);
        HospitalActivity::dispatch($consultation->patient->user, 'Invoice updated', 'Your consultation or laboratory charges are available in billing.', 'billing');
    }

    public function cancelLabCharge(LabTest $test): void
    {
        $items = InvoiceItem::where('service_type', 'lab_test')->where('reference_id', $test->id)->get();
        foreach ($items as $item) {
            $invoice = Invoice::lockForUpdate()->findOrFail($item->invoice_id);
            if ($invoice->status === 'cancelled') {
                continue;
            }
            if ((float) $invoice->amount_paid > 0) {
                abort(409, 'Payment has already been recorded for this invoice. Ask administration to resolve the charge before cancelling this investigation.');
            }
            $item->update(['service_description' => $item->service_description.' (cancelled)', 'unit_price' => 0, 'subtotal' => 0]);
            $total = $invoice->items()->sum('subtotal');
            $invoice->update(['total_amount' => $total, 'outstanding_balance' => $total, 'status' => (float) $total > 0 ? 'unpaid' : 'cancelled']);
            AuditService::record('lab_charge_cancelled', 'invoices', $invoice->id);
        }
    }
}

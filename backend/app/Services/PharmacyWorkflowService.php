<?php

namespace App\Services;

use App\Events\HospitalActivity;
use App\Models\Consultation;
use App\Models\Dispensation;
use App\Models\DispensationItem;
use App\Models\Medicine;
use App\Models\MedicineStockMovement;
use App\Models\Prescription;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class PharmacyWorkflowService
{
    public static function version(Prescription $prescription): string
    {
        return hash('sha256', json_encode([$prescription->status, $prescription->prescription_instructions, $prescription->items->map(fn ($item) => [$item->id, $item->medicine_id, $item->quantity, $item->unit_price, $item->dosage, $item->frequency, $item->duration, (int) $item->dispensed_quantity])->all(), DB::table('patient_allergies')->where('patient_id', $prescription->patient_id)->orderBy('id')->get(['id', 'allergy_name', 'severity', 'reaction_description'])->toArray()], JSON_THROW_ON_ERROR));
    }

    public static function loadPrescription(Prescription $prescription): Prescription
    {
        return $prescription->load(['patient.user', 'doctor.user', 'items' => fn ($q) => $q->with('medicine')->withSum('dispensationItems as dispensed_quantity', 'quantity_dispensed')->orderBy('id'), 'dispensations.items.prescriptionItem.medicine', 'dispensations.pharmacist']);
    }

    private function lowStock(Medicine $medicine, int $previous): void
    {
        if ($previous > $medicine->reorder_level && $medicine->available_stock <= $medicine->reorder_level) {
            foreach (User::where('role', 'pharmacist')->where('account_status', 'active')->get() as $user) {
                HospitalActivity::dispatch($user, 'Low medicine stock', $medicine->name.' has reached its reorder level. Review pharmacy inventory.', 'pharmacy');
            }
        }
    }

    public function dispense(int $id, array $data): Dispensation
    {
        PharmacyAccess::requireManagement();
        usort($data['items'], fn ($a, $b) => $a['prescription_item_id'] <=> $b['prescription_item_id']);
        $hash = hash('sha256', json_encode($data, JSON_THROW_ON_ERROR));

        try {
            return DB::transaction(function () use ($id, $data, $hash): Dispensation {
                $prescription = Prescription::lockForUpdate()->findOrFail($id);
                Gate::authorize('pharmacy-record');
                $existing = Dispensation::where('request_key', $data['request_key'])->first();
                if ($existing) {
                    abort_unless($existing->pharmacist_id === auth()->id() && $existing->prescription_id === $id && hash_equals($existing->request_hash, $hash), 409, 'This submission key has already been used. Refresh the prescription.');

                    return $existing;
                }
                abort_unless(in_array($prescription->status, ['pending', 'partially_dispensed'], true), 409, 'Only pending or partially dispensed prescriptions can be processed.');
                $consultation = Consultation::lockForUpdate()->findOrFail($prescription->consultation_id);
                abort_unless($consultation->patient_id === $prescription->patient_id && $consultation->doctor_id === $prescription->doctor_id, 409, 'The prescription has inconsistent clinical links. Contact administration.');
                self::loadPrescription($prescription);
                abort_unless(hash_equals(self::version($prescription), $data['version']), 409, 'The prescription or allergy record has changed. Reopen it and review the current details.');
                $items = $prescription->items->keyBy('id');
                $medicines = Medicine::whereIn('id', $prescription->items->pluck('medicine_id'))->orderBy('id')->lockForUpdate()->get()->keyBy('id');
                $needed = [];
                foreach ($data['items'] as $index => $line) {
                    $item = $items->get($line['prescription_item_id']);
                    if (! $item || $line['quantity'] > $item->quantity - (int) $item->dispensed_quantity) {
                        throw ValidationException::withMessages(['items.'.$index.'.quantity' => 'Choose a prescribed item and a quantity within its remaining allowance.']);
                    }
                    $medicine = $medicines->get($item->medicine_id);
                    if (! $medicine || $medicine->status !== 'active' || $medicine->expiry_date < today()->toDateString()) {
                        throw ValidationException::withMessages(['items.'.$index.'.quantity' => 'This medicine is inactive, unavailable, or expired.']);
                    }
                    $needed[$medicine->id] = ($needed[$medicine->id] ?? 0) + $line['quantity'];
                }
                foreach ($needed as $medicineId => $quantity) {
                    if ($quantity > $medicines[$medicineId]->available_stock) {
                        throw ValidationException::withMessages(['items' => 'Insufficient stock for '.$medicines[$medicineId]->name.'. Refresh inventory before dispensing.']);
                    }
                }
                $remaining = $prescription->items->sum(fn ($item) => $item->quantity - (int) $item->dispensed_quantity) - array_sum(array_column($data['items'], 'quantity'));
                $dispensation = Dispensation::create(['prescription_id' => $id, 'pharmacist_id' => auth()->id(), 'dispensing_date' => now(), 'dispensing_status' => $remaining === 0 ? 'completed' : 'partially_completed', 'notes' => $data['notes'] ?? null, 'request_key' => $data['request_key'], 'request_hash' => $hash]);
                foreach ($needed as $medicineId => $quantity) {
                    $medicine = $medicines[$medicineId];
                    $previous = $medicine->available_stock;
                    $medicine->update(['available_stock' => $previous - $quantity]);
                    MedicineStockMovement::create(['medicine_id' => $medicineId, 'user_id' => auth()->id(), 'movement_type' => 'dispensing', 'quantity' => -$quantity, 'previous_stock' => $previous, 'resulting_stock' => $medicine->available_stock, 'reason' => 'Dispensation #'.$dispensation->id.' for prescription #'.$id]);
                    $this->lowStock($medicine, $previous);
                }
                foreach ($data['items'] as $line) {
                    $item = $items[$line['prescription_item_id']];
                    $dispensed = DispensationItem::create(['dispensation_id' => $dispensation->id, 'prescription_item_id' => $item->id, 'quantity_dispensed' => $line['quantity'], 'unit_price' => $item->unit_price]);
                    app(ClinicalBillingService::class)->charge($consultation, 'medicine', $dispensed->id, 'Medicine: '.$medicines[$item->medicine_id]->name.' (dispensation #'.$dispensation->id.')', $item->unit_price, $line['quantity']);
                }
                $prescription->update(['status' => $remaining === 0 ? 'dispensed' : 'partially_dispensed']);
                AuditService::record('prescription_dispensed', 'dispensations', $dispensation->id, 'Prescription #'.$id.'; allergy review acknowledged.');
                foreach ([$prescription->patient?->user, $prescription->doctor?->user] as $user) {
                    if ($user) {
                        HospitalActivity::dispatch($user, 'Prescription dispensing updated', 'Pharmacy has recorded dispensing against a prescription. Review the prescription for its current status.', 'prescription');
                    }
                }

                return $dispensation;
            }, 3);
        } catch (ValidationException $exception) {
            AuditService::record('dispensing_rejected', 'prescriptions', $id, 'Invalid dispensing quantities or unavailable medicine; no stock was changed.');
            throw $exception;
        }
    }

    public function stock(int $id, array $data): Medicine
    {
        PharmacyAccess::requireManagement();

        return DB::transaction(function () use ($id, $data): Medicine {
            $medicine = Medicine::lockForUpdate()->findOrFail($id);
            $previous = $medicine->available_stock;
            $after = $previous + $data['quantity'];
            if ($after < 0 || $after > 1000000000) {
                throw ValidationException::withMessages(['quantity' => 'Stock cannot become negative or exceed the supported amount.']);
            }
            $medicine->update(['available_stock' => $after]);
            MedicineStockMovement::create(['medicine_id' => $id, 'user_id' => auth()->id(), 'movement_type' => $data['quantity'] > 0 ? 'addition' : 'deduction', 'quantity' => $data['quantity'], 'previous_stock' => $previous, 'resulting_stock' => $after, 'reason' => $data['reason']]);
            $this->lowStock($medicine, $previous);
            AuditService::record('stock_adjusted', 'medicines', $id);

            return $medicine;
        }, 3);
    }

    public function medicine(array $data, ?int $id = null): Medicine
    {
        PharmacyAccess::requireManagement();

        return DB::transaction(function () use ($data, $id): Medicine {
            $medicine = $id ? Medicine::lockForUpdate()->findOrFail($id) : new Medicine(['available_stock' => 0]);
            $medicine->fill($data);
            $medicine->save();
            AuditService::record($id ? 'medicine_updated' : 'medicine_created', 'medicines', $medicine->id);

            return $medicine;
        }, 3);
    }
}

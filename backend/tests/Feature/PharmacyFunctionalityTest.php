<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Consultation;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Medicine;
use App\Models\Prescription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PharmacyFunctionalityTest extends TestCase
{
    use RefreshDatabase;

    private function pharmacist(array $attributes = []): User
    {
        $user = User::factory()->create($attributes + ['role' => 'pharmacist']);
        Sanctum::actingAs($user);

        return $user;
    }

    private function medicine(array $attributes = []): Medicine
    {
        return Medicine::create($attributes + ['medicine_code' => fake()->unique()->bothify('MED-########'), 'name' => 'Test medicine', 'category' => 'General', 'unit' => 'tablet', 'unit_price' => '12.35', 'available_stock' => 20, 'reorder_level' => 2, 'expiry_date' => today()->addYear()->toDateString(), 'status' => 'active']);
    }

    private function prescription(?Medicine $medicine = null, int $quantity = 7): Prescription
    {
        $appointment = Appointment::factory()->create(['status' => 'completed']);
        $consultation = Consultation::create(['appointment_id' => $appointment->id, 'patient_id' => $appointment->patient_id, 'doctor_id' => $appointment->doctor_id, 'diagnosis' => 'Private diagnosis', 'consultation_notes' => 'Private consultation']);
        $prescription = Prescription::create(['consultation_id' => $consultation->id, 'patient_id' => $consultation->patient_id, 'doctor_id' => $consultation->doctor_id, 'issue_date' => now(), 'status' => 'pending', 'prescription_instructions' => 'Take as prescribed']);
        $medicine ??= $this->medicine();
        $prescription->items()->create(['medicine_id' => $medicine->id, 'dosage' => 'One tablet', 'frequency' => 'Daily', 'duration' => 'One week', 'quantity' => $quantity, 'unit_price' => $medicine->unit_price]);

        return $prescription;
    }

    private function payload(Prescription $prescription, int $quantity = 3): array
    {
        $detail = $this->getJson('/api/pharmacy/prescriptions/'.$prescription->id)->assertOk()->json('data');

        return ['request_key' => (string) Str::uuid(), 'version' => $detail['version'], 'allergies_reviewed' => true, 'items' => [['prescription_item_id' => $detail['items'][0]['id'], 'quantity' => $quantity]], 'notes' => 'Reviewed prescription'];
    }

    private function dispense(Prescription $prescription, array $payload): TestResponse
    {
        return $this->postJson('/api/pharmacy/prescriptions/'.$prescription->id.'/dispense', $payload);
    }

    public function test_real_pharmacist_login_and_role_boundaries(): void
    {
        $this->getJson('/api/pharmacy/dashboard')->assertUnauthorized();
        foreach (['admin', 'patient', 'doctor', 'lab_tech'] as $role) {
            Sanctum::actingAs(User::factory()->create(['role' => $role]));
            $this->getJson('/api/pharmacy/dashboard')->assertForbidden();
        }
        app('auth')->forgetGuards();
        $user = User::factory()->create(['role' => 'pharmacist', 'password' => 'Pharmacist!123']);
        $token = $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'Pharmacist!123'])->assertOk()->assertJsonPath('user.role', 'pharmacist')->json('token');
        $this->withToken($token)->getJson('/api/pharmacy/dashboard')->assertOk();
        $this->withToken($token)->getJson('/api/admin/users')->assertForbidden();
        $this->withToken($token)->getJson('/api/doctor/dashboard')->assertForbidden();
    }

    public function test_partial_then_complete_dispensing_updates_stock_billing_and_notifications(): void
    {
        $user = $this->pharmacist();
        $medicine = $this->medicine();
        $prescription = $this->prescription($medicine);
        $data = $this->payload($prescription);
        $id = $this->dispense($prescription, $data)->assertCreated()->assertJsonPath('data.dispensing_status', 'partially_completed')->assertJsonPath('data.total', '37.05')->json('data.id');
        $this->assertSame(17, $medicine->fresh()->available_stock);
        $this->assertSame('partially_dispensed', $prescription->fresh()->status);
        $this->assertDatabaseHas('dispensation_items', ['dispensation_id' => $id, 'quantity_dispensed' => 3, 'unit_price' => '12.35']);
        $this->assertDatabaseHas('medicine_stock_movements', ['medicine_id' => $medicine->id, 'movement_type' => 'dispensing', 'quantity' => -3, 'previous_stock' => 20, 'resulting_stock' => 17, 'user_id' => $user->id]);
        $this->assertDatabaseHas('invoice_items', ['service_type' => 'medicine', 'quantity' => 3, 'unit_price' => '12.35', 'subtotal' => '37.05']);
        $this->assertDatabaseHas('invoices', ['patient_id' => $prescription->patient_id, 'total_amount' => '37.05', 'outstanding_balance' => '37.05']);
        $this->assertDatabaseHas('notifications', ['user_id' => $prescription->patient->user_id, 'title' => 'Prescription dispensing updated']);
        $this->assertDatabaseHas('notifications', ['user_id' => $prescription->doctor->user_id, 'title' => 'Prescription dispensing updated']);
        $this->dispense($prescription, $this->payload($prescription, 4))->assertCreated()->assertJsonPath('data.dispensing_status', 'completed');
        $this->assertSame('dispensed', $prescription->fresh()->status);
        $this->assertSame(13, $medicine->fresh()->available_stock);
        $this->assertDatabaseHas('invoices', ['total_amount' => '86.45']);
        $this->getJson('/api/pharmacy/prescriptions')->assertJsonPath('meta.total', 0);
        $this->getJson('/api/pharmacy/history')->assertJsonPath('meta.total', 2);
        $this->assertDatabaseHas('audit_logs', ['action' => 'prescription_dispensed', 'affected_record_id' => $id]);
    }

    public function test_retries_are_idempotent_and_changed_payload_cannot_reuse_key(): void
    {
        $this->pharmacist();
        $prescription = $this->prescription();
        $data = $this->payload($prescription);
        $first = $this->dispense($prescription, $data)->assertCreated()->json('data.id');
        $this->dispense($prescription, $data)->assertOk()->assertJsonPath('data.id', $first);
        $this->assertDatabaseCount('dispensations', 1);
        $this->assertDatabaseCount('invoice_items', 1);
        $this->assertDatabaseCount('medicine_stock_movements', 1);
        $data['items'][0]['quantity'] = 2;
        $this->dispense($prescription, $data)->assertConflict();
        $this->assertDatabaseCount('dispensations', 1);
    }

    public function test_over_prescribed_and_insufficient_stock_are_rejected_atomically(): void
    {
        $this->pharmacist();
        $medicine = $this->medicine(['available_stock' => 2]);
        $prescription = $this->prescription($medicine);
        $this->dispense($prescription, $this->payload($prescription, 8))->assertUnprocessable();
        $this->dispense($prescription, $this->payload($prescription, 3))->assertUnprocessable();
        $this->assertDatabaseHas('audit_logs', ['action' => 'dispensing_rejected', 'affected_record_id' => $prescription->id]);
        $this->assertSame(2, $medicine->fresh()->available_stock);
        $this->assertDatabaseCount('dispensations', 0);
        $this->assertDatabaseCount('invoices', 0);
        $this->assertDatabaseCount('medicine_stock_movements', 0);
        $this->assertSame('pending', $prescription->fresh()->status);
    }

    public function test_partial_dispense_cannot_exceed_remaining_allowance(): void
    {
        $this->pharmacist();
        $prescription = $this->prescription();
        $this->dispense($prescription, $this->payload($prescription, 5))->assertCreated();
        $this->dispense($prescription, $this->payload($prescription, 3))->assertUnprocessable();
        $this->assertDatabaseCount('dispensations', 1);
    }

    public function test_stale_prescription_or_allergy_review_requires_refresh(): void
    {
        $this->pharmacist();
        $prescription = $this->prescription();
        $data = $this->payload($prescription);
        $prescription->update(['prescription_instructions' => 'Changed instructions']);
        $this->dispense($prescription, $data)->assertConflict();
        $data = $this->payload($prescription);
        DB::table('patient_allergies')->insert(['patient_id' => $prescription->patient_id, 'allergy_name' => 'Recorded allergen', 'severity' => 'severe', 'reaction_description' => 'Recorded reaction', 'recorded_date' => today()->toDateString(), 'created_at' => now(), 'updated_at' => now()]);
        $this->dispense($prescription, $data)->assertConflict();
        $this->assertDatabaseCount('dispensations', 0);
    }

    public function test_expired_inactive_and_deleted_medicines_cannot_be_dispensed(): void
    {
        $this->pharmacist();
        foreach (['expired', 'inactive', 'deleted'] as $case) {
            $medicine = $this->medicine();
            $prescription = $this->prescription($medicine);
            if ($case === 'expired') {
                $medicine->update(['expiry_date' => today()->subDay()]);
            } elseif ($case === 'inactive') {
                $medicine->update(['status' => 'inactive']);
            } else {
                $medicine->delete();
            }$this->dispense($prescription, $this->payload($prescription))->assertUnprocessable();
        }
        $this->assertDatabaseCount('dispensations', 0);
    }

    public function test_cancelled_completed_and_deleted_prescriptions_are_protected(): void
    {
        $this->pharmacist();
        $prescription = $this->prescription();
        $data = $this->payload($prescription);
        $prescription->update(['status' => 'cancelled']);
        $this->dispense($prescription, $data)->assertConflict();
        $prescription->update(['status' => 'dispensed']);
        $this->dispense($prescription, $data)->assertConflict();
        $prescription->delete();
        $this->dispense($prescription, $data)->assertNotFound();
        $this->assertDatabaseCount('dispensations', 0);
    }

    public function test_line_validation_rejects_duplicate_foreign_invalid_and_unreviewed_items(): void
    {
        $this->pharmacist();
        $prescription = $this->prescription();
        $other = $this->prescription();
        $base = $this->payload($prescription);
        $invalid = [];
        $row = $base;
        $row['items'][] = $row['items'][0];
        $invalid[] = $row;
        $row = $base;
        $row['items'][0]['prescription_item_id'] = $other->items()->first()->id;
        $invalid[] = $row;
        foreach ([0, -1, 1.5, 1000001] as $quantity) {
            $row = $base;
            $row['items'][0]['quantity'] = $quantity;
            $invalid[] = $row;
        }
        $row = $base;
        $row['allergies_reviewed'] = false;
        $invalid[] = $row;
        $row = $base;
        $row['pharmacist_id'] = 999;
        $invalid[] = $row;
        $row = $base;
        $row['items'][0]['unit_price'] = 1;
        $invalid[] = $row;
        foreach ($invalid as $data) {
            $this->dispense($prescription, $data)->assertUnprocessable();
        }$this->assertDatabaseCount('dispensations', 0);
    }

    public function test_duplicate_medicine_lines_share_the_same_stock_limit(): void
    {
        $this->pharmacist();
        $medicine = $this->medicine(['available_stock' => 5]);
        $prescription = $this->prescription($medicine);
        $second = $prescription->items()->create(['medicine_id' => $medicine->id, 'dosage' => 'One', 'frequency' => 'Daily', 'duration' => 'Week', 'quantity' => 7, 'unit_price' => '12.35']);
        $data = $this->payload($prescription);
        $data['items'][] = ['prescription_item_id' => $second->id, 'quantity' => 3];
        $this->dispense($prescription, $data)->assertUnprocessable();
        $this->assertSame(5, $medicine->fresh()->available_stock);
        $this->assertDatabaseCount('dispensations', 0);
    }

    public function test_billing_failure_rolls_back_stock_dispensing_and_notifications(): void
    {
        $this->pharmacist();
        $medicine = $this->medicine();
        $prescription = $this->prescription($medicine);
        $data = $this->payload($prescription);
        InvoiceItem::creating(function (): void {
            throw new \RuntimeException('Simulated billing failure');
        });
        $this->withoutExceptionHandling();
        try {
            $this->dispense($prescription, $data);
            $this->fail('Expected transaction failure');
        } catch (\RuntimeException $exception) {
            $this->assertSame('Simulated billing failure', $exception->getMessage());
        } finally {
            InvoiceItem::flushEventListeners();
        }
        $this->assertSame(20, $medicine->fresh()->available_stock);
        foreach (['dispensations', 'dispensation_items', 'medicine_stock_movements', 'invoices', 'notifications'] as $table) {
            $this->assertDatabaseCount($table, 0);
        }$this->assertSame('pending', $prescription->fresh()->status);
    }

    public function test_price_snapshot_is_used_and_paid_invoices_receive_new_invoice(): void
    {
        $this->pharmacist();
        $medicine = $this->medicine();
        $prescription = $this->prescription($medicine);
        $medicine->update(['unit_price' => '99.99']);
        $this->dispense($prescription, $this->payload($prescription))->assertCreated()->assertJsonPath('data.total', '37.05');
        $invoice = Invoice::first();
        $invoice->update(['amount_paid' => '37.05', 'outstanding_balance' => 0, 'status' => 'paid']);
        $this->dispense($prescription, $this->payload($prescription, 4))->assertCreated();
        $this->assertDatabaseCount('invoices', 2);
        $this->assertSame('paid', $invoice->fresh()->status);
        $this->assertDatabaseHas('invoices', ['total_amount' => '49.40', 'outstanding_balance' => '49.40']);
    }

    public function test_inventory_creation_editing_stock_and_low_stock_notification(): void
    {
        $user = $this->pharmacist();
        $medicine = $this->medicine();
        $data = $medicine->only(['medicine_code', 'name', 'category', 'description', 'unit', 'unit_price', 'reorder_level', 'expiry_date', 'status']);
        $data['medicine_code'] = 'NEW-MED';
        $id = $this->postJson('/api/pharmacy/medicines', $data)->assertOk()->assertJsonPath('data.available_stock', 0)->json('data.id');
        $data['reorder_level'] = 5;
        $data['status'] = 'inactive';
        $this->putJson('/api/pharmacy/medicines/'.$id, $data)->assertOk()->assertJsonPath('data.reorder_level', 5);
        $this->postJson('/api/pharmacy/medicines/'.$id.'/stock', ['quantity' => 10, 'reason' => 'Received stock'])->assertOk()->assertJsonPath('data.available_stock', 10);
        $this->postJson('/api/pharmacy/medicines/'.$medicine->id.'/stock', ['quantity' => -18, 'reason' => 'Inventory correction'])->assertOk()->assertJsonPath('data.available_stock', 2);
        $this->assertDatabaseHas('notifications', ['user_id' => $user->id, 'title' => 'Low medicine stock']);
        $this->postJson('/api/pharmacy/medicines/'.$id.'/stock', ['quantity' => -11, 'reason' => 'Invalid deduction'])->assertUnprocessable();
        $data['available_stock'] = 100;
        $this->putJson('/api/pharmacy/medicines/'.$id, $data)->assertUnprocessable();
        $this->assertSame(10, Medicine::find($id)->available_stock);
    }

    public function test_permissions_and_inactive_accounts_block_mutations(): void
    {
        $this->pharmacist(['permissions' => ['view_own_records']]);
        $prescription = $this->prescription();
        $data = $this->payload($prescription);
        $this->dispense($prescription, $data)->assertForbidden();
        $this->postJson('/api/pharmacy/medicines/'.$prescription->items->first()->medicine_id.'/stock', ['quantity' => 5, 'reason' => 'Receive stock'])->assertForbidden();
        $this->getJson('/api/pharmacy/dashboard')->assertJsonPath('data.can_manage', false);
        $this->pharmacist(['account_status' => 'inactive']);
        $this->getJson('/api/pharmacy/dashboard')->assertUnauthorized();
    }

    public function test_resources_exclude_unrelated_clinical_financial_and_account_details(): void
    {
        $this->pharmacist();
        $prescription = $this->prescription();
        $response = $this->getJson('/api/pharmacy/prescriptions/'.$prescription->id)->assertOk();
        $response->assertJsonMissingPath('data.patient.email')->assertJsonMissingPath('data.patient.user')->assertJsonMissingPath('data.consultation')->assertJsonMissingPath('data.invoices');
        $this->assertStringNotContainsString('Private diagnosis', $response->getContent());
        $this->dispense($prescription, $this->payload($prescription))->assertCreated()->assertJsonMissingPath('data.request_key')->assertJsonMissingPath('data.pharmacist.email');
        $this->getJson('/api/pharmacy/history')->assertJsonMissingPath('data.0.request_hash');
    }

    public function test_dashboard_filters_search_pagination_and_movement_history(): void
    {
        $this->pharmacist();
        $this->medicine(['name' => 'Expired medicine', 'expiry_date' => today()->subDay(), 'available_stock' => 1]);
        $medicine = $this->medicine(['name' => 'Searchable medicine', 'expiry_date' => today()->addDays(10)]);
        $prescription = $this->prescription($medicine);
        $this->dispense($prescription, $this->payload($prescription))->assertCreated();
        $this->getJson('/api/pharmacy/dashboard')->assertOk()->assertJsonPath('data.partial', 1)->assertJsonPath('data.dispensed_today', 1)->assertJsonPath('data.expired', 1)->assertJsonPath('data.expiring', 1);
        $this->getJson('/api/pharmacy/medicines?filter=expired')->assertJsonPath('total', 1);
        $this->getJson('/api/pharmacy/medicines?search=Searchable&per_page=1')->assertJsonPath('total', 1)->assertJsonCount(1, 'data');
        $this->getJson('/api/pharmacy/movements?movement_type=dispensing&search=Searchable')->assertJsonPath('total', 1)->assertJsonMissingPath('data.0.user.email');
        $this->getJson('/api/pharmacy/history?status=partially_completed')->assertJsonPath('meta.total', 1);
        $this->getJson('/api/pharmacy/prescriptions?status=partially_dispensed')->assertJsonPath('meta.total', 1);
        $this->getJson('/api/pharmacy/medicines?sort=password')->assertUnprocessable();
    }

    public function test_two_pharmacists_cannot_use_stale_allowances_or_each_others_submission_keys(): void
    {
        $first = $this->pharmacist();
        $prescription = $this->prescription();
        $firstPayload = $this->payload($prescription, 4);
        $second = $this->pharmacist();
        $stalePayload = $this->payload($prescription, 4);
        Sanctum::actingAs($first);
        $this->dispense($prescription, $firstPayload)->assertCreated();
        Sanctum::actingAs($second);
        $this->dispense($prescription, $stalePayload)->assertConflict();
        $this->dispense($prescription, $firstPayload)->assertConflict();
        $this->assertDatabaseCount('dispensations', 1);
        $this->assertDatabaseCount('invoice_items', 1);
    }

    public function test_multi_medicine_failure_preserves_all_stock_and_free_medicine_completes_without_charge(): void
    {
        $this->pharmacist();
        $first = $this->medicine();
        $second = $this->medicine(['available_stock' => 1]);
        $prescription = $this->prescription($first);
        $item = $prescription->items()->create(['medicine_id' => $second->id, 'dosage' => 'One', 'frequency' => 'Daily', 'duration' => 'Week', 'quantity' => 7, 'unit_price' => '12.35']);
        $payload = $this->payload($prescription);
        $payload['items'][] = ['prescription_item_id' => $item->id, 'quantity' => 2];
        $this->dispense($prescription, $payload)->assertUnprocessable();
        $this->assertSame(20, $first->fresh()->available_stock);
        $this->assertSame(1, $second->fresh()->available_stock);
        $this->assertDatabaseCount('dispensations', 0);
        $free = $this->prescription($this->medicine(['unit_price' => '0.00']), 1);
        $payload = $this->payload($free, 1);
        $this->dispense($free, $payload)->assertCreated()->assertJsonPath('data.total', '0.00');
        $this->dispense($free, $payload)->assertOk();
        $this->assertSame('dispensed', $free->fresh()->status);
        $this->assertDatabaseCount('invoices', 0);
    }
}

<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\Invoice;
use App\Models\LabReport;
use App\Models\LabTest;
use App\Models\LabTestType;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LaboratoryFunctionalityTest extends TestCase
{
    use RefreshDatabase;

    private function technician(array $attributes = []): User
    {
        $user = User::factory()->create(['role' => 'lab_tech'] + $attributes);
        Sanctum::actingAs($user);

        return $user;
    }

    private function processing(?LabTest $test = null): LabTest
    {
        $test ??= LabTest::factory()->create();
        $this->postJson('/api/laboratory/tests/'.$test->id.'/claim')->assertOk();
        $this->postJson('/api/laboratory/tests/'.$test->id.'/start')->assertOk();

        return $test->fresh();
    }

    private function pdf(string $name = 'report.pdf'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, "%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
    }

    private function upload(LabTest $test, ?UploadedFile $file = null): int
    {
        return $this->post('/api/laboratory/tests/'.$test->id.'/reports', ['report' => $file ?? $this->pdf()], ['Accept' => 'application/json'])->assertCreated()->json('data.id');
    }

    public function test_laboratory_role_and_real_login_are_required(): void
    {
        $this->getJson('/api/laboratory/dashboard')->assertUnauthorized();
        foreach (['admin', 'patient', 'doctor', 'pharmacist'] as $role) {
            Sanctum::actingAs(User::factory()->create(['role' => $role]));
            $this->getJson('/api/laboratory/dashboard')->assertForbidden();
        }
        app('auth')->forgetGuards();
        $user = User::factory()->create(['role' => 'lab_tech', 'password' => 'Technician!123']);
        $token = $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'Technician!123'])->assertOk()->assertJsonPath('user.role', 'lab_tech')->json('token');
        $this->withToken($token)->getJson('/api/laboratory/dashboard')->assertOk();
        $this->withToken($token)->getJson('/api/admin/users')->assertForbidden();
    }

    public function test_queue_and_lists_do_not_disclose_other_technicians_results(): void
    {
        $user = $this->technician();
        $queued = LabTest::factory()->create();
        $mine = LabTest::factory()->create(['assigned_technician_id' => $user->id, 'status' => 'processing']);
        $foreign = LabTest::factory()->create(['assigned_technician_id' => User::factory()->create(['role' => 'lab_tech'])->id, 'status' => 'completed', 'result_summary' => 'Private foreign findings']);
        $this->getJson('/api/laboratory/tests?mode=queue')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $queued->id)->assertJsonMissingPath('data.0.patient.email')->assertJsonPath('data.0.result_summary', null);
        $this->getJson('/api/laboratory/tests?mode=work')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $mine->id);
        $this->getJson('/api/laboratory/tests')->assertOk()->assertJsonPath('meta.total', 2);
        $this->getJson('/api/laboratory/tests/'.$foreign->id)->assertForbidden();
        $this->assertDatabaseHas('audit_logs', ['action' => 'unauthorized_access', 'affected_record_id' => $foreign->id]);
    }

    public function test_requests_can_be_claimed_started_and_drafts_saved_with_valid_transitions(): void
    {
        $user = $this->technician();
        $test = LabTest::factory()->create();
        $this->postJson('/api/laboratory/tests/'.$test->id.'/start')->assertConflict();
        $this->postJson('/api/laboratory/tests/'.$test->id.'/claim')->assertOk()->assertJsonPath('data.status', 'assigned')->assertJsonPath('data.assigned_to_me', true);
        $this->putJson('/api/laboratory/tests/'.$test->id.'/results', ['result_summary' => 'Draft findings'])->assertConflict();
        $this->postJson('/api/laboratory/tests/'.$test->id.'/start')->assertOk()->assertJsonPath('data.status', 'processing');
        $this->putJson('/api/laboratory/tests/'.$test->id.'/results', ['result_summary' => 'Draft findings'])->assertOk()->assertJsonPath('data.result_summary', 'Draft findings');
        $this->postJson('/api/laboratory/tests/'.$test->id.'/release')->assertConflict();
        $this->postJson('/api/laboratory/tests/'.$test->id.'/start')->assertConflict();
        $this->assertDatabaseHas('lab_tests', ['id' => $test->id, 'assigned_technician_id' => $user->id, 'status' => 'processing']);
    }

    public function test_claims_cannot_steal_assigned_or_cancelled_work_and_release_returns_to_queue(): void
    {
        $first = $this->technician();
        $test = LabTest::factory()->create();
        $this->postJson('/api/laboratory/tests/'.$test->id.'/claim')->assertOk();
        $second = $this->technician();
        $this->postJson('/api/laboratory/tests/'.$test->id.'/claim')->assertConflict();
        $this->postJson('/api/laboratory/tests/'.$test->id.'/start')->assertForbidden();
        Sanctum::actingAs($first);
        $this->postJson('/api/laboratory/tests/'.$test->id.'/release')->assertOk()->assertJsonPath('data.status', 'requested');
        Sanctum::actingAs($second);
        $this->postJson('/api/laboratory/tests/'.$test->id.'/claim')->assertOk();
        $cancelled = LabTest::factory()->create(['status' => 'cancelled']);
        $this->postJson('/api/laboratory/tests/'.$cancelled->id.'/claim')->assertConflict();
    }

    public function test_reports_are_private_preliminary_validated_and_never_expose_storage_paths(): void
    {
        Storage::fake('local');
        $user = $this->technician();
        $test = $this->processing();
        $id = $this->upload($test);
        $report = LabReport::findOrFail($id);
        Storage::disk('local')->assertExists($report->file_path);
        $this->assertStringStartsWith('lab-reports/'.$test->id.'/', $report->file_path);
        $this->assertStringNotContainsString('report.pdf', $report->file_path);
        $this->assertSame('preliminary', $report->report_status);
        $this->assertSame($user->id, $report->uploaded_by);
        $this->getJson('/api/laboratory/tests/'.$test->id)->assertOk()->assertJsonMissingPath('data.reports.0.file_path')->assertJsonPath('data.reports.0.report_status', 'preliminary');
        $this->get('/api/laboratory/reports/'.$id.'/preview')->assertOk()->assertHeader('content-type', 'application/pdf')->assertHeader('cache-control', 'no-store, private');
        $this->get('/api/laboratory/reports/'.$id.'/download')->assertOk();
    }

    public function test_pdf_png_and_jpeg_uploads_are_supported(): void
    {
        Storage::fake('local');
        $this->technician();
        $test = $this->processing();
        $this->upload($test, $this->pdf());
        $this->upload($test, UploadedFile::fake()->image('report.png'));
        $this->upload($test, UploadedFile::fake()->image('report.jpg'));
        $this->assertDatabaseCount('lab_reports', 3);
    }

    public function test_invalid_extensions_mime_mismatch_and_oversized_files_are_rejected(): void
    {
        Storage::fake('local');
        $this->technician();
        $test = $this->processing();
        $url = '/api/laboratory/tests/'.$test->id.'/reports';
        $files = [UploadedFile::fake()->create('report.txt', 10, 'text/plain'), $this->pdf('report.exe'), UploadedFile::fake()->image('large.png')->size(2049), UploadedFile::fake()->createWithContent('report.png', "%PDF-1.4\n%%EOF")->mimeType('application/pdf'), UploadedFile::fake()->createWithContent('report.pdf', 'This is plain text, not a PDF document.')->mimeType('text/plain')];
        foreach ($files as $file) {
            $this->post($url, ['report' => $file], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('report');
        }
        $this->assertDatabaseCount('lab_reports', 0);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_exact_two_megabyte_upload_is_accepted(): void
    {
        Storage::fake('local');
        $this->technician();
        $test = $this->processing();
        $this->upload($test, UploadedFile::fake()->image('boundary.png')->size(2048));
    }

    public function test_files_and_results_cannot_be_managed_by_another_technician(): void
    {
        Storage::fake('local');
        $owner = $this->technician();
        $test = $this->processing();
        $id = $this->upload($test);
        $this->technician();
        $this->post('/api/laboratory/tests/'.$test->id.'/reports', ['report' => $this->pdf()], ['Accept' => 'application/json'])->assertForbidden();
        $this->putJson('/api/laboratory/tests/'.$test->id.'/results', ['result_summary' => 'Foreign update'])->assertForbidden();
        $this->postJson('/api/laboratory/tests/'.$test->id.'/complete', ['result_summary' => 'Foreign completion'])->assertForbidden();
        $this->getJson('/api/laboratory/reports/'.$id.'/download')->assertForbidden();
        $this->getJson('/api/laboratory/reports/'.$id.'/preview')->assertForbidden();
        $this->deleteJson('/api/laboratory/reports/'.$id)->assertForbidden();
        $this->assertDatabaseHas('lab_tests', ['id' => $test->id, 'status' => 'processing', 'result_summary' => null]);
    }

    public function test_draft_report_removal_removes_only_preliminary_files(): void
    {
        Storage::fake('local');
        $this->technician();
        $test = $this->processing();
        $id = $this->upload($test);
        $path = LabReport::findOrFail($id)->file_path;
        $this->deleteJson('/api/laboratory/reports/'.$id)->assertOk();
        Storage::disk('local')->assertMissing($path);
        $this->assertSoftDeleted('lab_reports', ['id' => $id]);
        $this->getJson('/api/laboratory/reports/'.$id.'/download')->assertNotFound();
    }

    public function test_finalization_releases_reports_and_notifies_patient_and_doctor_once(): void
    {
        Storage::fake('local');
        $technician = $this->technician();
        $test = $this->processing();
        $report = $this->upload($test);
        $this->putJson('/api/laboratory/tests/'.$test->id.'/results', ['result_summary' => 'Unreleased draft'])->assertOk();
        Sanctum::actingAs($test->doctor->user);
        $this->getJson('/api/doctor/lab-requests/'.$test->id)->assertOk()->assertJsonPath('data.result_summary', null)->assertJsonCount(0, 'data.reports');
        $this->getJson('/api/doctor/lab-reports/'.$report.'/download')->assertConflict();
        Sanctum::actingAs($test->patient->user);
        $this->getJson('/api/patient/lab-tests/'.$test->id)->assertOk()->assertJsonPath('data.result_summary', null)->assertJsonCount(0, 'data.reports');
        Sanctum::actingAs($technician);
        $this->postJson('/api/laboratory/tests/'.$test->id.'/complete', ['result_summary' => 'Final laboratory findings'])->assertOk()->assertJsonPath('data.status', 'completed');
        $this->assertDatabaseHas('lab_reports', ['id' => $report, 'report_status' => 'completed']);
        $this->assertDatabaseHas('notifications', ['user_id' => $test->doctor->user_id, 'notification_type' => 'laboratory']);
        $this->assertDatabaseHas('notifications', ['user_id' => $test->patient->user_id, 'notification_type' => 'laboratory']);
        $this->postJson('/api/laboratory/tests/'.$test->id.'/complete', ['result_summary' => 'Duplicate'])->assertConflict();
        $this->assertDatabaseCount('notifications', 2);
        Sanctum::actingAs($test->doctor->user);
        $this->getJson('/api/doctor/lab-requests/'.$test->id)->assertOk()->assertJsonPath('data.result_summary', 'Final laboratory findings');
        $this->get('/api/doctor/lab-reports/'.$report.'/download')->assertOk();
        Sanctum::actingAs($test->patient->user);
        $this->get('/api/patient/lab-reports/'.$report.'/download')->assertOk();
        $this->getJson('/api/patient/lab-tests/'.$test->id)->assertOk()->assertJsonCount(1, 'data.reports');
    }

    public function test_completed_investigations_and_files_are_immutable(): void
    {
        Storage::fake('local');
        $this->technician();
        $test = $this->processing();
        $id = $this->upload($test);
        $path = LabReport::findOrFail($id)->file_path;
        $this->postJson('/api/laboratory/tests/'.$test->id.'/complete', ['result_summary' => 'Final findings'])->assertOk();
        $this->putJson('/api/laboratory/tests/'.$test->id.'/results', ['result_summary' => 'Overwrite'])->assertConflict();
        $this->deleteJson('/api/laboratory/reports/'.$id)->assertConflict();
        $this->post('/api/laboratory/tests/'.$test->id.'/reports', ['report' => $this->pdf()], ['Accept' => 'application/json'])->assertConflict();
        Storage::disk('local')->assertExists($path);
        $this->assertDatabaseHas('lab_tests', ['id' => $test->id, 'result_summary' => 'Final findings']);
    }

    public function test_summary_is_required_for_completion_and_file_is_optional(): void
    {
        $this->technician();
        $test = $this->processing();
        $this->postJson('/api/laboratory/tests/'.$test->id.'/complete', ['result_summary' => ''])->assertUnprocessable();
        $this->postJson('/api/laboratory/tests/'.$test->id.'/complete', ['result_summary' => 'Summary without attachment'])->assertOk();
        $this->assertDatabaseCount('lab_reports', 0);
    }

    public function test_permissions_inactive_accounts_and_forged_metadata_are_blocked(): void
    {
        Storage::fake('local');
        $user = $this->technician();
        $test = $this->processing();
        $this->putJson('/api/laboratory/tests/'.$test->id.'/results', ['result_summary' => 'Draft', 'assigned_technician_id' => 123])->assertUnprocessable();
        $this->post('/api/laboratory/tests/'.$test->id.'/reports', ['report' => $this->pdf(), 'report_status' => 'completed'], ['Accept' => 'application/json'])->assertUnprocessable();
        $user->update(['permissions' => ['view_own_records']]);
        Sanctum::actingAs($user->fresh());
        $this->getJson('/api/laboratory/tests/'.$test->id)->assertOk();
        $this->putJson('/api/laboratory/tests/'.$test->id.'/results', ['result_summary' => 'Blocked'])->assertForbidden();
        $user->update(['account_status' => 'inactive']);
        Sanctum::actingAs($user->fresh());
        $this->getJson('/api/laboratory/dashboard')->assertUnauthorized();
    }

    public function test_files_are_cleaned_up_if_database_creation_fails(): void
    {
        Storage::fake('local');
        $this->technician();
        $test = $this->processing();
        $this->withoutExceptionHandling();
        LabReport::creating(function (): void {
            throw new \RuntimeException('Simulated report storage failure.');
        });
        try {
            $this->post('/api/laboratory/tests/'.$test->id.'/reports', ['report' => $this->pdf()], ['Accept' => 'application/json']);
            $this->fail('Expected the simulated database failure.');
        } catch (\RuntimeException $exception) {
            $this->assertSame('Simulated report storage failure.', $exception->getMessage());
        } finally {
            LabReport::flushEventListeners();
        }
        $this->assertDatabaseCount('lab_reports', 0);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_search_sort_filters_pagination_and_dashboard_are_database_backed(): void
    {
        $user = $this->technician();
        $first = LabTest::factory()->create();
        $second = LabTest::factory()->create(['assigned_technician_id' => $user->id, 'status' => 'completed']);
        $this->getJson('/api/laboratory/dashboard')->assertOk()->assertJsonPath('data.unassigned_requests', 1)->assertJsonPath('data.completed', 1);
        $this->getJson('/api/laboratory/tests?per_page=1&sort=patient&direction=asc')->assertOk()->assertJsonPath('meta.total', 2)->assertJsonCount(1, 'data');
        $this->getJson('/api/laboratory/tests?mode=history')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $second->id);
        $this->getJson('/api/laboratory/tests?search='.urlencode($first->patient->patient_number))->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/laboratory/tests?assigned_technician_id=123')->assertUnprocessable();
    }

    public function test_laboratory_completion_does_not_duplicate_doctor_generated_charges(): void
    {
        $doctor = Doctor::factory()->create();
        $patient = Patient::factory()->create();
        $appointment = Appointment::factory()->create(['doctor_id' => $doctor->id, 'patient_id' => $patient->id]);
        Sanctum::actingAs($doctor->user);
        $consultation = $this->postJson('/api/doctor/consultations', ['appointment_id' => $appointment->id, 'diagnosis' => 'Recorded diagnosis', 'consultation_notes' => 'Clinical findings'])->assertCreated()->json('data.id');
        $type = LabTestType::create(['name' => 'Test charge', 'price' => '1000.25', 'expected_turnaround_time' => '24 hours']);
        $testId = $this->postJson('/api/doctor/lab-requests', ['consultation_id' => $consultation, 'test_type_ids' => [$type->id]])->assertCreated()->json('data.0.id');
        $before = Invoice::first()->total_amount;
        $this->technician();
        $this->processing(LabTest::findOrFail($testId));
        $this->postJson('/api/laboratory/tests/'.$testId.'/complete', ['result_summary' => 'Completed'])->assertOk();
        $this->assertDatabaseCount('invoices', 1);
        $this->assertEquals($before, Invoice::first()->total_amount);
        $this->assertDatabaseCount('invoice_items', 2);
    }
}

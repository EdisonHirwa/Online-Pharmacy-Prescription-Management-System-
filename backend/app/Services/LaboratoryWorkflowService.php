<?php

namespace App\Services;

use App\Events\HospitalActivity;
use App\Models\LabReport;
use App\Models\LabTest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class LaboratoryWorkflowService
{
    private function owned(int $id): LabTest
    {
        $test = LabTest::lockForUpdate()->findOrFail($id);
        Gate::authorize('laboratory-record', $test);
        abort_unless((int) $test->assigned_technician_id === auth()->id(), 409, 'Claim this investigation before processing it.');

        return $test;
    }

    private function processing(int $id): LabTest
    {
        $test = $this->owned($id);
        abort_unless($test->status === 'processing', 409, 'Only investigations currently being processed can be changed.');

        return $test;
    }

    public function claim(int $id): LabTest
    {
        LaboratoryAccess::requireManagement();

        return DB::transaction(function () use ($id): LabTest {
            $test = LabTest::lockForUpdate()->findOrFail($id);
            if ((int) $test->assigned_technician_id === auth()->id() && $test->status === 'assigned') {
                return $test;
            }
            if ($test->assigned_technician_id !== null || $test->status !== 'requested') {
                AuditService::record('laboratory_claim_conflict', 'lab_tests', $id);
                abort(409, 'This investigation is no longer available to claim. Refresh the queue.');
            }
            $test->update(['assigned_technician_id' => auth()->id(), 'status' => 'assigned']);
            AuditService::record('laboratory_assigned', 'lab_tests', $id);

            return $test;
        }, 3);
    }

    public function start(int $id): LabTest
    {
        LaboratoryAccess::requireManagement();

        return DB::transaction(function () use ($id): LabTest {
            $test = $this->owned($id);
            abort_unless($test->status === 'assigned', 409, 'Only assigned investigations can be started.');
            $test->update(['status' => 'processing']);
            AuditService::record('laboratory_processing_started', 'lab_tests', $id);

            return $test;
        }, 3);
    }

    public function release(int $id): LabTest
    {
        LaboratoryAccess::requireManagement();

        return DB::transaction(function () use ($id): LabTest {
            $test = $this->owned($id);
            abort_unless($test->status === 'assigned' && ! $test->result_summary && ! $test->reports()->exists(), 409, 'Only unstarted assignments without findings or reports can be released.');
            $test->update(['status' => 'requested', 'assigned_technician_id' => null]);
            AuditService::record('laboratory_assignment_released', 'lab_tests', $id);

            return $test;
        }, 3);
    }

    public function results(int $id, string $summary, bool $complete = false): LabTest
    {
        LaboratoryAccess::requireManagement();

        return DB::transaction(function () use ($id, $summary, $complete): LabTest {
            $test = $this->processing($id);
            $test->update(['result_summary' => $summary, 'status' => $complete ? 'completed' : 'processing']);
            if ($complete) {
                $test->reports()->where('report_status', 'preliminary')->update(['report_status' => 'completed']);
                if ($test->doctor?->user) {
                    HospitalActivity::dispatch($test->doctor->user, 'Laboratory results ready', 'A requested laboratory investigation is complete and available for review.', 'laboratory');
                }
                if ($test->patient?->user) {
                    HospitalActivity::dispatch($test->patient->user, 'Laboratory results ready', 'Your completed laboratory results are available in your patient portal.', 'laboratory');
                }
            }
            AuditService::record($complete ? 'laboratory_completed' : 'laboratory_draft_saved', 'lab_tests', $id);

            return $test;
        }, 3);
    }

    public function upload(int $id, UploadedFile $file): LabReport
    {
        LaboratoryAccess::requireManagement();
        $test = LabTest::findOrFail($id);
        Gate::authorize('laboratory-record', $test);
        abort_unless((int) $test->assigned_technician_id === auth()->id() && $test->status === 'processing', 409, 'Start your assigned investigation before uploading reports.');
        $extension = match ($file->getMimeType()) {
            'application/pdf' => 'pdf','image/png' => 'png','image/jpeg' => 'jpg',default => abort(422, 'Unsupported report type.')
        };
        $path = $file->storeAs('lab-reports/'.$id, Str::uuid().'.'.$extension, 'local');
        if (! $path) {
            abort(500, 'Unable to store the report file. Please try again.');
        }
        try {
            return DB::transaction(function () use ($id, $file, $path): LabReport {
                $this->processing($id);
                $report = LabReport::create(['lab_test_id' => $id, 'uploaded_by' => auth()->id(), 'file_path' => $path, 'file_type' => $file->getMimeType(), 'file_size' => $file->getSize(), 'upload_date' => now(), 'report_status' => 'preliminary']);
                AuditService::record('laboratory_report_uploaded', 'lab_reports', $report->id);

                return $report;
            }, 3);
        } catch (\Throwable $exception) {
            Storage::disk('local')->delete($path);
            throw $exception;
        }
    }

    public function removeReport(int $id): void
    {
        LaboratoryAccess::requireManagement();
        $report = LabReport::findOrFail($id);
        Gate::authorize('laboratory-record', $report);
        $path = DB::transaction(function () use ($id, $report): string {
            $this->processing($report->lab_test_id);
            $record = LabReport::lockForUpdate()->findOrFail($id);
            abort_unless($record->report_status === 'preliminary', 409, 'Completed report files are preserved and cannot be deleted.');
            $path = $record->file_path;
            $record->delete();
            AuditService::record('laboratory_draft_report_removed', 'lab_reports', $id);

            return $path;
        }, 3);
        Storage::disk('local')->delete($path);
    }
}

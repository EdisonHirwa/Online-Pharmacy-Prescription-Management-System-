<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\LabReport;
use App\Services\AdminWorkflowService;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class WorkflowController extends Controller
{
    public function __construct(private AdminWorkflowService $workflows) {}

    public function admit(Request $request): JsonResponse
    {
        $data = $request->validate(['patient_id' => 'required|exists:patients,id,deleted_at,NULL', 'bed_id' => 'required|exists:hospital_beds,id', 'admission_notes' => 'nullable|string|max:5000']);

        return response()->json(['data' => $this->workflows->admit($data), 'message' => 'Patient admitted.'], 201);
    }

    public function discharge(Request $request, int $id): JsonResponse
    {
        return response()->json(['data' => $this->workflows->discharge($id, $request->validate(['discharge_summary' => 'required|string|max:5000'])), 'message' => 'Patient discharged.']);
    }

    public function invoice(Request $request): JsonResponse
    {
        $data = $request->validate(['patient_id' => 'required|exists:patients,id,deleted_at,NULL', 'items' => 'required|array|min:1|max:100', 'items.*.service_description' => 'required|string|max:255', 'items.*.service_type' => 'required|in:consultation,lab_test,medicine,admission', 'items.*.quantity' => 'required|integer|min:1|max:10000', 'items.*.unit_price' => 'required|numeric|min:0.01|max:99999999.99|decimal:0,2']);

        return response()->json(['data' => $this->workflows->invoice($data), 'message' => 'Invoice created.'], 201);
    }

    public function payment(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['amount' => 'required|numeric|min:0.01|max:99999999.99|decimal:0,2', 'payment_method' => 'required|in:cash,card,mobile_money', 'payment_reference' => 'required|string|max:100']);

        return response()->json(['data' => $this->workflows->payment($id, $data), 'message' => 'Payment recorded.']);
    }

    public function cancelInvoice(int $id): JsonResponse
    {
        return response()->json(['data' => $this->workflows->cancelInvoice($id), 'message' => 'Invoice cancelled.']);
    }

    public function stock(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['quantity' => 'required|integer|not_in:0|between:-1000000,1000000', 'reason' => 'required|string|max:1000']);

        return response()->json(['data' => $this->workflows->stock($id, $data), 'message' => 'Stock updated.']);
    }

    public function appointment(Request $request, ?int $id = null): JsonResponse
    {
        $data = $request->validate(['patient_id' => 'required|exists:patients,id,deleted_at,NULL', 'doctor_id' => 'required|exists:doctors,id,deleted_at,NULL', 'appointment_date' => 'required|date_format:Y-m-d|after_or_equal:today', 'appointment_time' => 'required|date_format:H:i', 'reason' => 'required|string|max:5000']);

        return response()->json(['data' => $this->workflows->appointment($data, $id), 'message' => 'Appointment booked.'], 201);
    }

    public function appointmentStatus(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['status' => 'required|in:confirmed,cancelled,rejected', 'cancellation_reason' => 'required_if:status,cancelled,rejected|nullable|string|max:1000']);

        return response()->json(['data' => $this->workflows->appointmentStatus($id, $data), 'message' => 'Appointment updated.']);
    }

    public function notifications(Request $request): JsonResponse
    {
        return response()->json(['data' => DB::table('notifications')->where('user_id', $request->user()->id)->orderByDesc('id')->limit(100)->get()]);
    }

    public function readNotifications(Request $request): JsonResponse
    {
        DB::table('notifications')->where('user_id', $request->user()->id)->where('is_read', false)->update(['is_read' => true, 'updated_at' => now()]);

        return response()->json(['message' => 'Notifications marked as read.']);
    }

    public function downloadReport(int $id): StreamedResponse
    {
        $report = LabReport::findOrFail($id);
        abort_unless(Storage::disk('local')->exists($report->file_path), 404, 'Report file is unavailable.');
        AuditService::record('report_downloaded', 'lab_reports', $id);

        return Storage::disk('local')->download($report->file_path, 'laboratory-report-'.$id.'.'.pathinfo($report->file_path, PATHINFO_EXTENSION));
    }
}

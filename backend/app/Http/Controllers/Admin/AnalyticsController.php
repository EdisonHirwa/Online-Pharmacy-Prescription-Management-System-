<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Doctor;
use App\Models\InvoiceItem;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

class AnalyticsController extends Controller
{
    public function index(Request $request, string $report): JsonResponse
    {
        $rows = $this->rows($request, $report);

        if ($search = trim((string) $request->input('search'))) {
            $rows = $rows->filter(fn ($row) => str_contains(strtolower(implode(' ', array_values($row))), strtolower($search)));
        }
        $size = max(1, min(100, $request->integer('per_page', 25)));

        return response()->json(['data' => $rows->values()->slice((max(1, $request->integer('page', 1)) - 1) * $size, $size)->values(), 'total' => $rows->count()]);
    }

    public function rows(Request $request, string $report): Collection
    {
        $request->validate(['start_date' => 'nullable|date_format:Y-m-d', 'end_date' => ['nullable', 'date_format:Y-m-d', Rule::when($request->filled('start_date'), 'after_or_equal:start_date')]]);
        if ($report === 'doctor-performance') {
            $filter = function ($query) use ($request): void {
                if ($request->filled('start_date')) {
                    $query->whereDate('created_at', '>=', $request->input('start_date'));
                }
                if ($request->filled('end_date')) {
                    $query->whereDate('created_at', '<=', $request->input('end_date'));
                }
            };

            return Doctor::with('user', 'department')->withCount(['appointments' => $filter, 'consultations' => $filter])->get()->map(fn ($d): array => ['id' => $d->id, 'doctor' => $d->user?->name, 'department' => $d->department?->name, 'appointments' => $d->appointments_count, 'consultations' => $d->consultations_count, 'professional_status' => $d->professional_status]);
        }
        if ($report === 'laboratory-revenue') {
            $query = InvoiceItem::where('service_type', 'lab_test')->whereHas('invoice', function ($q) use ($request): void {
                $q->where('status', '!=', 'cancelled');
                if ($request->filled('start_date')) {
                    $q->whereDate('issue_date', '>=', $request->input('start_date'));
                }
                if ($request->filled('end_date')) {
                    $q->whereDate('issue_date', '<=', $request->input('end_date'));
                }
            });

            return $query->get()->groupBy('service_description')->map(fn ($items, $description): array => ['id' => $items->first()->id, 'service' => $description, 'quantity' => $items->sum('quantity'), 'total_billed' => round((float) $items->sum('subtotal'), 2)])->values();
        }
        if ($report === 'revenue') {
            $query = Payment::where('transaction_status', 'completed');
            if ($request->filled('start_date')) {
                $query->whereDate('payment_date', '>=', $request->input('start_date'));
            }
            if ($request->filled('end_date')) {
                $query->whereDate('payment_date', '<=', $request->input('end_date'));
            }

            return $query->get()->groupBy(fn ($p) => substr($p->payment_date, 0, 10).' '.$p->payment_method)->map(fn ($items): array => ['id' => $items->first()->id, 'date' => substr($items->first()->payment_date, 0, 10), 'payment_method' => $items->first()->payment_method, 'transactions' => $items->count(), 'revenue' => round((float) $items->sum('amount'), 2)])->values();
        }
        abort(404);
    }
}

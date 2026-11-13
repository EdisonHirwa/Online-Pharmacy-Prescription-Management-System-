<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AuditService;
use App\Services\PdfReport;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function export(Request $request, string $resource): Response|StreamedResponse
    {
        $data = $request->validate(['format' => 'required|in:csv,pdf', 'start_date' => 'nullable|date_format:Y-m-d', 'end_date' => ['nullable', 'date_format:Y-m-d', Rule::when($request->filled('start_date'), 'after_or_equal:start_date')]]);
        if (in_array($resource, ['doctor-performance', 'laboratory-revenue', 'revenue'], true)) {
            $rows = (new AnalyticsController)->rows($request, $resource);
        } else {
            $query = (new ResourceController)->filteredQuery($request, $resource);
            abort_if($query->count() > 5000, 422, 'Narrow the filters to export no more than 5,000 records.');
            $rows = $query->orderBy('id')->get()->map(function ($record): array {
                $row = $record->attributesToArray();
                unset($row['password'],$row['remember_token'],$row['deleted_at'],$row['file_path']);
                foreach ($row as &$value) {
                    if (is_array($value)) {
                        $value = implode(', ', $value);
                    }
                }
                if ($record->relationLoaded('user')) {
                    $row['user_name'] = $record->user?->name;
                }
                if ($record->relationLoaded('patient')) {
                    $row['patient_name'] = $record->patient?->user?->name;
                }
                if ($record->relationLoaded('doctor')) {
                    $row['doctor_name'] = $record->doctor?->user?->name;
                }

                return $row;
            });
        }
        AuditService::record('report_exported', $resource, null, 'Exported '.$rows->count().' records as '.$data['format'].'.');
        $filename = $resource.'-'.today()->format('Y-m-d').'.'.$data['format'];
        if ($data['format'] === 'pdf') {
            $lines = [];
            foreach ($rows as $row) {
                foreach ($row as $key => $value) {
                    foreach (explode("\n", wordwrap($key.': '.(string) $value, 95, "\n", true)) as $line) {
                        $lines[] = $line;
                    }
                }
                $lines[] = '';
            }
            if (! $lines) {
                $lines[] = 'No matching records.';
            }

            return response(PdfReport::render(ucwords(str_replace('-', ' ', $resource)).' Report', $lines), 200, ['Content-Type' => 'application/pdf', 'Content-Disposition' => 'attachment; filename="'.$filename.'"']);
        }

        return response()->streamDownload(function () use ($rows): void {
            $file = fopen('php://output', 'w');
            if ($rows->isNotEmpty()) {
                fputcsv($file, array_keys($rows->first()), ',', '"', '');
            }
            foreach ($rows as $row) {
                fputcsv($file, array_map(fn ($value) => is_string($value) && preg_match('/^[=+@\\-\\t\\r]/', $value) ? "'".$value : $value, array_values($row)), ',', '"', '');
            }
            fclose($file);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}

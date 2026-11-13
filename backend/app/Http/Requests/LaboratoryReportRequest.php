<?php

namespace App\Http\Requests;

use App\Services\LaboratoryAccess;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class LaboratoryReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return LaboratoryAccess::canManage($this->user());
    }

    public function rules(): array
    {
        return ['report' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'mimetypes:application/pdf,image/jpeg,image/png', 'extensions:pdf,jpg,jpeg,png', 'max:2048'], 'file_path' => 'prohibited', 'uploaded_by' => 'prohibited', 'lab_test_id' => 'prohibited', 'report_status' => 'prohibited', 'status' => 'prohibited'];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            $file = $this->file('report');
            $extension = strtolower($file->getClientOriginalExtension());
            $expected = ['pdf' => 'application/pdf', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png'];
            if (($expected[$extension] ?? null) !== $file->getMimeType()) {
                $validator->errors()->add('report', 'The report file extension must match its PDF, JPEG, or PNG contents.');
            }
        }];
    }
}

<?php

namespace App\Http\Requests;

use App\Services\AdminCatalog;
use Illuminate\Foundation\Http\FormRequest;

class AdminResourceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    public function rules(): array
    {
        return AdminCatalog::rules($this->route('resource'), $this->route('id') ? (int) $this->route('id') : null);
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('email')) {
            $this->merge(['email' => strtolower(trim((string) $this->input('email')))]);
        }
    }
}

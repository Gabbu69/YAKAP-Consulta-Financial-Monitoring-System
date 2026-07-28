<?php

namespace App\Http\Requests;

use App\Enums\SapBatchStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SapBatchStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::enum(SapBatchStatus::class)],
            'submitted_gross_centavos' => ['nullable', 'integer', 'min:0'],
            'approved_gross_centavos' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}

<?php

namespace App\Http\Requests;

use App\Enums\FacilityType;
use App\Models\Facility;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class FacilityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:180'],
            'facility_code' => ['required', 'string', 'max:60', Rule::unique('facilities')->ignore(Facility::query()->value('id'))],
            'type' => ['required', Rule::enum(FacilityType::class)],
            'city' => ['nullable', 'string', 'max:100'],
            'province' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:500'],
            'contact_email' => ['nullable', 'email', 'max:180'],
            'contact_number' => ['nullable', 'string', 'max:30'],
        ];
    }
}

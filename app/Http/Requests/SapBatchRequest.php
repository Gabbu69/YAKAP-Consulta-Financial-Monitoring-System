<?php

namespace App\Http\Requests;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SapBatchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'policy_version_id' => ['required', 'integer', 'exists:policy_versions,id'],
            'tranche' => ['required', 'integer', Rule::in([1, 2])],
            'year' => ['required', 'integer', 'between:2020,2100'],
            'month' => ['required', 'integer', 'between:1,12'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /** @return array<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->hasAny(['tranche', 'year', 'month'])) {
                return;
            }
            $tranche = (int) $this->input('tranche');
            $year = (int) $this->input('year');
            $month = (int) $this->input('month');
            $today = CarbonImmutable::today('Asia/Manila');

            if ($tranche === 2 && $month !== 12) {
                $validator->errors()->add('month', 'SAP2 is an annual close and must use December as its reporting month.');
            }
            if ($tranche === 1
                && CarbonImmutable::create($year, $month, 1, 0, 0, 0, 'Asia/Manila')->greaterThan($today)) {
                $validator->errors()->add('month', 'SAP1 cannot be generated for a future reporting month.');
            }
            if ($tranche === 2
                && $month === 12
                && $today->lessThan(CarbonImmutable::create($year + 1, 1, 8, 0, 0, 0, 'Asia/Manila'))) {
                $validator->errors()->add('year', 'SAP2 can be frozen only from January 8 after the benefit year closes.');
            }
        }];
    }
}

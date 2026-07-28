<?php

namespace App\Http\Requests;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class CopaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'beneficiary_id' => ['required', 'integer', 'exists:beneficiaries,id'],
            'encounter_id' => ['nullable', 'integer', 'exists:encounters,id'],
            'year' => ['required', 'integer', 'between:2020,2100'],
            'amount_centavos' => ['required', 'integer', 'min:1'],
            'paid_at' => ['required', 'date', 'before_or_equal:today'],
            'receipt_number' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /** @return array<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->hasAny(['year', 'paid_at'])) {
                return;
            }

            $paymentYear = CarbonImmutable::parse((string) $this->input('paid_at'), 'Asia/Manila')
                ->setTimezone('Asia/Manila')->year;
            if ($paymentYear !== $this->integer('year')) {
                $validator->errors()->add('paid_at', 'The co-payment date must be within the selected member year.');
            }
        }];
    }
}

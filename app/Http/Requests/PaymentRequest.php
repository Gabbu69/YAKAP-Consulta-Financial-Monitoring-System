<?php

namespace App\Http\Requests;

use App\Models\SapBatch;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class PaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'sap_batch_id' => ['required', 'integer', 'exists:sap_batches,id'],
            'amount_centavos' => ['required', 'integer', 'min:1'],
            'paid_at' => ['required', 'date', 'before_or_equal:today'],
            'method' => ['nullable', 'string', 'max:60'],
            'external_reference' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /** @return array<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->hasAny(['sap_batch_id', 'paid_at'])) {
                return;
            }

            $batch = SapBatch::query()->find($this->integer('sap_batch_id'));
            $paymentDate = CarbonImmutable::parse((string) $this->input('paid_at'), 'Asia/Manila')
                ->setTimezone('Asia/Manila')->startOfDay();
            $reportingPeriodStart = $batch === null
                ? null
                : CarbonImmutable::create($batch->year, $batch->month, 1, 0, 0, 0, 'Asia/Manila');

            if ($reportingPeriodStart !== null && $paymentDate->lessThan($reportingPeriodStart)) {
                $validator->errors()->add('paid_at', 'The payment date cannot precede the SAP reporting period.');
            }
        }];
    }
}

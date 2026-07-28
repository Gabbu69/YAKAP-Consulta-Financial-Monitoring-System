<?php

namespace App\Http\Requests;

use App\Models\Facility;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class PolicyVersionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $facilityId = Facility::query()->value('id');

        return [
            'effective_year' => ['required', 'integer', 'between:2020,2100',
                Rule::unique('policy_versions')->where('facility_id', $facilityId)->ignore($this->route('policy'))],
            'source_circular' => ['required', 'string', 'max:255'],
            'source_url' => ['nullable', 'url', 'max:1000'],
            'per_capita_rate_centavos' => ['required', 'integer', 'min:0'],
            'sap1_percentage_bps' => ['required', 'integer', 'between:0,10000'],
            'sap2_percentage_bps' => ['required', 'integer', 'between:0,10000'],
            'withholding_tax_bps' => ['required', 'integer', 'between:0,10000'],
            'copayment_cap_centavos' => ['required', 'integer', 'min:0'],
            'performance_rules' => ['required', 'array', 'size:4'],
            'performance_rules.*.key' => ['required', Rule::in([
                'consultation_utilization', 'laboratory_utilization', 'antibiotic_access', 'ncd_medicine_access',
            ]), 'distinct'],
            'performance_rules.*.label' => ['required', 'string', 'max:100'],
            'performance_rules.*.target' => ['required', 'numeric', 'gt:0', 'max:1'],
            'performance_rules.*.weight' => ['required', 'numeric', 'gt:0', 'max:1'],
        ];
    }

    /** @return array<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            $first = (int) $this->input('sap1_percentage_bps');
            $second = (int) $this->input('sap2_percentage_bps');
            if ($first + $second !== 10000) {
                $validator->errors()->add('sap2_percentage_bps', 'SAP1 and SAP2 percentages must total 100%.');
            }
            $rules = $this->input('performance_rules', []);
            $weight = 0.0;
            if (is_array($rules)) {
                foreach ($rules as $rule) {
                    if (is_array($rule)) {
                        $weight += (float) ($rule['weight'] ?? 0);
                    }
                }
            }
            if (abs($weight - 1) > 0.0001) {
                $validator->errors()->add('performance_rules', 'Performance weights must total 1.00.');
            }
        }];
    }
}

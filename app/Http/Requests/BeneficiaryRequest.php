<?php

namespace App\Http\Requests;

use App\Enums\BeneficiaryType;
use App\Models\Beneficiary;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class BeneficiaryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $updating = $this->route('beneficiary') instanceof Beneficiary;
        $requestedYear = $this->integer('year');
        $year = $requestedYear >= 2020 && $requestedYear <= 2100
            ? $requestedYear
            : now()->year;
        $latestReadinessDate = CarbonImmutable::create($year, 12, 31, 0, 0, 0, 'Asia/Manila')
            ->min(CarbonImmutable::today('Asia/Manila'))
            ->toDateString();

        return [
            'philhealth_pin' => [$updating ? 'nullable' : 'required', 'string', 'regex:/^\d{12}$/'],
            'first_name' => ['required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'suffix' => ['nullable', 'string', 'max:20'],
            'birth_date' => ['required', 'date', 'before_or_equal:today'],
            'sex' => ['required', Rule::in(['female', 'male', 'intersex', 'not_stated'])],
            'beneficiary_type' => ['required', Rule::enum(BeneficiaryType::class)],
            'contact_number' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:500'],
            'year' => ['required', 'integer', 'between:2020,2100'],
            'selected' => ['required', 'boolean'],
            'selected_at' => [Rule::requiredIf(fn () => $this->boolean('selected')), 'nullable', 'date', "after_or_equal:{$year}-01-01", "before_or_equal:{$latestReadinessDate}"],
            'fpe_completed' => ['required', 'boolean'],
            'fpe_completed_at' => [Rule::requiredIf(fn () => $this->boolean('fpe_completed')), 'nullable', 'date', "after_or_equal:{$year}-01-01", "before_or_equal:{$latestReadinessDate}"],
            'pcu_reference' => ['nullable', 'string', 'max:100'],
            'yes_confirmed' => ['required', 'boolean'],
            'yes_confirmed_at' => [Rule::requiredIf(fn () => $this->boolean('yes_confirmed')), 'nullable', 'date', "after_or_equal:{$year}-01-01", "before_or_equal:{$latestReadinessDate}"],
        ];
    }

    /** @return array<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($this->boolean('fpe_completed') && ! $this->boolean('selected')) {
                $validator->errors()->add('fpe_completed', 'FPE completion requires the member to be selected for this facility.');
            }
            if (! $validator->errors()->hasAny(['selected_at', 'fpe_completed_at'])
                && $this->boolean('selected')
                && $this->boolean('fpe_completed')) {
                $selectedAt = CarbonImmutable::parse((string) $this->input('selected_at'), 'Asia/Manila');
                $fpeCompletedAt = CarbonImmutable::parse((string) $this->input('fpe_completed_at'), 'Asia/Manila');
                if ($fpeCompletedAt->lessThan($selectedAt)) {
                    $validator->errors()->add('fpe_completed_at', 'FPE completion cannot precede facility selection.');
                }
            }

            $pin = $this->input('philhealth_pin');
            if (! $pin) {
                return;
            }
            $routeBeneficiary = $this->route('beneficiary');
            $beneficiaryId = $routeBeneficiary instanceof Beneficiary
                ? $routeBeneficiary->getKey()
                : (is_numeric($routeBeneficiary) ? (int) $routeBeneficiary : null);
            $existing = Beneficiary::withTrashed()
                ->where('philhealth_pin_hash', Beneficiary::hashPin($pin))
                ->when($beneficiaryId !== null, fn ($query) => $query->whereKeyNot($beneficiaryId))
                ->exists();
            if ($existing) {
                $validator->errors()->add('philhealth_pin', 'This PhilHealth PIN is already registered.');
            }
        }];
    }
}

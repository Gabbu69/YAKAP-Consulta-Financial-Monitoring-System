<?php

namespace App\Services;

use App\Enums\EncounterStatus;
use App\Enums\FacilityType;
use App\Models\BeneficiaryYear;
use App\Models\Copayment;
use App\Models\Encounter;
use App\Models\Facility;
use App\Models\PolicyVersion;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CopaymentService
{
    public function __construct(
        private ReferenceNumberService $references,
        private AuditLogger $audit,
    ) {}

    /** @param array<string, mixed> $data */
    public function create(Facility $facility, PolicyVersion $policy, array $data): Copayment
    {
        if ($facility->type === FacilityType::Public) {
            throw ValidationException::withMessages([
                'amount_centavos' => 'Co-payment collection is disabled for public facilities.',
            ]);
        }
        $paymentDate = CarbonImmutable::parse((string) $data['paid_at'], 'Asia/Manila')
            ->setTimezone('Asia/Manila');
        if ($paymentDate->year !== (int) $data['year']) {
            throw ValidationException::withMessages([
                'paid_at' => 'The co-payment date must be within the selected member year.',
            ]);
        }
        if ($policy->facility_id !== $facility->id || $policy->effective_year !== (int) $data['year']) {
            throw ValidationException::withMessages([
                'year' => 'The selected policy does not match this facility and member year.',
            ]);
        }
        $data['paid_at'] = $paymentDate->toDateString();

        return DB::transaction(function () use ($facility, $policy, $data): Copayment {
            $eligibility = BeneficiaryYear::query()
                ->where('facility_id', $facility->id)
                ->where('beneficiary_id', $data['beneficiary_id'])
                ->where('year', $data['year'])
                ->sap1ReadyAsOf((int) $data['year'], (string) $data['paid_at'])
                ->whereHas('beneficiary', fn ($query) => $query
                    ->whereNull('archived_at')
                    ->whereNull('deleted_at'))
                ->lockForUpdate()
                ->first();

            if ($eligibility === null) {
                throw ValidationException::withMessages([
                    'beneficiary_id' => 'Co-payments require active empanelment, completed FPE, PCU reference, and digital YES before collection.',
                ]);
            }

            if (($data['encounter_id'] ?? null) !== null) {
                $validEncounter = Encounter::query()
                    ->whereKey($data['encounter_id'])
                    ->where('facility_id', $facility->id)
                    ->where('beneficiary_id', $data['beneficiary_id'])
                    ->where('status', EncounterStatus::Posted->value)
                    ->whereDate('encounter_date', '<=', $data['paid_at'])
                    ->exists();
                if (! $validEncounter) {
                    throw ValidationException::withMessages([
                        'encounter_id' => 'The encounter must be a posted service record for this beneficiary and facility.',
                    ]);
                }
            }

            $used = Copayment::query()
                ->where('facility_id', $facility->id)
                ->where('beneficiary_id', $data['beneficiary_id'])
                ->where('year', $data['year'])
                ->whereNull('voided_at')
                ->lockForUpdate()
                ->sum('amount_centavos');

            if ($used + $data['amount_centavos'] > $policy->copayment_cap_centavos) {
                throw ValidationException::withMessages([
                    'amount_centavos' => 'This payment exceeds the configured member-year co-payment cap.',
                ]);
            }

            $copayment = Copayment::create([
                ...$data,
                'facility_id' => $facility->id,
                'reference' => $this->references->copayment((int) $data['year']),
            ]);
            $this->audit->log('copayment.created', "Recorded co-payment {$copayment->reference}", $copayment);

            return $copayment;
        });
    }
}

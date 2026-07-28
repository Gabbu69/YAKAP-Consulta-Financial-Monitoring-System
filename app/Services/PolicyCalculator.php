<?php

namespace App\Services;

use App\Enums\EncounterStatus;
use App\Enums\ServiceClassification;
use App\Models\BeneficiaryYear;
use App\Models\EncounterItem;
use App\Models\Facility;
use App\Models\PolicyVersion;
use Illuminate\Support\Collection;

class PolicyCalculator
{
    public function sap1Expected(int $eligibleBeneficiaries, PolicyVersion $policy): int
    {
        return (int) round(
            $eligibleBeneficiaries
            * $policy->per_capita_rate_centavos
            * $policy->sap1_percentage_bps / 10000,
        );
    }

    public function sap2Expected(
        int $validatedFpeBeneficiaries,
        PolicyVersion $policy,
        int $performanceFactorBps,
    ): int {
        return (int) round(
            $validatedFpeBeneficiaries
            * $policy->per_capita_rate_centavos
            * $policy->sap2_percentage_bps / 10000
            * $performanceFactorBps / 10000,
        );
    }

    /**
     * @return array{factor_bps:int, bars:list<array{key:string,label:string,actual:float,target:float,weight:float,score:float}>}
     */
    public function performance(Facility $facility, PolicyVersion $policy, int $year): array
    {
        $statuses = BeneficiaryYear::query()
            ->where('facility_id', $facility->id)
            ->where('year', $year)
            ->whereHas('beneficiary', fn ($query) => $query
                ->whereNull('archived_at')->whereNull('deleted_at'));

        $fpeBeneficiaryIds = (clone $statuses)
            ->sap2Eligible($year)
            ->pluck('beneficiary_id');
        $fpe = $fpeBeneficiaryIds->count();
        $denominator = max($fpe, 1);

        $uniqueByClassification = function (array $classifications) use ($facility, $fpeBeneficiaryIds, $year): int {
            if ($fpeBeneficiaryIds->isEmpty()) {
                return 0;
            }

            return EncounterItem::query()
                ->join('encounters', 'encounters.id', '=', 'encounter_items.encounter_id')
                ->whereIn('encounter_items.classification_snapshot', $classifications)
                ->where('encounters.facility_id', $facility->id)
                ->whereIn('encounters.beneficiary_id', $fpeBeneficiaryIds)
                ->where('encounters.status', EncounterStatus::Posted->value)
                ->whereYear('encounters.encounter_date', $year)
                ->distinct('encounters.beneficiary_id')
                ->count('encounters.beneficiary_id');
        };

        $actuals = [
            'consultation_utilization' => $uniqueByClassification([ServiceClassification::Consultation->value]) / $denominator,
            'laboratory_utilization' => $uniqueByClassification([ServiceClassification::Laboratory->value]) / $denominator,
            'antibiotic_access' => $uniqueByClassification([ServiceClassification::Antibiotic->value]) / $denominator,
            'ncd_medicine_access' => $uniqueByClassification([ServiceClassification::NcdMedicine->value]) / $denominator,
        ];

        $rules = collect($policy->performance_rules ?? []);
        $bars = $rules->map(function (array $rule) use ($actuals): array {
            $actual = (float) ($actuals[$rule['key']] ?? 0);
            $target = max((float) $rule['target'], 0.0001);
            $weight = (float) $rule['weight'];
            $score = min($actual / $target, 1) * $weight;

            return [
                'key' => (string) $rule['key'],
                'label' => (string) $rule['label'],
                'actual' => round($actual, 4),
                'target' => round($target, 4),
                'weight' => round($weight, 4),
                'score' => round($score, 4),
            ];
        })->values();

        return [
            'factor_bps' => min(10000, (int) round($bars->sum('score') * 10000)),
            'bars' => array_values($bars->all()),
        ];
    }

    public function withholding(int $approvedGrossCentavos, PolicyVersion $policy): int
    {
        return (int) round($approvedGrossCentavos * $policy->withholding_tax_bps / 10000);
    }

    /** @param Collection<int, int|float> $payments */
    public function outstanding(int $submittedOrApprovedNetCentavos, Collection $payments): int
    {
        return max(0, $submittedOrApprovedNetCentavos - (int) $payments->sum());
    }

    public function netPosition(int $payments, int $validCopayments, int $directServiceCosts): int
    {
        return $payments + $validCopayments - $directServiceCosts;
    }
}

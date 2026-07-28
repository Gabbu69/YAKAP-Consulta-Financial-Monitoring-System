<?php

namespace Tests\Support;

use App\Enums\BeneficiaryType;
use App\Enums\EncounterStatus;
use App\Enums\FacilityType;
use App\Enums\SapBatchStatus;
use App\Enums\ServiceClassification;
use App\Enums\UserRole;
use App\Models\Beneficiary;
use App\Models\BeneficiaryYear;
use App\Models\Encounter;
use App\Models\Facility;
use App\Models\PolicyVersion;
use App\Models\SapBatch;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Models\User;

final class YakapFixtures
{
    private static int $sequence = 100;

    public static function user(UserRole $role = UserRole::Administrator): User
    {
        $sequence = self::next();

        return User::factory()->create([
            'name' => "Test User {$sequence}",
            'email' => "user{$sequence}@yakap.test",
            'role' => $role,
        ]);
    }

    public static function facility(FacilityType $type = FacilityType::Public): Facility
    {
        $sequence = self::next();

        return Facility::query()->create([
            'name' => "Test Primary Care Facility {$sequence}",
            'facility_code' => "TEST-{$sequence}",
            'type' => $type,
            'city' => 'Test City',
            'province' => 'Test Province',
            'is_demo' => true,
        ]);
    }

    /** @param array<string, mixed> $overrides */
    public static function policy(
        Facility $facility,
        int $year = 2026,
        array $overrides = [],
    ): PolicyVersion {
        return PolicyVersion::query()->create([
            'facility_id' => $facility->id,
            'effective_year' => $year,
            'source_circular' => 'Test policy source',
            'source_url' => 'https://example.test/policy.pdf',
            'per_capita_rate_centavos' => 170_000,
            'sap1_percentage_bps' => 4_000,
            'sap2_percentage_bps' => 6_000,
            'withholding_tax_bps' => 0,
            'copayment_cap_centavos' => 90_000,
            'performance_rules' => [
                ['key' => 'consultation_utilization', 'label' => 'Consultation', 'target' => 1, 'weight' => 0.30],
                ['key' => 'laboratory_utilization', 'label' => 'Laboratory', 'target' => 0.50, 'weight' => 0.30],
                ['key' => 'antibiotic_access', 'label' => 'Antibiotic', 'target' => 0.15, 'weight' => 0.10],
                ['key' => 'ncd_medicine_access', 'label' => 'NCD medicine', 'target' => 0.20, 'weight' => 0.30],
            ],
            ...$overrides,
        ]);
    }

    /** @param array<string, mixed> $overrides */
    public static function beneficiary(Facility $facility, array $overrides = []): Beneficiary
    {
        $sequence = self::next();

        return Beneficiary::query()->create([
            'facility_id' => $facility->id,
            'reference' => sprintf('YKP-2026-%06d', $sequence),
            'philhealth_pin' => sprintf('99%010d', $sequence),
            'first_name' => 'Test',
            'last_name' => "Member {$sequence}",
            'birth_date' => '1988-05-12',
            'sex' => 'female',
            'beneficiary_type' => BeneficiaryType::Member,
            ...$overrides,
        ]);
    }

    /** @param array<string, mixed> $overrides */
    public static function readiness(
        Beneficiary $beneficiary,
        int $year = 2026,
        array $overrides = [],
    ): BeneficiaryYear {
        return BeneficiaryYear::query()->create([
            'beneficiary_id' => $beneficiary->id,
            'facility_id' => $beneficiary->facility_id,
            'year' => $year,
            'selected' => true,
            'selected_at' => "{$year}-01-02",
            'fpe_completed' => true,
            'fpe_completed_at' => "{$year}-01-03",
            'pcu_reference' => "PCU-{$year}-{$beneficiary->id}",
            'yes_confirmed' => true,
            'yes_confirmed_at' => "{$year}-01-04",
            ...$overrides,
        ]);
    }

    public static function service(
        ServiceClassification $classification = ServiceClassification::Consultation,
        int $costCentavos = 25_000,
    ): Service {
        $sequence = self::next();
        $category = ServiceCategory::query()->create([
            'name' => "{$classification->value} {$sequence}",
            'classification' => $classification,
            'is_active' => true,
        ]);

        return Service::query()->create([
            'service_category_id' => $category->id,
            'code' => "SVC-{$sequence}",
            'name' => "Test service {$sequence}",
            'unit' => 'service',
            'default_cost_centavos' => $costCentavos,
            'is_active' => true,
        ]);
    }

    public static function postedEncounter(
        Facility $facility,
        Beneficiary $beneficiary,
        string $date = '2026-03-10',
    ): Encounter {
        $sequence = self::next();

        return Encounter::query()->create([
            'facility_id' => $facility->id,
            'beneficiary_id' => $beneficiary->id,
            'reference' => sprintf('ENC-%d-%06d', (int) substr($date, 0, 4), $sequence),
            'encounter_date' => $date,
            'status' => EncounterStatus::Posted,
            'posted_at' => now(),
        ]);
    }

    /** @param array<string, mixed> $overrides */
    public static function batch(
        Facility $facility,
        PolicyVersion $policy,
        array $overrides = [],
    ): SapBatch {
        $sequence = self::next();

        return SapBatch::query()->create([
            'facility_id' => $facility->id,
            'policy_version_id' => $policy->id,
            'reference' => sprintf('SAP1-%d01-%04d', $policy->effective_year, $sequence),
            'tranche' => 1,
            'year' => $policy->effective_year,
            'month' => 1,
            'status' => SapBatchStatus::Draft,
            'eligible_beneficiary_count' => 1,
            'performance_factor_bps' => 10_000,
            'expected_gross_centavos' => 68_000,
            'submitted_gross_centavos' => 0,
            'approved_gross_centavos' => 0,
            'withholding_tax_centavos' => 0,
            'approved_net_centavos' => 0,
            ...$overrides,
        ]);
    }

    private static function next(): int
    {
        return ++self::$sequence;
    }
}

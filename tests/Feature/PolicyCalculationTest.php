<?php

use App\Enums\ServiceClassification;
use App\Enums\UserRole;
use App\Services\PolicyCalculator;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Tests\Support\YakapFixtures;

it('calculates SAP1 and SAP2 from the versioned policy in centavos', function () {
    $facility = YakapFixtures::facility();
    $policy = YakapFixtures::policy($facility);
    $calculator = app(PolicyCalculator::class);

    expect($calculator->sap1Expected(10, $policy))->toBe(680_000)
        ->and($calculator->sap2Expected(10, $policy, 8_000))->toBe(816_000);
});

it('caps each performance indicator at its weighted target contribution', function () {
    $facility = YakapFixtures::facility();
    $policy = YakapFixtures::policy($facility, overrides: [
        'performance_rules' => [
            ['key' => 'consultation_utilization', 'label' => 'Consultation', 'target' => 0.5, 'weight' => 1.0],
        ],
    ]);

    $served = YakapFixtures::beneficiary($facility);
    YakapFixtures::readiness($served);
    YakapFixtures::readiness(YakapFixtures::beneficiary($facility));
    $service = YakapFixtures::service(ServiceClassification::Consultation);
    $encounter = YakapFixtures::postedEncounter($facility, $served);
    $encounter->items()->create([
        'service_id' => $service->id,
        'service_code_snapshot' => $service->code,
        'service_name_snapshot' => $service->name,
        'classification_snapshot' => ServiceClassification::Consultation->value,
        'unit_snapshot' => $service->unit,
        'unit_cost_centavos' => 25_000,
        'quantity' => 1,
        'total_cost_centavos' => 25_000,
        'is_repeat_laboratory' => false,
    ]);

    $performance = app(PolicyCalculator::class)->performance($facility, $policy, 2026);

    expect($performance['factor_bps'])->toBe(10_000)
        ->and($performance['bars'][0]['score'])->toBe(1.0);
});

it('uses unique members rather than encounter rows for utilization denominators', function () {
    $facility = YakapFixtures::facility();
    $policy = YakapFixtures::policy($facility, overrides: [
        'performance_rules' => [
            ['key' => 'consultation_utilization', 'label' => 'Consultation', 'target' => 1, 'weight' => 1],
        ],
    ]);
    $first = YakapFixtures::beneficiary($facility);
    $second = YakapFixtures::beneficiary($facility);
    YakapFixtures::readiness($first);
    YakapFixtures::readiness($second);
    $service = YakapFixtures::service(ServiceClassification::Consultation);

    foreach (['2026-02-01', '2026-03-01'] as $date) {
        $encounter = YakapFixtures::postedEncounter($facility, $first, $date);
        $encounter->items()->create([
            'service_id' => $service->id,
            'service_code_snapshot' => $service->code,
            'service_name_snapshot' => $service->name,
            'classification_snapshot' => ServiceClassification::Consultation->value,
            'unit_snapshot' => $service->unit,
            'unit_cost_centavos' => 25_000,
            'quantity' => 1,
            'total_cost_centavos' => 25_000,
            'is_repeat_laboratory' => false,
        ]);
    }

    $performance = app(PolicyCalculator::class)->performance($facility, $policy, 2026);

    expect($performance['bars'][0]['actual'])->toBe(0.5)
        ->and($performance['factor_bps'])->toBe(5_000);
});

it('limits utilization numerators to the active FPE-complete cohort', function () {
    $facility = YakapFixtures::facility();
    $policy = YakapFixtures::policy($facility, overrides: [
        'performance_rules' => [
            ['key' => 'consultation_utilization', 'label' => 'Consultation', 'target' => 1, 'weight' => 1],
        ],
    ]);
    $eligible = YakapFixtures::beneficiary($facility);
    $notFpeComplete = YakapFixtures::beneficiary($facility);
    $archived = YakapFixtures::beneficiary($facility);
    YakapFixtures::readiness($eligible);
    YakapFixtures::readiness($notFpeComplete, overrides: [
        'fpe_completed' => false,
        'fpe_completed_at' => null,
    ]);
    YakapFixtures::readiness($archived);
    $archived->update(['archived_at' => now()]);
    $archived->delete();
    $service = YakapFixtures::service(ServiceClassification::Consultation);

    foreach ([$notFpeComplete, $archived] as $outsideCohort) {
        $encounter = YakapFixtures::postedEncounter($facility, $outsideCohort);
        $encounter->items()->create([
            'service_id' => $service->id,
            'service_code_snapshot' => $service->code,
            'service_name_snapshot' => $service->name,
            'classification_snapshot' => ServiceClassification::Consultation->value,
            'unit_snapshot' => $service->unit,
            'unit_cost_centavos' => 25_000,
            'quantity' => 1,
            'total_cost_centavos' => 25_000,
            'is_repeat_laboratory' => false,
        ]);
    }

    $performance = app(PolicyCalculator::class)->performance($facility, $policy, 2026);

    expect($performance['bars'][0]['actual'])->toBe(0.0)
        ->and($performance['factor_bps'])->toBe(0);
});

it('calculates outstanding receivables and net position from valid financial flows', function () {
    $calculator = app(PolicyCalculator::class);

    expect($calculator->outstanding(100_000, new Collection([25_000, 15_000])))->toBe(60_000)
        ->and($calculator->netPosition(90_000, 5_000, 60_000))->toBe(35_000);
});

it('prevents changes to a locked or referenced policy version', function () {
    $facility = YakapFixtures::facility();
    $policy = YakapFixtures::policy($facility);
    YakapFixtures::batch($facility, $policy);

    expect(fn () => $policy->update(['per_capita_rate_centavos' => 200_000]))
        ->toThrow(ValidationException::class);
});

it('accepts exactly the four source-backed performance indicators in policy forms', function () {
    $facility = YakapFixtures::facility();
    $administrator = YakapFixtures::user(UserRole::Administrator);
    $data = [
        'effective_year' => 2027,
        'source_circular' => 'Source-backed policy',
        'source_url' => 'https://example.com/policy.pdf',
        'per_capita_rate_centavos' => 170_000,
        'sap1_percentage_bps' => 4_000,
        'sap2_percentage_bps' => 6_000,
        'withholding_tax_bps' => 0,
        'copayment_cap_centavos' => 90_000,
        'performance_rules' => [
            ['key' => 'consultation_utilization', 'label' => 'Consultation', 'target' => 1, 'weight' => 0.30],
            ['key' => 'laboratory_utilization', 'label' => 'Laboratory', 'target' => 0.50, 'weight' => 0.30],
            ['key' => 'antibiotic_access', 'label' => 'Antibiotic', 'target' => 0.15, 'weight' => 0.10],
            ['key' => 'fpe_completion', 'label' => 'FPE', 'target' => 1, 'weight' => 0.30],
        ],
    ];

    $this->actingAs($administrator)
        ->post(route('policies.store'), $data)
        ->assertSessionHasErrors('performance_rules.3.key');

    $data['performance_rules'][3] = [
        'key' => 'ncd_medicine_access',
        'label' => 'NCD medicine',
        'target' => 0.20,
        'weight' => 0.30,
    ];

    $this->actingAs($administrator)
        ->post(route('policies.store'), $data)
        ->assertSessionHasNoErrors();

    $this->assertDatabaseHas('policy_versions', [
        'facility_id' => $facility->id,
        'effective_year' => 2027,
    ]);
});

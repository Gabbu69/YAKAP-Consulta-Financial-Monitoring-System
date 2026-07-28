<?php

use App\Enums\SapBatchStatus;
use App\Services\SapBatchService;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;
use Tests\Support\YakapFixtures;

it('freezes the eligible beneficiary membership readiness and allocation snapshot', function () {
    $facility = YakapFixtures::facility();
    $policy = YakapFixtures::policy($facility);
    $first = YakapFixtures::beneficiary($facility, ['first_name' => 'Original']);
    $second = YakapFixtures::beneficiary($facility);
    $excluded = YakapFixtures::beneficiary($facility);
    YakapFixtures::readiness($first);
    YakapFixtures::readiness($second);
    YakapFixtures::readiness($excluded, overrides: ['yes_confirmed' => false]);
    $creator = YakapFixtures::user();

    $batch = app(SapBatchService::class)->create([
        'facility_id' => $facility->id,
        'policy_version_id' => $policy->id,
        'tranche' => 1,
        'year' => 2026,
        'month' => 7,
        'user_id' => $creator->id,
    ]);

    $firstSnapshot = $batch->beneficiaries
        ->firstWhere('beneficiary_id', $first->id);
    $first->update(['first_name' => 'Changed']);
    $first->yearlyStatuses()->where('year', 2026)->update(['yes_confirmed' => false]);

    expect($batch->eligible_beneficiary_count)->toBe(2)
        ->and($batch->expected_gross_centavos)->toBe(136_000)
        ->and($batch->beneficiaries)->toHaveCount(2)
        ->and($batch->beneficiaries->sum('allocated_amount_centavos'))->toBe(136_000)
        ->and($firstSnapshot->beneficiary_name_snapshot)->toContain('Original')
        ->and($firstSnapshot->readiness_snapshot['yes_confirmed'])->toBeTrue()
        ->and($batch->created_by)->toBe($creator->id)
        ->and($policy->fresh()->locked_at)->not->toBeNull();
});

it('allows only one active SAP1 batch per reporting month', function () {
    $facility = YakapFixtures::facility();
    $policy = YakapFixtures::policy($facility);
    $first = YakapFixtures::beneficiary($facility);
    YakapFixtures::readiness($first);
    $service = app(SapBatchService::class);
    $base = [
        'facility_id' => $facility->id,
        'policy_version_id' => $policy->id,
        'tranche' => 1,
        'year' => 2026,
        'user_id' => YakapFixtures::user()->id,
    ];

    $service->create([...$base, 'month' => 1]);
    $second = YakapFixtures::beneficiary($facility);
    YakapFixtures::readiness($second);

    expect(fn () => $service->create([...$base, 'month' => 1]))
        ->toThrow(ValidationException::class);

    $nextMonth = $service->create([...$base, 'month' => 2]);
    expect($nextMonth->beneficiaries)->toHaveCount(1)
        ->and($nextMonth->beneficiaries->first()->beneficiary_id)->toBe($second->id);
});

it('prevents future SAP1 periods and excludes readiness completed after the reporting cutoff', function () {
    $this->travelTo(CarbonImmutable::parse('2026-07-28 12:00:00', 'Asia/Manila'));
    $facility = YakapFixtures::facility();
    $policy = YakapFixtures::policy($facility);
    $lateMember = YakapFixtures::beneficiary($facility);
    YakapFixtures::readiness($lateMember, overrides: [
        'selected_at' => '2026-08-01',
        'fpe_completed_at' => '2026-08-02',
        'yes_confirmed_at' => '2026-08-03',
    ]);
    $service = app(SapBatchService::class);
    $base = [
        'facility_id' => $facility->id,
        'policy_version_id' => $policy->id,
        'tranche' => 1,
        'year' => 2026,
        'user_id' => YakapFixtures::user()->id,
    ];

    expect(fn () => $service->create([...$base, 'month' => 12]))
        ->toThrow(ValidationException::class)
        ->and(fn () => $service->create([...$base, 'month' => 7]))
        ->toThrow(ValidationException::class);
    $this->travelBack();
});

it('freezes SAP2 once at the December annual close and permits a cancelled replacement', function () {
    $this->travelTo(CarbonImmutable::parse('2026-07-28 12:00:00', 'Asia/Manila'));
    $facility = YakapFixtures::facility();
    $currentPolicy = YakapFixtures::policy($facility);
    $currentMember = YakapFixtures::beneficiary($facility);
    YakapFixtures::readiness($currentMember);
    $service = app(SapBatchService::class);
    $creator = YakapFixtures::user();

    expect(fn () => $service->create([
        'facility_id' => $facility->id,
        'policy_version_id' => $currentPolicy->id,
        'tranche' => 2,
        'year' => 2026,
        'month' => 12,
        'user_id' => $creator->id,
    ]))->toThrow(ValidationException::class);

    $policy = YakapFixtures::policy($facility, 2025);
    $first = YakapFixtures::beneficiary($facility);
    $second = YakapFixtures::beneficiary($facility);
    $notRegistered = YakapFixtures::beneficiary($facility);
    $outOfYearFpe = YakapFixtures::beneficiary($facility);
    YakapFixtures::readiness($first, 2025);
    YakapFixtures::readiness($second, 2025);
    YakapFixtures::readiness($notRegistered, 2025, overrides: [
        'selected' => false,
        'selected_at' => null,
    ]);
    YakapFixtures::readiness($outOfYearFpe, 2025, overrides: [
        'selected_at' => '2026-01-02',
        'fpe_completed_at' => '2026-01-03',
    ]);
    $base = [
        'facility_id' => $facility->id,
        'policy_version_id' => $policy->id,
        'tranche' => 2,
        'year' => 2025,
        'user_id' => $creator->id,
    ];

    expect(fn () => $service->create([...$base, 'month' => 11]))
        ->toThrow(ValidationException::class);

    $annual = $service->create([...$base, 'month' => 12]);
    $third = YakapFixtures::beneficiary($facility);
    YakapFixtures::readiness($third, 2025);

    expect($annual->beneficiaries)->toHaveCount(2)
        ->and(fn () => $service->create([...$base, 'month' => 12]))
        ->toThrow(ValidationException::class);

    $annual->update(['status' => SapBatchStatus::Cancelled]);
    $replacement = $service->create([...$base, 'month' => 12]);

    expect($replacement->beneficiaries)->toHaveCount(3);
    $this->travelBack();
});

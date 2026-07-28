<?php

use App\Enums\FacilityType;
use App\Enums\SapBatchStatus;
use App\Models\Payment;
use App\Services\CopaymentService;
use App\Services\SapBatchService;
use Illuminate\Validation\ValidationException;
use Tests\Support\YakapFixtures;

it('disables co-payment entry for public facilities', function () {
    $facility = YakapFixtures::facility(FacilityType::Public);
    $policy = YakapFixtures::policy($facility);
    $beneficiary = YakapFixtures::beneficiary($facility);

    expect(fn () => app(CopaymentService::class)->create($facility, $policy, [
        'beneficiary_id' => $beneficiary->id,
        'encounter_id' => null,
        'year' => 2026,
        'amount_centavos' => 10_000,
        'paid_at' => '2026-03-01',
        'created_by' => null,
    ]))->toThrow(ValidationException::class);
});

it('enforces the configured private member-year co-payment cap', function () {
    $facility = YakapFixtures::facility(FacilityType::Private);
    $policy = YakapFixtures::policy($facility, overrides: ['copayment_cap_centavos' => 90_000]);
    $beneficiary = YakapFixtures::beneficiary($facility);
    YakapFixtures::readiness($beneficiary);
    $service = app(CopaymentService::class);
    $base = [
        'beneficiary_id' => $beneficiary->id,
        'encounter_id' => null,
        'year' => 2026,
        'paid_at' => '2026-03-01',
        'created_by' => null,
    ];

    $service->create($facility, $policy, [...$base, 'amount_centavos' => 50_000]);
    $service->create($facility, $policy, [...$base, 'amount_centavos' => 40_000]);

    expect(fn () => $service->create($facility, $policy, [
        ...$base,
        'amount_centavos' => 1,
    ]))->toThrow(ValidationException::class);
});

it('requires an active selected member with completed FPE before collecting a private co-payment', function () {
    $facility = YakapFixtures::facility(FacilityType::Private);
    $policy = YakapFixtures::policy($facility);
    $beneficiary = YakapFixtures::beneficiary($facility);
    $service = app(CopaymentService::class);
    $data = [
        'beneficiary_id' => $beneficiary->id,
        'encounter_id' => null,
        'year' => 2026,
        'amount_centavos' => 10_000,
        'paid_at' => '2026-03-01',
        'created_by' => null,
    ];

    expect(fn () => $service->create($facility, $policy, $data))
        ->toThrow(ValidationException::class);

    $readiness = YakapFixtures::readiness($beneficiary, overrides: [
        'selected' => false,
        'selected_at' => null,
    ]);

    expect(fn () => $service->create($facility, $policy, $data))
        ->toThrow(ValidationException::class);

    $readiness->update(['selected' => true, 'selected_at' => '2026-01-02']);
    $copayment = $service->create($facility, $policy, $data);

    expect($copayment->beneficiary_id)->toBe($beneficiary->id)
        ->and($copayment->amount_centavos)->toBe(10_000);
});

it('requires complete empanelment before collection and validates any linked encounter', function () {
    $facility = YakapFixtures::facility(FacilityType::Private);
    $policy = YakapFixtures::policy($facility);
    $beneficiary = YakapFixtures::beneficiary($facility);
    $readiness = YakapFixtures::readiness($beneficiary, overrides: [
        'pcu_reference' => null,
        'yes_confirmed' => false,
        'yes_confirmed_at' => null,
    ]);
    $service = app(CopaymentService::class);
    $data = [
        'beneficiary_id' => $beneficiary->id,
        'encounter_id' => null,
        'year' => 2026,
        'amount_centavos' => 10_000,
        'paid_at' => '2026-03-01',
        'created_by' => null,
    ];

    expect(fn () => $service->create($facility, $policy, $data))
        ->toThrow(ValidationException::class);

    $readiness->update([
        'pcu_reference' => 'PCU-2026-COPAY',
        'yes_confirmed' => true,
        'yes_confirmed_at' => '2026-04-01',
    ]);
    expect(fn () => $service->create($facility, $policy, $data))
        ->toThrow(ValidationException::class);

    $readiness->update(['yes_confirmed_at' => '2026-02-01']);
    $otherMember = YakapFixtures::beneficiary($facility);
    $otherEncounter = YakapFixtures::postedEncounter($facility, $otherMember);

    expect(fn () => $service->create($facility, $policy, [
        ...$data,
        'encounter_id' => $otherEncounter->id,
    ]))->toThrow(ValidationException::class);

    $copayment = $service->create($facility, $policy, $data);
    expect($copayment->beneficiary_id)->toBe($beneficiary->id);
});

it('moves approved batches through partial and full payment reconciliation', function () {
    $facility = YakapFixtures::facility();
    $policy = YakapFixtures::policy($facility);
    $batch = YakapFixtures::batch($facility, $policy, [
        'status' => SapBatchStatus::Approved,
        'submitted_gross_centavos' => 100_000,
        'approved_gross_centavos' => 100_000,
        'approved_net_centavos' => 100_000,
    ]);
    $reconciliation = app(SapBatchService::class);

    Payment::query()->create([
        'sap_batch_id' => $batch->id,
        'reference' => 'PAY-2026-000001',
        'amount_centavos' => 40_000,
        'paid_at' => '2026-03-01',
    ]);
    $reconciliation->reconcilePaymentStatus($batch);
    expect($batch->fresh()->status)->toBe(SapBatchStatus::PartiallyPaid)
        ->and($batch->fresh()->outstanding_centavos)->toBe(60_000);

    Payment::query()->create([
        'sap_batch_id' => $batch->id,
        'reference' => 'PAY-2026-000002',
        'amount_centavos' => 60_000,
        'paid_at' => '2026-03-10',
    ]);
    $reconciliation->reconcilePaymentStatus($batch);
    expect($batch->fresh()->status)->toBe(SapBatchStatus::Paid)
        ->and($batch->fresh()->outstanding_centavos)->toBe(0);
});

it('ignores voided payments during reconciliation', function () {
    $facility = YakapFixtures::facility();
    $policy = YakapFixtures::policy($facility);
    $batch = YakapFixtures::batch($facility, $policy, [
        'status' => SapBatchStatus::Approved,
        'approved_net_centavos' => 80_000,
    ]);
    Payment::query()->create([
        'sap_batch_id' => $batch->id,
        'reference' => 'PAY-2026-000003',
        'amount_centavos' => 80_000,
        'paid_at' => '2026-03-01',
        'voided_at' => now(),
        'void_reason' => 'Reversed',
    ]);

    app(SapBatchService::class)->reconcilePaymentStatus($batch);

    expect($batch->fresh()->status)->toBe(SapBatchStatus::Approved)
        ->and($batch->fresh()->outstanding_centavos)->toBe(80_000);
});

<?php

use App\Enums\EncounterStatus;
use App\Enums\ServiceClassification;
use App\Services\EncounterService;
use Illuminate\Validation\ValidationException;
use Tests\Support\YakapFixtures;

it('uses snapshotted service names classifications and costs for encounter totals', function () {
    $facility = YakapFixtures::facility();
    $user = YakapFixtures::user();
    $beneficiary = YakapFixtures::beneficiary($facility);
    $service = YakapFixtures::service(ServiceClassification::Laboratory, 12_500);

    $encounter = app(EncounterService::class)->create([
        'facility_id' => $facility->id,
        'beneficiary_id' => $beneficiary->id,
        'encounter_date' => '2026-04-12',
        'post_now' => true,
        'user_id' => $user->id,
        'items' => [[
            'service_id' => $service->id,
            'quantity' => 2,
            'is_repeat_laboratory' => false,
        ]],
    ]);
    $service->update(['name' => 'Changed later', 'default_cost_centavos' => 99_999]);
    $item = $encounter->items->first();

    expect($encounter->status)->toBe(EncounterStatus::Posted)
        ->and($encounter->total_cost_centavos)->toBe(25_000)
        ->and($item->service_name_snapshot)->not->toBe('Changed later')
        ->and($item->classification_snapshot)->toBe(ServiceClassification::Laboratory->value)
        ->and($item->unit_cost_centavos)->toBe(12_500);
});

it('requires an earlier posted matching laboratory service for a repeat test', function () {
    $facility = YakapFixtures::facility();
    $user = YakapFixtures::user();
    $beneficiary = YakapFixtures::beneficiary($facility);
    $service = YakapFixtures::service(ServiceClassification::Laboratory);
    $encounters = app(EncounterService::class);
    $repeatData = [
        'facility_id' => $facility->id,
        'beneficiary_id' => $beneficiary->id,
        'encounter_date' => '2026-05-20',
        'post_now' => true,
        'user_id' => $user->id,
        'items' => [[
            'service_id' => $service->id,
            'quantity' => 1,
            'is_repeat_laboratory' => true,
        ]],
    ];

    expect(fn () => $encounters->create($repeatData))->toThrow(ValidationException::class);

    $encounters->create([
        ...$repeatData,
        'encounter_date' => '2026-04-20',
        'items' => [[
            'service_id' => $service->id,
            'quantity' => 1,
            'is_repeat_laboratory' => false,
        ]],
    ]);

    expect($encounters->create($repeatData)->items->first()->is_repeat_laboratory)->toBeTrue();
});

it('voids a posted encounter while preserving its lines and audit history', function () {
    $facility = YakapFixtures::facility();
    $user = YakapFixtures::user();
    $beneficiary = YakapFixtures::beneficiary($facility);
    $service = YakapFixtures::service();
    $encounters = app(EncounterService::class);
    $encounter = $encounters->create([
        'facility_id' => $facility->id,
        'beneficiary_id' => $beneficiary->id,
        'encounter_date' => '2026-04-20',
        'post_now' => true,
        'user_id' => $user->id,
        'items' => [['service_id' => $service->id, 'quantity' => 1]],
    ]);

    $encounters->void($encounter, 'Duplicate entry');

    expect($encounter->fresh()->status)->toBe(EncounterStatus::Void)
        ->and($encounter->items()->count())->toBe(1)
        ->and($encounter->exists())->toBeTrue();

    $this->assertDatabaseHas('audit_logs', [
        'auditable_type' => $encounter->getMorphClass(),
        'auditable_id' => $encounter->id,
        'event' => 'encounter.voided',
    ]);
});

it('reloads and locks encounter state before posting a stale draft', function () {
    $facility = YakapFixtures::facility();
    $user = YakapFixtures::user();
    $beneficiary = YakapFixtures::beneficiary($facility);
    $catalogService = YakapFixtures::service();
    $service = app(EncounterService::class);
    $encounter = $service->create([
        'facility_id' => $facility->id,
        'beneficiary_id' => $beneficiary->id,
        'encounter_date' => '2026-04-20',
        'post_now' => false,
        'user_id' => $user->id,
        'items' => [['service_id' => $catalogService->id, 'quantity' => 1]],
    ]);
    $staleDraft = $encounter->fresh();
    $service->void($encounter, 'Entered against the wrong member');

    expect(fn () => $service->post($staleDraft))
        ->toThrow(ValidationException::class)
        ->and($encounter->fresh()->status)->toBe(EncounterStatus::Void)
        ->and($encounter->fresh()->posted_at)->toBeNull();
});

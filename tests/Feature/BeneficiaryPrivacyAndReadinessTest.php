<?php

use App\Enums\UserRole;
use App\Models\Beneficiary;
use App\Models\BeneficiaryYear;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\YakapFixtures;

it('encrypts the PhilHealth PIN, masks it, and stores only a uniqueness hash', function () {
    $facility = YakapFixtures::facility();
    $beneficiary = YakapFixtures::beneficiary($facility, [
        'philhealth_pin' => '12-345678901-2',
    ]);
    $stored = DB::table('beneficiaries')->find($beneficiary->id);

    expect($stored->philhealth_pin)
        ->not->toBe('123456789012')
        ->and($stored->philhealth_pin_hash)->toHaveLength(64)
        ->and($beneficiary->masked_philhealth_pin)->toEndWith('9012')
        ->and($beneficiary->toArray())->not->toHaveKeys(['philhealth_pin', 'philhealth_pin_hash']);
});

it('enforces uniqueness using the normalized PIN hash', function () {
    $facility = YakapFixtures::facility();
    YakapFixtures::beneficiary($facility, ['philhealth_pin' => '12-345678901-2']);

    expect(fn () => YakapFixtures::beneficiary($facility, [
        'philhealth_pin' => '1234 567 890 12',
    ]))->toThrow(QueryException::class);
});

it('finds an exact PIN through its hash while returning only the masked identifier', function () {
    $this->withoutVite();
    $facility = YakapFixtures::facility();
    $beneficiary = YakapFixtures::beneficiary($facility, [
        'philhealth_pin' => '123456789012',
    ]);
    $user = YakapFixtures::user(UserRole::Auditor);

    $this->actingAs($user)
        ->get(route('beneficiaries.index', ['search' => '123456789012', 'year' => 2026]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('beneficiaries.data', 1)
            ->where('beneficiaries.data.0.id', $beneficiary->id)
            ->where('beneficiaries.data.0.masked_philhealth_pin', '********9012')
            ->missing('beneficiaries.data.0.philhealth_pin')
            ->missing('beneficiaries.data.0.philhealth_pin_hash'));
});

it('requires selection FPE PCU and digital YES independently for SAP1 readiness', function () {
    $facility = YakapFixtures::facility();
    $ready = YakapFixtures::readiness(YakapFixtures::beneficiary($facility));
    $missingPcu = YakapFixtures::readiness(
        YakapFixtures::beneficiary($facility),
        overrides: ['pcu_reference' => null],
    );
    $missingYes = YakapFixtures::readiness(
        YakapFixtures::beneficiary($facility),
        overrides: ['yes_confirmed' => false, 'yes_confirmed_at' => null],
    );

    expect($ready->sap1_ready)->toBeTrue()
        ->and($missingPcu->sap1_ready)->toBeFalse()
        ->and($missingYes->sap1_ready)->toBeFalse()
        ->and(BeneficiaryYear::query()->sap1Ready()->pluck('id')->all())
        ->toBe([$ready->id]);
});

it('rejects future, out-of-year, and contradictory readiness dates', function () {
    $this->travelTo(CarbonImmutable::parse('2026-07-28 12:00:00', 'Asia/Manila'));
    YakapFixtures::facility();
    $encoder = YakapFixtures::user(UserRole::Encoder);
    $base = [
        'philhealth_pin' => '123456789012',
        'first_name' => 'Date',
        'last_name' => 'Check',
        'birth_date' => '1990-01-01',
        'sex' => 'female',
        'beneficiary_type' => 'member',
        'year' => 2026,
        'selected' => true,
        'selected_at' => '2026-08-01',
        'fpe_completed' => true,
        'fpe_completed_at' => '2026-08-02',
        'pcu_reference' => 'PCU-DATE-CHECK',
        'yes_confirmed' => true,
        'yes_confirmed_at' => '2026-08-03',
    ];

    $this->actingAs($encoder)
        ->post(route('beneficiaries.store'), $base)
        ->assertSessionHasErrors(['selected_at', 'fpe_completed_at', 'yes_confirmed_at']);

    $this->actingAs($encoder)
        ->post(route('beneficiaries.store'), [
            ...$base,
            'philhealth_pin' => '123456789013',
            'selected' => false,
            'selected_at' => null,
            'fpe_completed_at' => '2026-07-01',
            'yes_confirmed' => false,
            'yes_confirmed_at' => null,
        ])->assertSessionHasErrors('fpe_completed');

    $this->assertDatabaseCount('beneficiaries', 0);
    $this->travelBack();
});

it('archives beneficiaries without hard deleting their financial history', function () {
    $facility = YakapFixtures::facility();
    $beneficiary = YakapFixtures::beneficiary($facility);
    $beneficiary->update(['archived_at' => now()]);

    expect(Beneficiary::query()->active()->count())->toBe(0)
        ->and(Beneficiary::query()->find($beneficiary->id))->not->toBeNull();
});

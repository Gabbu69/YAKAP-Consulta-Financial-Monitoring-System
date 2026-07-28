<?php

use App\Enums\FacilityType;
use App\Enums\SapBatchStatus;
use App\Enums\UserRole;
use App\Models\Copayment;
use App\Models\Payment;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\YakapFixtures;

it('summarizes every SAP batch matching the filters instead of only the current page', function () {
    $facility = YakapFixtures::facility();
    $policy = YakapFixtures::policy($facility);
    $user = YakapFixtures::user(UserRole::FinanceOfficer);

    foreach (range(1, 16) as $index) {
        $batch = YakapFixtures::batch($facility, $policy, [
            'month' => (($index - 1) % 12) + 1,
            'status' => SapBatchStatus::Approved,
            'expected_gross_centavos' => 10_000,
            'submitted_gross_centavos' => 9_000,
            'approved_gross_centavos' => 8_000,
            'approved_net_centavos' => 8_000,
        ]);
        Payment::query()->create([
            'sap_batch_id' => $batch->id,
            'reference' => "PAY-2026-SUMMARY-{$batch->id}",
            'amount_centavos' => 1_000,
            'paid_at' => '2026-07-01',
        ]);
    }

    YakapFixtures::batch($facility, $policy, [
        'status' => SapBatchStatus::Draft,
        'expected_gross_centavos' => 999_999,
    ]);

    $this->actingAs($user)
        ->get(route('finance.sap-batches.index', [
            'year' => 2026,
            'status' => SapBatchStatus::Approved->value,
            'tranche' => 1,
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('finance/sap-batches/index')
            ->has('batches.data', 15)
            ->where('summary.expected', 160_000)
            ->where('summary.submitted', 144_000)
            ->where('summary.paid', 16_000)
            ->where('summary.outstanding', 112_000));
});

it('infers a requested payment batch year and exposes only a safe selection', function () {
    $facility = YakapFixtures::facility();
    $currentPolicy = YakapFixtures::policy($facility);
    $priorPolicy = YakapFixtures::policy($facility, 2025);
    $user = YakapFixtures::user(UserRole::FinanceOfficer);
    $currentBatch = YakapFixtures::batch($facility, $currentPolicy, [
        'status' => SapBatchStatus::Approved,
        'approved_net_centavos' => 80_000,
    ]);
    $priorBatch = YakapFixtures::batch($facility, $priorPolicy, [
        'status' => SapBatchStatus::Approved,
        'approved_net_centavos' => 70_000,
    ]);

    $this->actingAs($user)
        ->get(route('finance.payments.index', ['batch_id' => $priorBatch->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('finance/payments/index')
            ->where('filters.year', 2025)
            ->where('selectedBatchId', $priorBatch->id)
            ->where('batchSelectionRequested', true)
            ->has('batches', 1)
            ->where('batches.0.id', $priorBatch->id));

    $this->actingAs($user)
        ->get(route('finance.payments.index', [
            'batch_id' => $priorBatch->id,
            'year' => 2026,
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('finance/payments/index')
            ->where('filters.year', 2026)
            ->where('selectedBatchId', null)
            ->where('batchSelectionRequested', true)
            ->has('batches', 1)
            ->where('batches.0.id', $currentBatch->id));
});

it('offers only co-payment eligible members while retaining archived history identity', function () {
    $facility = YakapFixtures::facility(FacilityType::Private);
    YakapFixtures::policy($facility);
    $user = YakapFixtures::user(UserRole::FinanceOfficer);
    $eligible = YakapFixtures::beneficiary($facility);
    $notSelected = YakapFixtures::beneficiary($facility);
    $missingDigitalYes = YakapFixtures::beneficiary($facility);
    $archived = YakapFixtures::beneficiary($facility);
    YakapFixtures::readiness($eligible);
    YakapFixtures::readiness($notSelected, overrides: ['selected' => false]);
    YakapFixtures::readiness($missingDigitalYes, overrides: ['yes_confirmed' => false]);
    YakapFixtures::readiness($archived);
    $eligibleEncounter = YakapFixtures::postedEncounter($facility, $eligible);
    YakapFixtures::postedEncounter($facility, $eligible)->update(['status' => 'draft', 'posted_at' => null]);
    YakapFixtures::postedEncounter($facility, $eligible)->update(['status' => 'void']);
    YakapFixtures::postedEncounter($facility, $notSelected);
    YakapFixtures::postedEncounter($facility, $missingDigitalYes);
    Copayment::query()->create([
        'facility_id' => $facility->id,
        'beneficiary_id' => $archived->id,
        'reference' => 'COP-2026-HISTORY',
        'year' => 2026,
        'amount_centavos' => 25_000,
        'paid_at' => '2026-06-01',
    ]);
    $archived->update(['archived_at' => now()]);
    $archived->delete();

    $this->actingAs($user)
        ->get(route('finance.copayments.index', ['year' => 2026]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('finance/copayments/index')
            ->has('beneficiaries', 1)
            ->where('beneficiaries.0.id', $eligible->id)
            ->has('encounters', 1)
            ->where('encounters.0.id', $eligibleEncounter->id)
            ->has('copayments.data', 1)
            ->where('copayments.data.0.beneficiary.id', $archived->id));
});

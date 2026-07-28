<?php

use App\Enums\FacilityType;
use App\Enums\SapBatchStatus;
use App\Enums\UserRole;
use App\Models\Copayment;
use App\Models\Payment;
use App\Models\SapBatch;
use App\Services\CopaymentService;
use App\Services\DashboardService;
use App\Services\ReportService;
use App\Services\SapBatchService;
use Illuminate\Validation\ValidationException;
use Tests\Support\YakapFixtures;

it('reserves beneficiary membership across non-cancelled batches for the same year and tranche', function () {
    $facility = YakapFixtures::facility();
    $policy = YakapFixtures::policy($facility);
    $user = YakapFixtures::user();
    $first = YakapFixtures::beneficiary($facility);
    $second = YakapFixtures::beneficiary($facility);
    YakapFixtures::readiness($first);
    YakapFixtures::readiness($second);
    $service = app(SapBatchService::class);
    $base = [
        'facility_id' => $facility->id,
        'policy_version_id' => $policy->id,
        'tranche' => 1,
        'year' => 2026,
        'user_id' => $user->id,
    ];

    $firstBatch = $service->create([...$base, 'month' => 1]);

    $third = YakapFixtures::beneficiary($facility);
    YakapFixtures::readiness($third);
    $secondBatch = $service->create([...$base, 'month' => 2]);

    expect($firstBatch->beneficiaries->pluck('beneficiary_id')->sort()->values()->all())
        ->toBe([$first->id, $second->id])
        ->and($secondBatch->beneficiaries)->toHaveCount(1)
        ->and($secondBatch->beneficiaries->first()->beneficiary_id)->toBe($third->id)
        ->and(fn () => $service->create([...$base, 'month' => 3]))
        ->toThrow(ValidationException::class);

    $firstBatch->update(['status' => SapBatchStatus::Cancelled]);
    $replacement = $service->create([...$base, 'month' => 4]);

    expect($replacement->beneficiaries->pluck('beneficiary_id')->sort()->values()->all())
        ->toBe([$first->id, $second->id]);
});

it('excludes cancelled batches while retaining returned receivables in dashboard and reports', function () {
    $facility = YakapFixtures::facility();
    $policy = YakapFixtures::policy($facility);
    $cancelled = YakapFixtures::batch($facility, $policy, [
        'month' => 2,
        'status' => SapBatchStatus::Cancelled,
        'expected_gross_centavos' => 90_000,
        'submitted_gross_centavos' => 90_000,
        'approved_net_centavos' => 90_000,
    ]);
    YakapFixtures::batch($facility, $policy, [
        'month' => 2,
        'status' => SapBatchStatus::Returned,
        'expected_gross_centavos' => 70_000,
        'submitted_gross_centavos' => 80_000,
    ]);
    Payment::query()->create([
        'sap_batch_id' => $cancelled->id,
        'reference' => 'PAY-2026-CANCELLED',
        'amount_centavos' => 90_000,
        'paid_at' => '2026-02-15',
    ]);

    $dashboard = app(DashboardService::class)->forYear($facility, 2026);
    $financial = app(ReportService::class)->build('financial-summary', $facility, 2026);
    $reconciliation = app(ReportService::class)->build('sap-reconciliation', $facility, 2026);

    expect($dashboard['kpis']['paid'])->toBe(0)
        ->and($dashboard['kpis']['outstanding'])->toBe(80_000)
        ->and($dashboard['trend'][1])->toMatchArray([
            'expected' => 70_000,
            'submitted' => 80_000,
            'paid' => 0,
        ])
        ->and($financial['rows'][1][1])->toBe('700.00')
        ->and($financial['rows'][1][2])->toBe('800.00')
        ->and($reconciliation['rows'])->toHaveCount(1)
        ->and($reconciliation['rows'][0][3])->toBe('returned')
        ->and($reconciliation['rows'][0][9])->toBe('800.00');
});

it('blocks inactive users at login and invalidates their existing internal session', function () {
    $facility = YakapFixtures::facility();
    YakapFixtures::policy($facility);
    $user = YakapFixtures::user();
    $user->update(['is_active' => false]);

    $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ])->assertSessionHasErrors('email');
    $this->assertGuest();

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertRedirect(route('login'));
    $this->assertGuest();
});

it('excludes archived beneficiaries from readiness cards and exception reports', function () {
    $facility = YakapFixtures::facility();
    YakapFixtures::policy($facility);
    $ready = YakapFixtures::beneficiary($facility);
    $activeException = YakapFixtures::beneficiary($facility);
    $archivedException = YakapFixtures::beneficiary($facility);
    YakapFixtures::readiness($ready);
    YakapFixtures::readiness($activeException, overrides: ['pcu_reference' => null]);
    YakapFixtures::readiness($archivedException, overrides: ['pcu_reference' => null]);
    $archivedException->update(['archived_at' => now()]);
    $archivedException->delete();

    $dashboard = app(DashboardService::class)->forYear($facility, 2026);
    $report = app(ReportService::class)->build('readiness-exceptions', $facility, 2026);
    $selected = collect($dashboard['readiness'])->firstWhere('key', 'selected');

    expect($selected['count'])->toBe(2)
        ->and($dashboard['exceptions'])->toHaveCount(1)
        ->and($dashboard['exceptions'][0]['id'])->toBe($activeException->id)
        ->and($report['rows'])->toHaveCount(1)
        ->and($report['rows'][0][0])->toBe($activeException->reference);
});

it('restricts audit activity exports to administrators and read-only auditors', function () {
    YakapFixtures::facility();
    $encoder = YakapFixtures::user(UserRole::Encoder);
    $finance = YakapFixtures::user(UserRole::FinanceOfficer);
    $administrator = YakapFixtures::user(UserRole::Administrator);
    $auditor = YakapFixtures::user(UserRole::Auditor);
    $url = fn (string $format) => route('reports.export', [
        'type' => 'audit-activity',
        'format' => $format,
        'year' => 2026,
    ]);

    $this->actingAs($encoder)->get($url('csv'))->assertForbidden();
    $this->actingAs($finance)->get($url('pdf'))->assertForbidden();
    $this->actingAs($administrator)->get($url('csv'))->assertOk();
    $this->actingAs($auditor)->get($url('pdf'))->assertOk();
});

it('normalizes Manila dates while allowing succeeding-year SAP receipts', function () {
    $facility = YakapFixtures::facility(FacilityType::Private);
    $policy = YakapFixtures::policy($facility);
    $beneficiary = YakapFixtures::beneficiary($facility);
    YakapFixtures::readiness($beneficiary);
    $batch = YakapFixtures::batch($facility, $policy, [
        'status' => SapBatchStatus::Approved,
        'approved_net_centavos' => 100_000,
    ]);
    $finance = YakapFixtures::user(UserRole::FinanceOfficer);

    $this->actingAs($finance)->post(route('finance.payments.store'), [
        'sap_batch_id' => $batch->id,
        'amount_centavos' => 10_000,
        'paid_at' => '2025-12-31',
    ])->assertSessionHasErrors('paid_at');

    $this->actingAs($finance)->post(route('finance.copayments.store'), [
        'beneficiary_id' => $beneficiary->id,
        'year' => 2026,
        'amount_centavos' => 10_000,
        'paid_at' => '2025-12-31',
    ])->assertSessionHasErrors('paid_at');

    $this->actingAs($finance)->post(route('finance.payments.store'), [
        'sap_batch_id' => $batch->id,
        'amount_centavos' => 10_000,
        'paid_at' => '2026-01-03T16:30:00Z',
    ])->assertSessionHasNoErrors();

    $historicPolicy = YakapFixtures::policy($facility, 2025);
    $historicBatch = YakapFixtures::batch($facility, $historicPolicy, [
        'month' => 12,
        'status' => SapBatchStatus::Approved,
        'approved_net_centavos' => 100_000,
    ]);
    $this->actingAs($finance)->post(route('finance.payments.store'), [
        'sap_batch_id' => $historicBatch->id,
        'amount_centavos' => 10_000,
        'paid_at' => '2026-01-15',
    ])->assertSessionHasNoErrors();

    $this->actingAs($finance)->post(route('finance.copayments.store'), [
        'beneficiary_id' => $beneficiary->id,
        'year' => 2026,
        'amount_centavos' => 10_000,
        'paid_at' => '2026-01-03T16:30:00Z',
    ])->assertSessionHasNoErrors();

    expect(fn () => app(CopaymentService::class)->create($facility, $policy, [
        'beneficiary_id' => $beneficiary->id,
        'encounter_id' => null,
        'year' => 2026,
        'amount_centavos' => 10_000,
        'paid_at' => '2025-12-31',
        'created_by' => $finance->id,
    ]))->toThrow(ValidationException::class);

    $this->assertDatabaseHas('payments', ['paid_at' => '2026-01-04']);
    $this->assertDatabaseHas('payments', ['paid_at' => '2026-01-15']);
    $this->assertDatabaseHas('copayments', ['paid_at' => '2026-01-04', 'year' => 2026]);
});

it('retains archived beneficiary identity in co-payment history reports', function () {
    $facility = YakapFixtures::facility(FacilityType::Private);
    YakapFixtures::policy($facility);
    $beneficiary = YakapFixtures::beneficiary($facility);
    Copayment::query()->create([
        'facility_id' => $facility->id,
        'beneficiary_id' => $beneficiary->id,
        'reference' => 'COP-2026-ARCHIVED',
        'year' => 2026,
        'amount_centavos' => 25_000,
        'paid_at' => '2026-04-15',
    ]);
    $expectedName = $beneficiary->full_name;
    $beneficiary->update(['archived_at' => now()]);
    $beneficiary->delete();

    $report = app(ReportService::class)->build('copayment-collections', $facility, 2026);

    expect($report['rows'])->toHaveCount(1)
        ->and($report['rows'][0][2])->toBe($expectedName)
        ->and(Copayment::query()->firstOrFail()->beneficiary->trashed())->toBeTrue();
});

it('uses the approved zero net as the final receivable basis', function () {
    $facility = YakapFixtures::facility();
    $policy = YakapFixtures::policy($facility);
    $batch = YakapFixtures::batch($facility, $policy, [
        'status' => SapBatchStatus::Approved,
        'submitted_gross_centavos' => 100_000,
        'approved_gross_centavos' => 0,
        'approved_net_centavos' => 0,
    ]);

    $dashboard = app(DashboardService::class)->forYear($facility, 2026);
    $reconciliation = app(ReportService::class)->build('sap-reconciliation', $facility, 2026);

    expect($batch->outstanding_centavos)->toBe(0)
        ->and($dashboard['kpis']['outstanding'])->toBe(0)
        ->and($reconciliation['rows'][0][9])->toBe('0.00');
});

it('reloads and locks the current batch state before a transition', function () {
    $facility = YakapFixtures::facility();
    $policy = YakapFixtures::policy($facility);
    $batch = YakapFixtures::batch($facility, $policy, [
        'status' => SapBatchStatus::Approved,
    ]);
    $staleBatch = SapBatch::query()->findOrFail($batch->id);
    $batch->update(['status' => SapBatchStatus::Paid]);

    expect(fn () => app(SapBatchService::class)->transition($staleBatch, [
        'status' => SapBatchStatus::Cancelled->value,
    ]))->toThrow(ValidationException::class)
        ->and($batch->refresh()->status)->toBe(SapBatchStatus::Paid);
});

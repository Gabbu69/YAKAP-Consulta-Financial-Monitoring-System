<?php

use App\Enums\SapBatchStatus;
use App\Models\Payment;
use App\Services\DashboardService;
use App\Services\ReportService;
use Tests\Support\YakapFixtures;

it('isolates all dashboard finance and direct-cost metrics by selected year', function () {
    $facility = YakapFixtures::facility();
    $policy2025 = YakapFixtures::policy($facility, 2025);
    $policy2026 = YakapFixtures::policy($facility, 2026);
    $beneficiary = YakapFixtures::beneficiary($facility);
    $service = YakapFixtures::service(costCentavos: 20_000);

    foreach ([2025, 2026] as $year) {
        $encounter = YakapFixtures::postedEncounter($facility, $beneficiary, "{$year}-03-10");
        $encounter->items()->create([
            'service_id' => $service->id,
            'service_code_snapshot' => $service->code,
            'service_name_snapshot' => $service->name,
            'classification_snapshot' => 'consultation',
            'unit_snapshot' => 'service',
            'unit_cost_centavos' => $year === 2025 ? 20_000 : 30_000,
            'quantity' => 1,
            'total_cost_centavos' => $year === 2025 ? 20_000 : 30_000,
        ]);
    }

    $batch2025 = YakapFixtures::batch($facility, $policy2025, [
        'status' => SapBatchStatus::Paid,
        'approved_net_centavos' => 80_000,
    ]);
    $batch2026 = YakapFixtures::batch($facility, $policy2026, [
        'status' => SapBatchStatus::Paid,
        'month' => 3,
        'approved_net_centavos' => 120_000,
    ]);
    Payment::query()->create([
        'sap_batch_id' => $batch2025->id,
        'reference' => 'PAY-2025-000001',
        'amount_centavos' => 80_000,
        'paid_at' => '2025-03-20',
    ]);
    Payment::query()->create([
        'sap_batch_id' => $batch2026->id,
        'reference' => 'PAY-2026-000001',
        'amount_centavos' => 120_000,
        'paid_at' => '2026-03-20',
    ]);

    $dashboard = app(DashboardService::class)->forYear($facility, 2026);

    expect($dashboard['kpis'])
        ->toMatchArray([
            'paid' => 120_000,
            'outstanding' => 0,
            'direct_cost' => 30_000,
            'net_position' => 90_000,
        ])
        ->and(collect($dashboard['trend'])->sum('paid'))->toBe(120_000);
});

it('reconciles dashboard totals to the financial summary report', function () {
    $facility = YakapFixtures::facility();
    $policy = YakapFixtures::policy($facility);
    $batch = YakapFixtures::batch($facility, $policy, [
        'month' => 2,
        'status' => SapBatchStatus::PartiallyPaid,
        'expected_gross_centavos' => 100_000,
        'submitted_gross_centavos' => 98_000,
        'approved_net_centavos' => 95_000,
    ]);
    Payment::query()->create([
        'sap_batch_id' => $batch->id,
        'reference' => 'PAY-2026-000001',
        'amount_centavos' => 60_000,
        'paid_at' => '2026-02-20',
    ]);

    $kpis = app(DashboardService::class)->forYear($facility, 2026)['kpis'];
    $report = app(ReportService::class)->build('financial-summary', $facility, 2026);
    $february = $report['rows'][1];

    expect($kpis['paid'])->toBe((int) round(((float) $february[4]) * 100))
        ->and($kpis['net_position'])->toBe((int) round(((float) $february[7]) * 100));
});

it('returns a twelve-month trend and readiness exception actions for the chosen year', function () {
    $facility = YakapFixtures::facility();
    YakapFixtures::policy($facility);
    $beneficiary = YakapFixtures::beneficiary($facility);
    YakapFixtures::readiness($beneficiary, overrides: [
        'pcu_reference' => null,
        'yes_confirmed' => false,
        'yes_confirmed_at' => null,
    ]);

    $dashboard = app(DashboardService::class)->forYear($facility, 2026);

    expect($dashboard['trend'])->toHaveCount(12)
        ->and($dashboard['exceptions'])->toHaveCount(1)
        ->and($dashboard['exceptions'][0]['missing'])->toBe(['PCU reference', 'YES confirmation']);
});

it('attributes succeeding-year receipts to their SAP benefit period for program reconciliation', function () {
    $facility = YakapFixtures::facility();
    $policy = YakapFixtures::policy($facility, 2025);
    $batch = YakapFixtures::batch($facility, $policy, [
        'month' => 12,
        'status' => SapBatchStatus::Paid,
        'expected_gross_centavos' => 100_000,
        'submitted_gross_centavos' => 100_000,
        'approved_net_centavos' => 100_000,
    ]);
    Payment::query()->create([
        'sap_batch_id' => $batch->id,
        'reference' => 'PAY-2026-000001',
        'amount_centavos' => 100_000,
        'paid_at' => '2026-01-15',
    ]);

    $dashboard = app(DashboardService::class)->forYear($facility, 2025);
    $report = app(ReportService::class)->build('financial-summary', $facility, 2025);

    expect($dashboard['kpis']['paid'])->toBe(100_000)
        ->and($dashboard['trend'][11]['paid'])->toBe(100_000)
        ->and($report['rows'][11][4])->toBe('1000.00');
});

<?php

namespace App\Services;

use App\Enums\EncounterStatus;
use App\Enums\SapBatchStatus;
use App\Models\BeneficiaryYear;
use App\Models\Copayment;
use App\Models\EncounterItem;
use App\Models\Facility;
use App\Models\Payment;
use App\Models\PolicyVersion;
use App\Models\SapBatch;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    public function __construct(private PolicyCalculator $calculator) {}

    /** @return array<string, mixed> */
    public function forYear(Facility $facility, int $year): array
    {
        $policy = PolicyVersion::where('facility_id', $facility->id)
            ->where('effective_year', $year)->first();
        $batchIds = SapBatch::where('facility_id', $facility->id)
            ->where('year', $year)
            ->where('status', '!=', SapBatchStatus::Cancelled->value)
            ->pluck('id');
        $paid = (int) Payment::whereIn('sap_batch_id', $batchIds)->whereNull('voided_at')->sum('amount_centavos');
        $batches = SapBatch::whereIn('id', $batchIds)->withSum([
            'payments as active_paid_centavos' => fn ($query) => $query->whereNull('voided_at'),
        ], 'amount_centavos')->get();
        $outstanding = $batches->sum(fn (SapBatch $batch) => max(
            0,
            $batch->receivableBasisCentavos() - (int) ($batch->active_paid_centavos ?? 0),
        ));
        $directCost = (int) EncounterItem::query()
            ->whereHas('encounter', fn ($query) => $query->where('facility_id', $facility->id)
                ->where('status', EncounterStatus::Posted->value)
                ->whereYear('encounter_date', $year))
            ->sum('total_cost_centavos');
        $copays = (int) Copayment::where('facility_id', $facility->id)->where('year', $year)
            ->whereNull('voided_at')->sum('amount_centavos');

        $months = collect(range(1, 12))->map(function (int $month) use ($facility, $year, $policy): array {
            $monthBatches = SapBatch::query()
                ->where('facility_id', $facility->id)
                ->where('year', $year)
                ->where('month', $month)
                ->where('status', '!=', SapBatchStatus::Cancelled->value);
            $ids = (clone $monthBatches)->pluck('id');
            $statuses = BeneficiaryYear::where('facility_id', $facility->id)
                ->where('year', $year)
                ->whereHas('beneficiary', fn ($query) => $query
                    ->whereNull('archived_at')->whereNull('deleted_at'));
            $eligible = (clone $statuses)->sap1Ready()->count();
            $expected = (int) (clone $monthBatches)->sum('expected_gross_centavos');
            if ($expected === 0 && $policy && $month === 1) {
                $expected = $this->calculator->sap1Expected($eligible, $policy);
            }

            return [
                'month' => Carbon::create($year, $month, 1)->format('M'),
                'month_number' => $month,
                'expected' => $expected,
                'submitted' => (int) (clone $monthBatches)->sum('submitted_gross_centavos'),
                'paid' => (int) Payment::whereIn('sap_batch_id', $ids)->whereNull('voided_at')->sum('amount_centavos'),
            ];
        })->all();

        $statusQuery = BeneficiaryYear::where('facility_id', $facility->id)
            ->where('year', $year)
            ->whereHas('beneficiary', fn ($query) => $query
                ->whereNull('archived_at')->whereNull('deleted_at'));
        $readiness = [
            ['key' => 'selected', 'label' => 'Selected', 'count' => (clone $statusQuery)->where('selected', true)->count()],
            ['key' => 'fpe', 'label' => 'FPE complete', 'count' => (clone $statusQuery)->where('fpe_completed', true)->count()],
            ['key' => 'pcu', 'label' => 'With PCU reference', 'count' => (clone $statusQuery)->whereNotNull('pcu_reference')->where('pcu_reference', '!=', '')->count()],
            ['key' => 'yes', 'label' => 'YES confirmed', 'count' => (clone $statusQuery)->where('yes_confirmed', true)->count()],
            ['key' => 'ready', 'label' => 'SAP1 ready', 'count' => (clone $statusQuery)->sap1Ready()->count()],
        ];

        $performance = $policy
            ? $this->calculator->performance($facility, $policy, $year)
            : ['factor_bps' => 0, 'bars' => []];

        $serviceCosts = EncounterItem::query()
            ->select('classification_snapshot as classification', DB::raw('SUM(total_cost_centavos) as total'))
            ->whereHas('encounter', fn ($query) => $query->where('facility_id', $facility->id)
                ->where('status', EncounterStatus::Posted->value)->whereYear('encounter_date', $year))
            ->groupBy('classification_snapshot')->orderByDesc('total')->get()
            ->map(fn ($row) => [
                'classification' => (string) $row->getAttribute('classification'),
                'total' => (int) $row->getAttribute('total'),
            ])->all();

        $exceptions = BeneficiaryYear::with('beneficiary')
            ->where('facility_id', $facility->id)->where('year', $year)->where('selected', true)
            ->whereHas('beneficiary', fn ($query) => $query
                ->whereNull('archived_at')->whereNull('deleted_at'))
            ->where(function ($query) {
                $query->where('fpe_completed', false)->orWhereNull('pcu_reference')
                    ->orWhere('pcu_reference', '')->orWhere('yes_confirmed', false);
            })->limit(8)->get()->map(fn (BeneficiaryYear $row) => [
                'id' => $row->beneficiary_id,
                'reference' => $row->beneficiary->reference,
                'name' => $row->beneficiary->full_name,
                'missing' => collect([
                    ! $row->fpe_completed ? 'FPE' : null,
                    ! filled($row->pcu_reference) ? 'PCU reference' : null,
                    ! $row->yes_confirmed ? 'YES confirmation' : null,
                ])->filter()->values()->all(),
            ])->all();

        return [
            'year' => $year,
            'facility' => $facility,
            'kpis' => [
                'paid' => $paid,
                'outstanding' => (int) $outstanding,
                'direct_cost' => $directCost,
                'net_position' => $this->calculator->netPosition($paid, $copays, $directCost),
            ],
            'trend' => $months,
            'readiness' => $readiness,
            'performance' => $performance['bars'],
            'performance_factor_bps' => $performance['factor_bps'],
            'serviceCosts' => $serviceCosts,
            'exceptions' => $exceptions,
            'recentBatches' => SapBatch::where('facility_id', $facility->id)->where('year', $year)
                ->where('status', '!=', SapBatchStatus::Cancelled->value)
                ->latest()->limit(5)->get(),
        ];
    }
}

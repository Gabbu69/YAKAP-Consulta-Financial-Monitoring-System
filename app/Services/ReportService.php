<?php

namespace App\Services;

use App\Enums\EncounterStatus;
use App\Enums\SapBatchStatus;
use App\Models\AuditLog;
use App\Models\BeneficiaryYear;
use App\Models\Copayment;
use App\Models\EncounterItem;
use App\Models\Facility;
use App\Models\Payment;
use App\Models\PolicyVersion;
use App\Models\SapBatch;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class ReportService
{
    public const TYPES = [
        'financial-summary' => 'Financial Summary',
        'sap-reconciliation' => 'SAP Reconciliation',
        'readiness-exceptions' => 'Beneficiary Readiness Exceptions',
        'second-tranche-performance' => 'Second-Tranche Performance',
        'service-utilization-cost' => 'Service Utilization and Cost',
        'copayment-collections' => 'Co-payment Collections',
        'audit-activity' => 'Audit Activity',
    ];

    public function __construct(private PolicyCalculator $calculator) {}

    /**
     * @return array{title:string,headers:list<string>,rows:list<list<string|int|float|null>>}
     */
    public function build(string $type, Facility $facility, int $year): array
    {
        if (! isset(self::TYPES[$type])) {
            throw new InvalidArgumentException('Unknown report type.');
        }

        return match ($type) {
            'financial-summary' => $this->financialSummary($facility, $year),
            'sap-reconciliation' => $this->sapReconciliation($facility, $year),
            'readiness-exceptions' => $this->readinessExceptions($facility, $year),
            'second-tranche-performance' => $this->performance($facility, $year),
            'service-utilization-cost' => $this->serviceUtilization($facility, $year),
            'copayment-collections' => $this->copayments($facility, $year),
            'audit-activity' => $this->auditActivity($year),
        };
    }

    /** @return array{title:string,headers:list<string>,rows:list<list<string|int|float|null>>} */
    private function financialSummary(Facility $facility, int $year): array
    {
        $rows = [];
        foreach (range(1, 12) as $month) {
            $batches = SapBatch::where('facility_id', $facility->id)
                ->where('year', $year)
                ->where('month', $month)
                ->where('status', '!=', SapBatchStatus::Cancelled->value);
            $ids = (clone $batches)->pluck('id');
            $paid = (int) Payment::whereIn('sap_batch_id', $ids)->whereNull('voided_at')->sum('amount_centavos');
            $cost = (int) EncounterItem::whereHas('encounter', fn ($query) => $query
                ->where('facility_id', $facility->id)->where('status', EncounterStatus::Posted->value)
                ->whereYear('encounter_date', $year)->whereMonth('encounter_date', $month))->sum('total_cost_centavos');
            $copay = (int) Copayment::where('facility_id', $facility->id)->where('year', $year)
                ->whereMonth('paid_at', $month)->whereNull('voided_at')->sum('amount_centavos');
            $rows[] = [
                Carbon::create($year, $month, 1)->format('F'),
                $this->money((int) (clone $batches)->sum('expected_gross_centavos')),
                $this->money((int) (clone $batches)->sum('submitted_gross_centavos')),
                $this->money((int) (clone $batches)->sum('approved_net_centavos')),
                $this->money($paid),
                $this->money($cost),
                $this->money($copay),
                $this->money($paid + $copay - $cost),
            ];
        }

        return [
            'title' => "Program-Year Financial Summary - {$year}",
            'headers' => ['SAP Reporting Month', 'Expected (PHP)', 'Submitted (PHP)', 'Approved Net (PHP)', 'Paid Reconciled (PHP)', 'Direct Cost (PHP)', 'Co-payments (PHP)', 'Net Position (PHP)'],
            'rows' => $rows,
        ];
    }

    /** @return array{title:string,headers:list<string>,rows:list<list<string|int|float|null>>} */
    private function sapReconciliation(Facility $facility, int $year): array
    {
        $batches = SapBatch::withSum([
            'payments as paid_total' => fn ($query) => $query->whereNull('voided_at'),
        ], 'amount_centavos')->where('facility_id', $facility->id)
            ->where('year', $year)
            ->where('status', '!=', SapBatchStatus::Cancelled->value)
            ->orderBy('month')->get();

        return [
            'title' => "SAP Reconciliation - {$year}",
            'headers' => ['Reference', 'Tranche', 'Month', 'Status', 'Beneficiaries', 'Expected (PHP)', 'Submitted (PHP)', 'Approved Net (PHP)', 'Paid (PHP)', 'Outstanding (PHP)'],
            'rows' => array_values($batches->map(function (SapBatch $batch): array {
                $paid = (int) ($batch->paid_total ?? 0);
                $basis = $batch->receivableBasisCentavos();

                return [
                    $batch->reference, $batch->tranche, $batch->month, $batch->status->value,
                    $batch->eligible_beneficiary_count, $this->money($batch->expected_gross_centavos),
                    $this->money($batch->submitted_gross_centavos), $this->money($batch->approved_net_centavos),
                    $this->money($paid), $this->money(max(0, $basis - $paid)),
                ];
            })->all()),
        ];
    }

    /** @return array{title:string,headers:list<string>,rows:list<list<string|int|float|null>>} */
    private function readinessExceptions(Facility $facility, int $year): array
    {
        $statuses = BeneficiaryYear::with('beneficiary')->where('facility_id', $facility->id)
            ->where('year', $year)->where('selected', true)
            ->whereHas('beneficiary', fn ($query) => $query
                ->whereNull('archived_at')->whereNull('deleted_at'))
            ->where(function ($query) {
                $query->where('fpe_completed', false)->orWhereNull('pcu_reference')
                    ->orWhere('pcu_reference', '')->orWhere('yes_confirmed', false);
            })->get();

        return [
            'title' => "Beneficiary Readiness Exceptions - {$year}",
            'headers' => ['Reference', 'Beneficiary', 'Masked PIN', 'FPE', 'PCU Reference', 'YES', 'Required Action'],
            'rows' => array_values($statuses->map(fn (BeneficiaryYear $status) => [
                $status->beneficiary->reference,
                $status->beneficiary->full_name,
                $status->beneficiary->masked_philhealth_pin,
                $status->fpe_completed ? 'Complete' : 'Missing',
                $status->pcu_reference ?: 'Missing',
                $status->yes_confirmed ? 'Confirmed' : 'Missing',
                collect([
                    ! $status->fpe_completed ? 'Complete FPE' : null,
                    ! filled($status->pcu_reference) ? 'Add PCU reference' : null,
                    ! $status->yes_confirmed ? 'Confirm digital YES' : null,
                ])->filter()->join('; '),
            ])->all()),
        ];
    }

    /** @return array{title:string,headers:list<string>,rows:list<list<string|int|float|null>>} */
    private function performance(Facility $facility, int $year): array
    {
        $policy = PolicyVersion::where('facility_id', $facility->id)->where('effective_year', $year)->first();
        $result = $policy ? $this->calculator->performance($facility, $policy, $year) : ['factor_bps' => 0, 'bars' => []];

        return [
            'title' => "Second-Tranche Performance - {$year} (Factor: ".number_format($result['factor_bps'] / 100, 2).'%)',
            'headers' => ['Indicator', 'Actual', 'Target', 'Weight', 'Weighted Score'],
            'rows' => array_values(collect($result['bars'])->map(fn ($bar) => [
                $bar['label'],
                number_format($bar['actual'] * 100, 2).'%',
                number_format($bar['target'] * 100, 2).'%',
                number_format($bar['weight'] * 100, 2).'%',
                number_format($bar['score'] * 100, 2).'%',
            ])->all()),
        ];
    }

    /** @return array{title:string,headers:list<string>,rows:list<list<string|int|float|null>>} */
    private function serviceUtilization(Facility $facility, int $year): array
    {
        $items = EncounterItem::query()
            ->select([
                'service_code_snapshot', 'service_name_snapshot', 'classification_snapshot',
                DB::raw('SUM(quantity) as quantity_total'),
                DB::raw('SUM(total_cost_centavos) as cost_total'),
                DB::raw('COUNT(DISTINCT encounters.beneficiary_id) as unique_beneficiaries'),
            ])->join('encounters', 'encounters.id', '=', 'encounter_items.encounter_id')
            ->where('encounters.facility_id', $facility->id)
            ->where('encounters.status', EncounterStatus::Posted->value)
            ->whereYear('encounters.encounter_date', $year)
            ->groupBy('service_code_snapshot', 'service_name_snapshot', 'classification_snapshot')
            ->orderByDesc('cost_total')->get();

        return [
            'title' => "Service Utilization and Cost - {$year}",
            'headers' => ['Code', 'Service', 'Classification', 'Quantity', 'Unique Beneficiaries', 'Direct Cost (PHP)'],
            'rows' => array_values($items->map(fn ($item) => [
                (string) $item->getAttribute('service_code_snapshot'),
                (string) $item->getAttribute('service_name_snapshot'),
                (string) $item->getAttribute('classification_snapshot'),
                (int) $item->getAttribute('quantity_total'),
                (int) $item->getAttribute('unique_beneficiaries'),
                $this->money((int) $item->getAttribute('cost_total')),
            ])->all()),
        ];
    }

    /** @return array{title:string,headers:list<string>,rows:list<list<string|int|float|null>>} */
    private function copayments(Facility $facility, int $year): array
    {
        $rows = Copayment::with(['beneficiary', 'encounter'])->where('facility_id', $facility->id)
            ->where('year', $year)->orderBy('paid_at')->get();

        return [
            'title' => "Co-payment Collections - {$year}",
            'headers' => ['Reference', 'Date', 'Beneficiary', 'Encounter', 'Receipt', 'Amount (PHP)', 'Status'],
            'rows' => array_values($rows->map(fn (Copayment $row) => [
                $row->reference, $row->paid_at->format('Y-m-d'), $row->beneficiary->full_name,
                $row->encounter?->reference, $row->receipt_number, $this->money($row->amount_centavos),
                $row->voided_at ? 'Void' : 'Valid',
            ])->all()),
        ];
    }

    /** @return array{title:string,headers:list<string>,rows:list<list<string|int|float|null>>} */
    private function auditActivity(int $year): array
    {
        $logs = AuditLog::with('user')->whereYear('created_at', $year)->orderBy('created_at')->get();

        return [
            'title' => "Audit Activity - {$year}",
            'headers' => ['Timestamp', 'User', 'Event', 'Description', 'IP Address'],
            'rows' => array_values($logs->map(fn (AuditLog $log) => [
                $log->created_at->timezone('Asia/Manila')->format('Y-m-d H:i:s'),
                $log->user !== null ? $log->user->name : 'System',
                $log->event, $log->description, $log->ip_address,
            ])->all()),
        ];
    }

    private function money(int $centavos): string
    {
        return number_format($centavos / 100, 2, '.', '');
    }
}

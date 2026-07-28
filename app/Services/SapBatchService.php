<?php

namespace App\Services;

use App\Enums\SapBatchStatus;
use App\Models\BeneficiaryYear;
use App\Models\PolicyVersion;
use App\Models\SapBatch;
use App\Models\SapBatchBeneficiary;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SapBatchService
{
    public function __construct(
        private ReferenceNumberService $references,
        private PolicyCalculator $calculator,
        private AuditLogger $audit,
    ) {}

    /** @param array{facility_id:int,policy_version_id:int,tranche:int,year:int,month:int,notes?:string|null,user_id:int} $data */
    public function create(array $data): SapBatch
    {
        return DB::transaction(function () use ($data): SapBatch {
            $policy = PolicyVersion::query()
                ->where('facility_id', $data['facility_id'])
                ->lockForUpdate()
                ->findOrFail($data['policy_version_id']);

            if ((int) $policy->effective_year !== (int) $data['year']) {
                throw ValidationException::withMessages([
                    'policy_version_id' => 'The selected policy is not effective for the batch year.',
                ]);
            }

            if ($data['tranche'] === 2 && $data['month'] !== 12) {
                throw ValidationException::withMessages([
                    'month' => 'SAP2 is an annual close and must use December as its reporting month.',
                ]);
            }
            $today = CarbonImmutable::today('Asia/Manila');
            $periodStart = CarbonImmutable::create(
                $data['year'],
                $data['month'],
                1,
                0,
                0,
                0,
                'Asia/Manila',
            );
            if ($data['tranche'] === 1 && $periodStart->greaterThan($today)) {
                throw ValidationException::withMessages([
                    'month' => 'SAP1 cannot be generated for a future reporting month.',
                ]);
            }
            $sap2Cutoff = CarbonImmutable::create($data['year'] + 1, 1, 8, 0, 0, 0, 'Asia/Manila');
            if ($data['tranche'] === 2 && $today->lessThan($sap2Cutoff)) {
                throw ValidationException::withMessages([
                    'year' => 'SAP2 can be frozen only from January 8 after the benefit year closes.',
                ]);
            }

            $existingBatch = SapBatch::query()
                ->where('facility_id', $data['facility_id'])
                ->where('year', $data['year'])
                ->where('tranche', $data['tranche'])
                ->where('status', '!=', SapBatchStatus::Cancelled->value)
                ->when($data['tranche'] === 1, fn ($query) => $query->where('month', $data['month']))
                ->lockForUpdate()
                ->exists();

            if ($existingBatch) {
                throw ValidationException::withMessages([
                    'tranche' => $data['tranche'] === 1
                        ? 'A non-cancelled SAP1 batch already exists for this reporting month.'
                        : 'A non-cancelled annual SAP2 batch already exists for this year.',
                ]);
            }

            $alreadyBatchedBeneficiaryIds = SapBatchBeneficiary::query()
                ->select('beneficiary_id')
                ->whereHas('batch', fn ($query) => $query
                    ->where('facility_id', $data['facility_id'])
                    ->where('year', $data['year'])
                    ->where('tranche', $data['tranche'])
                    ->where('status', '!=', SapBatchStatus::Cancelled->value));

            $readinessCutoff = $periodStart->endOfMonth()->min($today)->toDateString();
            $statuses = BeneficiaryYear::with('beneficiary')
                ->where('facility_id', $data['facility_id'])
                ->where('year', $data['year'])
                ->whereNotIn('beneficiary_id', $alreadyBatchedBeneficiaryIds)
                ->when(
                    $data['tranche'] === 1,
                    fn ($query) => $query->sap1ReadyAsOf($data['year'], $readinessCutoff),
                    fn ($query) => $query->sap2Eligible($data['year']),
                )
                ->whereHas('beneficiary', fn ($query) => $query
                    ->whereNull('archived_at')->whereNull('deleted_at'))
                ->lockForUpdate()
                ->get();

            if ($statuses->isEmpty()) {
                throw ValidationException::withMessages([
                    'beneficiaries' => 'No unbatched eligible beneficiaries remain for this year and tranche.',
                ]);
            }

            $performance = $data['tranche'] === 2
                ? $this->calculator->performance($policy->facility, $policy, $data['year'])
                : ['factor_bps' => 10000, 'bars' => []];
            $count = $statuses->count();
            $expected = $data['tranche'] === 1
                ? $this->calculator->sap1Expected($count, $policy)
                : $this->calculator->sap2Expected($count, $policy, $performance['factor_bps']);

            if ($policy->locked_at === null) {
                $policy->forceFill(['locked_at' => now()])->saveQuietly();
            }

            $batch = SapBatch::create([
                ...collect($data)->except('user_id')->all(),
                'created_by' => $data['user_id'],
                'reference' => $this->references->sapBatch($data['tranche'], $data['year'], $data['month']),
                'status' => SapBatchStatus::Draft,
                'eligible_beneficiary_count' => $count,
                'performance_factor_bps' => $performance['factor_bps'],
                'expected_gross_centavos' => $expected,
                'submitted_gross_centavos' => 0,
                'approved_gross_centavos' => 0,
                'withholding_tax_centavos' => 0,
                'approved_net_centavos' => 0,
            ]);

            $allocated = $count > 0 ? intdiv($expected, $count) : 0;
            $remainder = $expected - ($allocated * $count);
            foreach ($statuses->values() as $index => $status) {
                $batch->beneficiaries()->create([
                    'beneficiary_id' => $status->beneficiary_id,
                    'beneficiary_reference_snapshot' => $status->beneficiary->reference,
                    'beneficiary_name_snapshot' => $status->beneficiary->full_name,
                    'pin_masked_snapshot' => $status->beneficiary->masked_philhealth_pin,
                    'readiness_snapshot' => [
                        'selected' => $status->selected,
                        'fpe_completed' => $status->fpe_completed,
                        'pcu_reference' => $status->pcu_reference,
                        'yes_confirmed' => $status->yes_confirmed,
                    ],
                    'allocated_amount_centavos' => $allocated + ($index === 0 ? $remainder : 0),
                ]);
            }

            $this->audit->log('sap_batch.created', "Generated frozen batch {$batch->reference}", $batch);

            return $batch->load(['policy', 'beneficiaries']);
        });
    }

    /** @param array<string, mixed> $data */
    public function transition(SapBatch $batch, array $data): SapBatch
    {
        return DB::transaction(function () use ($batch, $data): SapBatch {
            $lockedBatch = SapBatch::query()
                ->whereKey($batch->id)
                ->lockForUpdate()
                ->firstOrFail();
            $next = SapBatchStatus::from($data['status']);
            $allowed = [
                SapBatchStatus::Draft->value => [SapBatchStatus::Submitted, SapBatchStatus::Cancelled],
                SapBatchStatus::Submitted->value => [SapBatchStatus::Approved, SapBatchStatus::Returned, SapBatchStatus::Cancelled],
                SapBatchStatus::Returned->value => [SapBatchStatus::Submitted, SapBatchStatus::Cancelled],
                SapBatchStatus::Approved->value => [SapBatchStatus::Cancelled],
                SapBatchStatus::PartiallyPaid->value => [SapBatchStatus::Cancelled],
                SapBatchStatus::Paid->value => [],
                SapBatchStatus::Cancelled->value => [],
            ];

            if (! in_array($next, $allowed[$lockedBatch->status->value], true)) {
                throw ValidationException::withMessages([
                    'status' => "Cannot move a {$lockedBatch->status->value} batch to {$next->value}.",
                ]);
            }
            if ($next === SapBatchStatus::Cancelled && $lockedBatch->payments()->whereNull('voided_at')->exists()) {
                throw ValidationException::withMessages([
                    'status' => 'Void all recorded payments before cancelling this batch.',
                ]);
            }

            $updates = ['status' => $next, 'notes' => $data['notes'] ?? $lockedBatch->notes];
            if ($next === SapBatchStatus::Submitted) {
                $submitted = (int) ($data['submitted_gross_centavos'] ?? $lockedBatch->expected_gross_centavos);
                $updates += ['submitted_gross_centavos' => $submitted, 'submitted_at' => now()];
            }
            if ($next === SapBatchStatus::Approved) {
                $gross = (int) ($data['approved_gross_centavos'] ?? $lockedBatch->submitted_gross_centavos);
                $withholding = $this->calculator->withholding($gross, $lockedBatch->policy);
                $updates += [
                    'approved_gross_centavos' => $gross,
                    'withholding_tax_centavos' => $withholding,
                    'approved_net_centavos' => $gross - $withholding,
                    'approved_at' => now(),
                ];
            }
            if ($next === SapBatchStatus::Returned) {
                $updates['returned_at'] = now();
            }
            if ($next === SapBatchStatus::Cancelled) {
                $updates['cancelled_at'] = now();
            }

            $old = $lockedBatch->toArray();
            $lockedBatch->update($updates);
            $this->audit->log('sap_batch.status_changed', "Batch {$lockedBatch->reference} moved to {$next->value}", $lockedBatch, $old, $lockedBatch->toArray());

            return $lockedBatch->fresh(['policy', 'beneficiaries', 'payments']);
        });
    }

    public function reconcilePaymentStatus(SapBatch $batch): void
    {
        $paid = (int) $batch->payments()->whereNull('voided_at')->sum('amount_centavos');
        $net = (int) $batch->approved_net_centavos;
        if ($net <= 0 || in_array($batch->status, [SapBatchStatus::Draft, SapBatchStatus::Submitted, SapBatchStatus::Returned, SapBatchStatus::Cancelled], true)) {
            return;
        }

        $status = match (true) {
            $paid <= 0 => SapBatchStatus::Approved,
            $paid >= $net => SapBatchStatus::Paid,
            default => SapBatchStatus::PartiallyPaid,
        };
        $batch->update(['status' => $status]);
    }
}

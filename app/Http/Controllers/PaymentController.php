<?php

namespace App\Http\Controllers;

use App\Enums\SapBatchStatus;
use App\Http\Requests\PaymentRequest;
use App\Models\Payment;
use App\Models\SapBatch;
use App\Services\AuditLogger;
use App\Services\ReferenceNumberService;
use App\Services\SapBatchService;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class PaymentController extends Controller
{
    public function index(Request $request): Response
    {
        $facility = $this->facility();
        $batchSelectionRequested = $request->has('batch_id');
        $requestedBatchId = $batchSelectionRequested
            ? (int) $request->integer('batch_id')
            : null;
        $requestedBatch = $requestedBatchId
            ? SapBatch::query()
                ->where('facility_id', $facility->id)
                ->whereKey($requestedBatchId)
                ->first()
            : null;
        $year = $request->filled('year')
            ? (int) $request->integer('year')
            : (int) ($requestedBatch->year ?? now()->year);
        $payableBatches = SapBatch::withSum([
            'payments as active_paid_centavos' => fn ($query) => $query->whereNull('voided_at'),
        ], 'amount_centavos')->where('facility_id', $facility->id)->where('year', $year)
            ->whereIn('status', [
                SapBatchStatus::Approved->value,
                SapBatchStatus::PartiallyPaid->value,
            ])->latest()->get();
        $selectedBatchId = $requestedBatch !== null
            && $requestedBatch->year === $year
            && $payableBatches->contains('id', $requestedBatch->id)
                ? $requestedBatch->id
                : null;

        return Inertia::render('finance/payments/index', [
            'payments' => Payment::with('batch')
                ->whereHas('batch', fn ($query) => $query->where('facility_id', $facility->id)->where('year', $year))
                ->latest('paid_at')->paginate(15)->withQueryString(),
            'batches' => $payableBatches,
            'selectedBatchId' => $selectedBatchId,
            'batchSelectionRequested' => $batchSelectionRequested,
            'filters' => ['year' => $year, 'batch_id' => $requestedBatchId],
            'years' => SapBatch::where('facility_id', $facility->id)->select('year')->distinct()
                ->orderByDesc('year')->pluck('year'),
        ]);
    }

    public function store(
        PaymentRequest $request,
        ReferenceNumberService $references,
        AuditLogger $audit,
        SapBatchService $batchService,
    ): RedirectResponse {
        $facility = $this->facility();
        $data = $request->validated();
        DB::transaction(function () use ($data, $request, $facility, $references, $audit, $batchService): void {
            $batch = SapBatch::query()->where('facility_id', $facility->id)
                ->whereKey((int) $data['sap_batch_id'])->lockForUpdate()->firstOrFail();
            if (! in_array($batch->status, [SapBatchStatus::Approved, SapBatchStatus::PartiallyPaid], true)) {
                throw ValidationException::withMessages(['sap_batch_id' => 'Only approved batches can receive payments.']);
            }
            $paymentDate = CarbonImmutable::parse((string) $data['paid_at'], 'Asia/Manila')
                ->setTimezone('Asia/Manila');
            $reportingPeriodStart = CarbonImmutable::create(
                $batch->year,
                $batch->month,
                1,
                0,
                0,
                0,
                'Asia/Manila',
            );
            if ($paymentDate->startOfDay()->lessThan($reportingPeriodStart)) {
                throw ValidationException::withMessages([
                    'paid_at' => 'The payment date cannot precede the SAP reporting period.',
                ]);
            }
            $paid = (int) $batch->payments()->whereNull('voided_at')->sum('amount_centavos');
            if ($paid + $data['amount_centavos'] > $batch->approved_net_centavos) {
                throw ValidationException::withMessages(['amount_centavos' => 'Payment exceeds the batch outstanding balance.']);
            }
            $payment = Payment::create([
                ...$data,
                'paid_at' => $paymentDate->toDateString(),
                'reference' => $references->payment($paymentDate->year),
                'created_by' => $request->user()->id,
            ]);
            $audit->log('payment.created', "Recorded payment {$payment->reference}", $payment);
            $batchService->reconcilePaymentStatus($batch);
        });

        return back()->with('success', 'Payment recorded and batch reconciled.');
    }

    public function void(Request $request, Payment $payment, AuditLogger $audit, SapBatchService $batchService): RedirectResponse
    {
        abort_unless($payment->batch()->where('facility_id', $this->facility()->id)->exists(), 404);
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']]);
        DB::transaction(function () use ($payment, $data, $audit, $batchService): void {
            $batch = SapBatch::query()->whereKey($payment->sap_batch_id)->lockForUpdate()->firstOrFail();
            $lockedPayment = Payment::query()->whereKey($payment->id)->lockForUpdate()->firstOrFail();
            if ($lockedPayment->voided_at !== null) {
                throw ValidationException::withMessages(['payment' => 'The payment is already void.']);
            }

            $lockedPayment->update(['voided_at' => now(), 'void_reason' => $data['reason']]);
            $audit->log('payment.voided', "Voided payment {$lockedPayment->reference}: {$data['reason']}", $lockedPayment);
            $batchService->reconcilePaymentStatus($batch);
        });

        return back()->with('success', 'Payment voided; the original record was preserved.');
    }
}

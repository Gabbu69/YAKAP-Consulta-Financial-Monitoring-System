<?php

namespace App\Http\Controllers;

use App\Enums\SapBatchStatus;
use App\Http\Requests\SapBatchRequest;
use App\Http\Requests\SapBatchStatusRequest;
use App\Models\PolicyVersion;
use App\Models\SapBatch;
use App\Services\SapBatchService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SapBatchController extends Controller
{
    public function index(Request $request): Response
    {
        $facility = $this->facility();
        $year = (int) $request->integer('year', now()->year);
        $status = (string) $request->string('status');
        $tranche = $request->integer('tranche') ?: null;
        $batchQuery = SapBatch::query()
            ->where('facility_id', $facility->id)
            ->where('year', $year)
            ->when($status, fn ($query) => $query->where('status', $status))
            ->when($tranche, fn ($query) => $query->where('tranche', $tranche));
        $summaryBatches = (clone $batchQuery)->withSum([
            'payments as active_paid_centavos' => fn ($query) => $query->whereNull('voided_at'),
        ], 'amount_centavos')->get();
        $summary = $summaryBatches->reduce(
            function (array $totals, SapBatch $batch): array {
                $paid = (int) ($batch->getAttribute('active_paid_centavos') ?? 0);

                return [
                    'expected' => $totals['expected'] + (int) $batch->expected_gross_centavos,
                    'submitted' => $totals['submitted'] + (int) $batch->submitted_gross_centavos,
                    'paid' => $totals['paid'] + $paid,
                    'outstanding' => $totals['outstanding']
                        + max(0, $batch->receivableBasisCentavos() - $paid),
                ];
            },
            ['expected' => 0, 'submitted' => 0, 'paid' => 0, 'outstanding' => 0],
        );

        return Inertia::render('finance/sap-batches/index', [
            'batches' => (clone $batchQuery)->with('policy')->withSum([
                'payments as paid_centavos' => fn ($query) => $query->whereNull('voided_at'),
            ], 'amount_centavos')
                ->latest()->paginate(15)->withQueryString(),
            'summary' => $summary,
            'policies' => PolicyVersion::where('facility_id', $facility->id)->orderByDesc('effective_year')->get(),
            'facility' => $facility,
            'filters' => ['year' => $year, 'status' => $status, 'tranche' => $tranche],
            'years' => PolicyVersion::where('facility_id', $facility->id)->orderByDesc('effective_year')->pluck('effective_year'),
            'statuses' => SapBatchStatus::cases(),
        ]);
    }

    public function store(SapBatchRequest $request, SapBatchService $service): RedirectResponse
    {
        $batch = $service->create([
            'policy_version_id' => $request->integer('policy_version_id'),
            'tranche' => $request->integer('tranche'),
            'year' => $request->integer('year'),
            'month' => $request->integer('month'),
            'notes' => $request->filled('notes') ? (string) $request->string('notes') : null,
            'facility_id' => $this->facility()->id,
            'user_id' => $request->user()->id,
        ]);

        return to_route('finance.sap-batches.show', $batch)->with('success', 'Frozen SAP batch generated.');
    }

    public function show(SapBatch $sapBatch): Response
    {
        abort_unless($sapBatch->facility_id === $this->facility()->id, 404);

        return Inertia::render('finance/sap-batches/show', [
            'batch' => $sapBatch->load(['policy', 'beneficiaries', 'payments']),
            'statuses' => SapBatchStatus::cases(),
        ]);
    }

    public function updateStatus(
        SapBatchStatusRequest $request,
        SapBatch $sapBatch,
        SapBatchService $service,
    ): RedirectResponse {
        abort_unless($sapBatch->facility_id === $this->facility()->id, 404);
        $service->transition($sapBatch->load('policy'), $request->validated());

        return back()->with('success', 'Batch status updated.');
    }
}

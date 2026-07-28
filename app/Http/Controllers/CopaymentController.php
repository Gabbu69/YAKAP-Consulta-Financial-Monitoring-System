<?php

namespace App\Http\Controllers;

use App\Http\Requests\CopaymentRequest;
use App\Models\Beneficiary;
use App\Models\Copayment;
use App\Models\Encounter;
use App\Models\PolicyVersion;
use App\Services\AuditLogger;
use App\Services\CopaymentService;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class CopaymentController extends Controller
{
    public function index(Request $request): Response
    {
        $facility = $this->facility();
        $year = (int) $request->integer('year', now()->year);
        $eligibilityCutoff = min(
            CarbonImmutable::now('Asia/Manila')->toDateString(),
            "{$year}-12-31",
        );
        $eligibleBeneficiaries = Beneficiary::query()
            ->where('facility_id', $facility->id)
            ->active()
            ->whereHas('yearlyStatuses', fn ($query) => $query
                ->where('year', $year)
                ->where('selected', true)
                ->where('fpe_completed', true)
                ->whereNotNull('pcu_reference')
                ->where('pcu_reference', '!=', '')
                ->where('yes_confirmed', true)
                ->whereBetween('selected_at', ["{$year}-01-01", $eligibilityCutoff])
                ->whereBetween('fpe_completed_at', ["{$year}-01-01", $eligibilityCutoff])
                ->whereBetween('yes_confirmed_at', ["{$year}-01-01", $eligibilityCutoff]))
            ->orderBy('last_name')
            ->get(['id', 'reference', 'first_name', 'middle_name', 'last_name', 'suffix']);

        return Inertia::render('finance/copayments/index', [
            'copayments' => Copayment::with(['beneficiary', 'encounter.beneficiary'])
                ->where('facility_id', $facility->id)->where('year', $year)
                ->latest('paid_at')->paginate(15)->withQueryString(),
            'beneficiaries' => $eligibleBeneficiaries,
            'encounters' => Encounter::with('beneficiary')->where('facility_id', $facility->id)
                ->whereIn('beneficiary_id', $eligibleBeneficiaries->modelKeys())
                ->where('status', 'posted')
                ->whereYear('encounter_date', $year)->latest('encounter_date')->limit(100)->get(),
            'facility' => $facility,
            'policy' => PolicyVersion::where('facility_id', $facility->id)->where('effective_year', $year)->first(),
            'filters' => ['year' => $year],
            'years' => PolicyVersion::where('facility_id', $facility->id)->orderByDesc('effective_year')->pluck('effective_year'),
        ]);
    }

    public function store(CopaymentRequest $request, CopaymentService $service): RedirectResponse
    {
        $facility = $this->facility();
        $data = $request->validated();
        $policy = PolicyVersion::where('facility_id', $facility->id)
            ->where('effective_year', $data['year'])->firstOrFail();
        abort_unless(Beneficiary::whereKey($data['beneficiary_id'])->where('facility_id', $facility->id)->exists(), 422);
        if ($data['encounter_id'] ?? null) {
            abort_unless(Encounter::whereKey($data['encounter_id'])->where('facility_id', $facility->id)
                ->where('beneficiary_id', $data['beneficiary_id'])->exists(), 422);
        }
        $service->create($facility, $policy, [
            ...$data,
            'created_by' => $request->user()->id,
        ]);

        return back()->with('success', 'Co-payment recorded.');
    }

    public function void(Request $request, Copayment $copayment, AuditLogger $audit): RedirectResponse
    {
        abort_unless($copayment->facility_id === $this->facility()->id, 404);
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']]);
        DB::transaction(function () use ($copayment, $data, $audit): void {
            $lockedCopayment = Copayment::query()
                ->whereKey($copayment->id)
                ->lockForUpdate()
                ->firstOrFail();
            if ($lockedCopayment->voided_at !== null) {
                throw ValidationException::withMessages(['copayment' => 'The co-payment is already void.']);
            }
            $lockedCopayment->update(['voided_at' => now(), 'void_reason' => $data['reason']]);
            $audit->log('copayment.voided', "Voided co-payment {$lockedCopayment->reference}: {$data['reason']}", $lockedCopayment);
        });

        return back()->with('success', 'Co-payment voided; the original record was preserved.');
    }
}

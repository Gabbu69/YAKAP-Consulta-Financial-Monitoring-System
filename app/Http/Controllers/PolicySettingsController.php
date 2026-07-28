<?php

namespace App\Http\Controllers;

use App\Http\Requests\PolicyVersionRequest;
use App\Models\PolicyVersion;
use App\Services\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class PolicySettingsController extends Controller
{
    public function index(): Response
    {
        $facility = $this->facility();

        return Inertia::render('settings/policies', [
            'facility' => $facility,
            'policies' => PolicyVersion::where('facility_id', $facility->id)
                ->orderByDesc('effective_year')->get(),
            'defaultPerformanceRules' => [
                ['key' => 'consultation_utilization', 'label' => 'Primary care consultation', 'target' => 1.00, 'weight' => 0.30],
                ['key' => 'laboratory_utilization', 'label' => 'Laboratory utilization', 'target' => 0.50, 'weight' => 0.30],
                ['key' => 'antibiotic_access', 'label' => 'Antibiotic dispensing', 'target' => 0.15, 'weight' => 0.10],
                ['key' => 'ncd_medicine_access', 'label' => 'NCD medicine dispensing', 'target' => 0.20, 'weight' => 0.30],
            ],
        ]);
    }

    public function store(PolicyVersionRequest $request, AuditLogger $audit): RedirectResponse
    {
        $policy = PolicyVersion::create([
            ...$request->validated(),
            'facility_id' => $this->facility()->id,
            'created_by' => $request->user()->id,
        ]);
        $audit->log('policy.created', "Created {$policy->effective_year} policy", $policy, request: $request);

        return back()->with('success', 'Policy version created.');
    }

    public function update(
        PolicyVersionRequest $request,
        PolicyVersion $policy,
        AuditLogger $audit,
    ): RedirectResponse {
        abort_unless($policy->facility_id === $this->facility()->id, 404);
        DB::transaction(function () use ($request, $policy, $audit): void {
            $lockedPolicy = PolicyVersion::query()
                ->where('facility_id', $this->facility()->id)
                ->whereKey($policy->id)
                ->lockForUpdate()
                ->firstOrFail();
            $old = $lockedPolicy->toArray();
            $lockedPolicy->update($request->validated());
            $audit->log('policy.updated', "Updated {$lockedPolicy->effective_year} policy", $lockedPolicy, $old, $lockedPolicy->fresh()->toArray(), $request);
        });

        return back()->with('success', 'Policy version updated.');
    }
}

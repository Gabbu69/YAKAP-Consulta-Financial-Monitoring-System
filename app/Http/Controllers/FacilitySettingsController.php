<?php

namespace App\Http\Controllers;

use App\Enums\FacilityType;
use App\Http\Requests\FacilityRequest;
use App\Services\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class FacilitySettingsController extends Controller
{
    public function edit(): Response
    {
        return Inertia::render('settings/facility', [
            'facility' => $this->facility(),
            'facilityTypes' => FacilityType::cases(),
        ]);
    }

    public function update(FacilityRequest $request, AuditLogger $audit): RedirectResponse
    {
        $facility = $this->facility();
        $old = $facility->toArray();
        $facility->update($request->validated());
        $audit->log('facility.updated', 'Updated facility settings', $facility, $old, $facility->fresh()->toArray(), $request);

        return back()->with('success', 'Facility settings updated.');
    }
}

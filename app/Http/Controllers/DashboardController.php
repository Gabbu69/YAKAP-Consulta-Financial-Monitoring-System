<?php

namespace App\Http\Controllers;

use App\Models\PolicyVersion;
use App\Services\DashboardService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request, DashboardService $dashboard): Response
    {
        $facility = $this->facility();
        $availableYears = PolicyVersion::where('facility_id', $facility->id)
            ->orderByDesc('effective_year')->pluck('effective_year')->all();
        $years = count($availableYears) > 0 ? $availableYears : [(int) now()->year];
        $year = (int) $request->integer('year', $years[0]);

        return Inertia::render('dashboard', [
            ...$dashboard->forYear($facility, $year),
            'years' => $years,
        ]);
    }
}

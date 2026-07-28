<?php

namespace App\Http\Controllers;

use App\Enums\EncounterStatus;
use App\Http\Requests\EncounterRequest;
use App\Models\Beneficiary;
use App\Models\Encounter;
use App\Models\Service;
use App\Services\EncounterService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class EncounterController extends Controller
{
    public function index(Request $request): Response
    {
        $facility = $this->facility();
        $year = (int) $request->integer('year', now()->year);
        $search = trim((string) $request->string('search'));
        $status = (string) $request->string('status');
        $encounters = Encounter::with(['beneficiary', 'items'])
            ->where('facility_id', $facility->id)
            ->whereYear('encounter_date', $year)
            ->when($search, fn ($query) => $query->where(function ($query) use ($search) {
                $query->where('reference', 'like', "%{$search}%")
                    ->orWhereHas('beneficiary', fn ($query) => $query
                        ->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%"));
            }))
            ->when($status, fn ($query) => $query->where('status', $status))
            ->latest('encounter_date')->paginate(15)->withQueryString();

        return Inertia::render('encounters/index', [
            'encounters' => $encounters,
            'filters' => ['search' => $search, 'status' => $status, 'year' => $year],
            'years' => range(now()->year + 1, now()->year - 5),
            'statuses' => EncounterStatus::cases(),
        ]);
    }

    public function create(): Response
    {
        $facility = $this->facility();

        return Inertia::render('encounters/form', [
            'encounter' => null,
            'beneficiaries' => Beneficiary::where('facility_id', $facility->id)->active()
                ->orderBy('last_name')->get(['id', 'reference', 'first_name', 'middle_name', 'last_name', 'suffix']),
            'services' => Service::with('category')->where('is_active', true)->orderBy('name')->get(),
        ]);
    }

    public function store(EncounterRequest $request, EncounterService $service): RedirectResponse
    {
        $facility = $this->facility();
        abort_unless(
            Beneficiary::whereKey($request->integer('beneficiary_id'))->where('facility_id', $facility->id)->active()->exists(),
            422,
            'The selected beneficiary is unavailable.',
        );
        $encounter = $service->create([
            ...$request->validated(),
            'facility_id' => $facility->id,
            'user_id' => $request->user()->id,
        ]);

        return to_route('encounters.show', $encounter)->with('success', 'Encounter saved.');
    }

    public function show(Encounter $encounter): Response
    {
        abort_unless($encounter->facility_id === $this->facility()->id, 404);

        return Inertia::render('encounters/show', [
            'encounter' => $encounter->load(['beneficiary', 'items.service.category']),
        ]);
    }

    public function post(Encounter $encounter, EncounterService $service): RedirectResponse
    {
        abort_unless($encounter->facility_id === $this->facility()->id, 404);
        $service->post($encounter);

        return back()->with('success', 'Encounter posted.');
    }

    public function void(Request $request, Encounter $encounter, EncounterService $service): RedirectResponse
    {
        abort_unless($encounter->facility_id === $this->facility()->id, 404);
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']]);
        $service->void($encounter, $data['reason']);

        return back()->with('success', 'Encounter voided; its history was preserved.');
    }
}

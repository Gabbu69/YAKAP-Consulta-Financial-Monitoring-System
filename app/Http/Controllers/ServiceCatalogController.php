<?php

namespace App\Http\Controllers;

use App\Enums\ServiceClassification;
use App\Http\Requests\ServiceCatalogRequest;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Services\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ServiceCatalogController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim((string) $request->string('search'));
        $classification = (string) $request->string('classification');

        return Inertia::render('catalog/index', [
            'services' => Service::with('category')
                ->when($search, fn ($query) => $query->where(function ($query) use ($search) {
                    $query->where('code', 'like', "%{$search}%")->orWhere('name', 'like', "%{$search}%");
                }))
                ->when($classification, fn ($query) => $query->whereHas(
                    'category',
                    fn ($query) => $query->where('classification', $classification),
                ))
                ->orderBy('name')->paginate(20)->withQueryString(),
            'categories' => ServiceCategory::orderBy('name')->get(),
            'classifications' => ServiceClassification::cases(),
            'filters' => ['search' => $search, 'classification' => $classification],
        ]);
    }

    public function store(ServiceCatalogRequest $request, AuditLogger $audit): RedirectResponse
    {
        $data = $request->validated();
        $service = DB::transaction(function () use ($data): Service {
            $category = ServiceCategory::firstOrCreate(
                ['name' => $data['category_name'], 'classification' => $data['classification']],
                ['is_active' => true],
            );

            return Service::create([
                ...collect($data)->except(['category_name', 'classification'])->all(),
                'service_category_id' => $category->id,
            ]);
        });
        $audit->log('service.created', "Created service {$service->code}", $service);

        return back()->with('success', 'Service created.');
    }

    public function update(ServiceCatalogRequest $request, Service $service, AuditLogger $audit): RedirectResponse
    {
        $data = $request->validated();
        $old = $service->toArray();
        DB::transaction(function () use ($data, $service): void {
            $category = ServiceCategory::firstOrCreate(
                ['name' => $data['category_name'], 'classification' => $data['classification']],
                ['is_active' => true],
            );
            $service->update([
                ...collect($data)->except(['category_name', 'classification'])->all(),
                'service_category_id' => $category->id,
            ]);
        });
        $audit->log('service.updated', "Updated service {$service->code}", $service, $old, $service->fresh()->toArray());

        return back()->with('success', 'Service updated. Existing encounter snapshots were not changed.');
    }
}

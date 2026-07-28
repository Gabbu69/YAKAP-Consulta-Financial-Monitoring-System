<?php

namespace App\Http\Controllers;

use App\Enums\BeneficiaryType;
use App\Http\Requests\BeneficiaryImportRequest;
use App\Http\Requests\BeneficiaryRequest;
use App\Models\Beneficiary;
use App\Services\AuditLogger;
use App\Services\ReferenceNumberService;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BeneficiaryController extends Controller
{
    public function index(Request $request): Response
    {
        return $this->renderIndex($request);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('beneficiaries/form', [
            'beneficiary' => null,
            'yearStatus' => null,
            'year' => (int) $request->integer('year', now()->year),
            'beneficiaryTypes' => BeneficiaryType::cases(),
        ]);
    }

    public function store(
        BeneficiaryRequest $request,
        ReferenceNumberService $references,
        AuditLogger $audit,
    ): RedirectResponse {
        $facility = $this->facility();
        $data = $request->validated();
        $beneficiary = DB::transaction(function () use ($data, $facility, $references, $request, $audit): Beneficiary {
            $person = Beneficiary::create([
                ...collect($data)->except([
                    'year', 'selected', 'selected_at', 'fpe_completed', 'fpe_completed_at',
                    'pcu_reference', 'yes_confirmed', 'yes_confirmed_at',
                ])->all(),
                'facility_id' => $facility->id,
                'reference' => $references->beneficiary((int) $data['year']),
            ]);
            $person->yearlyStatuses()->create($this->yearData($data, $facility->id));
            $audit->log('beneficiary.created', "Created beneficiary {$person->reference}", $person, null, $person->toArray(), $request);

            return $person;
        });

        return to_route('beneficiaries.show', $beneficiary)->with('success', 'Beneficiary created.');
    }

    public function show(Beneficiary $beneficiary, Request $request): Response
    {
        $this->assertFacility($beneficiary);
        $year = (int) $request->integer('year', now()->year);

        return Inertia::render('beneficiaries/show', [
            'beneficiary' => $beneficiary->load([
                'yearlyStatuses' => fn ($query) => $query->orderByDesc('year'),
                'encounters' => fn ($query) => $query->with('items')->latest('encounter_date')->limit(10),
            ]),
            'year' => $year,
            'yearStatus' => $beneficiary->yearlyStatuses->firstWhere('year', $year),
        ]);
    }

    public function edit(Beneficiary $beneficiary, Request $request): Response
    {
        $this->assertFacility($beneficiary);
        $year = (int) $request->integer('year', now()->year);

        return Inertia::render('beneficiaries/form', [
            'beneficiary' => $beneficiary,
            'yearStatus' => $beneficiary->yearlyStatuses()->where('year', $year)->first(),
            'year' => $year,
            'beneficiaryTypes' => BeneficiaryType::cases(),
        ]);
    }

    public function update(
        BeneficiaryRequest $request,
        Beneficiary $beneficiary,
        AuditLogger $audit,
    ): RedirectResponse {
        $this->assertFacility($beneficiary);
        $data = $request->validated();
        DB::transaction(function () use ($data, $beneficiary, $audit, $request): void {
            $old = $beneficiary->toArray();
            $personData = collect($data)->except([
                'year', 'selected', 'selected_at', 'fpe_completed', 'fpe_completed_at',
                'pcu_reference', 'yes_confirmed', 'yes_confirmed_at',
            ])->filter(fn ($value, $key) => $key !== 'philhealth_pin' || filled($value))->all();
            $beneficiary->update($personData);
            $beneficiary->yearlyStatuses()->updateOrCreate(
                ['year' => $data['year']],
                $this->yearData($data, $beneficiary->facility_id),
            );
            $audit->log('beneficiary.updated', "Updated beneficiary {$beneficiary->reference}", $beneficiary, $old, $beneficiary->fresh()->toArray(), $request);
        });

        return to_route('beneficiaries.show', [$beneficiary, 'year' => $data['year']])
            ->with('success', 'Beneficiary updated.');
    }

    public function archive(Request $request, Beneficiary $beneficiary, AuditLogger $audit): RedirectResponse
    {
        $this->assertFacility($beneficiary);
        $beneficiary->update(['archived_at' => now()]);
        $beneficiary->delete();
        $audit->log('beneficiary.archived', "Archived beneficiary {$beneficiary->reference}", $beneficiary, request: $request);

        return to_route('beneficiaries.index')->with('success', 'Beneficiary archived.');
    }

    public function template(): StreamedResponse
    {
        return response()->streamDownload(function (): void {
            $stream = fopen('php://output', 'wb');
            if ($stream === false) {
                throw new \RuntimeException('Unable to open CSV output stream.');
            }
            fputcsv($stream, [
                'philhealth_pin', 'first_name', 'middle_name', 'last_name', 'suffix',
                'birth_date', 'sex', 'beneficiary_type', 'contact_number', 'address',
                'selected', 'selected_at', 'fpe_completed', 'fpe_completed_at',
                'pcu_reference', 'yes_confirmed', 'yes_confirmed_at',
            ]);
            fputcsv($stream, [
                '001234567890', 'Maria', 'Santos', 'Dela Cruz', '', '1985-04-12',
                'female', 'member', '09171234567', 'Sample address', '1', now()->toDateString(),
                '1', now()->toDateString(), 'PCU-SAMPLE-001', '1', now()->toDateString(),
            ]);
            fclose($stream);
        }, 'yakap-beneficiary-import-template.csv', ['Content-Type' => 'text/csv']);
    }

    public function export(Request $request): StreamedResponse
    {
        $facility = $this->facility();
        $year = (int) $request->integer('year', now()->year);
        $rows = Beneficiary::with(['yearlyStatuses' => fn ($query) => $query->where('year', $year)])
            ->where('facility_id', $facility->id)->active()->orderBy('last_name')->get();

        return response()->streamDownload(function () use ($rows, $year): void {
            $stream = fopen('php://output', 'wb');
            if ($stream === false) {
                throw new \RuntimeException('Unable to open CSV output stream.');
            }
            fputcsv($stream, [
                'reference', 'masked_philhealth_pin', 'full_name', 'birth_date',
                'sex', 'beneficiary_type', 'year', 'selected', 'fpe_completed',
                'pcu_reference', 'yes_confirmed', 'sap1_ready',
            ]);
            foreach ($rows as $row) {
                $status = $row->yearlyStatuses()->where('year', $year)->first();
                $statusValues = $status === null
                    ? ['selected' => false, 'fpe' => false, 'pcu' => null, 'yes' => false, 'ready' => false]
                    : [
                        'selected' => $status->selected,
                        'fpe' => $status->fpe_completed,
                        'pcu' => $status->pcu_reference,
                        'yes' => $status->yes_confirmed,
                        'ready' => $status->sap1_ready,
                    ];
                fputcsv($stream, [
                    $row->reference, $row->masked_philhealth_pin, $row->full_name,
                    $row->birth_date->format('Y-m-d'), $row->sex, $row->beneficiary_type->value,
                    $year, (int) $statusValues['selected'], (int) $statusValues['fpe'],
                    $statusValues['pcu'], (int) $statusValues['yes'], (int) $statusValues['ready'],
                ]);
            }
            fclose($stream);
        }, "yakap-beneficiaries-{$year}.csv", ['Content-Type' => 'text/csv']);
    }

    public function previewImport(BeneficiaryImportRequest $request): Response
    {
        [$rows, $errors] = $this->parseCsv($request->file('file')->getRealPath(), (int) $request->integer('year'));
        if (count($rows) > 500) {
            $errors[] = 'The import is limited to 500 data rows per file.';
            $rows = array_slice($rows, 0, 500);
        }
        $storedRows = array_map(function (array $row): array {
            if (isset($row['philhealth_pin'])) {
                $row['philhealth_pin'] = Crypt::encryptString((string) $row['philhealth_pin']);
            }

            return $row;
        }, $rows);
        $request->session()->put('beneficiary_import_preview', $storedRows);

        return $this->renderIndex($request, [
            'rows' => array_map(fn ($row) => collect($row)->except('philhealth_pin')->all(), $rows),
            'errors' => $errors,
            'year' => (int) $request->integer('year'),
            'validCount' => count($rows) - count(array_filter($rows, fn ($row) => isset($row['_errors']))),
        ]);
    }

    public function commitImport(Request $request, ReferenceNumberService $references, AuditLogger $audit): RedirectResponse
    {
        $storedRows = $request->session()->pull('beneficiary_import_preview', []);
        abort_if(! is_array($storedRows) || $storedRows === [], 422, 'No validated import preview is available.');
        $rows = [];
        foreach ($storedRows as $storedRow) {
            if (is_array($storedRow)) {
                $rows[] = $storedRow;
            }
        }
        abort_if($rows === [], 422, 'No valid import rows are available.');
        $facility = $this->facility();
        $imported = 0;

        DB::transaction(function () use ($rows, $facility, $references, $audit, $request, &$imported): void {
            foreach ($rows as $row) {
                if (isset($row['_errors'])) {
                    continue;
                }
                $row['philhealth_pin'] = Crypt::decryptString((string) $row['philhealth_pin']);
                $data = collect($row)->except('_errors')->all();
                $beneficiary = Beneficiary::create([
                    ...collect($data)->except([
                        'year', 'selected', 'selected_at', 'fpe_completed', 'fpe_completed_at',
                        'pcu_reference', 'yes_confirmed', 'yes_confirmed_at',
                    ])->all(),
                    'facility_id' => $facility->id,
                    'reference' => $references->beneficiary((int) $data['year']),
                ]);
                $beneficiary->yearlyStatuses()->create($this->yearData($data, $facility->id));
                $imported++;
            }
            $audit->log('beneficiary.imported', "Imported {$imported} beneficiaries", null, null, ['count' => $imported], $request);
        });

        return to_route('beneficiaries.index')->with('success', "Imported {$imported} beneficiaries.");
    }

    /** @param array<string, mixed> $extra */
    private function renderIndex(Request $request, array $extra = []): Response
    {
        $facility = $this->facility();
        $year = (int) $request->integer('year', now()->year);
        $search = trim((string) $request->string('search'));
        $pinHash = preg_match('/^\d{12}$/', $search) === 1
            ? Beneficiary::hashPin($search)
            : null;
        $readiness = (string) $request->string('readiness');
        $query = Beneficiary::query()->with([
            'yearlyStatuses' => fn ($query) => $query->where('year', $year),
        ])->where('facility_id', $facility->id)->active()
            ->when($search, fn ($query) => $query->where(function ($query) use ($search, $pinHash) {
                $query->where('reference', 'like', "%{$search}%")
                    ->orWhere('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%");
                if ($pinHash !== null) {
                    $query->orWhere('philhealth_pin_hash', $pinHash);
                }
            }))
            ->when($readiness === 'ready', fn ($query) => $query->whereHas(
                'yearlyStatuses',
                fn ($query) => $query->where('year', $year)
                    ->where('selected', true)->where('fpe_completed', true)
                    ->whereNotNull('pcu_reference')->where('pcu_reference', '!=', '')
                    ->where('yes_confirmed', true),
            ))
            ->when($readiness === 'not_ready', fn ($query) => $query->whereDoesntHave(
                'yearlyStatuses',
                fn ($query) => $query->where('year', $year)
                    ->where('selected', true)->where('fpe_completed', true)
                    ->whereNotNull('pcu_reference')->where('pcu_reference', '!=', '')
                    ->where('yes_confirmed', true),
            ));

        return Inertia::render('beneficiaries/index', [
            'beneficiaries' => $query->orderBy('last_name')->paginate(15)->withQueryString(),
            'filters' => ['search' => $search, 'year' => $year, 'readiness' => $readiness],
            'years' => range(now()->year + 1, now()->year - 5),
            'importPreview' => null,
            ...($extra === [] ? [] : ['importPreview' => $extra]),
        ]);
    }

    /** @return array{0:list<array<string,mixed>>,1:list<string>} */
    private function parseCsv(string $path, int $year): array
    {
        $handle = fopen($path, 'rb');
        if ($handle === false) {
            return [[], ['Unable to read the uploaded CSV file.']];
        }
        $headers = array_map(fn ($value) => trim((string) $value), fgetcsv($handle) ?: []);
        $required = ['philhealth_pin', 'first_name', 'last_name', 'birth_date', 'sex', 'beneficiary_type'];
        $errors = array_values(array_map(fn ($header) => "Missing required column: {$header}", array_diff($required, $headers)));
        if ($errors !== []) {
            fclose($handle);

            return [[], $errors];
        }

        $rows = [];
        $seenPinHashes = [];
        $line = 1;
        while (($values = fgetcsv($handle)) !== false && count($rows) < 501) {
            $line++;
            $values = array_pad($values, count($headers), null);
            $row = array_combine($headers, array_slice($values, 0, count($headers))) ?: [];
            $row['year'] = $year;
            foreach (['selected', 'fpe_completed', 'yes_confirmed'] as $boolean) {
                $row[$boolean] = filter_var($row[$boolean] ?? false, FILTER_VALIDATE_BOOLEAN);
            }
            $latestReadinessDate = CarbonImmutable::create($year, 12, 31, 0, 0, 0, 'Asia/Manila')
                ->min(CarbonImmutable::today('Asia/Manila'))
                ->toDateString();
            $validator = Validator::make($row, [
                'philhealth_pin' => ['required', 'regex:/^\d{12}$/'],
                'first_name' => ['required', 'string', 'max:100'],
                'middle_name' => ['nullable', 'string', 'max:100'],
                'last_name' => ['required', 'string', 'max:100'],
                'suffix' => ['nullable', 'string', 'max:20'],
                'birth_date' => ['required', 'date', 'before_or_equal:today'],
                'sex' => ['required', Rule::in(['female', 'male', 'intersex', 'not_stated'])],
                'beneficiary_type' => ['required', Rule::enum(BeneficiaryType::class)],
                'contact_number' => ['nullable', 'string', 'max:30'],
                'address' => ['nullable', 'string', 'max:500'],
                'selected_at' => [Rule::requiredIf((bool) $row['selected']), 'nullable', 'date', "after_or_equal:{$year}-01-01", "before_or_equal:{$latestReadinessDate}"],
                'fpe_completed_at' => [Rule::requiredIf((bool) $row['fpe_completed']), 'nullable', 'date', "after_or_equal:{$year}-01-01", "before_or_equal:{$latestReadinessDate}"],
                'pcu_reference' => ['nullable', 'string', 'max:100'],
                'yes_confirmed_at' => [Rule::requiredIf((bool) $row['yes_confirmed']), 'nullable', 'date', "after_or_equal:{$year}-01-01", "before_or_equal:{$latestReadinessDate}"],
            ]);
            $validator->passes();
            if ($row['fpe_completed'] && ! $row['selected']) {
                $validator->errors()->add('fpe_completed', 'FPE completion requires facility selection.');
            }
            if (! $validator->errors()->hasAny(['selected_at', 'fpe_completed_at'])
                && $row['selected']
                && $row['fpe_completed']
                && CarbonImmutable::parse((string) $row['fpe_completed_at'], 'Asia/Manila')
                    ->lessThan(CarbonImmutable::parse((string) $row['selected_at'], 'Asia/Manila'))) {
                $validator->errors()->add('fpe_completed_at', 'FPE completion cannot precede facility selection.');
            }
            $pinHash = Beneficiary::hashPin((string) ($row['philhealth_pin'] ?? ''));
            if (in_array($pinHash, $seenPinHashes, true)) {
                $validator->errors()->add('philhealth_pin', 'PIN is duplicated within this file.');
            } elseif (Beneficiary::withTrashed()->where('philhealth_pin_hash', $pinHash)->exists()) {
                $validator->errors()->add('philhealth_pin', 'PIN already exists.');
            }
            $seenPinHashes[] = $pinHash;
            if ($validator->errors()->isNotEmpty()) {
                $row['_errors'] = $validator->errors()->all();
                $errors[] = "Row {$line}: ".implode(' ', $row['_errors']);
            }
            $rows[] = $row;
        }
        fclose($handle);

        return [$rows, $errors];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function yearData(array $data, int $facilityId): array
    {
        return [
            'facility_id' => $facilityId,
            'year' => $data['year'],
            'selected' => $data['selected'],
            'selected_at' => $data['selected'] ? ($data['selected_at'] ?? now()->toDateString()) : null,
            'fpe_completed' => $data['fpe_completed'],
            'fpe_completed_at' => $data['fpe_completed'] ? ($data['fpe_completed_at'] ?? now()->toDateString()) : null,
            'pcu_reference' => $data['pcu_reference'] ?: null,
            'yes_confirmed' => $data['yes_confirmed'],
            'yes_confirmed_at' => $data['yes_confirmed'] ? ($data['yes_confirmed_at'] ?? now()->toDateString()) : null,
        ];
    }

    private function assertFacility(Beneficiary $beneficiary): void
    {
        abort_unless($beneficiary->facility_id === $this->facility()->id, 404);
    }
}

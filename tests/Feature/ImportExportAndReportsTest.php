<?php

use App\Enums\UserRole;
use App\Services\ReportService;
use Illuminate\Http\UploadedFile;
use Tests\Support\YakapFixtures;

it('provides a beneficiary CSV template and exports only masked identifiers', function () {
    $facility = YakapFixtures::facility();
    $user = YakapFixtures::user(UserRole::Encoder);
    $beneficiary = YakapFixtures::beneficiary($facility, [
        'philhealth_pin' => '123456789012',
    ]);
    YakapFixtures::readiness($beneficiary);

    $template = $this->actingAs($user)->get(route('beneficiaries.import.template'));
    $template->assertOk()
        ->assertHeader('content-disposition', 'attachment; filename=yakap-beneficiary-import-template.csv');
    expect($template->streamedContent())->toContain('philhealth_pin,first_name');

    $export = $this->actingAs($user)->get(route('beneficiaries.export', ['year' => 2026]));
    $content = $export->streamedContent();

    $export->assertOk();
    expect($content)
        ->toContain('masked_philhealth_pin')
        ->toContain('********9012')
        ->not->toContain('123456789012');
});

it('validates a beneficiary CSV preview before committing accepted rows', function () {
    $facility = YakapFixtures::facility();
    $user = YakapFixtures::user(UserRole::Encoder);
    $csv = implode("\n", [
        'philhealth_pin,first_name,middle_name,last_name,suffix,birth_date,sex,beneficiary_type,contact_number,address,selected,selected_at,fpe_completed,fpe_completed_at,pcu_reference,yes_confirmed,yes_confirmed_at',
        '123456789012,Alma,,Sample,,1990-05-10,female,member,,,1,2026-01-02,1,2026-01-03,PCU-TEST-1,1,2026-01-04',
        '123456789013,Late,,Sequence,,1990-05-10,female,member,,,1,2026-02-02,1,2026-01-03,PCU-TEST-2,1,2026-02-03',
        '123456789012,Duplicate,,PIN,,1991-05-10,male,member,,,1,2026-01-02,1,2026-01-03,PCU-TEST-3,1,2026-01-04',
        'invalid,Invalid,,Member,,2050-01-01,unknown,wrong,,,1,,1,,,1,',
    ]);

    $preview = $this->actingAs($user)
        ->withHeader('X-Inertia', 'true')
        ->post(route('beneficiaries.import.preview'), [
            'year' => 2026,
            'file' => UploadedFile::fake()->createWithContent('beneficiaries.csv', $csv),
        ]);

    $preview->assertOk()->assertSessionHas('beneficiary_import_preview');
    $this->actingAs($user)->post(route('beneficiaries.import.store'))->assertRedirect();

    $this->assertDatabaseCount('beneficiaries', 1);
    $this->assertDatabaseHas('beneficiary_years', [
        'facility_id' => $facility->id,
        'year' => 2026,
        'selected' => true,
        'fpe_completed' => true,
        'pcu_reference' => 'PCU-TEST-1',
        'yes_confirmed' => true,
    ]);
});

it('builds all seven supported reports for the selected year', function () {
    $facility = YakapFixtures::facility();
    YakapFixtures::policy($facility);
    $reports = app(ReportService::class);

    foreach (array_keys(ReportService::TYPES) as $type) {
        $report = $reports->build($type, $facility, 2026);
        expect($report)
            ->toHaveKeys(['title', 'headers', 'rows'])
            ->and($report['headers'])->not->toBeEmpty();
    }
});

it('downloads filtered financial reports as CSV and PDF', function () {
    $facility = YakapFixtures::facility();
    YakapFixtures::policy($facility);
    $user = YakapFixtures::user(UserRole::Auditor);

    $csv = $this->actingAs($user)->get(route('reports.export', [
        'type' => 'financial-summary',
        'format' => 'csv',
        'year' => 2026,
    ]));
    $csv->assertOk()
        ->assertDownload('yakap-financial-summary-2026.csv');
    expect($csv->streamedContent())->toContain('Financial Summary');

    $pdf = $this->actingAs($user)->get(route('reports.export', [
        'type' => 'sap-reconciliation',
        'format' => 'pdf',
        'year' => 2026,
    ]));
    $pdf->assertOk()
        ->assertDownload('yakap-sap-reconciliation-2026.pdf');
    expect($pdf->getContent())->toStartWith('%PDF');
});

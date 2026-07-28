<?php

use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\BeneficiaryController;
use App\Http\Controllers\CopaymentController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\EncounterController;
use App\Http\Controllers\FacilitySettingsController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\PolicySettingsController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\SapBatchController;
use App\Http\Controllers\ServiceCatalogController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/dashboard')->name('home');

Route::middleware(['auth', 'active', 'verified'])->group(function (): void {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    Route::get('beneficiaries', [BeneficiaryController::class, 'index'])->name('beneficiaries.index');
    Route::get('beneficiaries/export', [BeneficiaryController::class, 'export'])->name('beneficiaries.export');
    Route::get('beneficiaries/import/template', [BeneficiaryController::class, 'template'])->name('beneficiaries.import.template');
    Route::middleware('role:administrator,encoder')->group(function (): void {
        Route::get('beneficiaries/create', [BeneficiaryController::class, 'create'])->name('beneficiaries.create');
        Route::post('beneficiaries', [BeneficiaryController::class, 'store'])->name('beneficiaries.store');
        Route::post('beneficiaries/import/preview', [BeneficiaryController::class, 'previewImport'])->name('beneficiaries.import.preview');
        Route::post('beneficiaries/import', [BeneficiaryController::class, 'commitImport'])->name('beneficiaries.import.store');
        Route::get('beneficiaries/{beneficiary}/edit', [BeneficiaryController::class, 'edit'])->name('beneficiaries.edit');
        Route::patch('beneficiaries/{beneficiary}', [BeneficiaryController::class, 'update'])->name('beneficiaries.update');
    });
    Route::get('beneficiaries/{beneficiary}', [BeneficiaryController::class, 'show'])->name('beneficiaries.show');
    Route::delete('beneficiaries/{beneficiary}', [BeneficiaryController::class, 'archive'])
        ->middleware('role:administrator')->name('beneficiaries.archive');

    Route::get('encounters', [EncounterController::class, 'index'])->name('encounters.index');
    Route::middleware('role:administrator,encoder')->group(function (): void {
        Route::get('encounters/create', [EncounterController::class, 'create'])->name('encounters.create');
        Route::post('encounters', [EncounterController::class, 'store'])->name('encounters.store');
        Route::patch('encounters/{encounter}/post', [EncounterController::class, 'post'])->name('encounters.post');
    });
    Route::get('encounters/{encounter}', [EncounterController::class, 'show'])->name('encounters.show');
    Route::patch('encounters/{encounter}/void', [EncounterController::class, 'void'])
        ->middleware('role:administrator')->name('encounters.void');

    Route::get('catalog', [ServiceCatalogController::class, 'index'])->name('catalog.index');
    Route::middleware('role:administrator')->group(function (): void {
        Route::post('catalog', [ServiceCatalogController::class, 'store'])->name('catalog.store');
        Route::patch('catalog/{service}', [ServiceCatalogController::class, 'update'])->name('catalog.update');
    });

    Route::prefix('finance')->name('finance.')->group(function (): void {
        Route::get('sap-batches', [SapBatchController::class, 'index'])->name('sap-batches.index');
        Route::get('sap-batches/{sapBatch}', [SapBatchController::class, 'show'])->name('sap-batches.show');
        Route::get('payments', [PaymentController::class, 'index'])->name('payments.index');
        Route::get('copayments', [CopaymentController::class, 'index'])->name('copayments.index');
        Route::middleware('role:administrator,finance_officer')->group(function (): void {
            Route::post('sap-batches', [SapBatchController::class, 'store'])->name('sap-batches.store');
            Route::patch('sap-batches/{sapBatch}/status', [SapBatchController::class, 'updateStatus'])->name('sap-batches.status');
            Route::post('payments', [PaymentController::class, 'store'])->name('payments.store');
            Route::patch('payments/{payment}/void', [PaymentController::class, 'void'])->name('payments.void');
            Route::post('copayments', [CopaymentController::class, 'store'])->name('copayments.store');
            Route::patch('copayments/{copayment}/void', [CopaymentController::class, 'void'])->name('copayments.void');
        });
    });

    Route::get('reports', [ReportController::class, 'index'])->name('reports.index');
    Route::get('reports/{type}/{format}', [ReportController::class, 'export'])
        ->whereIn('format', ['csv', 'pdf'])->name('reports.export');

    Route::get('audit-log', [AuditLogController::class, 'index'])
        ->middleware('role:administrator,auditor')->name('audit-log.index');

    Route::middleware('role:administrator')->group(function (): void {
        Route::get('users', [UserController::class, 'index'])->name('users.index');
        Route::post('users', [UserController::class, 'store'])->name('users.store');
        Route::patch('users/{user}', [UserController::class, 'update'])->name('users.update');
        Route::get('settings/facility', [FacilitySettingsController::class, 'edit'])->name('facility.edit');
        Route::patch('settings/facility', [FacilitySettingsController::class, 'update'])->name('facility.update');
        Route::get('settings/policies', [PolicySettingsController::class, 'index'])->name('policies.index');
        Route::post('settings/policies', [PolicySettingsController::class, 'store'])->name('policies.store');
        Route::patch('settings/policies/{policy}', [PolicySettingsController::class, 'update'])->name('policies.update');
    });
});

require __DIR__.'/settings.php';

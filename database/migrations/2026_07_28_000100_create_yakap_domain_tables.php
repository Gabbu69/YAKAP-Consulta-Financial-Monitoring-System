<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('facilities', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('facility_code')->unique();
            $table->string('type')->default('public');
            $table->string('city')->nullable();
            $table->string('province')->nullable();
            $table->text('address')->nullable();
            $table->string('contact_email')->nullable();
            $table->string('contact_number')->nullable();
            $table->boolean('is_demo')->default(true);
            $table->timestamps();
        });

        Schema::create('policy_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facility_id')->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('effective_year');
            $table->string('source_circular');
            $table->string('source_url')->nullable();
            $table->unsignedInteger('per_capita_rate_centavos');
            $table->unsignedSmallInteger('sap1_percentage_bps')->default(4000);
            $table->unsignedSmallInteger('sap2_percentage_bps')->default(6000);
            $table->unsignedSmallInteger('withholding_tax_bps')->default(0);
            $table->unsignedInteger('copayment_cap_centavos')->default(90000);
            $table->json('performance_rules');
            $table->timestamp('locked_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['facility_id', 'effective_year']);
        });

        Schema::create('beneficiaries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facility_id')->constrained()->restrictOnDelete();
            $table->string('reference')->unique();
            $table->text('philhealth_pin');
            $table->string('philhealth_pin_hash', 64)->unique();
            $table->string('first_name');
            $table->string('middle_name')->nullable();
            $table->string('last_name');
            $table->string('suffix')->nullable();
            $table->date('birth_date');
            $table->string('sex', 20);
            $table->string('beneficiary_type')->default('member');
            $table->string('contact_number')->nullable();
            $table->text('address')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['facility_id', 'last_name']);
        });

        Schema::create('beneficiary_years', function (Blueprint $table) {
            $table->id();
            $table->foreignId('beneficiary_id')->constrained()->cascadeOnDelete();
            $table->foreignId('facility_id')->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('year');
            $table->boolean('selected')->default(false);
            $table->date('selected_at')->nullable();
            $table->boolean('fpe_completed')->default(false);
            $table->date('fpe_completed_at')->nullable();
            $table->string('pcu_reference')->nullable();
            $table->boolean('yes_confirmed')->default(false);
            $table->date('yes_confirmed_at')->nullable();
            $table->timestamps();
            $table->unique(['beneficiary_id', 'year']);
            $table->index(['facility_id', 'year']);
        });

        Schema::create('service_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('classification');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('services', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_category_id')->constrained()->restrictOnDelete();
            $table->string('code')->unique();
            $table->string('name');
            $table->string('unit')->default('service');
            $table->unsignedInteger('default_cost_centavos');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('encounters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facility_id')->constrained()->restrictOnDelete();
            $table->foreignId('beneficiary_id')->constrained()->restrictOnDelete();
            $table->string('reference')->unique();
            $table->date('encounter_date');
            $table->string('status')->default('draft');
            $table->timestamp('posted_at')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->text('void_reason')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['facility_id', 'encounter_date', 'status']);
        });

        Schema::create('encounter_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('encounter_id')->constrained()->cascadeOnDelete();
            $table->foreignId('service_id')->constrained()->restrictOnDelete();
            $table->string('service_code_snapshot');
            $table->string('service_name_snapshot');
            $table->string('classification_snapshot');
            $table->string('unit_snapshot');
            $table->unsignedInteger('unit_cost_centavos');
            $table->unsignedInteger('quantity');
            $table->unsignedBigInteger('total_cost_centavos');
            $table->boolean('is_repeat_laboratory')->default(false);
            $table->timestamps();
        });

        Schema::create('sap_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facility_id')->constrained()->restrictOnDelete();
            $table->foreignId('policy_version_id')->constrained()->restrictOnDelete();
            $table->string('reference')->unique();
            $table->unsignedTinyInteger('tranche');
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('month');
            $table->string('status')->default('draft');
            $table->unsignedInteger('eligible_beneficiary_count');
            $table->unsignedSmallInteger('performance_factor_bps')->default(10000);
            $table->unsignedBigInteger('expected_gross_centavos');
            $table->unsignedBigInteger('submitted_gross_centavos')->default(0);
            $table->unsignedBigInteger('approved_gross_centavos')->default(0);
            $table->unsignedBigInteger('withholding_tax_centavos')->default(0);
            $table->unsignedBigInteger('approved_net_centavos')->default(0);
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('returned_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['facility_id', 'year', 'status']);
            $table->index(['facility_id', 'year', 'tranche', 'month']);
        });

        Schema::create('sap_batch_beneficiaries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sap_batch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('beneficiary_id')->constrained()->restrictOnDelete();
            $table->string('beneficiary_reference_snapshot');
            $table->string('beneficiary_name_snapshot');
            $table->string('pin_masked_snapshot');
            $table->json('readiness_snapshot');
            $table->unsignedInteger('allocated_amount_centavos');
            $table->timestamps();
            $table->unique(['sap_batch_id', 'beneficiary_id']);
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sap_batch_id')->constrained()->restrictOnDelete();
            $table->string('reference')->unique();
            $table->unsignedBigInteger('amount_centavos');
            $table->date('paid_at');
            $table->string('method')->nullable();
            $table->string('external_reference')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->text('void_reason')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('copayments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facility_id')->constrained()->restrictOnDelete();
            $table->foreignId('beneficiary_id')->constrained()->restrictOnDelete();
            $table->foreignId('encounter_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('reference')->unique();
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('amount_centavos');
            $table->date('paid_at');
            $table->string('receipt_number')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->text('void_reason')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['beneficiary_id', 'year']);
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->nullableMorphs('auditable');
            $table->string('event');
            $table->text('description');
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamps();
            $table->index(['event', 'created_at']);
        });

        Schema::create('reference_sequences', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->unsignedBigInteger('current_value')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reference_sequences');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('copayments');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('sap_batch_beneficiaries');
        Schema::dropIfExists('sap_batches');
        Schema::dropIfExists('encounter_items');
        Schema::dropIfExists('encounters');
        Schema::dropIfExists('services');
        Schema::dropIfExists('service_categories');
        Schema::dropIfExists('beneficiary_years');
        Schema::dropIfExists('beneficiaries');
        Schema::dropIfExists('policy_versions');
        Schema::dropIfExists('facilities');
    }
};

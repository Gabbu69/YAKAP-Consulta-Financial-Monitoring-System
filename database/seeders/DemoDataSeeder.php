<?php

namespace Database\Seeders;

use App\Enums\BeneficiaryType;
use App\Enums\EncounterStatus;
use App\Enums\FacilityType;
use App\Enums\SapBatchStatus;
use App\Enums\ServiceClassification;
use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\Beneficiary;
use App\Models\BeneficiaryYear;
use App\Models\Encounter;
use App\Models\Facility;
use App\Models\Payment;
use App\Models\PolicyVersion;
use App\Models\SapBatch;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Models\User;
use App\Services\PolicyCalculator;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DemoDataSeeder extends Seeder
{
    /** @var array<int, User> */
    private array $users = [];

    /** @var Collection<int, Beneficiary> */
    private Collection $beneficiaries;

    /** @var array<string, Service> */
    private array $services = [];

    public function run(): void
    {
        DB::transaction(function (): void {
            $this->seedUsers();
            $facility = $this->seedFacility();
            $policies = $this->seedPolicies($facility);
            $this->seedCatalog();
            $this->seedBeneficiaries($facility);
            $encounterCounts = [
                2025 => $this->seedEncounters($facility, 2025, 12),
                2026 => $this->seedEncounters($facility, 2026, 7),
            ];
            $paymentCounts = [
                2025 => $this->seedSapBatches($facility, $policies[2025], 12),
                2026 => $this->seedSapBatches($facility, $policies[2026], 6),
            ];

            $this->seedReferenceSequences($encounterCounts, $paymentCounts);
            $this->seedAuditTrail($facility);

            DB::table('policy_versions')
                ->whereIn('id', [$policies[2025]->id, $policies[2026]->id])
                ->update(['locked_at' => now(), 'updated_at' => now()]);
        });
    }

    private function seedUsers(): void
    {
        $accounts = [
            UserRole::Administrator->value => ['Mara Villanueva', 'admin@yakap.test'],
            UserRole::Encoder->value => ['Paolo Reyes', 'encoder@yakap.test'],
            UserRole::FinanceOfficer->value => ['Lina Santos', 'finance@yakap.test'],
            UserRole::Auditor->value => ['Noel Garcia', 'auditor@yakap.test'],
        ];

        foreach ($accounts as $role => [$name, $email]) {
            $this->users[] = User::query()->create([
                'name' => $name,
                'email' => $email,
                'email_verified_at' => now(),
                'password' => Hash::make('password'),
                'role' => $role,
                'is_active' => true,
            ]);
        }
    }

    private function seedFacility(): Facility
    {
        return Facility::query()->create([
            'name' => 'YAKAP Community Primary Care Center',
            'facility_code' => 'YKP-DEMO-01',
            'type' => FacilityType::Public,
            'city' => 'Kidapawan City',
            'province' => 'Cotabato',
            'address' => 'Demo Civic Center, Barangay Maligaya',
            'contact_email' => 'finance@yakap.test',
            'contact_number' => '0917 000 2026',
            'is_demo' => true,
        ]);
    }

    /** @return array<int, PolicyVersion> */
    private function seedPolicies(Facility $facility): array
    {
        $rules = [
            ['key' => 'consultation_utilization', 'label' => 'Primary care consultation', 'target' => 1.00, 'weight' => 0.30],
            ['key' => 'laboratory_utilization', 'label' => 'Laboratory utilization', 'target' => 0.50, 'weight' => 0.30],
            ['key' => 'antibiotic_access', 'label' => 'Antibiotic dispensing', 'target' => 0.15, 'weight' => 0.10],
            ['key' => 'ncd_medicine_access', 'label' => 'NCD medicine dispensing', 'target' => 0.20, 'weight' => 0.30],
        ];

        $policies = [];
        foreach ([2025, 2026] as $year) {
            $policies[$year] = PolicyVersion::query()->create([
                'facility_id' => $facility->id,
                'effective_year' => $year,
                'source_circular' => 'PhilHealth Circular No. 2024-0013, Annex I',
                'source_url' => 'https://www.philhealth.gov.ph/circulars/2024/0013/Annex_I_Approved_Benefit_Payment.pdf',
                'per_capita_rate_centavos' => 170_000,
                'sap1_percentage_bps' => 4_000,
                'sap2_percentage_bps' => 6_000,
                'withholding_tax_bps' => 0,
                'copayment_cap_centavos' => 90_000,
                'performance_rules' => $rules,
                'created_by' => $this->user(UserRole::Administrator)->id,
            ]);
        }

        return $policies;
    }

    private function seedCatalog(): void
    {
        $catalog = [
            ['Consultations', ServiceClassification::Consultation, [
                ['CONS-FPE', 'First patient encounter', 'encounter', 35_000],
                ['CONS-FU', 'Primary care follow-up', 'encounter', 24_000],
            ]],
            ['Diagnostic laboratory', ServiceClassification::Laboratory, [
                ['LAB-FBS', 'Fasting blood sugar', 'test', 18_000],
                ['LAB-LIPID', 'Lipid profile', 'panel', 45_000],
                ['LAB-CBC', 'Complete blood count', 'test', 30_000],
            ]],
            ['Antibiotics', ServiceClassification::Antibiotic, [
                ['MED-AMOX', 'Amoxicillin course', 'course', 16_000],
            ]],
            ['NCD medicines', ServiceClassification::NcdMedicine, [
                ['MED-AMLO', 'Amlodipine 30-day supply', 'pack', 12_000],
                ['MED-METF', 'Metformin 30-day supply', 'pack', 15_000],
            ]],
            ['Other medicines', ServiceClassification::OtherDrug, [
                ['MED-PARA', 'Paracetamol pack', 'pack', 4_500],
            ]],
            ['Other primary-care services', ServiceClassification::Other, [
                ['OTH-COUNSEL', 'Lifestyle counseling', 'session', 10_000],
                ['OTH-WOUND', 'Basic wound care', 'session', 13_000],
            ]],
        ];

        foreach ($catalog as [$categoryName, $classification, $services]) {
            $category = ServiceCategory::query()->create([
                'name' => $categoryName,
                'classification' => $classification,
                'is_active' => true,
            ]);

            foreach ($services as [$code, $name, $unit, $cost]) {
                $this->services[$code] = Service::query()->create([
                    'service_category_id' => $category->id,
                    'code' => $code,
                    'name' => $name,
                    'unit' => $unit,
                    'default_cost_centavos' => $cost,
                    'is_active' => true,
                ]);
            }
        }
    }

    private function seedBeneficiaries(Facility $facility): void
    {
        $firstNames = [
            'Ana', 'Ben', 'Cara', 'Danilo', 'Elena', 'Felix', 'Grace', 'Hector',
            'Iris', 'Joel', 'Katrina', 'Luis', 'Maya', 'Nico', 'Olivia', 'Pedro',
            'Queenie', 'Ramon', 'Sofia', 'Tomas', 'Una', 'Victor', 'Wena', 'Xavier',
        ];
        $lastNames = [
            'Abad', 'Bautista', 'Castro', 'Domingo', 'Evangelista', 'Flores',
            'Gonzales', 'Herrera', 'Ignacio', 'Jimenez', 'Katigbak', 'Lim',
            'Mendoza', 'Navarro', 'Ocampo', 'Pascual', 'Quinto', 'Rivera',
            'Soriano', 'Tolentino', 'Uy', 'Valdez', 'Williams', 'Yap',
        ];
        $types = BeneficiaryType::cases();
        $rows = collect();

        for ($index = 1; $index <= 48; $index++) {
            $beneficiary = Beneficiary::query()->create([
                'facility_id' => $facility->id,
                'reference' => sprintf('YKP-2025-%06d', $index),
                'philhealth_pin' => sprintf('12%010d', $index),
                'first_name' => $firstNames[($index - 1) % count($firstNames)],
                'middle_name' => $index % 3 === 0 ? 'Demo' : null,
                'last_name' => $lastNames[(($index * 7) - 1) % count($lastNames)],
                'birth_date' => CarbonImmutable::create(
                    1948 + (($index * 3) % 50),
                    (($index * 5) % 12) + 1,
                    (($index * 7) % 27) + 1,
                ),
                'sex' => $index % 2 === 0 ? 'female' : 'male',
                'beneficiary_type' => $types[($index - 1) % count($types)],
                'contact_number' => sprintf('09%09d', 100000000 + $index),
                'address' => sprintf('House %d, Barangay Maligaya (fictional)', 100 + $index),
            ]);

            foreach ([2025, 2026] as $year) {
                $selected = $index <= ($year === 2025 ? 44 : 43);
                $fpe = $index <= ($year === 2025 ? 40 : 39);
                $pcu = $index <= ($year === 2025 ? 37 : 36);
                $yes = $index <= ($year === 2025 ? 34 : 33);

                BeneficiaryYear::query()->create([
                    'beneficiary_id' => $beneficiary->id,
                    'facility_id' => $facility->id,
                    'year' => $year,
                    'selected' => $selected,
                    'selected_at' => $selected ? "{$year}-01-02" : null,
                    'fpe_completed' => $fpe,
                    'fpe_completed_at' => $fpe ? "{$year}-01-03" : null,
                    'pcu_reference' => $pcu ? sprintf('PCU-%d-%05d', $year, $index) : null,
                    'yes_confirmed' => $yes,
                    'yes_confirmed_at' => $yes ? "{$year}-01-04" : null,
                ]);
            }

            $rows->push($beneficiary);
        }

        $this->beneficiaries = $rows;
    }

    private function seedEncounters(Facility $facility, int $year, int $months): int
    {
        $sequence = 0;

        for ($month = 1; $month <= $months; $month++) {
            for ($offset = 0; $offset < 8; $offset++) {
                $sequence++;
                $beneficiary = $this->beneficiaries[(($month - 1) * 5 + $offset) % 39];
                $date = CarbonImmutable::create($year, $month, min(4 + ($offset * 3), 27));
                $encounter = Encounter::query()->create([
                    'facility_id' => $facility->id,
                    'beneficiary_id' => $beneficiary->id,
                    'reference' => sprintf('ENC-%d-%06d', $year, $sequence),
                    'encounter_date' => $date,
                    'status' => EncounterStatus::Posted,
                    'posted_at' => $date->setTime(16, 0),
                    'created_by' => $this->user(UserRole::Encoder)->id,
                    'updated_by' => $this->user(UserRole::Encoder)->id,
                ]);

                $consultation = ($month + $offset) % 3 === 0 ? 'CONS-FPE' : 'CONS-FU';
                $this->addEncounterItem($encounter, $consultation, 1);

                if ($offset < 5 || ($month + $offset) % 2 === 0) {
                    $laboratory = ['LAB-FBS', 'LAB-LIPID', 'LAB-CBC'][($month + $offset) % 3];
                    $this->addEncounterItem(
                        $encounter,
                        $laboratory,
                        1,
                        $year === 2026 || $month > 6,
                    );
                }

                if ($offset % 4 !== 0) {
                    $medicine = ['MED-AMLO', 'MED-METF', 'MED-AMOX', 'MED-PARA'][($month + $offset) % 4];
                    $this->addEncounterItem($encounter, $medicine, $medicine === 'MED-PARA' ? 2 : 1);
                }

                if (($month + $offset) % 4 === 0) {
                    $this->addEncounterItem($encounter, 'OTH-COUNSEL', 1);
                }
            }
        }

        return $sequence;
    }

    private function addEncounterItem(
        Encounter $encounter,
        string $serviceCode,
        int $quantity,
        bool $repeatLaboratory = false,
    ): void {
        $service = $this->services[$serviceCode];
        $service->loadMissing('category');

        $encounter->items()->create([
            'service_id' => $service->id,
            'service_code_snapshot' => $service->code,
            'service_name_snapshot' => $service->name,
            'classification_snapshot' => $service->category->classification->value,
            'unit_snapshot' => $service->unit,
            'unit_cost_centavos' => $service->default_cost_centavos,
            'quantity' => $quantity,
            'total_cost_centavos' => $service->default_cost_centavos * $quantity,
            'is_repeat_laboratory' => $repeatLaboratory,
        ]);
    }

    private function seedSapBatches(
        Facility $facility,
        PolicyVersion $policy,
        int $months,
    ): int {
        $calculator = app(PolicyCalculator::class);
        $paymentSequence = 0;
        $sap1Members = BeneficiaryYear::query()
            ->with('beneficiary')
            ->where('facility_id', $facility->id)
            ->where('year', $policy->effective_year)
            ->sap1Ready()
            ->whereHas('beneficiary', fn ($query) => $query
                ->whereNull('archived_at')->whereNull('deleted_at'))
            ->orderBy('beneficiary_id')
            ->get()
            ->pluck('beneficiary')
            ->values();
        $cohortSize = max(1, (int) ceil($sap1Members->count() / max($months, 1)));
        $monthlyCohorts = $sap1Members->chunk($cohortSize)->values();

        for ($month = 1; $month <= $months; $month++) {
            /** @var Collection<int, Beneficiary> $members */
            $members = $monthlyCohorts->get($month - 1, collect());
            if ($members->isNotEmpty()) {
                $this->seedSapBatch(
                    $facility,
                    $policy,
                    1,
                    $month,
                    $members,
                    $this->batchStatus($policy->effective_year, $month),
                    10_000,
                    $paymentSequence,
                );
            }
        }

        if ($months === 12) {
            /** @var Collection<int, Beneficiary> $annualMembers */
            $annualMembers = BeneficiaryYear::query()
                ->with('beneficiary')
                ->where('facility_id', $facility->id)
                ->where('year', $policy->effective_year)
                ->sap2Eligible($policy->effective_year)
                ->whereHas('beneficiary', fn ($query) => $query
                    ->whereNull('archived_at')->whereNull('deleted_at'))
                ->orderBy('beneficiary_id')
                ->get()
                ->pluck('beneficiary')
                ->values();
            $performance = $calculator->performance($facility, $policy, $policy->effective_year);
            $this->seedSapBatch(
                $facility,
                $policy,
                2,
                12,
                $annualMembers,
                SapBatchStatus::Approved,
                $performance['factor_bps'],
                $paymentSequence,
            );
        }

        return $paymentSequence;
    }

    /** @param Collection<int, Beneficiary> $members */
    private function seedSapBatch(
        Facility $facility,
        PolicyVersion $policy,
        int $tranche,
        int $month,
        Collection $members,
        SapBatchStatus $status,
        int $performanceFactorBps,
        int &$paymentSequence,
    ): void {
        $calculator = app(PolicyCalculator::class);
        $eligibleCount = $members->count();
        $expected = $tranche === 1
            ? $calculator->sap1Expected($eligibleCount, $policy)
            : $calculator->sap2Expected($eligibleCount, $policy, $performanceFactorBps);
        $submitted = in_array($status, [
            SapBatchStatus::Submitted,
            SapBatchStatus::Approved,
            SapBatchStatus::PartiallyPaid,
            SapBatchStatus::Paid,
            SapBatchStatus::Returned,
        ], true) ? (int) round($expected * (0.97 + (($month % 3) * 0.01))) : 0;
        $approved = in_array($status, [
            SapBatchStatus::Approved,
            SapBatchStatus::PartiallyPaid,
            SapBatchStatus::Paid,
        ], true) ? (int) round($submitted * 0.99) : 0;

        $batch = SapBatch::query()->create([
            'facility_id' => $facility->id,
            'policy_version_id' => $policy->id,
            'reference' => sprintf('SAP%d-%d%02d-0001', $tranche, $policy->effective_year, $month),
            'tranche' => $tranche,
            'year' => $policy->effective_year,
            'month' => $month,
            'status' => $status,
            'eligible_beneficiary_count' => $eligibleCount,
            'performance_factor_bps' => $performanceFactorBps,
            'expected_gross_centavos' => $expected,
            'submitted_gross_centavos' => $submitted,
            'approved_gross_centavos' => $approved,
            'withholding_tax_centavos' => 0,
            'approved_net_centavos' => $approved,
            'submitted_at' => $submitted > 0
                ? ($tranche === 2
                    ? CarbonImmutable::create($policy->effective_year + 1, 1, 8)
                    : CarbonImmutable::create($policy->effective_year, $month, 18))
                : null,
            'approved_at' => $approved > 0
                ? ($tranche === 2
                    ? CarbonImmutable::create($policy->effective_year + 1, 1, 12)
                    : CarbonImmutable::create($policy->effective_year, $month, 24))
                : null,
            'returned_at' => $status === SapBatchStatus::Returned
                ? CarbonImmutable::create($policy->effective_year, $month, 25)
                : null,
            'cancelled_at' => $status === SapBatchStatus::Cancelled
                ? CarbonImmutable::create($policy->effective_year, $month, 16)
                : null,
            'notes' => $tranche === 2
                ? 'Synthetic annual-close SAP2 batch; not an official PhilHealth submission.'
                : 'Synthetic demo SAP1 batch; not an official PhilHealth submission.',
            'created_by' => $this->user(UserRole::FinanceOfficer)->id,
        ]);

        $allocated = intdiv($expected, max($eligibleCount, 1));
        foreach ($members as $memberIndex => $member) {
            $statusSnapshot = $member->yearlyStatuses()
                ->where('year', $policy->effective_year)
                ->firstOrFail();
            $amount = $memberIndex === $eligibleCount - 1
                ? $expected - ($allocated * ($eligibleCount - 1))
                : $allocated;

            $batch->beneficiaries()->create([
                'beneficiary_id' => $member->id,
                'beneficiary_reference_snapshot' => $member->reference,
                'beneficiary_name_snapshot' => $member->full_name,
                'pin_masked_snapshot' => $member->masked_philhealth_pin,
                'readiness_snapshot' => [
                    'selected' => $statusSnapshot->selected,
                    'fpe_completed' => $statusSnapshot->fpe_completed,
                    'pcu_reference' => $statusSnapshot->pcu_reference,
                    'yes_confirmed' => $statusSnapshot->yes_confirmed,
                ],
                'allocated_amount_centavos' => $amount,
            ]);
        }

        if (in_array($status, [SapBatchStatus::Paid, SapBatchStatus::PartiallyPaid], true)) {
            $paymentSequence++;
            $amount = $status === SapBatchStatus::Paid
                ? $approved
                : (int) round($approved * 0.58);

            Payment::query()->create([
                'sap_batch_id' => $batch->id,
                'reference' => sprintf('PAY-%d-%06d', $policy->effective_year, $paymentSequence),
                'amount_centavos' => $amount,
                'paid_at' => CarbonImmutable::create($policy->effective_year, $month, 28),
                'method' => 'Bank transfer',
                'external_reference' => sprintf('DEMO-TRX-%d-%02d', $policy->effective_year, $month),
                'notes' => 'Synthetic demo payment.',
                'created_by' => $this->user(UserRole::FinanceOfficer)->id,
            ]);
        }
    }

    private function batchStatus(int $year, int $month): SapBatchStatus
    {
        if ($year === 2025) {
            return match ($month) {
                1, 2, 3, 4, 5, 7, 8, 10 => SapBatchStatus::Paid,
                6, 9 => SapBatchStatus::PartiallyPaid,
                11 => SapBatchStatus::Approved,
                default => SapBatchStatus::Returned,
            };
        }

        return match ($month) {
            1, 2 => SapBatchStatus::Paid,
            3 => SapBatchStatus::PartiallyPaid,
            4 => SapBatchStatus::Approved,
            5 => SapBatchStatus::Submitted,
            6 => SapBatchStatus::Returned,
            default => SapBatchStatus::Draft,
        };
    }

    /**
     * @param  array<int, int>  $encounterCounts
     * @param  array<int, int>  $paymentCounts
     */
    private function seedReferenceSequences(array $encounterCounts, array $paymentCounts): void
    {
        $now = now();
        $sequences = [
            ['key' => 'beneficiary:2025', 'current_value' => 48],
        ];

        foreach ($encounterCounts as $year => $count) {
            $sequences[] = ['key' => "encounter:{$year}", 'current_value' => $count];
        }
        foreach ($paymentCounts as $year => $count) {
            $sequences[] = ['key' => "payment:{$year}", 'current_value' => $count];
        }
        foreach ([2025 => 12, 2026 => 6] as $year => $months) {
            for ($month = 1; $month <= $months; $month++) {
                $sequences[] = [
                    'key' => sprintf('sap1:%d%02d', $year, $month),
                    'current_value' => 1,
                ];
            }
        }
        $sequences[] = ['key' => 'sap2:202512', 'current_value' => 1];

        DB::table('reference_sequences')->insert(array_map(
            fn (array $row): array => $row + ['created_at' => $now, 'updated_at' => $now],
            $sequences,
        ));
    }

    private function seedAuditTrail(Facility $facility): void
    {
        $events = [
            [UserRole::Administrator, 'facility.created', 'Configured the demo primary-care facility'],
            [UserRole::Administrator, 'policy.created', 'Created and locked the 2026 financial policy version'],
            [UserRole::Encoder, 'beneficiary.imported', 'Imported 48 fictional beneficiary records'],
            [UserRole::Encoder, 'beneficiary.readiness.updated', 'Updated FPE, PCU, and digital YES readiness'],
            [UserRole::Encoder, 'encounter.created', 'Recorded a multi-line primary-care encounter'],
            [UserRole::Encoder, 'encounter.posted', 'Posted encounter costs to the 2026 monitoring year'],
            [UserRole::FinanceOfficer, 'sap_batch.created', 'Generated a frozen SAP1 beneficiary snapshot'],
            [UserRole::FinanceOfficer, 'sap_batch.submitted', 'Marked a SAP batch as submitted'],
            [UserRole::FinanceOfficer, 'sap_batch.approved', 'Recorded the approved net reimbursement'],
            [UserRole::FinanceOfficer, 'payment.created', 'Recorded a partial reimbursement payment'],
            [UserRole::Administrator, 'user.created', 'Added a read-only audit account'],
            [UserRole::Auditor, 'report.exported', 'Exported a filtered financial summary report'],
        ];

        foreach ($events as $index => [$role, $event, $description]) {
            AuditLog::query()->create([
                'user_id' => $this->user($role)->id,
                'auditable_type' => Facility::class,
                'auditable_id' => $facility->id,
                'event' => $event,
                'description' => $description,
                'old_values' => null,
                'new_values' => ['demo' => true],
                'ip_address' => '127.0.0.1',
                'user_agent' => 'YAKAP demo data seeder',
                'created_at' => now()->subDays(count($events) - $index),
            ]);
        }
    }

    private function user(UserRole $role): User
    {
        return collect($this->users)
            ->first(fn (User $user): bool => $user->role === $role)
            ?? throw new \RuntimeException("Missing demo user for {$role->value}.");
    }
}

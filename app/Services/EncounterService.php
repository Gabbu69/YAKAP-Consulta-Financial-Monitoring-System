<?php

namespace App\Services;

use App\Enums\EncounterStatus;
use App\Enums\ServiceClassification;
use App\Models\Encounter;
use App\Models\Service;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class EncounterService
{
    public function __construct(
        private ReferenceNumberService $references,
        private AuditLogger $audit,
    ) {}

    /** @param array<string, mixed> $data */
    public function create(array $data): Encounter
    {
        return DB::transaction(function () use ($data): Encounter {
            $status = ($data['post_now'] ?? false) ? EncounterStatus::Posted : EncounterStatus::Draft;
            $encounter = Encounter::create([
                'facility_id' => $data['facility_id'],
                'beneficiary_id' => $data['beneficiary_id'],
                'reference' => $this->references->encounter((int) date('Y', strtotime($data['encounter_date']))),
                'encounter_date' => $data['encounter_date'],
                'status' => $status,
                'posted_at' => $status === EncounterStatus::Posted ? now() : null,
                'created_by' => $data['user_id'],
                'updated_by' => $data['user_id'],
            ]);

            foreach ($data['items'] as $item) {
                $service = Service::query()->with('category')
                    ->whereKey((int) $item['service_id'])->firstOrFail();
                $repeat = (bool) ($item['is_repeat_laboratory'] ?? false);
                if ($repeat) {
                    $this->validatePriorLaboratory($encounter, $service);
                }
                $quantity = (int) $item['quantity'];
                $unitCost = (int) $service->default_cost_centavos;
                $encounter->items()->create([
                    'service_id' => $service->id,
                    'service_code_snapshot' => $service->code,
                    'service_name_snapshot' => $service->name,
                    'classification_snapshot' => $service->category->classification->value,
                    'unit_snapshot' => $service->unit,
                    'unit_cost_centavos' => $unitCost,
                    'quantity' => $quantity,
                    'total_cost_centavos' => $unitCost * $quantity,
                    'is_repeat_laboratory' => $repeat,
                ]);
            }

            $this->audit->log('encounter.created', "Created encounter {$encounter->reference}", $encounter, null, $encounter->toArray());

            return $encounter->load(['beneficiary', 'items']);
        });
    }

    public function post(Encounter $encounter): Encounter
    {
        return DB::transaction(function () use ($encounter): Encounter {
            $lockedEncounter = Encounter::query()
                ->whereKey($encounter->id)
                ->lockForUpdate()
                ->firstOrFail();
            if ($lockedEncounter->status !== EncounterStatus::Draft) {
                throw ValidationException::withMessages(['status' => 'Only draft encounters may be posted.']);
            }
            if (! $lockedEncounter->items()->exists()) {
                throw ValidationException::withMessages(['items' => 'An encounter must contain at least one item.']);
            }
            $lockedEncounter->update(['status' => EncounterStatus::Posted, 'posted_at' => now()]);
            $this->audit->log('encounter.posted', "Posted encounter {$lockedEncounter->reference}", $lockedEncounter);

            return $lockedEncounter;
        });
    }

    public function void(Encounter $encounter, string $reason): Encounter
    {
        return DB::transaction(function () use ($encounter, $reason): Encounter {
            $lockedEncounter = Encounter::query()
                ->whereKey($encounter->id)
                ->lockForUpdate()
                ->firstOrFail();
            if ($lockedEncounter->status === EncounterStatus::Void) {
                throw ValidationException::withMessages(['status' => 'The encounter is already void.']);
            }
            $lockedEncounter->update([
                'status' => EncounterStatus::Void,
                'voided_at' => now(),
                'void_reason' => $reason,
            ]);
            $this->audit->log('encounter.voided', "Voided encounter {$lockedEncounter->reference}: {$reason}", $lockedEncounter);

            return $lockedEncounter;
        });
    }

    private function validatePriorLaboratory(Encounter $encounter, Service $service): void
    {
        if ($service->category->classification !== ServiceClassification::Laboratory) {
            throw ValidationException::withMessages([
                'items' => 'Only laboratory services may be marked as repeat tests.',
            ]);
        }

        $exists = Encounter::query()
            ->where('beneficiary_id', $encounter->beneficiary_id)
            ->where('encounter_date', '<', $encounter->encounter_date)
            ->where('status', EncounterStatus::Posted->value)
            ->whereHas('items', fn ($query) => $query->where('service_id', $service->id))
            ->exists();

        if (! $exists) {
            throw ValidationException::withMessages([
                'items' => "Repeat laboratory service {$service->name} needs an earlier posted matching service.",
            ]);
        }
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $encounter_id
 * @property int $service_id
 * @property string $service_code_snapshot
 * @property string $service_name_snapshot
 * @property string $classification_snapshot
 * @property string $unit_snapshot
 * @property int $unit_cost_centavos
 * @property int $quantity
 * @property int $total_cost_centavos
 * @property bool $is_repeat_laboratory
 * @property-read Encounter $encounter
 * @property-read Service $service
 */
class EncounterItem extends Model
{
    protected $fillable = [
        'encounter_id', 'service_id', 'service_code_snapshot', 'service_name_snapshot',
        'classification_snapshot', 'unit_snapshot', 'unit_cost_centavos',
        'quantity', 'total_cost_centavos', 'is_repeat_laboratory',
    ];

    protected function casts(): array
    {
        return ['is_repeat_laboratory' => 'boolean'];
    }

    /** @return BelongsTo<Encounter, $this> */
    public function encounter(): BelongsTo
    {
        return $this->belongsTo(Encounter::class);
    }

    /** @return BelongsTo<Service, $this> */
    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }
}

<?php

namespace App\Models;

use App\Enums\EncounterStatus;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $facility_id
 * @property int $beneficiary_id
 * @property string $reference
 * @property Carbon $encounter_date
 * @property EncounterStatus $status
 * @property Carbon|null $posted_at
 * @property Carbon|null $voided_at
 * @property string|null $void_reason
 * @property-read Beneficiary $beneficiary
 * @property-read Collection<int, EncounterItem> $items
 * @property-read int $total_cost_centavos
 */
class Encounter extends Model
{
    protected $fillable = [
        'facility_id', 'beneficiary_id', 'reference', 'encounter_date', 'status',
        'posted_at', 'voided_at', 'void_reason', 'created_by', 'updated_by',
    ];

    protected $appends = ['total_cost_centavos'];

    protected function casts(): array
    {
        return [
            'encounter_date' => 'date:Y-m-d',
            'status' => EncounterStatus::class,
            'posted_at' => 'datetime',
            'voided_at' => 'datetime',
        ];
    }

    public function getTotalCostCentavosAttribute(): int
    {
        return (int) ($this->relationLoaded('items')
            ? $this->items->sum('total_cost_centavos')
            : $this->items()->sum('total_cost_centavos'));
    }

    /** @return BelongsTo<Beneficiary, $this> */
    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }

    /** @return HasMany<EncounterItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(EncounterItem::class);
    }
}

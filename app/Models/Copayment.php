<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $facility_id
 * @property int $beneficiary_id
 * @property int|null $encounter_id
 * @property string $reference
 * @property int $year
 * @property int $amount_centavos
 * @property Carbon $paid_at
 * @property string|null $receipt_number
 * @property Carbon|null $voided_at
 * @property string|null $void_reason
 * @property-read Beneficiary $beneficiary
 * @property-read Encounter|null $encounter
 */
class Copayment extends Model
{
    protected $fillable = [
        'facility_id', 'beneficiary_id', 'encounter_id', 'reference', 'year',
        'amount_centavos', 'paid_at', 'receipt_number', 'notes', 'voided_at',
        'void_reason', 'created_by',
    ];

    protected function casts(): array
    {
        return ['paid_at' => 'date:Y-m-d', 'voided_at' => 'datetime'];
    }

    /** @return BelongsTo<Beneficiary, $this> */
    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class)->withTrashed();
    }

    /** @return BelongsTo<Encounter, $this> */
    public function encounter(): BelongsTo
    {
        return $this->belongsTo(Encounter::class);
    }
}

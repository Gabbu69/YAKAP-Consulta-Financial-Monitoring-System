<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $sap_batch_id
 * @property int $beneficiary_id
 * @property string $beneficiary_reference_snapshot
 * @property string $beneficiary_name_snapshot
 * @property string $pin_masked_snapshot
 * @property array<string,mixed> $readiness_snapshot
 * @property int $allocated_amount_centavos
 */
class SapBatchBeneficiary extends Model
{
    protected $fillable = [
        'sap_batch_id', 'beneficiary_id', 'beneficiary_reference_snapshot',
        'beneficiary_name_snapshot', 'pin_masked_snapshot', 'readiness_snapshot',
        'allocated_amount_centavos',
    ];

    protected function casts(): array
    {
        return ['readiness_snapshot' => 'array'];
    }

    /** @return BelongsTo<SapBatch, $this> */
    public function batch(): BelongsTo
    {
        return $this->belongsTo(SapBatch::class, 'sap_batch_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $sap_batch_id
 * @property string $reference
 * @property int $amount_centavos
 * @property Carbon $paid_at
 * @property Carbon|null $voided_at
 * @property string|null $void_reason
 * @property-read SapBatch $batch
 */
class Payment extends Model
{
    protected $fillable = [
        'sap_batch_id', 'reference', 'amount_centavos', 'paid_at', 'method',
        'external_reference', 'notes', 'voided_at', 'void_reason', 'created_by',
    ];

    protected function casts(): array
    {
        return ['paid_at' => 'date:Y-m-d', 'voided_at' => 'datetime'];
    }

    /** @return BelongsTo<SapBatch, $this> */
    public function batch(): BelongsTo
    {
        return $this->belongsTo(SapBatch::class, 'sap_batch_id');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

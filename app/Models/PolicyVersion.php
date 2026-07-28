<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * @property int $id
 * @property int $facility_id
 * @property int $effective_year
 * @property string $source_circular
 * @property string|null $source_url
 * @property int $per_capita_rate_centavos
 * @property int $sap1_percentage_bps
 * @property int $sap2_percentage_bps
 * @property int $withholding_tax_bps
 * @property int $copayment_cap_centavos
 * @property list<array{key:string,label:string,target:float,weight:float}> $performance_rules
 * @property Carbon|null $locked_at
 * @property-read Facility $facility
 */
class PolicyVersion extends Model
{
    protected $fillable = [
        'facility_id', 'effective_year', 'source_circular', 'source_url',
        'per_capita_rate_centavos', 'sap1_percentage_bps', 'sap2_percentage_bps',
        'withholding_tax_bps', 'copayment_cap_centavos', 'performance_rules', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'effective_year' => 'integer',
            'performance_rules' => 'array',
            'locked_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (self $policy): void {
            if ($policy->getOriginal('locked_at') !== null || $policy->sapBatches()->exists()) {
                throw ValidationException::withMessages([
                    'policy' => 'A policy referenced by a SAP batch is immutable. Create a new version instead.',
                ]);
            }
        });

        static::deleting(function (self $policy): void {
            if ($policy->sapBatches()->exists()) {
                throw ValidationException::withMessages([
                    'policy' => 'A policy referenced by a SAP batch cannot be deleted.',
                ]);
            }
        });
    }

    /** @return BelongsTo<Facility, $this> */
    public function facility(): BelongsTo
    {
        return $this->belongsTo(Facility::class);
    }

    /** @return HasMany<SapBatch, $this> */
    public function sapBatches(): HasMany
    {
        return $this->hasMany(SapBatch::class);
    }
}

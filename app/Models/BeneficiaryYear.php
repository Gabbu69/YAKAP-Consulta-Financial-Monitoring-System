<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $beneficiary_id
 * @property int $facility_id
 * @property int $year
 * @property bool $selected
 * @property Carbon|null $selected_at
 * @property bool $fpe_completed
 * @property Carbon|null $fpe_completed_at
 * @property string|null $pcu_reference
 * @property bool $yes_confirmed
 * @property Carbon|null $yes_confirmed_at
 * @property-read bool $sap1_ready
 * @property-read Beneficiary $beneficiary
 */
class BeneficiaryYear extends Model
{
    protected $fillable = [
        'beneficiary_id', 'facility_id', 'year', 'selected', 'selected_at',
        'fpe_completed', 'fpe_completed_at', 'pcu_reference',
        'yes_confirmed', 'yes_confirmed_at',
    ];

    protected $appends = ['sap1_ready'];

    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'selected' => 'boolean',
            'selected_at' => 'date:Y-m-d',
            'fpe_completed' => 'boolean',
            'fpe_completed_at' => 'date:Y-m-d',
            'yes_confirmed' => 'boolean',
            'yes_confirmed_at' => 'date:Y-m-d',
        ];
    }

    public function getSap1ReadyAttribute(): bool
    {
        return $this->selected
            && $this->fpe_completed
            && filled($this->pcu_reference)
            && $this->yes_confirmed;
    }

    /**
     * @param  Builder<BeneficiaryYear>  $query
     * @return Builder<BeneficiaryYear>
     */
    public function scopeSap1Ready(Builder $query): Builder
    {
        return $query->where('selected', true)
            ->where('fpe_completed', true)
            ->whereNotNull('pcu_reference')
            ->where('pcu_reference', '!=', '')
            ->where('yes_confirmed', true);
    }

    /**
     * @param  Builder<BeneficiaryYear>  $query
     * @return Builder<BeneficiaryYear>
     */
    public function scopeSap1ReadyAsOf(Builder $query, int $year, string $asOfDate): Builder
    {
        return $query->sap1Ready()
            ->whereBetween('selected_at', ["{$year}-01-01", $asOfDate])
            ->whereBetween('fpe_completed_at', ["{$year}-01-01", $asOfDate])
            ->whereBetween('yes_confirmed_at', ["{$year}-01-01", $asOfDate]);
    }

    /**
     * @param  Builder<BeneficiaryYear>  $query
     * @return Builder<BeneficiaryYear>
     */
    public function scopeSap2Eligible(Builder $query, int $year): Builder
    {
        return $query
            ->where('selected', true)
            ->where('fpe_completed', true)
            ->whereBetween('selected_at', ["{$year}-01-01", "{$year}-12-31"])
            ->whereBetween('fpe_completed_at', ["{$year}-01-01", "{$year}-12-31"]);
    }

    /** @return BelongsTo<Beneficiary, $this> */
    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }
}

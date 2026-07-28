<?php

namespace App\Models;

use App\Enums\SapBatchStatus;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $facility_id
 * @property int $policy_version_id
 * @property string $reference
 * @property int $tranche
 * @property int $year
 * @property int $month
 * @property SapBatchStatus $status
 * @property int $eligible_beneficiary_count
 * @property int $performance_factor_bps
 * @property int $expected_gross_centavos
 * @property int $submitted_gross_centavos
 * @property int $approved_gross_centavos
 * @property int $withholding_tax_centavos
 * @property int $approved_net_centavos
 * @property int|null $created_by
 * @property Carbon|null $submitted_at
 * @property Carbon|null $approved_at
 * @property string|null $notes
 * @property-read PolicyVersion $policy
 * @property-read Collection<int, Payment> $payments
 * @property-read int $paid_centavos
 * @property-read int $outstanding_centavos
 */
class SapBatch extends Model
{
    protected $fillable = [
        'facility_id', 'policy_version_id', 'reference', 'tranche', 'year', 'month',
        'status', 'eligible_beneficiary_count', 'performance_factor_bps',
        'expected_gross_centavos', 'submitted_gross_centavos', 'approved_gross_centavos',
        'withholding_tax_centavos', 'approved_net_centavos', 'submitted_at',
        'approved_at', 'returned_at', 'cancelled_at', 'notes', 'created_by',
    ];

    protected $appends = ['paid_centavos', 'outstanding_centavos'];

    protected function casts(): array
    {
        return [
            'status' => SapBatchStatus::class,
            'submitted_at' => 'datetime',
            'approved_at' => 'datetime',
            'returned_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function getPaidCentavosAttribute(): int
    {
        return (int) $this->payments()->whereNull('voided_at')->sum('amount_centavos');
    }

    public function getOutstandingCentavosAttribute(): int
    {
        return max(0, $this->receivableBasisCentavos() - $this->paid_centavos);
    }

    public function receivableBasisCentavos(): int
    {
        return match ($this->status) {
            SapBatchStatus::Submitted, SapBatchStatus::Returned => (int) $this->submitted_gross_centavos,
            SapBatchStatus::Approved, SapBatchStatus::PartiallyPaid, SapBatchStatus::Paid => (int) $this->approved_net_centavos,
            default => 0,
        };
    }

    /** @return BelongsTo<PolicyVersion, $this> */
    public function policy(): BelongsTo
    {
        return $this->belongsTo(PolicyVersion::class, 'policy_version_id');
    }

    /** @return BelongsTo<Facility, $this> */
    public function facility(): BelongsTo
    {
        return $this->belongsTo(Facility::class);
    }

    /** @return HasMany<SapBatchBeneficiary, $this> */
    public function beneficiaries(): HasMany
    {
        return $this->hasMany(SapBatchBeneficiary::class);
    }

    /** @return HasMany<Payment, $this> */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}

<?php

namespace App\Models;

use App\Enums\BeneficiaryType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $facility_id
 * @property string $reference
 * @property string $philhealth_pin
 * @property string $philhealth_pin_hash
 * @property string $first_name
 * @property string|null $middle_name
 * @property string $last_name
 * @property string|null $suffix
 * @property Carbon $birth_date
 * @property string $sex
 * @property BeneficiaryType $beneficiary_type
 * @property string|null $contact_number
 * @property string|null $address
 * @property Carbon|null $archived_at
 * @property-read string $full_name
 * @property-read string $masked_philhealth_pin
 * @property-read Collection<int, BeneficiaryYear> $yearlyStatuses
 * @property-read Collection<int, Encounter> $encounters
 */
class Beneficiary extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'facility_id', 'reference', 'philhealth_pin', 'first_name', 'middle_name',
        'last_name', 'suffix', 'birth_date', 'sex', 'beneficiary_type',
        'contact_number', 'address', 'archived_at',
    ];

    protected $hidden = ['philhealth_pin', 'philhealth_pin_hash'];

    protected $appends = ['full_name', 'masked_philhealth_pin'];

    protected function casts(): array
    {
        return [
            'philhealth_pin' => 'encrypted',
            'birth_date' => 'date:Y-m-d',
            'archived_at' => 'datetime',
            'beneficiary_type' => BeneficiaryType::class,
        ];
    }

    public function setAttribute($key, $value)
    {
        if ($key === 'philhealth_pin' && $value !== null) {
            $value = preg_replace('/\D+/', '', (string) $value) ?? '';
            parent::setAttribute('philhealth_pin_hash', self::hashPin($value));
        }

        return parent::setAttribute($key, $value);
    }

    public static function hashPin(string $pin): string
    {
        $normalized = preg_replace('/\D+/', '', $pin) ?? '';

        return hash_hmac('sha256', $normalized, (string) config('app.key'));
    }

    public function getFullNameAttribute(): string
    {
        return collect([$this->first_name, $this->middle_name, $this->last_name, $this->suffix])
            ->filter()->join(' ');
    }

    public function getMaskedPhilhealthPinAttribute(): string
    {
        $pin = (string) $this->philhealth_pin;
        $visible = substr($pin, -4);

        return str_repeat('*', max(strlen($pin) - 4, 4)).$visible;
    }

    /**
     * @param  Builder<Beneficiary>  $query
     * @return Builder<Beneficiary>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('archived_at');
    }

    /** @return BelongsTo<Facility, $this> */
    public function facility(): BelongsTo
    {
        return $this->belongsTo(Facility::class);
    }

    /** @return HasMany<BeneficiaryYear, $this> */
    public function yearlyStatuses(): HasMany
    {
        return $this->hasMany(BeneficiaryYear::class);
    }

    /** @return HasMany<Encounter, $this> */
    public function encounters(): HasMany
    {
        return $this->hasMany(Encounter::class);
    }
}

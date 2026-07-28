<?php

namespace App\Models;

use App\Enums\FacilityType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $name
 * @property string $facility_code
 * @property FacilityType $type
 * @property bool $is_demo
 */
class Facility extends Model
{
    protected $fillable = [
        'name', 'facility_code', 'type', 'city', 'province', 'address',
        'contact_email', 'contact_number', 'is_demo',
    ];

    protected function casts(): array
    {
        return ['type' => FacilityType::class, 'is_demo' => 'boolean'];
    }

    /** @return HasMany<PolicyVersion, $this> */
    public function policies(): HasMany
    {
        return $this->hasMany(PolicyVersion::class);
    }
}

<?php

namespace App\Models;

use App\Enums\ServiceClassification;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $name
 * @property ServiceClassification $classification
 * @property bool $is_active
 */
class ServiceCategory extends Model
{
    protected $fillable = ['name', 'classification', 'is_active'];

    protected function casts(): array
    {
        return ['classification' => ServiceClassification::class, 'is_active' => 'boolean'];
    }

    /** @return HasMany<Service, $this> */
    public function services(): HasMany
    {
        return $this->hasMany(Service::class);
    }
}

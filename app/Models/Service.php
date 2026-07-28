<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $service_category_id
 * @property string $code
 * @property string $name
 * @property string $unit
 * @property int $default_cost_centavos
 * @property bool $is_active
 * @property-read ServiceCategory $category
 */
class Service extends Model
{
    protected $fillable = [
        'service_category_id', 'code', 'name', 'unit', 'default_cost_centavos', 'is_active',
    ];

    protected function casts(): array
    {
        return ['default_cost_centavos' => 'integer', 'is_active' => 'boolean'];
    }

    /** @return BelongsTo<ServiceCategory, $this> */
    public function category(): BelongsTo
    {
        return $this->belongsTo(ServiceCategory::class, 'service_category_id');
    }
}

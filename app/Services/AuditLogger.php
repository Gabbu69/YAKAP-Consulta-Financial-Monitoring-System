<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class AuditLogger
{
    /**
     * @param  array<string, mixed>|null  $old
     * @param  array<string, mixed>|null  $new
     */
    public function log(
        string $event,
        string $description,
        ?Model $auditable = null,
        ?array $old = null,
        ?array $new = null,
        ?Request $request = null,
    ): AuditLog {
        $request ??= request();

        return AuditLog::create([
            'user_id' => $request->user()?->id,
            'auditable_type' => $auditable?->getMorphClass(),
            'auditable_id' => $auditable?->getKey(),
            'event' => $event,
            'description' => $description,
            'old_values' => $this->redact($old),
            'new_values' => $this->redact($new),
            'ip_address' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 1000),
        ]);
    }

    /**
     * @param  array<string, mixed>|null  $values
     * @return array<string, mixed>|null
     */
    private function redact(?array $values): ?array
    {
        if ($values === null) {
            return null;
        }

        foreach (['password', 'philhealth_pin', 'philhealth_pin_hash', 'two_factor_secret'] as $secret) {
            if (array_key_exists($secret, $values)) {
                $values[$secret] = '[REDACTED]';
            }
        }

        return $values;
    }
}

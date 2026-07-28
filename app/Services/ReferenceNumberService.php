<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class ReferenceNumberService
{
    public function beneficiary(int $year): string
    {
        return sprintf('YKP-%d-%06d', $year, $this->next("beneficiary:{$year}"));
    }

    public function sapBatch(int $tranche, int $year, int $month): string
    {
        $period = sprintf('%d%02d', $year, $month);

        return sprintf('SAP%d-%s-%04d', $tranche, $period, $this->next("sap{$tranche}:{$period}"));
    }

    public function encounter(int $year): string
    {
        return sprintf('ENC-%d-%06d', $year, $this->next("encounter:{$year}"));
    }

    public function payment(int $year): string
    {
        return sprintf('PAY-%d-%06d', $year, $this->next("payment:{$year}"));
    }

    public function copayment(int $year): string
    {
        return sprintf('COP-%d-%06d', $year, $this->next("copayment:{$year}"));
    }

    private function next(string $key): int
    {
        return DB::transaction(function () use ($key): int {
            DB::table('reference_sequences')->insertOrIgnore([
                'key' => $key,
                'current_value' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $row = DB::table('reference_sequences')->where('key', $key)->lockForUpdate()->first();
            $next = ((int) $row->current_value) + 1;
            DB::table('reference_sequences')->where('key', $key)->update([
                'current_value' => $next,
                'updated_at' => now(),
            ]);

            return $next;
        }, 5);
    }
}

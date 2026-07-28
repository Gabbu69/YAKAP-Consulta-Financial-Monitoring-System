<?php

namespace App\Enums;

enum UserRole: string
{
    case Administrator = 'administrator';
    case Encoder = 'encoder';
    case FinanceOfficer = 'finance_officer';
    case Auditor = 'auditor';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}

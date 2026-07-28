<?php

namespace App\Enums;

enum ServiceClassification: string
{
    case Consultation = 'consultation';
    case Laboratory = 'laboratory';
    case Antibiotic = 'antibiotic';
    case NcdMedicine = 'ncd_medicine';
    case OtherDrug = 'other_drug';
    case Other = 'other';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}

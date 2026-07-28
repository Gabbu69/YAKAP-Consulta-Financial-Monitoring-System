<?php

namespace App\Enums;

enum EncounterStatus: string
{
    case Draft = 'draft';
    case Posted = 'posted';
    case Void = 'void';
}

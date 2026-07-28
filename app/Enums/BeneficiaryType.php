<?php

namespace App\Enums;

enum BeneficiaryType: string
{
    case Member = 'member';
    case Dependent = 'dependent';
    case Sponsored = 'sponsored';
    case Indigent = 'indigent';
    case SeniorCitizen = 'senior_citizen';
}

<?php

namespace App\Http\Controllers;

use App\Models\Facility;

abstract class Controller
{
    protected function facility(): Facility
    {
        return Facility::query()->firstOrFail();
    }
}

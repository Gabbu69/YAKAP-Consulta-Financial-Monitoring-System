<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AuditLogController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim((string) $request->string('search'));
        $event = (string) $request->string('event');
        $year = (int) $request->integer('year', now()->year);

        return Inertia::render('audit-log/index', [
            'logs' => AuditLog::with('user')
                ->whereYear('created_at', $year)
                ->when($event, fn ($query) => $query->where('event', $event))
                ->when($search, fn ($query) => $query->where(function ($query) use ($search) {
                    $query->where('description', 'like', "%{$search}%")
                        ->orWhereHas('user', fn ($query) => $query->where('name', 'like', "%{$search}%"));
                }))->latest()->paginate(25)->withQueryString(),
            'events' => AuditLog::select('event')->distinct()->orderBy('event')->pluck('event'),
            'filters' => ['search' => $search, 'event' => $event, 'year' => $year],
            'years' => AuditLog::selectRaw('DISTINCT CAST(strftime("%Y", created_at) AS INTEGER) as year')
                ->orderByDesc('year')->pluck('year'),
        ]);
    }
}

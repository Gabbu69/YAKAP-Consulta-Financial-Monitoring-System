<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\PolicyVersion;
use App\Services\DashboardService;
use App\Services\ReportService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class ReportController extends Controller
{
    public function index(Request $request, DashboardService $dashboard): Response
    {
        $facility = $this->facility();
        $years = PolicyVersion::where('facility_id', $facility->id)
            ->orderByDesc('effective_year')->pluck('effective_year');
        $year = (int) $request->integer('year', $years->first() ?? now()->year);

        $reportTypes = collect(ReportService::TYPES);
        if (! $request->user()->hasRole(UserRole::Administrator, UserRole::Auditor)) {
            $reportTypes->forget('audit-activity');
        }

        return Inertia::render('reports/index', [
            'reportTypes' => $reportTypes
                ->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values(),
            'year' => $year,
            'years' => $years,
            'facility' => $facility,
            'summary' => $dashboard->forYear($facility, $year)['kpis'],
        ]);
    }

    public function export(Request $request, string $type, string $format, ReportService $reports): HttpResponse
    {
        abort_unless(isset(ReportService::TYPES[$type]) && in_array($format, ['csv', 'pdf'], true), 404);
        if ($type === 'audit-activity') {
            abort_unless($request->user()->hasRole(UserRole::Administrator, UserRole::Auditor), 403);
        }
        $year = (int) $request->integer('year', now()->year);
        abort_unless($year >= 2020 && $year <= 2100, 422);
        $facility = $this->facility();
        $report = $reports->build($type, $facility, $year);
        $filename = "yakap-{$type}-{$year}";

        if ($format === 'csv') {
            return response()->streamDownload(function () use ($report): void {
                $stream = fopen('php://output', 'wb');
                if ($stream === false) {
                    throw new \RuntimeException('Unable to open CSV output stream.');
                }
                fputcsv($stream, [$report['title']]);
                fputcsv($stream, $report['headers']);
                foreach ($report['rows'] as $row) {
                    fputcsv($stream, $row);
                }
                fclose($stream);
            }, "{$filename}.csv", ['Content-Type' => 'text/csv']);
        }

        $html = $this->pdfHtml($report['title'], $facility->name, $report['headers'], $report['rows']);

        return Pdf::loadHTML($html)->setPaper('a4', 'landscape')->download("{$filename}.pdf");
    }

    /**
     * @param  list<string>  $headers
     * @param  list<list<string|int|float|null>>  $rows
     */
    private function pdfHtml(string $title, string $facility, array $headers, array $rows): string
    {
        $head = collect($headers)->map(fn ($value) => '<th>'.e($value).'</th>')->join('');
        $body = collect($rows)->map(fn ($row) => '<tr>'.collect($row)
            ->map(fn ($value) => '<td>'.e((string) $value).'</td>')->join('').'</tr>')->join('');
        if ($body === '') {
            $body = '<tr><td colspan="'.count($headers).'">No records for this filter.</td></tr>';
        }

        return '<!doctype html><html><head><meta charset="UTF-8"><style>
            body{font-family:DejaVu Sans,sans-serif;color:#173a3a;font-size:9px}
            h1{font-size:18px;margin-bottom:4px}p{color:#526565;margin-top:0}
            table{border-collapse:collapse;width:100%;margin-top:16px}
            th{background:#0f625e;color:#fff;text-align:left}th,td{border:1px solid #ccd8d5;padding:6px}
            tr:nth-child(even){background:#f5f2eb}
            footer{position:fixed;bottom:0;color:#657575;font-size:8px}
        </style></head><body><h1>'.e($title).'</h1><p>'.e($facility)
            .' | Generated '.e(now()->timezone('Asia/Manila')->format('F j, Y g:i A')).'</p><table><thead><tr>'
            .$head.'</tr></thead><tbody>'.$body.'</tbody></table><footer>Internal monitoring report | Not a PhilHealth submission document</footer></body></html>';
    }
}

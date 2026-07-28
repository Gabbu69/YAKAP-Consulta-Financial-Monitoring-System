import { Head, router } from '@inertiajs/react';
import {
    Activity,
    ClipboardCheck,
    Download,
    FileBarChart,
    FileSpreadsheet,
    History,
    PhilippinePeso,
    ReceiptText,
    UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    PageContainer,
    PageHeader,
    SectionHeading,
} from '@/components/yakap/page-elements';
import { formatMoney } from '@/lib/yakap';
import type { Facility } from '@/types';

type ReportType = {
    key: string;
    label: string;
};

type Props = {
    reportTypes?: ReportType[];
    year?: number;
    years?: number[];
    facility?: Facility;
    summary?: {
        paid?: number;
        outstanding?: number;
        direct_cost?: number;
        net_position?: number;
    };
};

const reportMeta: Record<string, { icon: LucideIcon; description: string }> = {
    'financial-summary': {
        icon: PhilippinePeso,
        description:
            'Program-year reconciliation by SAP reporting month, including expected, submitted, approved, paid, co-payment, cost, and net values.',
    },
    'sap-reconciliation': {
        icon: ClipboardCheck,
        description:
            'Batch-by-batch expected, approved, paid, and outstanding reimbursement.',
    },
    'readiness-exceptions': {
        icon: UsersRound,
        description:
            'Selected beneficiaries missing an FPE, PCU reference, or digital YES.',
    },
    'second-tranche-performance': {
        icon: Activity,
        description:
            'Actual utilization, targets, weights, and resultant SAP2 factor.',
    },
    'service-utilization-cost': {
        icon: FileBarChart,
        description:
            'Service volume and direct cost grouped by explicit classification.',
    },
    'copayment-collections': {
        icon: ReceiptText,
        description:
            'Valid and voided private-facility collections for cap review.',
    },
    'audit-activity': {
        icon: History,
        description:
            'Chronological administrative and financial activity for review.',
    },
};

export default function ReportsIndex({
    reportTypes = [],
    year = new Date().getFullYear(),
    years = [],
    facility,
    summary = {},
}: Props) {
    const availableYears =
        years.length > 0 ? years : [new Date().getFullYear()];

    return (
        <>
            <Head title="Reports" />
            <PageContainer>
                <PageHeader
                    eyebrow="Insights"
                    title="Reports"
                    description={`Generate filtered, presentation-ready exports${facility?.name ? ` for ${facility.name}` : ''}.`}
                    actions={
                        <Select
                            value={String(year)}
                            onValueChange={(value) =>
                                router.get(
                                    '/reports',
                                    { year: Number(value) },
                                    {
                                        preserveState: true,
                                        replace: true,
                                    },
                                )
                            }
                        >
                            <SelectTrigger
                                className="w-28 bg-card"
                                aria-label="Report year"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {availableYears.map((option) => (
                                    <SelectItem
                                        key={option}
                                        value={String(option)}
                                    >
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    }
                />

                <section
                    className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                    aria-label="Selected program-year financial summary"
                >
                    {[
                        ['Paid reimbursement', summary.paid],
                        ['Outstanding', summary.outstanding],
                        ['Direct service cost', summary.direct_cost],
                        ['Net program position', summary.net_position],
                    ].map(([label, value], index) => (
                        <Card className="gap-2 py-4" key={String(label)}>
                            <CardHeader className="px-5">
                                <p className="text-xs text-muted-foreground">
                                    {label}
                                </p>
                            </CardHeader>
                            <CardContent className="px-5">
                                <p
                                    className={`text-xl font-bold tabular-nums ${index === 1 ? 'text-coral' : ''}`}
                                >
                                    {formatMoney(Number(value))}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </section>

                <Card>
                    <CardHeader>
                        <SectionHeading
                            title={`${year} report library`}
                            description="CSV files are analysis-ready. PDFs are formatted for review and presentation."
                            action={
                                <Badge variant="outline">
                                    <FileSpreadsheet className="size-3" />
                                    {reportTypes.length} available
                                </Badge>
                            }
                        />
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {reportTypes.map((report) => {
                                const meta =
                                    reportMeta[report.key] ??
                                    reportMeta['financial-summary'];
                                const Icon = meta.icon;

                                return (
                                    <article
                                        key={report.key}
                                        className="flex min-h-52 flex-col rounded-xl border bg-background/55 p-5"
                                    >
                                        <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                                            <Icon className="size-4.5" />
                                        </div>
                                        <h3 className="mt-4 font-display text-base font-semibold">
                                            {report.label}
                                        </h3>
                                        <p className="mt-2 flex-1 text-xs leading-5 text-muted-foreground">
                                            {meta.description}
                                        </p>
                                        <div className="mt-5 grid grid-cols-2 gap-2">
                                            <Button
                                                asChild
                                                variant="outline"
                                                size="sm"
                                            >
                                                <a
                                                    href={`/reports/${report.key}/csv?year=${year}`}
                                                    download
                                                >
                                                    <Download className="size-3.5" />
                                                    CSV
                                                </a>
                                            </Button>
                                            <Button
                                                asChild
                                                variant="outline"
                                                size="sm"
                                            >
                                                <a
                                                    href={`/reports/${report.key}/pdf?year=${year}`}
                                                    download
                                                >
                                                    <Download className="size-3.5" />
                                                    PDF
                                                </a>
                                            </Button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                <p className="text-center text-xs leading-5 text-muted-foreground">
                    Exports are internal monitoring documents and are not
                    PhilHealth submission records.
                </p>
            </PageContainer>
        </>
    );
}

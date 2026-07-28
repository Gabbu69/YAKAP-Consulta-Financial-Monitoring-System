import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowDownToLine,
    ArrowRight,
    CircleAlert,
    Clock3,
    ReceiptText,
    Stethoscope,
    TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    EmptyState,
    PageContainer,
    PageHeader,
    SectionHeading,
    StatusBadge,
} from '@/components/yakap/page-elements';
import { formatMoney, formatNumber, formatPercent } from '@/lib/yakap';
import type { Facility, SapBatch } from '@/types';

type Kpis = {
    paid: number;
    outstanding: number;
    direct_cost: number;
    net_position: number;
};

type TrendPoint = {
    month: string;
    month_number?: number;
    label?: string;
    expected: number;
    submitted: number;
    paid: number;
};

type ReadinessPoint = {
    key?: string;
    label: string;
    count: number;
    total?: number;
    percentage?: number;
};

type PerformancePoint = {
    key: string;
    label: string;
    actual: number;
    target: number;
    weight: number;
    resultant?: number;
    score?: number;
};

type ServiceCost = {
    name?: string;
    classification?: string;
    total: number;
};

type ExceptionItem = {
    type?: string;
    subject?: string;
    detail?: string;
    action_url?: string;
    id?: number;
    reference?: string;
    name?: string;
    missing?: string[];
};

type Props = {
    year?: number;
    years?: number[];
    facility?: Facility | null;
    kpis?: Kpis;
    trend?: TrendPoint[];
    readiness?: ReadinessPoint[];
    performance?: PerformancePoint[];
    serviceCosts?: ServiceCost[];
    exceptions?: ExceptionItem[];
    recentBatches?: SapBatch[];
};

const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];

const zeroKpis: Kpis = {
    paid: 0,
    outstanding: 0,
    direct_cost: 0,
    net_position: 0,
};

function compactMoney(value: number): string {
    return new Intl.NumberFormat('en-PH', {
        notation: 'compact',
        compactDisplay: 'short',
        maximumFractionDigits: 1,
    }).format(value / 100);
}

function toPercentValue(value: number): number {
    return value <= 1 ? value * 100 : value;
}

function KpiCard({
    label,
    value,
    description,
    icon: Icon,
    tone = 'default',
}: {
    label: string;
    value: number;
    description: string;
    icon: LucideIcon;
    tone?: 'default' | 'coral' | 'positive';
}) {
    return (
        <Card className="relative gap-4 overflow-hidden py-5 shadow-sm">
            <div className="absolute top-0 right-0 h-full w-1 bg-primary/65" />
            <CardHeader className="flex flex-row items-start justify-between px-5">
                <div>
                    <CardDescription className="font-medium">
                        {label}
                    </CardDescription>
                    <CardTitle
                        className={`mt-2 text-2xl tabular-nums ${
                            tone === 'coral'
                                ? 'text-coral'
                                : tone === 'positive' && value >= 0
                                  ? 'text-emerald-700 dark:text-emerald-300'
                                  : ''
                        }`}
                    >
                        {formatMoney(value)}
                    </CardTitle>
                </div>
                <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                    <Icon className="size-4.5" />
                </div>
            </CardHeader>
            <CardContent className="px-5">
                <p className="text-xs leading-5 text-muted-foreground">
                    {description}
                </p>
            </CardContent>
        </Card>
    );
}

export default function Dashboard({
    year = new Date().getFullYear(),
    years,
    facility,
    kpis = zeroKpis,
    trend,
    readiness = [],
    performance = [],
    serviceCosts = [],
    exceptions = [],
    recentBatches = [],
}: Props) {
    const availableYears =
        years && years.length > 0 ? years : [new Date().getFullYear()];
    const trendData = (
        trend && trend.length > 0
            ? trend
            : months.map((label, index) => ({
                  month: String(index + 1).padStart(2, '0'),
                  label,
                  expected: 0,
                  submitted: 0,
                  paid: 0,
              }))
    ).map((point) => ({
        ...point,
        label: point.label ?? point.month,
    }));
    const readinessTotal = Math.max(
        0,
        ...readiness.map((item) => item.total ?? item.count),
    );
    const normalizedServiceCosts = serviceCosts.map((item) => ({
        ...item,
        name: item.name ?? item.classification ?? 'Other',
    }));
    const normalizedExceptions = exceptions.map((item) => ({
        type: item.type ?? 'Readiness',
        subject: item.subject ?? item.name ?? item.reference ?? 'Beneficiary',
        detail:
            item.detail ??
            (item.missing?.length
                ? `Missing: ${item.missing.join(', ')}`
                : 'Readiness details require review'),
        action_url:
            item.action_url ??
            (item.id
                ? `/beneficiaries/${item.id}?year=${year}`
                : '/beneficiaries'),
    }));

    return (
        <>
            <Head title="Dashboard" />
            <PageContainer>
                <PageHeader
                    eyebrow="Program overview"
                    title="Financial pulse"
                    description={`A single-year view of care delivery and reimbursement${facility?.name ? ` for ${facility.name}` : ''}.`}
                    actions={
                        <>
                            <Badge
                                variant="outline"
                                className="hidden py-1.5 sm:inline-flex"
                            >
                                Year scope
                            </Badge>
                            <Select
                                value={String(year)}
                                onValueChange={(selectedYear) =>
                                    router.get(
                                        '/dashboard',
                                        { year: selectedYear },
                                        {
                                            preserveState: true,
                                            preserveScroll: true,
                                            replace: true,
                                            only: [
                                                'year',
                                                'kpis',
                                                'trend',
                                                'readiness',
                                                'performance',
                                                'serviceCosts',
                                                'exceptions',
                                                'recentBatches',
                                            ],
                                        },
                                    )
                                }
                            >
                                <SelectTrigger
                                    className="w-28 bg-card"
                                    aria-label="Reporting year"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent align="end">
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
                        </>
                    }
                />

                <section
                    aria-label="Financial summary"
                    className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
                >
                    <KpiCard
                        label="Paid reimbursement"
                        value={kpis.paid}
                        description={`Payments received in ${year}`}
                        icon={ArrowDownToLine}
                        tone="positive"
                    />
                    <KpiCard
                        label="Outstanding receivables"
                        value={kpis.outstanding}
                        description="Approved or submitted, less recorded payments"
                        icon={Clock3}
                        tone="coral"
                    />
                    <KpiCard
                        label="Direct service cost"
                        value={kpis.direct_cost}
                        description="Posted encounter lines at snapshotted cost"
                        icon={Stethoscope}
                    />
                    <KpiCard
                        label="Net program position"
                        value={kpis.net_position}
                        description="Payments and valid co-payments, less direct cost"
                        icon={TrendingUp}
                        tone="positive"
                    />
                </section>

                <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(22rem,.7fr)]">
                    <Card className="min-w-0">
                        <CardHeader>
                            <SectionHeading
                                title="Expected, submitted, and paid amounts"
                                description={`Program-year reimbursement reconciliation by SAP reporting month for ${year}. Payments follow their batch reporting month; values are shown from a zero baseline.`}
                            />
                        </CardHeader>
                        <CardContent>
                            <div
                                className="h-[19rem] w-full"
                                aria-label="Expected, submitted, and paid reimbursement by SAP reporting month"
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart
                                        data={trendData}
                                        margin={{
                                            top: 8,
                                            right: 12,
                                            left: 0,
                                            bottom: 0,
                                        }}
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 5"
                                            vertical={false}
                                            stroke="var(--border)"
                                        />
                                        <XAxis
                                            dataKey="label"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{
                                                fill: 'var(--muted-foreground)',
                                                fontSize: 11,
                                            }}
                                        />
                                        <YAxis
                                            domain={[0, 'auto']}
                                            axisLine={false}
                                            tickLine={false}
                                            width={54}
                                            tickFormatter={compactMoney}
                                            tick={{
                                                fill: 'var(--muted-foreground)',
                                                fontSize: 11,
                                            }}
                                        />
                                        <Tooltip
                                            cursor={{
                                                stroke: 'var(--border)',
                                                strokeDasharray: '3 3',
                                            }}
                                            contentStyle={{
                                                background: 'var(--popover)',
                                                color: 'var(--popover-foreground)',
                                                borderColor: 'var(--border)',
                                                borderRadius: '10px',
                                                fontSize: '12px',
                                            }}
                                            formatter={(value) =>
                                                formatMoney(Number(value))
                                            }
                                        />
                                        <Legend
                                            wrapperStyle={{
                                                fontSize: '12px',
                                                paddingTop: '14px',
                                            }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="expected"
                                            name="Expected"
                                            stroke="var(--chart-4)"
                                            strokeWidth={2}
                                            dot={false}
                                            activeDot={{ r: 4 }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="submitted"
                                            name="Submitted"
                                            stroke="var(--chart-1)"
                                            strokeWidth={2.5}
                                            dot={false}
                                            activeDot={{ r: 4 }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="paid"
                                            name="Paid"
                                            stroke="var(--chart-3)"
                                            strokeWidth={2.5}
                                            dot={false}
                                            activeDot={{ r: 4 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <SectionHeading
                                title="SAP1 readiness"
                                description="Beneficiaries completing each prerequisite stage."
                            />
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {readiness.length > 0 ? (
                                readiness.map((item) => {
                                    const total = item.total ?? readinessTotal;
                                    const percentage =
                                        item.percentage != null
                                            ? toPercentValue(item.percentage)
                                            : total > 0
                                              ? (item.count / total) * 100
                                              : 0;

                                    return (
                                        <div
                                            key={item.label}
                                            className="space-y-2"
                                        >
                                            <div className="flex items-end justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-medium">
                                                        {item.label}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                                        {formatNumber(
                                                            item.count,
                                                        )}{' '}
                                                        of {formatNumber(total)}
                                                    </p>
                                                </div>
                                                <span className="text-sm font-semibold tabular-nums">
                                                    {percentage.toFixed(1)}%
                                                </span>
                                            </div>
                                            <Progress
                                                value={percentage}
                                                label={`${item.label} readiness`}
                                            />
                                        </div>
                                    );
                                })
                            ) : (
                                <EmptyState
                                    title="No readiness data"
                                    description={`No beneficiary readiness records are available for ${year}.`}
                                />
                            )}
                        </CardContent>
                    </Card>
                </section>

                <section className="grid gap-4 xl:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <SectionHeading
                                title="Second-tranche performance"
                                description="Actual utilization against the policy target for each weighted indicator."
                                action={
                                    <Badge variant="secondary">
                                        SAP2 inputs
                                    </Badge>
                                }
                            />
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {performance.length > 0 ? (
                                performance.map((item) => {
                                    const actual = toPercentValue(item.actual);
                                    const target = toPercentValue(item.target);
                                    const displayMax = Math.max(
                                        100,
                                        actual,
                                        target,
                                    );

                                    return (
                                        <div
                                            key={item.key}
                                            className="space-y-2.5"
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <div>
                                                    <p className="text-sm font-medium">
                                                        {item.label}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                                        Target{' '}
                                                        {target.toFixed(1)}% ·{' '}
                                                        {formatPercent(
                                                            item.weight,
                                                        )}{' '}
                                                        weight
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-semibold tabular-nums">
                                                        {actual.toFixed(1)}%
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        Result{' '}
                                                        {formatPercent(
                                                            item.resultant ??
                                                                item.score,
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            <div
                                                className="relative h-3 overflow-hidden rounded-full bg-secondary"
                                                role="meter"
                                                aria-label={`${item.label}: actual ${actual.toFixed(1)}%, target ${target.toFixed(1)}%`}
                                                aria-valuemin={0}
                                                aria-valuemax={displayMax}
                                                aria-valuenow={actual}
                                            >
                                                <div
                                                    className="h-full rounded-full bg-primary"
                                                    style={{
                                                        width: `${(actual / displayMax) * 100}%`,
                                                    }}
                                                />
                                                <div
                                                    className="absolute top-0 h-full w-0.5 bg-[var(--coral)]"
                                                    style={{
                                                        left: `${(target / displayMax) * 100}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <EmptyState
                                    title="No performance measurements"
                                    description="Utilization indicators will appear after encounters are posted."
                                />
                            )}
                        </CardContent>
                    </Card>

                    <Card className="min-w-0">
                        <CardHeader>
                            <SectionHeading
                                title="Direct service cost by category"
                                description={`Ranked posted encounter cost for ${year}.`}
                            />
                        </CardHeader>
                        <CardContent>
                            {normalizedServiceCosts.length > 0 ? (
                                <div
                                    className="h-[17rem] w-full"
                                    aria-label="Horizontal bar chart of direct service cost by category"
                                >
                                    <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                    >
                                        <BarChart
                                            layout="vertical"
                                            data={normalizedServiceCosts}
                                            margin={{
                                                top: 0,
                                                right: 18,
                                                bottom: 0,
                                                left: 0,
                                            }}
                                        >
                                            <CartesianGrid
                                                horizontal={false}
                                                strokeDasharray="3 5"
                                                stroke="var(--border)"
                                            />
                                            <XAxis
                                                type="number"
                                                domain={[0, 'auto']}
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={compactMoney}
                                                tick={{
                                                    fill: 'var(--muted-foreground)',
                                                    fontSize: 11,
                                                }}
                                            />
                                            <YAxis
                                                type="category"
                                                dataKey="name"
                                                axisLine={false}
                                                tickLine={false}
                                                width={104}
                                                tick={{
                                                    fill: 'var(--muted-foreground)',
                                                    fontSize: 11,
                                                }}
                                            />
                                            <Tooltip
                                                cursor={{
                                                    fill: 'var(--muted)',
                                                    opacity: 0.5,
                                                }}
                                                contentStyle={{
                                                    background:
                                                        'var(--popover)',
                                                    color: 'var(--popover-foreground)',
                                                    borderColor:
                                                        'var(--border)',
                                                    borderRadius: '10px',
                                                    fontSize: '12px',
                                                }}
                                                formatter={(value) =>
                                                    formatMoney(Number(value))
                                                }
                                            />
                                            <Bar
                                                dataKey="total"
                                                name="Direct cost"
                                                fill="var(--chart-1)"
                                                radius={[0, 6, 6, 0]}
                                                maxBarSize={24}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <EmptyState
                                    title="No service costs"
                                    description="Cost categories will appear once service encounters are posted."
                                    icon={ReceiptText}
                                />
                            )}
                        </CardContent>
                    </Card>
                </section>

                <section className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
                    <Card className="min-w-0 gap-0 py-0">
                        <CardHeader className="border-b py-5">
                            <SectionHeading
                                title="Items needing attention"
                                description="Readiness and finance exceptions that may delay reimbursement."
                                action={
                                    normalizedExceptions.length > 0 ? (
                                        <Badge
                                            variant="outline"
                                            className="text-coral border-[var(--coral)]/35"
                                        >
                                            <CircleAlert className="size-3" />
                                            {normalizedExceptions.length} open
                                        </Badge>
                                    ) : null
                                }
                            />
                        </CardHeader>
                        <CardContent className="p-0">
                            {normalizedExceptions.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Subject</TableHead>
                                            <TableHead>
                                                Why it matters
                                            </TableHead>
                                            <TableHead className="w-12">
                                                <span className="sr-only">
                                                    Action
                                                </span>
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {normalizedExceptions
                                            .slice(0, 6)
                                            .map((item) => (
                                                <TableRow
                                                    key={`${item.type}-${item.subject}`}
                                                >
                                                    <TableCell>
                                                        <Badge variant="secondary">
                                                            {item.type}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {item.subject}
                                                    </TableCell>
                                                    <TableCell className="max-w-sm text-muted-foreground">
                                                        {item.detail}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            asChild
                                                            variant="ghost"
                                                            size="icon"
                                                        >
                                                            <Link
                                                                href={
                                                                    item.action_url
                                                                }
                                                                aria-label={`Review ${item.subject}`}
                                                            >
                                                                <ArrowRight className="size-4" />
                                                            </Link>
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <EmptyState
                                    title="Nothing needs attention"
                                    description="No readiness or financial exceptions are open for this year."
                                />
                            )}
                        </CardContent>
                    </Card>

                    <Card className="min-w-0 gap-0 py-0">
                        <CardHeader className="border-b py-5">
                            <SectionHeading
                                title="Recent SAP batches"
                                description="Latest frozen reimbursement snapshots."
                                action={
                                    <Button asChild variant="ghost" size="sm">
                                        <Link href="/finance/sap-batches">
                                            View all
                                            <ArrowRight className="size-3.5" />
                                        </Link>
                                    </Button>
                                }
                            />
                        </CardHeader>
                        <CardContent className="p-0">
                            {recentBatches.length > 0 ? (
                                <div className="divide-y">
                                    {recentBatches.slice(0, 5).map((batch) => (
                                        <Link
                                            key={batch.id}
                                            href={`/finance/sap-batches/${batch.id}`}
                                            className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/50"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate font-mono text-xs font-semibold">
                                                    {batch.reference}
                                                </p>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {batch.tranche} ·{' '}
                                                    {formatNumber(
                                                        batch.eligible_beneficiary_count ??
                                                            batch.beneficiary_count,
                                                    )}{' '}
                                                    beneficiaries
                                                </p>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="text-sm font-semibold tabular-nums">
                                                    {formatMoney(
                                                        batch.expected_gross_centavos ??
                                                            batch.expected_centavos,
                                                    )}
                                                </p>
                                                <StatusBadge
                                                    status={batch.status}
                                                    className="mt-1"
                                                />
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <EmptyState
                                    title="No SAP batches"
                                    description={`Generate the first frozen reimbursement snapshot for ${year}.`}
                                    icon={ReceiptText}
                                />
                            )}
                        </CardContent>
                    </Card>
                </section>
            </PageContainer>
        </>
    );
}

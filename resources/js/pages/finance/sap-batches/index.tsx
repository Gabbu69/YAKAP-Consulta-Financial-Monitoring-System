import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    CalendarRange,
    CirclePlus,
    FileLock2,
    Layers3,
} from 'lucide-react';
import { useState } from 'react';
import AlertError from '@/components/alert-error';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
import { Textarea } from '@/components/ui/textarea';
import {
    EmptyState,
    PageContainer,
    PageHeader,
    Pagination,
    SectionHeading,
    StatusBadge,
    getRows,
} from '@/components/yakap/page-elements';
import {
    formatDate,
    formatMoney,
    formatNumber,
    manilaDateInput,
    titleCase,
} from '@/lib/yakap';
import type {
    Facility,
    PaginatedOrArray,
    PolicyVersion,
    SapBatch,
} from '@/types';

type Props = {
    batches?: PaginatedOrArray<SapBatch>;
    policies?: PolicyVersion[];
    years?: number[];
    year?: number;
    facility?: Facility | null;
    filters?: {
        status?: string;
        tranche?: number | string | null;
        year?: number;
    };
    summary?: {
        expected?: number;
        submitted?: number;
        paid?: number;
        outstanding?: number;
    };
};

const monthNames = Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: new Intl.DateTimeFormat('en-PH', { month: 'long' }).format(
        new Date(2026, index, 1),
    ),
}));

function latestAvailableSap1Month(
    benefitYear: number,
    currentYear: number,
    currentMonth: number,
): number {
    if (benefitYear < currentYear) {
        return 12;
    }

    return benefitYear === currentYear ? currentMonth : 0;
}

export default function SapBatchIndex({
    batches,
    policies = [],
    years,
    year = new Date().getFullYear(),
    facility,
    filters = {},
    summary,
}: Props) {
    const rows = getRows(batches);
    const role = usePage().props.auth.user.role;
    const canManage = role === 'administrator' || role === 'finance_officer';
    const availableYears =
        years && years.length > 0 ? years : [new Date().getFullYear()];
    const [selectedYear, setSelectedYear] = useState(filters.year ?? year);
    const [status, setStatus] = useState(filters.status || 'all');
    const [tranche, setTranche] = useState(
        filters.tranche ? String(filters.tranche) : 'all',
    );
    const initialPolicy =
        policies.find((policy) => policy.effective_year === year) ??
        policies[0];
    const today = manilaDateInput();
    const currentManilaYear = Number(today.slice(0, 4));
    const currentManilaMonth = Number(today.slice(5, 7));
    const initialBenefitYear = initialPolicy?.effective_year ?? year;
    const initialAvailableMonth = latestAvailableSap1Month(
        initialBenefitYear,
        currentManilaYear,
        currentManilaMonth,
    );
    const form = useForm({
        policy_version_id: initialPolicy?.id ?? 0,
        tranche: 1,
        year: initialBenefitYear,
        month: Math.max(initialAvailableMonth, 1),
        notes: '',
    });
    const generationErrors = Object.values(form.errors).filter(
        (error): error is string => Boolean(error),
    );
    const latestSap1Month = latestAvailableSap1Month(
        form.data.year,
        currentManilaYear,
        currentManilaMonth,
    );
    const sap2AvailableOn = `${form.data.year + 1}-01-08`;
    const sap2Available = today >= sap2AvailableOn;
    const generationUnavailableReason =
        form.data.tranche === 2 && !sap2Available
            ? `SAP2 for ${form.data.year} becomes available on January 8, ${form.data.year + 1}, after the annual performance close.`
            : form.data.tranche === 1 && latestSap1Month === 0
              ? `SAP1 reporting months for ${form.data.year} are not available yet.`
              : null;

    const totals = summary ?? {
        expected: rows.reduce(
            (sum, batch) =>
                sum +
                (batch.expected_gross_centavos ?? batch.expected_centavos ?? 0),
            0,
        ),
        submitted: rows.reduce(
            (sum, batch) =>
                sum +
                (batch.submitted_gross_centavos ??
                    batch.submitted_centavos ??
                    0),
            0,
        ),
        paid: rows.reduce((sum, batch) => sum + (batch.paid_centavos ?? 0), 0),
        outstanding: rows.reduce(
            (sum, batch) => sum + (batch.outstanding_centavos ?? 0),
            0,
        ),
    };

    const applyFilters = () =>
        router.get(
            '/finance/sap-batches',
            {
                year: selectedYear,
                status: status === 'all' ? undefined : status,
                tranche: tranche === 'all' ? undefined : Number(tranche),
            },
            { preserveState: true, replace: true },
        );

    const summaryCards = [
        { label: 'Expected', value: totals.expected },
        { label: 'Submitted', value: totals.submitted },
        { label: 'Paid', value: totals.paid },
        {
            label: 'Outstanding',
            value: totals.outstanding,
            accent: true,
        },
    ];

    return (
        <>
            <Head title="SAP Batches" />
            <PageContainer>
                <PageHeader
                    eyebrow="Finance"
                    title="SAP batches"
                    description={`Generate and reconcile frozen reimbursement snapshots${facility?.name ? ` for ${facility.name}` : ''}.`}
                    actions={
                        <Badge variant="outline" className="gap-1.5 py-1.5">
                            <FileLock2 className="size-3.5" />
                            Immutable snapshots
                        </Badge>
                    }
                />

                <section
                    className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                    aria-label="SAP batch summary"
                >
                    {summaryCards.map((card) => (
                        <Card className="gap-2 py-4" key={card.label}>
                            <CardHeader className="px-5">
                                <p className="text-xs font-medium text-muted-foreground">
                                    {card.label}
                                </p>
                            </CardHeader>
                            <CardContent className="px-5">
                                <p
                                    className={`text-xl font-bold tabular-nums ${card.accent ? 'text-coral' : ''}`}
                                >
                                    {formatMoney(card.value)}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </section>

                <div
                    className={`grid min-w-0 grid-cols-1 items-start gap-4 ${canManage ? 'xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,.55fr)]' : ''}`}
                >
                    <Card className="min-w-0 gap-0 overflow-hidden py-0">
                        <CardHeader className="border-b py-5">
                            <div className="flex flex-col gap-4">
                                <SectionHeading
                                    title="Batch register"
                                    description="Expected, submitted, approved, and paid values stay traceable by frozen batch."
                                />
                                <form
                                    className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-[9rem_11rem_11rem_auto]"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        applyFilters();
                                    }}
                                >
                                    <Select
                                        value={String(selectedYear)}
                                        onValueChange={(value) =>
                                            setSelectedYear(Number(value))
                                        }
                                    >
                                        <SelectTrigger
                                            aria-label="Filter by benefit year"
                                            className="w-full"
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
                                    <Select
                                        value={tranche}
                                        onValueChange={setTranche}
                                    >
                                        <SelectTrigger
                                            aria-label="Filter by tranche"
                                            className="w-full"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">
                                                All tranches
                                            </SelectItem>
                                            <SelectItem value="1">
                                                SAP1
                                            </SelectItem>
                                            <SelectItem value="2">
                                                SAP2
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select
                                        value={status}
                                        onValueChange={setStatus}
                                    >
                                        <SelectTrigger
                                            aria-label="Filter by batch status"
                                            className="w-full"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">
                                                All statuses
                                            </SelectItem>
                                            {[
                                                'draft',
                                                'submitted',
                                                'approved',
                                                'partially_paid',
                                                'paid',
                                                'returned',
                                                'cancelled',
                                            ].map((item) => (
                                                <SelectItem
                                                    key={item}
                                                    value={item}
                                                >
                                                    {titleCase(item)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button type="submit" variant="outline">
                                        Apply filters
                                    </Button>
                                </form>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {rows.length > 0 ? (
                                <>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Batch</TableHead>
                                                <TableHead>Members</TableHead>
                                                <TableHead className="text-right">
                                                    Expected
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Paid
                                                </TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="w-12">
                                                    <span className="sr-only">
                                                        View
                                                    </span>
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {rows.map((batch) => (
                                                <TableRow key={batch.id}>
                                                    <TableCell>
                                                        <Link
                                                            href={`/finance/sap-batches/${batch.id}`}
                                                            className="font-mono text-xs font-semibold text-primary hover:underline"
                                                        >
                                                            {batch.reference}
                                                        </Link>
                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                            SAP{batch.tranche} ·{' '}
                                                            {batch.year}-
                                                            {String(
                                                                batch.month ??
                                                                    1,
                                                            ).padStart(
                                                                2,
                                                                '0',
                                                            )}{' '}
                                                            · created{' '}
                                                            {formatDate(
                                                                batch.created_at,
                                                            )}
                                                        </p>
                                                    </TableCell>
                                                    <TableCell className="tabular-nums">
                                                        {formatNumber(
                                                            batch.eligible_beneficiary_count ??
                                                                batch.beneficiary_count,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium tabular-nums">
                                                        {formatMoney(
                                                            batch.expected_gross_centavos ??
                                                                batch.expected_centavos,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {formatMoney(
                                                            batch.paid_centavos,
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <StatusBadge
                                                            status={
                                                                batch.status
                                                            }
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            asChild
                                                            variant="ghost"
                                                            size="icon"
                                                        >
                                                            <Link
                                                                href={`/finance/sap-batches/${batch.id}`}
                                                                aria-label={`View ${batch.reference}`}
                                                            >
                                                                <ArrowRight className="size-4" />
                                                            </Link>
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <Pagination collection={batches} />
                                </>
                            ) : (
                                <EmptyState
                                    icon={Layers3}
                                    title="No SAP batches found"
                                    description="Generate a batch or adjust the active filters."
                                />
                            )}
                        </CardContent>
                    </Card>

                    {canManage ? (
                        <Card className="min-w-0 xl:sticky xl:top-24">
                            <CardHeader>
                                <SectionHeading
                                    title="Generate a frozen batch"
                                    description="Eligibility, policy rates, and performance values are snapshotted when the batch is created."
                                />
                            </CardHeader>
                            <CardContent>
                                <form
                                    className="space-y-4"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        form.post('/finance/sap-batches', {
                                            preserveScroll: true,
                                        });
                                    }}
                                >
                                    {generationErrors.length > 0 ? (
                                        <AlertError
                                            errors={generationErrors}
                                            title="Batch could not be generated."
                                        />
                                    ) : null}
                                    <div className="grid gap-2">
                                        <Label htmlFor="batch-tranche">
                                            Payment tranche
                                        </Label>
                                        <Select
                                            value={String(form.data.tranche)}
                                            onValueChange={(value) => {
                                                const nextTranche =
                                                    Number(value);
                                                form.setData((data) => ({
                                                    ...data,
                                                    tranche: nextTranche,
                                                    month:
                                                        nextTranche === 2
                                                            ? 12
                                                            : Math.max(
                                                                  1,
                                                                  Math.min(
                                                                      data.month,
                                                                      latestAvailableSap1Month(
                                                                          data.year,
                                                                          currentManilaYear,
                                                                          currentManilaMonth,
                                                                      ),
                                                                  ),
                                                              ),
                                                }));
                                            }}
                                        >
                                            <SelectTrigger
                                                id="batch-tranche"
                                                className="w-full"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">
                                                    SAP1 · initial 40%
                                                </SelectItem>
                                                <SelectItem value="2">
                                                    SAP2 · annual performance
                                                    close (60%)
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <InputError
                                            message={form.errors.tranche}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="batch-policy">
                                            Effective policy
                                        </Label>
                                        <Select
                                            value={String(
                                                form.data.policy_version_id,
                                            )}
                                            onValueChange={(value) => {
                                                const policy = policies.find(
                                                    (item) =>
                                                        item.id ===
                                                        Number(value),
                                                );
                                                const nextYear =
                                                    policy?.effective_year ??
                                                    form.data.year;
                                                const nextAvailableMonth =
                                                    latestAvailableSap1Month(
                                                        nextYear,
                                                        currentManilaYear,
                                                        currentManilaMonth,
                                                    );
                                                form.setData((data) => ({
                                                    ...data,
                                                    policy_version_id:
                                                        Number(value),
                                                    year: nextYear,
                                                    month:
                                                        data.tranche === 2
                                                            ? 12
                                                            : Math.max(
                                                                  1,
                                                                  Math.min(
                                                                      data.month,
                                                                      nextAvailableMonth,
                                                                  ),
                                                              ),
                                                }));
                                            }}
                                        >
                                            <SelectTrigger
                                                id="batch-policy"
                                                className="w-full"
                                            >
                                                <SelectValue placeholder="Choose a policy" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {policies.map((policy) => (
                                                    <SelectItem
                                                        key={policy.id}
                                                        value={String(
                                                            policy.id,
                                                        )}
                                                    >
                                                        {policy.effective_year}{' '}
                                                        ·{' '}
                                                        {policy.source_circular}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <InputError
                                            message={
                                                form.errors.policy_version_id ??
                                                form.errors.year
                                            }
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="batch-month">
                                            {form.data.tranche === 2
                                                ? 'Annual close month'
                                                : 'Reporting month'}
                                        </Label>
                                        <Select
                                            value={String(form.data.month)}
                                            onValueChange={(value) => {
                                                const nextMonth = Number(value);

                                                if (
                                                    nextMonth >= 1 &&
                                                    nextMonth <= 12
                                                ) {
                                                    form.setData(
                                                        'month',
                                                        nextMonth,
                                                    );
                                                }
                                            }}
                                            disabled={
                                                form.data.tranche === 2 ||
                                                latestSap1Month === 0
                                            }
                                        >
                                            <SelectTrigger
                                                id="batch-month"
                                                className="w-full"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {monthNames
                                                    .filter((month) =>
                                                        form.data.tranche === 2
                                                            ? month.value === 12
                                                            : month.value <=
                                                              latestSap1Month,
                                                    )
                                                    .map((month) => (
                                                        <SelectItem
                                                            key={month.value}
                                                            value={String(
                                                                month.value,
                                                            )}
                                                        >
                                                            {month.label}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs leading-5 text-muted-foreground">
                                            {form.data.tranche === 2
                                                ? `SAP2 uses December and opens on January 8, ${form.data.year + 1}, after the annual close.`
                                                : 'Only elapsed SAP1 reporting months are available; one active batch is allowed per month.'}
                                        </p>
                                        {generationUnavailableReason ? (
                                            <p
                                                role="status"
                                                className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs leading-5 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
                                            >
                                                {generationUnavailableReason}
                                            </p>
                                        ) : null}
                                        <InputError
                                            message={form.errors.month}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="batch-notes">
                                            Notes{' '}
                                            <span className="font-normal text-muted-foreground">
                                                (optional)
                                            </span>
                                        </Label>
                                        <Textarea
                                            id="batch-notes"
                                            value={form.data.notes}
                                            onChange={(event) =>
                                                form.setData(
                                                    'notes',
                                                    event.target.value,
                                                )
                                            }
                                            rows={3}
                                        />
                                        <InputError
                                            message={form.errors.notes}
                                        />
                                    </div>
                                    <div className="rounded-lg border bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
                                        <div className="mb-1 flex items-center gap-2 font-semibold text-foreground">
                                            <CalendarRange className="size-3.5" />
                                            Snapshot checkpoint
                                        </div>
                                        Review readiness exceptions before
                                        generating. Existing batches will not
                                        change when beneficiary or policy data
                                        is edited.
                                    </div>
                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={
                                            form.processing ||
                                            policies.length === 0 ||
                                            generationUnavailableReason !== null
                                        }
                                    >
                                        <CirclePlus className="size-4" />
                                        {generationUnavailableReason
                                            ? 'Not yet available'
                                            : 'Generate draft batch'}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    ) : null}
                </div>
            </PageContainer>
        </>
    );
}

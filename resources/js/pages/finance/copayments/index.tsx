import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { Ban, CirclePlus, Info, ReceiptText, ShieldCheck } from 'lucide-react';
import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { VoidRecordDialog } from '@/components/yakap/void-record-dialog';
import {
    formatDate,
    formatMoney,
    manilaDateInput,
    toPesoInput,
} from '@/lib/yakap';
import type {
    Beneficiary,
    Copayment,
    Encounter,
    Facility,
    PaginatedOrArray,
    PolicyVersion,
} from '@/types';

type Props = {
    copayments?: PaginatedOrArray<Copayment>;
    beneficiaries?: Beneficiary[];
    encounters?: Encounter[];
    facility?: Facility;
    policy?: PolicyVersion | null;
    filters?: { year?: number };
    years?: number[];
};

export default function CopaymentsIndex({
    copayments,
    beneficiaries = [],
    encounters = [],
    facility,
    policy,
    filters = {},
    years = [],
}: Props) {
    const rows = getRows(copayments);
    const role = usePage().props.auth.user.role;
    const isAdministrator = role === 'administrator';
    const canManage = role === 'administrator' || role === 'finance_officer';
    const today = manilaDateInput();
    const year =
        filters.year ?? policy?.effective_year ?? Number(today.slice(0, 4));
    const availableYears = Array.from(new Set([year, ...years])).sort(
        (left, right) => right - left,
    );
    const isPrivate = facility?.type === 'private';
    const canRecordCopayment =
        isPrivate && policy !== null && policy !== undefined;
    const hasEligibleBeneficiaries = beneficiaries.length > 0;
    const canShowCopaymentForm = canRecordCopayment && hasEligibleBeneficiaries;
    const form = useForm({
        beneficiary_id: beneficiaries[0]?.id ?? 0,
        encounter_id: null as number | null,
        year,
        amount_centavos: 0,
        paid_at: today,
        receipt_number: '',
        notes: '',
    });
    const relevantEncounters = encounters.filter(
        (encounter) =>
            !encounter.beneficiary ||
            encounter.beneficiary.id === form.data.beneficiary_id,
    );

    return (
        <>
            <Head title="Co-payments" />
            <PageContainer>
                <PageHeader
                    eyebrow="Finance"
                    title="Co-payments"
                    description="Keep valid private-facility collections separate from benefit utilization and enforce the member-year cap."
                    actions={
                        <>
                            <Badge
                                variant="outline"
                                className={
                                    isPrivate
                                        ? 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300'
                                        : 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300'
                                }
                            >
                                {isPrivate ? (
                                    <ReceiptText className="size-3" />
                                ) : (
                                    <ShieldCheck className="size-3" />
                                )}
                                {isPrivate
                                    ? 'Private facility'
                                    : 'Public facility · no co-pay'}
                            </Badge>
                            <Select
                                value={String(year)}
                                onValueChange={(value) =>
                                    router.get(
                                        '/finance/copayments',
                                        { year: Number(value) },
                                        {
                                            preserveState: false,
                                            replace: true,
                                        },
                                    )
                                }
                            >
                                <SelectTrigger
                                    className="w-28 bg-card"
                                    aria-label="Co-payment year"
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
                        </>
                    }
                />

                {!isPrivate ? (
                    <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">
                        <ShieldCheck className="size-4" />
                        <AlertTitle>Collection is disabled</AlertTitle>
                        <AlertDescription>
                            Public facilities must not collect YAKAP Consulta
                            co-payments. Existing historical records remain
                            visible for audit purposes.
                        </AlertDescription>
                    </Alert>
                ) : !policy ? (
                    <Alert variant="destructive">
                        <Ban className="size-4" />
                        <AlertTitle>No active policy for {year}</AlertTitle>
                        <AlertDescription>
                            Co-payment entry stays disabled until an
                            administrator configures a year-effective policy and
                            member cap.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <Alert>
                        <Info className="size-4" />
                        <AlertTitle>Member-year cap</AlertTitle>
                        <AlertDescription>
                            The active {year} policy limits valid collections to{' '}
                            {formatMoney(policy?.copayment_cap_centavos)} per
                            member across the calendar year. Only active,
                            SAP1-ready members with selection, FPE, PCU, and
                            digital YES completed by the collection date are
                            eligible.
                        </AlertDescription>
                    </Alert>
                )}

                <div
                    className={`grid min-w-0 grid-cols-1 items-start gap-4 ${canManage ? 'xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,.55fr)]' : ''}`}
                >
                    <Card className="gap-0 py-0">
                        <CardHeader className="border-b py-5">
                            <SectionHeading
                                title={`${year} collection register`}
                                description="Voided collections are preserved but excluded from financial totals."
                            />
                        </CardHeader>
                        <CardContent className="p-0">
                            {rows.length > 0 ? (
                                <>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Receipt</TableHead>
                                                <TableHead>
                                                    Beneficiary
                                                </TableHead>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Encounter</TableHead>
                                                <TableHead className="text-right">
                                                    Amount
                                                </TableHead>
                                                <TableHead>Status</TableHead>
                                                {canManage ? (
                                                    <TableHead className="w-20">
                                                        <span className="sr-only">
                                                            Actions
                                                        </span>
                                                    </TableHead>
                                                ) : null}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {rows.map((copayment) => (
                                                <TableRow
                                                    key={copayment.id}
                                                    className={
                                                        copayment.voided_at
                                                            ? 'opacity-60'
                                                            : undefined
                                                    }
                                                >
                                                    <TableCell>
                                                        <p className="font-mono text-xs font-semibold">
                                                            {
                                                                copayment.reference
                                                            }
                                                        </p>
                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                            {copayment.receipt_number ??
                                                                'No receipt number'}
                                                        </p>
                                                    </TableCell>
                                                    <TableCell>
                                                        {copayment.beneficiary ? (
                                                            <Link
                                                                href={`/beneficiaries/${copayment.beneficiary.id}`}
                                                                className="font-medium text-primary hover:underline"
                                                            >
                                                                {
                                                                    copayment
                                                                        .beneficiary
                                                                        .full_name
                                                                }
                                                            </Link>
                                                        ) : (
                                                            (copayment.beneficiary_name ??
                                                            '—')
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {formatDate(
                                                            copayment.paid_at ??
                                                                copayment.collected_at,
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {copayment.encounter_id
                                                            ? `#${copayment.encounter_id}`
                                                            : 'Not linked'}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium tabular-nums">
                                                        {formatMoney(
                                                            copayment.amount_centavos,
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <StatusBadge
                                                            status={
                                                                copayment.voided_at
                                                                    ? 'void'
                                                                    : 'posted'
                                                            }
                                                        />
                                                    </TableCell>
                                                    {canManage ? (
                                                        <TableCell>
                                                            {!copayment.voided_at ? (
                                                                <VoidRecordDialog
                                                                    endpoint={`/finance/copayments/${copayment.id}/void`}
                                                                    recordType="co-payment"
                                                                    reference={
                                                                        copayment.reference
                                                                    }
                                                                />
                                                            ) : null}
                                                        </TableCell>
                                                    ) : null}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <Pagination collection={copayments} />
                                </>
                            ) : (
                                <EmptyState
                                    icon={ReceiptText}
                                    title="No co-payments"
                                    description={`No collection records exist for ${year}.`}
                                />
                            )}
                        </CardContent>
                    </Card>

                    {canManage ? (
                        <Card className="xl:sticky xl:top-24">
                            <CardHeader>
                                <SectionHeading
                                    title="Record a co-payment"
                                    description="Entry is limited to active, SAP1-ready beneficiaries; the server also checks readiness as of the collection date and enforces the member-year cap."
                                />
                            </CardHeader>
                            <CardContent>
                                {canShowCopaymentForm ? (
                                    <form
                                        className="space-y-4"
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            form.post('/finance/copayments', {
                                                preserveScroll: true,
                                                onSuccess: () =>
                                                    form.reset(
                                                        'amount_centavos',
                                                        'receipt_number',
                                                        'notes',
                                                        'encounter_id',
                                                    ),
                                            });
                                        }}
                                    >
                                        <div className="grid gap-2">
                                            <Label htmlFor="copay-beneficiary">
                                                Beneficiary
                                            </Label>
                                            <Select
                                                value={String(
                                                    form.data.beneficiary_id,
                                                )}
                                                onValueChange={(value) => {
                                                    form.setData((data) => ({
                                                        ...data,
                                                        beneficiary_id:
                                                            Number(value),
                                                        encounter_id: null,
                                                    }));
                                                }}
                                            >
                                                <SelectTrigger
                                                    id="copay-beneficiary"
                                                    className="w-full"
                                                >
                                                    <SelectValue placeholder="Choose a beneficiary" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {beneficiaries.map(
                                                        (beneficiary) => (
                                                            <SelectItem
                                                                key={
                                                                    beneficiary.id
                                                                }
                                                                value={String(
                                                                    beneficiary.id,
                                                                )}
                                                            >
                                                                {beneficiary.full_name ??
                                                                    `${beneficiary.first_name ?? ''} ${beneficiary.last_name ?? ''}`}
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <InputError
                                                message={
                                                    form.errors.beneficiary_id
                                                }
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="copay-encounter">
                                                Encounter{' '}
                                                <span className="font-normal text-muted-foreground">
                                                    (optional)
                                                </span>
                                            </Label>
                                            <Select
                                                value={
                                                    form.data.encounter_id
                                                        ? String(
                                                              form.data
                                                                  .encounter_id,
                                                          )
                                                        : 'none'
                                                }
                                                onValueChange={(value) =>
                                                    form.setData(
                                                        'encounter_id',
                                                        value === 'none'
                                                            ? null
                                                            : Number(value),
                                                    )
                                                }
                                            >
                                                <SelectTrigger
                                                    id="copay-encounter"
                                                    className="w-full"
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">
                                                        Not linked
                                                    </SelectItem>
                                                    {relevantEncounters.map(
                                                        (encounter) => (
                                                            <SelectItem
                                                                key={
                                                                    encounter.id
                                                                }
                                                                value={String(
                                                                    encounter.id,
                                                                )}
                                                            >
                                                                {
                                                                    encounter.reference
                                                                }{' '}
                                                                ·{' '}
                                                                {formatDate(
                                                                    encounter.encounter_date,
                                                                )}
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="copay-amount">
                                                Amount collected (PHP)
                                            </Label>
                                            <Input
                                                id="copay-amount"
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                max={
                                                    (policy?.copayment_cap_centavos ??
                                                        90000) / 100
                                                }
                                                value={
                                                    form.data.amount_centavos
                                                        ? toPesoInput(
                                                              form.data
                                                                  .amount_centavos,
                                                          )
                                                        : ''
                                                }
                                                onChange={(event) =>
                                                    form.setData(
                                                        'amount_centavos',
                                                        Math.round(
                                                            Number(
                                                                event.target
                                                                    .value,
                                                            ) * 100,
                                                        ),
                                                    )
                                                }
                                                placeholder="0.00"
                                                required
                                            />
                                            <InputError
                                                message={
                                                    form.errors.amount_centavos
                                                }
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="copay-date">
                                                Date collected
                                            </Label>
                                            <Input
                                                id="copay-date"
                                                type="date"
                                                max={today}
                                                value={form.data.paid_at}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'paid_at',
                                                        event.target.value,
                                                    )
                                                }
                                                required
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="copay-receipt">
                                                Receipt number
                                            </Label>
                                            <Input
                                                id="copay-receipt"
                                                value={form.data.receipt_number}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'receipt_number',
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="OR-2026-00001"
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="copay-notes">
                                                Notes
                                            </Label>
                                            <Textarea
                                                id="copay-notes"
                                                rows={3}
                                                value={form.data.notes}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'notes',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </div>
                                        <Button
                                            type="submit"
                                            className="w-full"
                                            disabled={form.processing}
                                        >
                                            <CirclePlus className="size-4" />
                                            Record co-payment
                                        </Button>
                                    </form>
                                ) : (
                                    <EmptyState
                                        icon={Ban}
                                        title={
                                            canRecordCopayment
                                                ? `No eligible ${year} beneficiaries`
                                                : isPrivate
                                                  ? `No active ${year} policy`
                                                  : 'Not available for public facilities'
                                        }
                                        description={
                                            canRecordCopayment
                                                ? 'Complete yearly selection, FPE, PCU, and digital YES readiness before recording a co-payment.'
                                                : isPrivate
                                                  ? 'An administrator must configure a year-effective policy before any collection can be recorded.'
                                                  : 'Change the facility classification only if this organization is formally operating as a private facility.'
                                        }
                                        action={
                                            canRecordCopayment ? (
                                                <Button
                                                    asChild
                                                    variant="outline"
                                                >
                                                    <Link
                                                        href={`/beneficiaries?year=${year}`}
                                                    >
                                                        Review beneficiary
                                                        readiness
                                                    </Link>
                                                </Button>
                                            ) : isAdministrator ? (
                                                <Button
                                                    asChild
                                                    variant="outline"
                                                >
                                                    <Link
                                                        href={
                                                            isPrivate
                                                                ? '/settings/policies'
                                                                : '/settings/facility'
                                                        }
                                                    >
                                                        {isPrivate
                                                            ? 'Configure policy'
                                                            : 'Review facility settings'}
                                                    </Link>
                                                </Button>
                                            ) : undefined
                                        }
                                    />
                                )}
                            </CardContent>
                        </Card>
                    ) : null}
                </div>
            </PageContainer>
        </>
    );
}

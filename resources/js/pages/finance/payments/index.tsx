import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    CirclePlus,
    CreditCard,
    Landmark,
    ReceiptText,
    TriangleAlert,
} from 'lucide-react';
import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import type { PaginatedOrArray, Payment, SapBatch } from '@/types';

type Props = {
    payments?: PaginatedOrArray<Payment>;
    batches?: SapBatch[];
    filters?: { year?: number; batch_id?: number | null };
    years?: number[];
    selectedBatchId?: number | null;
    batchSelectionRequested?: boolean;
};

export default function PaymentsIndex({
    payments,
    batches = [],
    filters = {},
    years = [],
    selectedBatchId,
    batchSelectionRequested,
}: Props) {
    const rows = getRows(payments);
    const page = usePage();
    const role = page.props.auth.user.role;
    const canManage = role === 'administrator' || role === 'finance_officer';
    const today = manilaDateInput();
    const query = page.url.includes('?') ? page.url.split('?')[1] : '';
    const queryRequestsBatch = new URLSearchParams(query).has('batch_id');
    const hasExplicitBatchSelection =
        batchSelectionRequested ?? queryRequestsBatch;
    const safeSelectedBatch = batches.find(
        (batch) => batch.id === selectedBatchId,
    );
    const activeYear = filters.year ?? Number(today.slice(0, 4));
    const availableYears =
        years.length > 0 ? years : [Number(today.slice(0, 4))];
    const initialBatchId = hasExplicitBatchSelection
        ? (safeSelectedBatch?.id ?? 0)
        : (safeSelectedBatch?.id ?? batches[0]?.id ?? 0);
    const form = useForm({
        sap_batch_id: initialBatchId,
        amount_centavos: 0,
        paid_at: today,
        method: 'Bank transfer',
        external_reference: '',
        notes: '',
    });
    const effectiveBatchId = batches.some(
        (batch) => batch.id === form.data.sap_batch_id,
    )
        ? form.data.sap_batch_id
        : initialBatchId;
    const formBatch = batches.find((batch) => batch.id === effectiveBatchId);
    const requestedBatchUnavailable =
        hasExplicitBatchSelection && safeSelectedBatch === undefined;

    return (
        <>
            <Head title="Payments" />
            <PageContainer>
                <PageHeader
                    eyebrow="Finance"
                    title="Payments"
                    description="Record partial or complete reimbursements and reconcile them to approved SAP batches."
                    actions={
                        <Select
                            value={String(activeYear)}
                            onValueChange={(value) =>
                                router.get(
                                    '/finance/payments',
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
                                aria-label="Payment year"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {availableYears.map((year) => (
                                    <SelectItem key={year} value={String(year)}>
                                        {year}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    }
                />

                <div
                    className={`grid min-w-0 grid-cols-1 items-start gap-4 ${canManage ? 'xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,.55fr)]' : ''}`}
                >
                    <Card className="gap-0 py-0">
                        <CardHeader className="border-b py-5">
                            <SectionHeading
                                title={`${activeYear} payment register`}
                                description="Voided records remain visible but no longer contribute to reconciliation."
                            />
                        </CardHeader>
                        <CardContent className="p-0">
                            {rows.length > 0 ? (
                                <>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Payment</TableHead>
                                                <TableHead>SAP batch</TableHead>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Method</TableHead>
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
                                            {rows.map((payment) => {
                                                const batch = payment.batch;

                                                return (
                                                    <TableRow
                                                        key={payment.id}
                                                        className={
                                                            payment.voided_at
                                                                ? 'opacity-60'
                                                                : undefined
                                                        }
                                                    >
                                                        <TableCell>
                                                            <p className="font-mono text-xs font-semibold">
                                                                {
                                                                    payment.reference
                                                                }
                                                            </p>
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                {payment.external_reference ??
                                                                    'No external reference'}
                                                            </p>
                                                        </TableCell>
                                                        <TableCell>
                                                            {batch ? (
                                                                <Link
                                                                    href={`/finance/sap-batches/${batch.id}`}
                                                                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                                                >
                                                                    {
                                                                        batch.reference
                                                                    }
                                                                    <ArrowRight className="size-3" />
                                                                </Link>
                                                            ) : (
                                                                (payment.batch_reference ??
                                                                '—')
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {formatDate(
                                                                payment.paid_at,
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {payment.method ??
                                                                '—'}
                                                        </TableCell>
                                                        <TableCell className="text-right font-medium tabular-nums">
                                                            {formatMoney(
                                                                payment.amount_centavos,
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <StatusBadge
                                                                status={
                                                                    payment.voided_at
                                                                        ? 'void'
                                                                        : 'posted'
                                                                }
                                                            />
                                                        </TableCell>
                                                        {canManage ? (
                                                            <TableCell>
                                                                {!payment.voided_at ? (
                                                                    <VoidRecordDialog
                                                                        endpoint={`/finance/payments/${payment.id}/void`}
                                                                        recordType="payment"
                                                                        reference={
                                                                            payment.reference
                                                                        }
                                                                    />
                                                                ) : null}
                                                            </TableCell>
                                                        ) : null}
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                    <Pagination collection={payments} />
                                </>
                            ) : (
                                <EmptyState
                                    icon={CreditCard}
                                    title="No payments recorded"
                                    description={`No SAP reimbursement payments have been recorded for ${activeYear}.`}
                                />
                            )}
                        </CardContent>
                    </Card>

                    {canManage ? (
                        <Card className="xl:sticky xl:top-24">
                            <CardHeader>
                                <SectionHeading
                                    title="Record a payment"
                                    description="The batch status updates automatically when the payment is saved."
                                />
                            </CardHeader>
                            <CardContent>
                                {batches.length > 0 ? (
                                    <form
                                        className="space-y-4"
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            form.transform((data) => ({
                                                ...data,
                                                sap_batch_id: effectiveBatchId,
                                            }));
                                            form.post('/finance/payments', {
                                                preserveScroll: true,
                                                onSuccess: () =>
                                                    form.reset(
                                                        'amount_centavos',
                                                        'external_reference',
                                                        'notes',
                                                    ),
                                            });
                                        }}
                                    >
                                        {requestedBatchUnavailable ? (
                                            <Alert>
                                                <TriangleAlert />
                                                <AlertTitle>
                                                    Requested batch is not
                                                    payable
                                                </AlertTitle>
                                                <AlertDescription>
                                                    It may be outside this
                                                    facility, in another year,
                                                    or no longer approved.
                                                    Choose a payable batch to
                                                    continue.
                                                </AlertDescription>
                                            </Alert>
                                        ) : null}
                                        <div className="grid gap-2">
                                            <Label htmlFor="payment-batch">
                                                Approved SAP batch
                                            </Label>
                                            <Select
                                                value={
                                                    effectiveBatchId
                                                        ? String(
                                                              effectiveBatchId,
                                                          )
                                                        : ''
                                                }
                                                onValueChange={(value) =>
                                                    form.setData(
                                                        'sap_batch_id',
                                                        Number(value),
                                                    )
                                                }
                                            >
                                                <SelectTrigger
                                                    id="payment-batch"
                                                    className="w-full"
                                                >
                                                    <SelectValue placeholder="Choose a payable batch" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {batches.map((batch) => (
                                                        <SelectItem
                                                            key={batch.id}
                                                            value={String(
                                                                batch.id,
                                                            )}
                                                        >
                                                            {batch.reference}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <InputError
                                                message={
                                                    form.errors.sap_batch_id
                                                }
                                            />
                                        </div>
                                        {formBatch ? (
                                            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/45 p-3 text-xs">
                                                <div>
                                                    <p className="text-muted-foreground">
                                                        Approved net
                                                    </p>
                                                    <p className="mt-1 font-semibold tabular-nums">
                                                        {formatMoney(
                                                            formBatch.approved_net_centavos,
                                                        )}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-muted-foreground">
                                                        Outstanding
                                                    </p>
                                                    <p className="text-coral mt-1 font-semibold tabular-nums">
                                                        {formatMoney(
                                                            formBatch.outstanding_centavos,
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : null}
                                        <div className="grid gap-2">
                                            <Label htmlFor="payment-amount">
                                                Amount received (PHP)
                                            </Label>
                                            <Input
                                                id="payment-amount"
                                                type="number"
                                                min="0.01"
                                                step="0.01"
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
                                            <Label htmlFor="payment-date">
                                                Date received
                                            </Label>
                                            <Input
                                                id="payment-date"
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
                                            <InputError
                                                message={form.errors.paid_at}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="payment-method">
                                                Payment method
                                            </Label>
                                            <Select
                                                value={form.data.method}
                                                onValueChange={(value) =>
                                                    form.setData(
                                                        'method',
                                                        value,
                                                    )
                                                }
                                            >
                                                <SelectTrigger
                                                    id="payment-method"
                                                    className="w-full"
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Bank transfer">
                                                        Bank transfer
                                                    </SelectItem>
                                                    <SelectItem value="Check">
                                                        Check
                                                    </SelectItem>
                                                    <SelectItem value="Other">
                                                        Other
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="payment-reference">
                                                External reference
                                            </Label>
                                            <Input
                                                id="payment-reference"
                                                value={
                                                    form.data.external_reference
                                                }
                                                onChange={(event) =>
                                                    form.setData(
                                                        'external_reference',
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Bank trace or check number"
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="payment-notes">
                                                Notes
                                            </Label>
                                            <Textarea
                                                id="payment-notes"
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
                                            disabled={
                                                form.processing || !formBatch
                                            }
                                        >
                                            <CirclePlus className="size-4" />
                                            Record payment
                                        </Button>
                                    </form>
                                ) : (
                                    <EmptyState
                                        icon={Landmark}
                                        title="No payable batches"
                                        description="A batch must be approved before a payment can be recorded."
                                        action={
                                            <Button asChild variant="outline">
                                                <Link href="/finance/sap-batches">
                                                    Review SAP batches
                                                    <ReceiptText className="size-4" />
                                                </Link>
                                            </Button>
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

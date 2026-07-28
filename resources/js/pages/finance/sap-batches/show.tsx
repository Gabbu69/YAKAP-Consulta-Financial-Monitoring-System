import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    CheckCircle2,
    FileLock2,
    Landmark,
    ReceiptText,
    UsersRound,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    InfoPair,
    PageContainer,
    PageHeader,
    SectionHeading,
    StatusBadge,
} from '@/components/yakap/page-elements';
import { SapStatusControl } from '@/components/yakap/sap-status-control';
import type { SapStatusUpdate } from '@/components/yakap/sap-status-control';
import {
    formatDate,
    formatMoney,
    formatNumber,
    formatPercent,
} from '@/lib/yakap';
import type { SapBatch } from '@/types';

type Props = {
    batch: SapBatch;
    statuses?: Array<{ name?: string; value?: string } | string>;
};

export default function SapBatchShow({ batch }: Props) {
    const [processing, setProcessing] = useState(false);
    const [transitionErrors, setTransitionErrors] = useState<
        Record<string, string>
    >({});
    const role = usePage().props.auth.user.role;
    const canManage = role === 'administrator' || role === 'finance_officer';
    const canRecordPayment =
        canManage && ['approved', 'partially_paid'].includes(batch.status);
    const payments = batch.payments ?? [];
    const snapshots = batch.beneficiaries ?? [];
    const paid = batch.paid_centavos ?? 0;
    const reconciliationBase = ['submitted', 'returned'].includes(batch.status)
        ? (batch.submitted_gross_centavos ?? 0)
        : ['approved', 'partially_paid', 'paid'].includes(batch.status)
          ? (batch.approved_net_centavos ?? 0)
          : 0;
    const reconciliationBasisLabel = ['submitted', 'returned'].includes(
        batch.status,
    )
        ? 'submitted gross while approval is pending'
        : ['approved', 'partially_paid', 'paid'].includes(batch.status)
          ? 'approved net'
          : 'no active receivable';
    const paymentProgress =
        reconciliationBase > 0
            ? Math.min((paid / reconciliationBase) * 100, 100)
            : 0;

    const updateStatus = (update: SapStatusUpdate) => {
        setProcessing(true);
        setTransitionErrors({});
        router.patch(`/finance/sap-batches/${batch.id}/status`, update, {
            preserveScroll: true,
            onError: (errors) =>
                setTransitionErrors(errors as Record<string, string>),
            onSuccess: () => setTransitionErrors({}),
            onFinish: () => setProcessing(false),
        });
    };

    const financialCards = [
        {
            label: 'Expected gross',
            value: batch.expected_gross_centavos,
            icon: FileLock2,
        },
        {
            label: 'Approved gross',
            value: batch.approved_gross_centavos,
            icon: CheckCircle2,
        },
        {
            label: 'Paid',
            value: batch.paid_centavos,
            icon: Landmark,
        },
        {
            label: 'Outstanding',
            value: batch.outstanding_centavos,
            icon: ReceiptText,
            accent: true,
        },
    ];

    return (
        <>
            <Head title={batch.reference} />
            <PageContainer>
                <PageHeader
                    eyebrow={`SAP${batch.tranche} · ${batch.year}`}
                    title={batch.reference}
                    description="Frozen reimbursement batch detail and payment reconciliation."
                    actions={
                        <>
                            <StatusBadge status={batch.status} />
                            <Button asChild variant="outline">
                                <Link href="/finance/sap-batches">
                                    <ArrowLeft className="size-4" />
                                    All batches
                                </Link>
                            </Button>
                        </>
                    }
                />

                <section
                    className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                    aria-label="Batch financial summary"
                >
                    {financialCards.map(
                        ({ label, value, icon: Icon, accent }) => (
                            <Card className="gap-3 py-5" key={label}>
                                <CardHeader className="flex flex-row items-center justify-between px-5">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        {label}
                                    </p>
                                    <Icon className="size-4 text-primary" />
                                </CardHeader>
                                <CardContent className="px-5">
                                    <p
                                        className={`text-xl font-bold tabular-nums ${accent ? 'text-coral' : ''}`}
                                    >
                                        {formatMoney(value)}
                                    </p>
                                </CardContent>
                            </Card>
                        ),
                    )}
                </section>

                <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,.6fr)]">
                    <div className="min-w-0 space-y-4">
                        {canManage ? (
                            <Card>
                                <CardHeader>
                                    <SectionHeading
                                        title="Snapshot basis"
                                        description="Fixed to the effective policy and eligibility data at generation."
                                        action={
                                            <Badge variant="outline">
                                                <FileLock2 className="size-3" />
                                                Frozen
                                            </Badge>
                                        }
                                    />
                                </CardHeader>
                                <CardContent>
                                    <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                                        <InfoPair
                                            label="Tranche"
                                            value={`SAP${batch.tranche}`}
                                        />
                                        <InfoPair
                                            label="Benefit year"
                                            value={batch.year}
                                        />
                                        <InfoPair
                                            label="Reporting month"
                                            value={new Intl.DateTimeFormat(
                                                'en-PH',
                                                {
                                                    month: 'long',
                                                },
                                            ).format(
                                                new Date(
                                                    batch.year,
                                                    (batch.month ?? 1) - 1,
                                                    1,
                                                ),
                                            )}
                                        />
                                        <InfoPair
                                            label="Eligible members"
                                            value={formatNumber(
                                                batch.eligible_beneficiary_count,
                                            )}
                                        />
                                        <InfoPair
                                            label="Policy source"
                                            value={
                                                batch.policy?.source_circular
                                            }
                                        />
                                        <InfoPair
                                            label="Per-capita rate"
                                            value={formatMoney(
                                                batch.policy
                                                    ?.per_capita_rate_centavos,
                                            )}
                                        />
                                        <InfoPair
                                            label="Performance factor"
                                            value={formatPercent(
                                                (batch.performance_factor_bps ??
                                                    0) / 10000,
                                            )}
                                        />
                                        <InfoPair
                                            label="Created"
                                            value={formatDate(batch.created_at)}
                                        />
                                    </dl>
                                </CardContent>
                            </Card>
                        ) : null}

                        <Card className="min-w-0 gap-0 overflow-hidden py-0">
                            <CardHeader className="border-b py-5">
                                <SectionHeading
                                    title="Beneficiary snapshot"
                                    description="Member-level readiness and allocation captured in this batch."
                                    action={
                                        <Badge variant="secondary">
                                            <UsersRound className="size-3" />
                                            {formatNumber(snapshots.length)}
                                        </Badge>
                                    }
                                />
                            </CardHeader>
                            <CardContent className="p-0">
                                {snapshots.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>
                                                    Beneficiary
                                                </TableHead>
                                                <TableHead>
                                                    Masked PIN
                                                </TableHead>
                                                <TableHead>Readiness</TableHead>
                                                <TableHead className="text-right">
                                                    Allocation
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {snapshots.map((snapshot) => (
                                                <TableRow key={snapshot.id}>
                                                    <TableCell>
                                                        <p className="font-medium">
                                                            {
                                                                snapshot.beneficiary_name_snapshot
                                                            }
                                                        </p>
                                                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                                                            {
                                                                snapshot.beneficiary_reference_snapshot
                                                            }
                                                        </p>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs">
                                                        {snapshot.pin_masked_snapshot ??
                                                            '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1">
                                                            {Object.entries(
                                                                snapshot.readiness_snapshot ??
                                                                    {},
                                                            ).map(
                                                                ([
                                                                    key,
                                                                    value,
                                                                ]) =>
                                                                    value ? (
                                                                        <Badge
                                                                            key={
                                                                                key
                                                                            }
                                                                            variant="secondary"
                                                                            className="text-[10px]"
                                                                        >
                                                                            {key.replaceAll(
                                                                                '_',
                                                                                ' ',
                                                                            )}
                                                                        </Badge>
                                                                    ) : null,
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium tabular-nums">
                                                        {formatMoney(
                                                            snapshot.allocated_amount_centavos,
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="p-6 text-sm text-muted-foreground">
                                        This frozen batch has no eligible
                                        beneficiary rows.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="min-w-0 gap-0 overflow-hidden py-0">
                            <CardHeader className="border-b py-5">
                                <SectionHeading
                                    title="Payment history"
                                    description="Posted and voided records are retained; only posted payments contribute to reconciliation."
                                    action={
                                        canRecordPayment ? (
                                            <Button
                                                asChild
                                                variant="outline"
                                                size="sm"
                                            >
                                                <Link
                                                    href={`/finance/payments?batch_id=${batch.id}&year=${batch.year}`}
                                                >
                                                    Record payment
                                                </Link>
                                            </Button>
                                        ) : null
                                    }
                                />
                            </CardHeader>
                            <CardContent className="p-0">
                                {payments.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Reference</TableHead>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Method</TableHead>
                                                <TableHead className="text-right">
                                                    Amount
                                                </TableHead>
                                                <TableHead>
                                                    Status / reason
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {payments.map((payment) => (
                                                <TableRow
                                                    key={payment.id}
                                                    className={
                                                        payment.voided_at
                                                            ? 'opacity-65'
                                                            : undefined
                                                    }
                                                >
                                                    <TableCell className="font-mono text-xs font-semibold">
                                                        {payment.reference}
                                                    </TableCell>
                                                    <TableCell>
                                                        {formatDate(
                                                            payment.paid_at,
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {payment.method ?? '—'}
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
                                                        {payment.void_reason ? (
                                                            <p className="mt-1 max-w-64 text-xs leading-5 text-muted-foreground">
                                                                {
                                                                    payment.void_reason
                                                                }
                                                            </p>
                                                        ) : null}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="p-6 text-sm text-muted-foreground">
                                        No payments have been recorded for this
                                        batch.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="min-w-0 space-y-4 xl:sticky xl:top-24">
                        <Card>
                            <CardHeader>
                                <SectionHeading
                                    title="Payment progress"
                                    description={`Paid against ${reconciliationBasisLabel}.`}
                                />
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-end justify-between">
                                    <p className="text-2xl font-bold tabular-nums">
                                        {paymentProgress.toFixed(1)}%
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatMoney(paid)} /{' '}
                                        {formatMoney(reconciliationBase)}
                                    </p>
                                </div>
                                <Progress
                                    value={paymentProgress}
                                    label="Batch payment progress"
                                />
                            </CardContent>
                        </Card>

                        {canManage ? (
                            <Card>
                                <CardHeader>
                                    <SectionHeading
                                        title="Move this batch"
                                        description={`Current status: ${batch.status.replaceAll('_', ' ')}`}
                                    />
                                </CardHeader>
                                <CardContent>
                                    <SapStatusControl
                                        key={batch.status}
                                        currentStatus={batch.status}
                                        expectedGrossCentavos={
                                            batch.expected_gross_centavos ?? 0
                                        }
                                        submittedGrossCentavos={
                                            batch.submitted_gross_centavos ?? 0
                                        }
                                        processing={processing}
                                        errors={transitionErrors}
                                        onUpdate={updateStatus}
                                    />
                                </CardContent>
                            </Card>
                        ) : null}

                        <Card>
                            <CardHeader>
                                <SectionHeading
                                    title="Approval deductions"
                                    description="Net approved reimbursement after configured withholding."
                                />
                            </CardHeader>
                            <CardContent>
                                <dl className="space-y-4">
                                    <InfoPair
                                        label="Approved gross"
                                        value={formatMoney(
                                            batch.approved_gross_centavos,
                                        )}
                                    />
                                    <InfoPair
                                        label="Withholding tax"
                                        value={formatMoney(
                                            batch.withholding_tax_centavos,
                                        )}
                                    />
                                    <InfoPair
                                        label="Approved net"
                                        value={formatMoney(
                                            batch.approved_net_centavos,
                                        )}
                                    />
                                </dl>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </PageContainer>
        </>
    );
}

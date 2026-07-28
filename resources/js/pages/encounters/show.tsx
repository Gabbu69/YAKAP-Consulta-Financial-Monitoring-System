import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarDays,
    CheckCircle2,
    ClipboardCheck,
    FileClock,
    History,
    LockKeyhole,
    ReceiptText,
    ShieldCheck,
    UserRound,
    XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { Auth } from '@/types';

type Beneficiary = {
    id: number | string;
    reference?: string;
    full_name?: string;
    first_name?: string;
    middle_name?: string | null;
    last_name?: string;
    suffix?: string | null;
    philhealth_pin_masked?: string;
    masked_pin?: string;
    masked_philhealth_pin?: string;
};

type User = {
    id?: number | string;
    name?: string;
};

type EncounterItem = {
    id: number | string;
    service_id?: number | string;
    service_code_snapshot?: string;
    service_name_snapshot?: string;
    classification_snapshot?: string;
    unit_snapshot?: string;
    service?: {
        code?: string;
        name?: string;
        unit?: string;
        classification?: string;
    };
    quantity?: number;
    unit_cost_centavos?: number;
    total_cost_centavos?: number;
    is_repeat_laboratory?: boolean;
};

type Encounter = {
    id: number | string;
    reference?: string;
    beneficiary_id?: number | string;
    beneficiary?: Beneficiary;
    beneficiary_name?: string;
    beneficiary_reference?: string;
    encounter_date?: string;
    status?: string;
    posted_at?: string | null;
    voided_at?: string | null;
    void_reason?: string | null;
    created_at?: string;
    updated_at?: string;
    created_by?: User;
    creator?: User;
    items?: EncounterItem[];
    encounter_items?: EncounterItem[];
    total_cost_centavos?: number;
    total_centavos?: number;
};

type PageProps = {
    encounter: Encounter;
    can?: {
        post?: boolean;
        void?: boolean;
    };
};

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

function friendlyDate(value?: string | null, includeTime = false): string {
    if (!value) {
        return 'Not recorded';
    }

    const date = includeTime
        ? new Date(value)
        : new Date(`${value.slice(0, 10)}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...(includeTime
            ? {
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZone: 'Asia/Manila',
              }
            : {}),
    }).format(date);
}

function titleCase(value?: string): string {
    return (value ?? 'other')
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function beneficiaryName(encounter: Encounter): string {
    if (encounter.beneficiary_name) {
        return encounter.beneficiary_name;
    }

    if (encounter.beneficiary?.full_name) {
        return encounter.beneficiary.full_name;
    }

    return [
        encounter.beneficiary?.first_name,
        encounter.beneficiary?.middle_name,
        encounter.beneficiary?.last_name,
        encounter.beneficiary?.suffix,
    ]
        .filter(Boolean)
        .join(' ');
}

function itemName(item: EncounterItem): string {
    return item.service_name_snapshot ?? item.service?.name ?? 'Service';
}

function itemCode(item: EncounterItem): string {
    return item.service_code_snapshot ?? item.service?.code ?? '—';
}

function classification(item: EncounterItem): string {
    return (
        item.classification_snapshot ?? item.service?.classification ?? 'other'
    );
}

function itemTotal(item: EncounterItem): number {
    return (
        item.total_cost_centavos ??
        (item.unit_cost_centavos ?? 0) * (item.quantity ?? 0)
    );
}

function totalCentavos(encounter: Encounter, items: EncounterItem[]): number {
    return (
        encounter.total_cost_centavos ??
        encounter.total_centavos ??
        items.reduce((sum, item) => sum + itemTotal(item), 0)
    );
}

function StatusBadge({ status = 'draft' }: { status?: string }) {
    const normalized = status.toLowerCase();

    if (normalized === 'posted') {
        return (
            <Badge className="border-0 bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                <ShieldCheck aria-hidden="true" />
                Posted
            </Badge>
        );
    }

    if (normalized === 'void' || normalized === 'voided') {
        return (
            <Badge variant="destructive">
                <XCircle aria-hidden="true" />
                Voided
            </Badge>
        );
    }

    return (
        <Badge
            variant="outline"
            className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
        >
            <FileClock aria-hidden="true" />
            Draft
        </Badge>
    );
}

export default function EncounterShow({ encounter, can }: PageProps) {
    const items = useMemo(
        () => encounter.items ?? encounter.encounter_items ?? [],
        [encounter.encounter_items, encounter.items],
    );
    const normalizedStatus = (encounter.status ?? 'draft').toLowerCase();
    const isDraft = normalizedStatus === 'draft';
    const isPosted = normalizedStatus === 'posted';
    const isVoided =
        normalizedStatus === 'void' || normalizedStatus === 'voided';
    const [postOpen, setPostOpen] = useState(false);
    const [voidOpen, setVoidOpen] = useState(false);
    const voidForm = useForm<{ reason: string }>({ reason: '' });
    const { auth } = usePage<{ auth: Auth }>().props;
    const total = totalCentavos(encounter, items);
    const costGroups = useMemo(() => {
        const groups = new Map<string, number>();

        items.forEach((item) => {
            const key = classification(item);
            groups.set(key, (groups.get(key) ?? 0) + itemTotal(item));
        });

        return [...groups.entries()].sort((a, b) => b[1] - a[1]);
    }, [items]);
    const beneficiaryId = encounter.beneficiary_id ?? encounter.beneficiary?.id;
    const canEncode = ['administrator', 'encoder'].includes(
        String(auth.user.role),
    );
    const canPost = can?.post ?? (canEncode && isDraft);
    const canVoid =
        can?.void ?? (auth.user.role === 'administrator' && isPosted);

    function postEncounter() {
        router.patch(
            `/encounters/${encounter.id}/post`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => setPostOpen(false),
            },
        );
    }

    function voidEncounter(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        voidForm.patch(`/encounters/${encounter.id}/void`, {
            preserveScroll: true,
            onSuccess: () => {
                voidForm.reset();
                setVoidOpen(false);
            },
        });
    }

    return (
        <>
            <Head title={encounter.reference ?? `Encounter ${encounter.id}`} />

            <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                <header>
                    <Button variant="ghost" size="sm" className="-ml-3" asChild>
                        <Link href="/encounters">
                            <ArrowLeft aria-hidden="true" />
                            Service encounters
                        </Link>
                    </Button>
                    <div className="mt-4 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                        <div>
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="font-[Manrope] text-2xl font-semibold tracking-tight sm:text-3xl">
                                    {encounter.reference ??
                                        `Encounter ${encounter.id}`}
                                </h1>
                                <StatusBadge status={encounter.status} />
                            </div>
                            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                <span>
                                    {friendlyDate(encounter.encounter_date)}
                                </span>
                                <span aria-hidden="true">•</span>
                                <span>{items.length} service lines</span>
                                <span aria-hidden="true">•</span>
                                <span>
                                    Recorded by{' '}
                                    {encounter.created_by?.name ??
                                        encounter.creator?.name ??
                                        'System user'}
                                </span>
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {canPost && isDraft ? (
                                <Dialog
                                    open={postOpen}
                                    onOpenChange={setPostOpen}
                                >
                                    <DialogTrigger asChild>
                                        <Button className="bg-teal-700 text-white hover:bg-teal-800">
                                            <ClipboardCheck aria-hidden="true" />
                                            Post encounter
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>
                                                Post this encounter?
                                            </DialogTitle>
                                            <DialogDescription>
                                                Service names, classifications,
                                                quantities, and unit costs will
                                                be frozen for reporting. This
                                                action cannot be edited
                                                afterward.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <DialogFooter>
                                            <Button
                                                variant="outline"
                                                onClick={() =>
                                                    setPostOpen(false)
                                                }
                                            >
                                                Keep as draft
                                            </Button>
                                            <Button
                                                className="bg-teal-700 text-white hover:bg-teal-800"
                                                onClick={postEncounter}
                                            >
                                                Confirm post
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            ) : null}
                            {canVoid && isPosted ? (
                                <Dialog
                                    open={voidOpen}
                                    onOpenChange={setVoidOpen}
                                >
                                    <DialogTrigger asChild>
                                        <Button variant="destructive">
                                            <XCircle aria-hidden="true" />
                                            Void
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>
                                                Void this encounter?
                                            </DialogTitle>
                                            <DialogDescription>
                                                The record and its cost remain
                                                in the audit history but are
                                                excluded from active financial
                                                totals.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <form
                                            onSubmit={voidEncounter}
                                            className="space-y-4"
                                        >
                                            <div>
                                                <Label htmlFor="reason">
                                                    Reason for voiding
                                                </Label>
                                                <textarea
                                                    id="reason"
                                                    rows={4}
                                                    className="mt-2 flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
                                                    value={voidForm.data.reason}
                                                    onChange={(event) =>
                                                        voidForm.setData(
                                                            'reason',
                                                            event.target.value,
                                                        )
                                                    }
                                                    placeholder="Explain why this financial record must be voided."
                                                    required
                                                    minLength={10}
                                                    aria-invalid={Boolean(
                                                        voidForm.errors.reason,
                                                    )}
                                                />
                                                <InputError
                                                    className="mt-2"
                                                    message={
                                                        voidForm.errors.reason
                                                    }
                                                />
                                            </div>
                                            <DialogFooter>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() =>
                                                        setVoidOpen(false)
                                                    }
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    variant="destructive"
                                                    disabled={
                                                        voidForm.processing ||
                                                        voidForm.data.reason.trim()
                                                            .length < 10
                                                    }
                                                >
                                                    Confirm void
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            ) : null}
                        </div>
                    </div>
                </header>

                {isVoided ? (
                    <Alert variant="destructive">
                        <XCircle aria-hidden="true" />
                        <AlertTitle>Voided financial record</AlertTitle>
                        <AlertDescription>
                            {encounter.void_reason ??
                                'No void reason was provided.'}{' '}
                            Voided {friendlyDate(encounter.voided_at, true)}.
                        </AlertDescription>
                    </Alert>
                ) : null}

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-6">
                        <Card className="gap-0 overflow-hidden py-0 shadow-sm">
                            <CardHeader className="border-b px-6 py-5">
                                <CardTitle>Service line items</CardTitle>
                                <CardDescription className="mt-1">
                                    Values below are the financial snapshots
                                    saved with this encounter.
                                </CardDescription>
                            </CardHeader>

                            {items.length ? (
                                <>
                                    <div className="divide-y md:hidden">
                                        {items.map((item) => (
                                            <article
                                                key={item.id}
                                                className="space-y-4 p-5"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="font-semibold">
                                                            {itemName(item)}
                                                        </p>
                                                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                                                            {itemCode(item)}
                                                        </p>
                                                    </div>
                                                    <Badge variant="outline">
                                                        {titleCase(
                                                            classification(
                                                                item,
                                                            ),
                                                        )}
                                                    </Badge>
                                                </div>
                                                {item.is_repeat_laboratory ? (
                                                    <Badge className="border-0 bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
                                                        Repeat laboratory
                                                    </Badge>
                                                ) : null}
                                                <dl className="grid grid-cols-3 gap-3 text-sm">
                                                    <div>
                                                        <dt className="text-xs text-muted-foreground">
                                                            Qty
                                                        </dt>
                                                        <dd className="mt-1 font-medium">
                                                            {item.quantity ?? 0}
                                                        </dd>
                                                    </div>
                                                    <div>
                                                        <dt className="text-xs text-muted-foreground">
                                                            Unit cost
                                                        </dt>
                                                        <dd className="mt-1 font-medium">
                                                            {currency.format(
                                                                (item.unit_cost_centavos ??
                                                                    0) / 100,
                                                            )}
                                                        </dd>
                                                    </div>
                                                    <div className="text-right">
                                                        <dt className="text-xs text-muted-foreground">
                                                            Total
                                                        </dt>
                                                        <dd className="mt-1 font-semibold">
                                                            {currency.format(
                                                                itemTotal(
                                                                    item,
                                                                ) / 100,
                                                            )}
                                                        </dd>
                                                    </div>
                                                </dl>
                                            </article>
                                        ))}
                                    </div>

                                    <div className="hidden overflow-x-auto md:block">
                                        <table className="w-full text-left text-sm">
                                            <thead className="border-b bg-muted/30 text-xs tracking-wide text-muted-foreground uppercase">
                                                <tr>
                                                    <th
                                                        scope="col"
                                                        className="px-6 py-3 font-medium"
                                                    >
                                                        Service
                                                    </th>
                                                    <th
                                                        scope="col"
                                                        className="px-5 py-3 font-medium"
                                                    >
                                                        Classification
                                                    </th>
                                                    <th
                                                        scope="col"
                                                        className="px-5 py-3 text-right font-medium"
                                                    >
                                                        Quantity
                                                    </th>
                                                    <th
                                                        scope="col"
                                                        className="px-5 py-3 text-right font-medium"
                                                    >
                                                        Unit cost
                                                    </th>
                                                    <th
                                                        scope="col"
                                                        className="px-6 py-3 text-right font-medium"
                                                    >
                                                        Total
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {items.map((item) => (
                                                    <tr key={item.id}>
                                                        <td className="px-6 py-4">
                                                            <p className="font-medium">
                                                                {itemName(item)}
                                                            </p>
                                                            <div className="mt-1 flex items-center gap-2">
                                                                <span className="font-mono text-xs text-muted-foreground">
                                                                    {itemCode(
                                                                        item,
                                                                    )}
                                                                </span>
                                                                {item.is_repeat_laboratory ? (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-200"
                                                                    >
                                                                        Repeat
                                                                        lab
                                                                    </Badge>
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            {titleCase(
                                                                classification(
                                                                    item,
                                                                ),
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-4 text-right tabular-nums">
                                                            {item.quantity ?? 0}{' '}
                                                            <span className="text-xs text-muted-foreground">
                                                                {item.unit_snapshot ??
                                                                    item.service
                                                                        ?.unit ??
                                                                    ''}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-4 text-right tabular-nums">
                                                            {currency.format(
                                                                (item.unit_cost_centavos ??
                                                                    0) / 100,
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-semibold tabular-nums">
                                                            {currency.format(
                                                                itemTotal(
                                                                    item,
                                                                ) / 100,
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <footer className="flex items-center justify-between gap-4 border-t bg-muted/20 px-6 py-5">
                                        <div>
                                            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                                Encounter total
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {total.toLocaleString('en-PH')}{' '}
                                                centavos
                                            </p>
                                        </div>
                                        <p className="font-[Manrope] text-2xl font-semibold tabular-nums">
                                            {currency.format(total / 100)}
                                        </p>
                                    </footer>
                                </>
                            ) : (
                                <div className="px-6 py-12 text-center">
                                    <p className="text-sm font-medium">
                                        No service lines
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        This draft does not contain costed
                                        services yet.
                                    </p>
                                </div>
                            )}
                        </Card>

                        <Card className="gap-5 shadow-sm">
                            <CardHeader>
                                <CardTitle>Record history</CardTitle>
                                <CardDescription>
                                    Key lifecycle timestamps in Asia/Manila
                                    time.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ol className="grid gap-3 sm:grid-cols-3">
                                    <li className="rounded-xl border p-4">
                                        <History
                                            className="size-4 text-muted-foreground"
                                            aria-hidden="true"
                                        />
                                        <p className="mt-3 text-xs text-muted-foreground">
                                            Created
                                        </p>
                                        <p className="mt-1 text-sm font-medium">
                                            {friendlyDate(
                                                encounter.created_at,
                                                true,
                                            )}
                                        </p>
                                    </li>
                                    <li className="rounded-xl border p-4">
                                        <CheckCircle2
                                            className="size-4 text-teal-600"
                                            aria-hidden="true"
                                        />
                                        <p className="mt-3 text-xs text-muted-foreground">
                                            Posted
                                        </p>
                                        <p className="mt-1 text-sm font-medium">
                                            {friendlyDate(
                                                encounter.posted_at,
                                                true,
                                            )}
                                        </p>
                                    </li>
                                    <li className="rounded-xl border p-4">
                                        <XCircle
                                            className="size-4 text-destructive"
                                            aria-hidden="true"
                                        />
                                        <p className="mt-3 text-xs text-muted-foreground">
                                            Voided
                                        </p>
                                        <p className="mt-1 text-sm font-medium">
                                            {friendlyDate(
                                                encounter.voided_at,
                                                true,
                                            )}
                                        </p>
                                    </li>
                                </ol>
                            </CardContent>
                        </Card>
                    </div>

                    <aside className="space-y-6 lg:sticky lg:top-6 lg:h-fit">
                        <Card className="gap-5 border-teal-900/10 bg-gradient-to-b from-teal-950 to-cyan-950 text-white shadow-sm">
                            <CardHeader>
                                <div className="grid size-10 place-items-center rounded-xl bg-white/10">
                                    <UserRound
                                        className="size-5"
                                        aria-hidden="true"
                                    />
                                </div>
                                <CardTitle className="mt-2">
                                    Beneficiary
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {beneficiaryId ? (
                                    <Link
                                        href={`/beneficiaries/${beneficiaryId}`}
                                        className="group block rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
                                    >
                                        <p className="font-semibold group-hover:underline">
                                            {beneficiaryName(encounter) ||
                                                'Beneficiary'}
                                        </p>
                                        <p className="mt-2 font-mono text-xs text-teal-100/70">
                                            {encounter.beneficiary_reference ??
                                                encounter.beneficiary
                                                    ?.reference ??
                                                'Reference unavailable'}
                                        </p>
                                        <p className="mt-1 font-mono text-xs text-teal-100/70">
                                            {encounter.beneficiary
                                                ?.philhealth_pin_masked ??
                                                encounter.beneficiary
                                                    ?.masked_pin ??
                                                encounter.beneficiary
                                                    ?.masked_philhealth_pin ??
                                                'PIN masked'}
                                        </p>
                                    </Link>
                                ) : (
                                    <p className="text-sm text-teal-100/70">
                                        Beneficiary unavailable
                                    </p>
                                )}
                                <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                                    <CalendarDays
                                        className="size-4 text-teal-200"
                                        aria-hidden="true"
                                    />
                                    <div>
                                        <p className="text-xs text-teal-100/65">
                                            Encounter date
                                        </p>
                                        <p className="mt-1 text-sm font-medium">
                                            {friendlyDate(
                                                encounter.encounter_date,
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="gap-5 shadow-sm">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <ReceiptText
                                        className="size-5 text-teal-700 dark:text-teal-300"
                                        aria-hidden="true"
                                    />
                                    <div>
                                        <CardTitle className="text-base">
                                            Cost composition
                                        </CardTitle>
                                        <CardDescription className="mt-1">
                                            By explicit classification
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {costGroups.length ? (
                                    costGroups.map(([group, amount]) => {
                                        const percentage =
                                            total > 0
                                                ? Math.round(
                                                      (amount / total) * 100,
                                                  )
                                                : 0;

                                        return (
                                            <div key={group}>
                                                <div className="flex items-center justify-between gap-3 text-sm">
                                                    <span className="font-medium">
                                                        {titleCase(group)}
                                                    </span>
                                                    <span className="font-semibold tabular-nums">
                                                        {currency.format(
                                                            amount / 100,
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                                                    <div
                                                        className="h-full rounded-full bg-teal-600"
                                                        style={{
                                                            width: `${percentage}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No cost data available.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="gap-4 shadow-sm">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <LockKeyhole
                                        className="size-5 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                    <CardTitle className="text-base">
                                        Audit safeguards
                                    </CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-3 text-xs leading-5 text-muted-foreground">
                                    <li>
                                        Posted snapshots do not change when the
                                        service catalog is updated.
                                    </li>
                                    <li>
                                        Voiding preserves this record and
                                        requires a reason.
                                    </li>
                                    <li>
                                        Detailed clinical notes are not
                                        collected here.
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </aside>
                </div>
            </main>
        </>
    );
}

EncounterShow.layout = {
    breadcrumbs: [
        {
            title: 'Service encounters',
            href: '/encounters',
        },
        {
            title: 'Encounter details',
            href: '#',
        },
    ],
};

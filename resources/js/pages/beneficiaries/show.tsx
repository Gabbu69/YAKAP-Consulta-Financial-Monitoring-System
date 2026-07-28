import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Archive,
    ArrowLeft,
    CalendarDays,
    Check,
    ClipboardPlus,
    Edit3,
    History,
    Mail,
    MapPin,
    Phone,
    RotateCcw,
    ShieldCheck,
    UserRound,
    X,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { Auth } from '@/types';

type YearRecord = {
    id?: number | string;
    year?: number;
    selected?: boolean;
    selected_at?: string | null;
    fpe_completed?: boolean;
    fpe_completed_at?: string | null;
    pcu_reference?: string | null;
    yes_confirmed?: boolean;
    yes_confirmed_at?: string | null;
    sap1_ready?: boolean;
};

type Encounter = {
    id: number | string;
    reference?: string;
    encounter_date?: string;
    status?: string;
    total_cost_centavos?: number;
    total_centavos?: number;
};

type Paginated<T> = {
    data: T[];
};

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
    birth_date?: string;
    sex?: string;
    beneficiary_type?: string;
    patient_type?: string;
    contact_number?: string | null;
    email?: string | null;
    address?: string | null;
    archived_at?: string | null;
    created_at?: string;
    readiness?: YearRecord;
    year_record?: YearRecord;
    beneficiary_year?: YearRecord;
    current_year?: YearRecord;
    beneficiary_years?: YearRecord[];
    year_records?: YearRecord[];
    yearly_statuses?: YearRecord[];
    encounters?: Encounter[];
};

type PageProps = {
    beneficiary: Beneficiary;
    yearRecord?: YearRecord;
    year_record?: YearRecord;
    yearStatus?: YearRecord;
    year_status?: YearRecord;
    readiness?: YearRecord;
    yearRecords?: YearRecord[];
    year_records?: YearRecord[];
    years?: number[];
    selectedYear?: number;
    selected_year?: number;
    year?: number;
    encounters?: Encounter[] | Paginated<Encounter>;
    can?: {
        update?: boolean;
        archive?: boolean;
        restore?: boolean;
        create_encounter?: boolean;
    };
};

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

function money(centavos?: number): string {
    return currency.format((centavos ?? 0) / 100);
}

function friendlyDate(value?: string | null): string {
    if (!value) {
        return 'Not recorded';
    }

    const date = new Date(`${value.slice(0, 10)}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(date);
}

function titleCase(value?: string): string {
    if (!value) {
        return 'Not recorded';
    }

    return value
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function fullName(beneficiary: Beneficiary): string {
    if (beneficiary.full_name) {
        return beneficiary.full_name;
    }

    return [
        beneficiary.first_name,
        beneficiary.middle_name,
        beneficiary.last_name,
        beneficiary.suffix,
    ]
        .filter(Boolean)
        .join(' ');
}

function isReady(record: YearRecord): boolean {
    return (
        record.sap1_ready ??
        Boolean(
            record.selected &&
            record.fpe_completed &&
            record.pcu_reference &&
            record.yes_confirmed,
        )
    );
}

function rowsFrom<T>(value: T[] | Paginated<T> | undefined): T[] {
    if (Array.isArray(value)) {
        return value;
    }

    return value?.data ?? [];
}

function StatusBadge({ status = 'draft' }: { status?: string }) {
    const normalized = status.toLowerCase();

    if (normalized === 'posted') {
        return (
            <Badge className="border-0 bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                Posted
            </Badge>
        );
    }

    if (normalized === 'void' || normalized === 'voided') {
        return <Badge variant="destructive">Voided</Badge>;
    }

    return <Badge variant="outline">{titleCase(status)}</Badge>;
}

function Detail({
    label,
    value,
    mono = false,
}: {
    label: string;
    value: ReactNode;
    mono?: boolean;
}) {
    return (
        <div>
            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </dt>
            <dd
                className={`mt-1.5 text-sm ${mono ? 'font-mono' : 'font-medium'}`}
            >
                {value || 'Not recorded'}
            </dd>
        </div>
    );
}

function ReadinessItem({
    label,
    complete,
    detail,
}: {
    label: string;
    complete: boolean;
    detail: string;
}) {
    return (
        <li className="flex gap-3 rounded-xl border bg-background p-4">
            <span
                className={`grid size-8 shrink-0 place-items-center rounded-full ${
                    complete
                        ? 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300'
                        : 'bg-muted text-muted-foreground'
                }`}
            >
                {complete ? (
                    <Check className="size-4" aria-hidden="true" />
                ) : (
                    <X className="size-4" aria-hidden="true" />
                )}
            </span>
            <div>
                <p className="text-sm font-semibold">{label}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {detail}
                </p>
            </div>
        </li>
    );
}

export default function BeneficiaryShow({
    beneficiary,
    yearRecord,
    year_record,
    yearStatus,
    year_status,
    readiness,
    yearRecords,
    year_records,
    years,
    selectedYear,
    selected_year,
    year,
    encounters,
    can,
}: PageProps) {
    const allYearRecords =
        yearRecords ??
        year_records ??
        beneficiary.year_records ??
        beneficiary.beneficiary_years ??
        beneficiary.yearly_statuses ??
        [];
    const activeRecord =
        yearRecord ??
        year_record ??
        yearStatus ??
        year_status ??
        readiness ??
        beneficiary.year_record ??
        beneficiary.readiness ??
        beneficiary.beneficiary_year ??
        beneficiary.current_year ??
        {};
    const activeYear =
        selectedYear ??
        selected_year ??
        year ??
        activeRecord.year ??
        new Date().getFullYear();
    const yearOptions = years?.length
        ? years
        : allYearRecords.length
          ? allYearRecords
                .map((record) => record.year)
                .filter((year): year is number => Boolean(year))
          : [activeYear];
    const recentEncounters = rowsFrom(encounters ?? beneficiary.encounters);
    const archived = Boolean(beneficiary.archived_at);
    const ready = isReady(activeRecord);
    const [archiveOpen, setArchiveOpen] = useState(false);
    const { auth } = usePage<{ auth: Auth }>().props;
    const canManage = ['administrator', 'encoder'].includes(
        String(auth.user.role),
    );
    const canUpdate = can?.update ?? canManage;
    const canArchive = can?.archive ?? auth.user.role === 'administrator';
    const canRestore = can?.restore ?? false;
    const canCreateEncounter =
        can?.create_encounter ?? (canManage && !archived);

    function changeYear(value: string) {
        router.get(
            `/beneficiaries/${beneficiary.id}`,
            { year: value },
            {
                preserveScroll: true,
                preserveState: true,
                replace: true,
            },
        );
    }

    function archiveBeneficiary() {
        router.delete(`/beneficiaries/${beneficiary.id}`, {
            preserveScroll: true,
            onSuccess: () => setArchiveOpen(false),
        });
    }

    function restoreBeneficiary() {
        router.post(
            `/beneficiaries/${beneficiary.id}/restore`,
            {},
            { preserveScroll: true },
        );
    }

    return (
        <>
            <Head title={fullName(beneficiary)} />

            <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                <header className="flex flex-col gap-5">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 w-fit"
                        asChild
                    >
                        <Link href="/beneficiaries">
                            <ArrowLeft aria-hidden="true" />
                            Beneficiaries
                        </Link>
                    </Button>

                    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                        <div className="flex min-w-0 items-start gap-4">
                            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-700 text-white shadow-sm">
                                <UserRound aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="font-[Manrope] text-2xl font-semibold tracking-tight sm:text-3xl">
                                        {fullName(beneficiary)}
                                    </h1>
                                    {archived ? (
                                        <Badge variant="outline">
                                            <Archive aria-hidden="true" />
                                            Archived
                                        </Badge>
                                    ) : ready ? (
                                        <Badge className="border-0 bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                                            <ShieldCheck aria-hidden="true" />
                                            SAP1 ready
                                        </Badge>
                                    ) : (
                                        <Badge
                                            variant="outline"
                                            className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                                        >
                                            Action needed
                                        </Badge>
                                    )}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                    <span className="font-mono">
                                        {beneficiary.reference ??
                                            'Reference pending'}
                                    </span>
                                    <span aria-hidden="true">•</span>
                                    <span>
                                        {titleCase(
                                            beneficiary.beneficiary_type ??
                                                beneficiary.patient_type,
                                        )}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {canCreateEncounter ? (
                                <Button
                                    className="bg-teal-700 text-white hover:bg-teal-800"
                                    asChild
                                >
                                    <Link
                                        href={`/encounters/create?beneficiary_id=${beneficiary.id}`}
                                    >
                                        <ClipboardPlus aria-hidden="true" />
                                        Record encounter
                                    </Link>
                                </Button>
                            ) : null}
                            {canUpdate && !archived ? (
                                <Button variant="outline" asChild>
                                    <Link
                                        href={`/beneficiaries/${beneficiary.id}/edit?year=${activeYear}`}
                                    >
                                        <Edit3 aria-hidden="true" />
                                        Edit
                                    </Link>
                                </Button>
                            ) : null}
                            {archived && canRestore ? (
                                <Button
                                    variant="outline"
                                    onClick={restoreBeneficiary}
                                >
                                    <RotateCcw aria-hidden="true" />
                                    Restore
                                </Button>
                            ) : null}
                            {!archived && canArchive ? (
                                <Dialog
                                    open={archiveOpen}
                                    onOpenChange={setArchiveOpen}
                                >
                                    <DialogTrigger asChild>
                                        <Button variant="ghost">
                                            <Archive aria-hidden="true" />
                                            Archive
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>
                                                Archive this beneficiary?
                                            </DialogTitle>
                                            <DialogDescription>
                                                The member will no longer appear
                                                in active workflows. Identity,
                                                encounter, and financial history
                                                will remain available for audit.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <DialogFooter>
                                            <Button
                                                variant="outline"
                                                onClick={() =>
                                                    setArchiveOpen(false)
                                                }
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                onClick={archiveBeneficiary}
                                            >
                                                Archive beneficiary
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            ) : null}
                        </div>
                    </div>
                </header>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
                    <div className="space-y-6">
                        <Card className="gap-5 shadow-sm">
                            <CardHeader>
                                <CardTitle>Member profile</CardTitle>
                                <CardDescription>
                                    Sensitive identifiers remain masked in all
                                    views and exports.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <dl className="grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                                    <Detail
                                        label="PhilHealth PIN"
                                        value={
                                            beneficiary.philhealth_pin_masked ??
                                            beneficiary.masked_pin ??
                                            beneficiary.masked_philhealth_pin ??
                                            '••••-••••••••-•'
                                        }
                                        mono
                                    />
                                    <Detail
                                        label="Birth date"
                                        value={friendlyDate(
                                            beneficiary.birth_date,
                                        )}
                                    />
                                    <Detail
                                        label="Sex"
                                        value={titleCase(beneficiary.sex)}
                                    />
                                    <Detail
                                        label="Beneficiary type"
                                        value={titleCase(
                                            beneficiary.beneficiary_type ??
                                                beneficiary.patient_type,
                                        )}
                                    />
                                    <Detail
                                        label="Registered"
                                        value={friendlyDate(
                                            beneficiary.created_at,
                                        )}
                                    />
                                    <Detail
                                        label="Registry state"
                                        value={archived ? 'Archived' : 'Active'}
                                    />
                                </dl>
                                <div className="mt-7 grid gap-4 border-t pt-6 sm:grid-cols-2">
                                    <div className="flex items-start gap-3 rounded-xl bg-muted/30 p-4">
                                        <Phone
                                            className="mt-0.5 size-4 text-teal-700 dark:text-teal-300"
                                            aria-hidden="true"
                                        />
                                        <div>
                                            <p className="text-xs text-muted-foreground">
                                                Contact number
                                            </p>
                                            <p className="mt-1 text-sm font-medium">
                                                {beneficiary.contact_number ??
                                                    'Not recorded'}
                                            </p>
                                        </div>
                                    </div>
                                    {beneficiary.email ? (
                                        <div className="flex items-start gap-3 rounded-xl bg-muted/30 p-4">
                                            <Mail
                                                className="mt-0.5 size-4 text-teal-700 dark:text-teal-300"
                                                aria-hidden="true"
                                            />
                                            <div>
                                                <p className="text-xs text-muted-foreground">
                                                    Email
                                                </p>
                                                <p className="mt-1 text-sm font-medium">
                                                    {beneficiary.email}
                                                </p>
                                            </div>
                                        </div>
                                    ) : null}
                                    <div className="flex items-start gap-3 rounded-xl bg-muted/30 p-4 sm:col-span-2">
                                        <MapPin
                                            className="mt-0.5 size-4 shrink-0 text-teal-700 dark:text-teal-300"
                                            aria-hidden="true"
                                        />
                                        <div>
                                            <p className="text-xs text-muted-foreground">
                                                Address
                                            </p>
                                            <p className="mt-1 text-sm leading-6 font-medium">
                                                {beneficiary.address ??
                                                    'Not recorded'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="gap-0 overflow-hidden py-0 shadow-sm">
                            <CardHeader className="border-b px-6 py-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <CardTitle>Recent encounters</CardTitle>
                                        <CardDescription className="mt-1">
                                            Posted and voided records are
                                            retained.
                                        </CardDescription>
                                    </div>
                                    <History
                                        className="size-5 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                </div>
                            </CardHeader>
                            {recentEncounters.length ? (
                                <div className="divide-y">
                                    {recentEncounters
                                        .slice(0, 6)
                                        .map((encounter) => (
                                            <Link
                                                key={encounter.id}
                                                href={`/encounters/${encounter.id}`}
                                                className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted/30"
                                            >
                                                <div className="min-w-0">
                                                    <p className="font-mono text-sm font-medium">
                                                        {encounter.reference ??
                                                            `Encounter ${encounter.id}`}
                                                    </p>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {friendlyDate(
                                                            encounter.encounter_date,
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-3">
                                                    <span className="hidden text-sm font-semibold sm:inline">
                                                        {money(
                                                            encounter.total_cost_centavos ??
                                                                encounter.total_centavos,
                                                        )}
                                                    </span>
                                                    <StatusBadge
                                                        status={
                                                            encounter.status
                                                        }
                                                    />
                                                </div>
                                            </Link>
                                        ))}
                                </div>
                            ) : (
                                <div className="px-6 py-10 text-center">
                                    <p className="text-sm font-medium">
                                        No encounters recorded
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        New service activity will appear here.
                                    </p>
                                </div>
                            )}
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card className="gap-5 border-teal-900/10 bg-gradient-to-b from-teal-50/80 to-background shadow-sm dark:from-teal-950/30">
                            <CardHeader>
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <CardTitle>
                                            {activeYear} readiness
                                        </CardTitle>
                                        <CardDescription className="mt-1">
                                            Four independent SAP1 requirements
                                        </CardDescription>
                                    </div>
                                    <Select
                                        value={String(activeYear)}
                                        onValueChange={changeYear}
                                    >
                                        <SelectTrigger
                                            className="w-28 bg-background"
                                            aria-label="Readiness year"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {yearOptions.map((year) => (
                                                <SelectItem
                                                    key={year}
                                                    value={String(year)}
                                                >
                                                    {year}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div
                                    className={`mb-5 rounded-xl border p-4 ${
                                        ready
                                            ? 'border-teal-200 bg-teal-100/60 text-teal-900 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-100'
                                            : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <ShieldCheck
                                            className="size-5"
                                            aria-hidden="true"
                                        />
                                        <div>
                                            <p className="text-sm font-semibold">
                                                {ready
                                                    ? 'Eligible for SAP1 batching'
                                                    : 'Readiness action required'}
                                            </p>
                                            <p className="mt-1 text-xs opacity-80">
                                                {
                                                    [
                                                        activeRecord.selected,
                                                        activeRecord.fpe_completed,
                                                        Boolean(
                                                            activeRecord.pcu_reference,
                                                        ),
                                                        activeRecord.yes_confirmed,
                                                    ].filter(Boolean).length
                                                }
                                                /4 checks complete
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <ol className="space-y-3">
                                    <ReadinessItem
                                        label="Selected / empanelled"
                                        complete={Boolean(
                                            activeRecord.selected,
                                        )}
                                        detail={
                                            activeRecord.selected
                                                ? friendlyDate(
                                                      activeRecord.selected_at,
                                                  )
                                                : 'No selection date recorded'
                                        }
                                    />
                                    <ReadinessItem
                                        label="FPE completed"
                                        complete={Boolean(
                                            activeRecord.fpe_completed,
                                        )}
                                        detail={
                                            activeRecord.fpe_completed
                                                ? friendlyDate(
                                                      activeRecord.fpe_completed_at,
                                                  )
                                                : 'First patient encounter is pending'
                                        }
                                    />
                                    <ReadinessItem
                                        label="PCU reference"
                                        complete={Boolean(
                                            activeRecord.pcu_reference,
                                        )}
                                        detail={
                                            activeRecord.pcu_reference ??
                                            'No reference recorded'
                                        }
                                    />
                                    <ReadinessItem
                                        label="Digital YES"
                                        complete={Boolean(
                                            activeRecord.yes_confirmed,
                                        )}
                                        detail={
                                            activeRecord.yes_confirmed
                                                ? friendlyDate(
                                                      activeRecord.yes_confirmed_at,
                                                  )
                                                : 'Confirmation is pending'
                                        }
                                    />
                                </ol>
                            </CardContent>
                        </Card>

                        {allYearRecords.length > 1 ? (
                            <Card className="gap-4 shadow-sm">
                                <CardHeader>
                                    <div className="flex items-center gap-3">
                                        <CalendarDays
                                            className="size-5 text-muted-foreground"
                                            aria-hidden="true"
                                        />
                                        <div>
                                            <CardTitle className="text-base">
                                                Readiness history
                                            </CardTitle>
                                            <CardDescription className="mt-1">
                                                Annual records remain separate.
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {allYearRecords
                                        .slice()
                                        .sort(
                                            (a, b) =>
                                                (b.year ?? 0) - (a.year ?? 0),
                                        )
                                        .map((record) => (
                                            <button
                                                key={record.id ?? record.year}
                                                type="button"
                                                onClick={() =>
                                                    changeYear(
                                                        String(record.year),
                                                    )
                                                }
                                                className="flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                                            >
                                                <span className="text-sm font-semibold">
                                                    {record.year}
                                                </span>
                                                <Badge
                                                    variant={
                                                        isReady(record)
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    className={
                                                        isReady(record)
                                                            ? 'bg-teal-700'
                                                            : undefined
                                                    }
                                                >
                                                    {isReady(record)
                                                        ? 'Ready'
                                                        : 'Incomplete'}
                                                </Badge>
                                            </button>
                                        ))}
                                </CardContent>
                            </Card>
                        ) : null}
                    </div>
                </div>
            </main>
        </>
    );
}

BeneficiaryShow.layout = {
    breadcrumbs: [
        {
            title: 'Beneficiaries',
            href: '/beneficiaries',
        },
        {
            title: 'Beneficiary profile',
            href: '#',
        },
    ],
};

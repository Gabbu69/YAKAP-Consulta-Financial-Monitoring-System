import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    CircleDollarSign,
    ClipboardList,
    Download,
    FileClock,
    Plus,
    Search,
    ShieldCheck,
    XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { Auth } from '@/types';

type Beneficiary = {
    id?: number | string;
    reference?: string;
    full_name?: string;
    first_name?: string;
    middle_name?: string | null;
    last_name?: string;
    suffix?: string | null;
};

type EncounterItem = {
    total_cost_centavos?: number;
    unit_cost_centavos?: number;
    quantity?: number;
};

type Encounter = {
    id: number | string;
    reference?: string;
    encounter_date?: string;
    status?: string;
    beneficiary?: Beneficiary;
    beneficiary_name?: string;
    beneficiary_reference?: string;
    item_count?: number;
    items_count?: number;
    total_cost_centavos?: number;
    total_centavos?: number;
    items?: EncounterItem[];
    encounter_items?: EncounterItem[];
    posted_at?: string | null;
    voided_at?: string | null;
};

type PaginationLink = {
    url: string | null;
    label: string;
    active?: boolean;
};

type Paginated<T> = {
    data: T[];
    current_page?: number;
    last_page?: number;
    from?: number | null;
    to?: number | null;
    total?: number;
    links?: PaginationLink[];
};

type Filters = {
    search?: string;
    status?: string;
    year?: string | number;
};

type Summary = {
    total?: number;
    draft?: number;
    posted?: number;
    voided?: number;
    total_cost_centavos?: number;
};

type PageProps = {
    encounters: Encounter[] | Paginated<Encounter>;
    filters?: Filters;
    years?: number[];
    selectedYear?: number;
    selected_year?: number;
    summary?: Summary;
    can?: {
        create?: boolean;
        export?: boolean;
    };
};

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});
const currentYear = new Date().getFullYear();

function rowsFrom<T>(value: T[] | Paginated<T>): T[] {
    return Array.isArray(value) ? value : (value.data ?? []);
}

function fullName(encounter: Encounter): string {
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

function totalCentavos(encounter: Encounter): number {
    if (
        encounter.total_cost_centavos !== undefined ||
        encounter.total_centavos !== undefined
    ) {
        return encounter.total_cost_centavos ?? encounter.total_centavos ?? 0;
    }

    const items = encounter.items ?? encounter.encounter_items ?? [];

    return items.reduce(
        (sum, item) =>
            sum +
            (item.total_cost_centavos ??
                (item.unit_cost_centavos ?? 0) * (item.quantity ?? 0)),
        0,
    );
}

function friendlyDate(value?: string): string {
    if (!value) {
        return '—';
    }

    const date = new Date(`${value.slice(0, 10)}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(date);
}

function titleCase(value?: string): string {
    return (value ?? 'draft')
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());
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
            {titleCase(status)}
        </Badge>
    );
}

function queryUrl(path: string, filters: Filters): string {
    const search = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
            search.set(key, String(value));
        }
    });

    const query = search.toString();

    return query ? `${path}?${query}` : path;
}

function paginationLabel(label: string): string {
    return label
        .replace('&laquo;', '‹')
        .replace('&raquo;', '›')
        .replace('Previous', 'Prev');
}

export default function EncountersIndex({
    encounters,
    filters = {},
    years,
    selectedYear,
    selected_year,
    summary,
    can,
}: PageProps) {
    const rows = rowsFrom(encounters);
    const page = Array.isArray(encounters) ? undefined : encounters;
    const activeYear =
        selectedYear ?? selected_year ?? Number(filters.year ?? currentYear);
    const yearOptions = years?.length
        ? years
        : [activeYear - 1, activeYear, activeYear + 1];
    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? 'all');
    const [year, setYear] = useState(String(activeYear));
    const { auth } = usePage<{ auth: Auth }>().props;
    const computedSummary = useMemo(() => {
        const draft = rows.filter(
            (encounter) => (encounter.status ?? 'draft') === 'draft',
        ).length;
        const posted = rows.filter(
            (encounter) => encounter.status === 'posted',
        ).length;
        const voided = rows.filter((encounter) =>
            ['void', 'voided'].includes(encounter.status ?? ''),
        ).length;

        return {
            total: summary?.total ?? page?.total ?? rows.length,
            draft: summary?.draft ?? draft,
            posted: summary?.posted ?? posted,
            voided: summary?.voided ?? voided,
            cost:
                summary?.total_cost_centavos ??
                rows.reduce(
                    (sum, encounter) => sum + totalCentavos(encounter),
                    0,
                ),
        };
    }, [page?.total, rows, summary]);
    const canCreate =
        can?.create ??
        ['administrator', 'encoder'].includes(String(auth.user.role));
    const canExport = can?.export ?? false;

    function applyFilters(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        router.get(
            '/encounters',
            {
                search: search || undefined,
                status: status === 'all' ? undefined : status,
                year,
            },
            {
                preserveScroll: true,
                preserveState: true,
                replace: true,
            },
        );
    }

    function clearFilters() {
        setSearch('');
        setStatus('all');
        setYear(String(activeYear));
        router.get(
            '/encounters',
            { year: activeYear },
            { preserveState: true, replace: true },
        );
    }

    return (
        <>
            <Head title="Service encounters" />

            <main className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                <section className="overflow-hidden rounded-2xl border border-cyan-900/10 bg-gradient-to-br from-slate-950 via-teal-950 to-cyan-900 px-5 py-6 text-white shadow-sm sm:px-7">
                    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                        <div className="max-w-2xl">
                            <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-cyan-100 uppercase">
                                <ClipboardList
                                    className="size-4"
                                    aria-hidden="true"
                                />
                                Utilization ledger
                            </div>
                            <h1 className="font-[Manrope] text-2xl font-semibold tracking-tight sm:text-3xl">
                                Service encounters
                            </h1>
                            <p className="mt-2 max-w-xl text-sm leading-6 text-cyan-50/75">
                                Capture costed services without clinical notes,
                                then post immutable snapshots for program
                                reporting.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {canExport ? (
                                <Button
                                    variant="outline"
                                    className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                                    asChild
                                >
                                    <a
                                        href={queryUrl('/encounters/export', {
                                            search: filters.search,
                                            status:
                                                status === 'all'
                                                    ? undefined
                                                    : status,
                                            year,
                                        })}
                                    >
                                        <Download aria-hidden="true" />
                                        Export CSV
                                    </a>
                                </Button>
                            ) : null}
                            {canCreate ? (
                                <Button
                                    className="bg-orange-500 text-white hover:bg-orange-600"
                                    asChild
                                >
                                    <Link href="/encounters/create">
                                        <Plus aria-hidden="true" />
                                        New encounter
                                    </Link>
                                </Button>
                            ) : null}
                        </div>
                    </div>
                </section>

                <section
                    aria-label="Encounter summary"
                    className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                >
                    <Card className="gap-3 py-5 shadow-none">
                        <CardContent className="px-5">
                            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                Total records
                            </p>
                            <p className="mt-2 font-[Manrope] text-3xl font-semibold">
                                {computedSummary.total.toLocaleString('en-PH')}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {activeYear} service activity
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="gap-3 py-5 shadow-none">
                        <CardContent className="px-5">
                            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                Posted
                            </p>
                            <p className="mt-2 font-[Manrope] text-3xl font-semibold text-teal-700 dark:text-teal-300">
                                {computedSummary.posted.toLocaleString('en-PH')}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Frozen for reporting
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="gap-3 py-5 shadow-none">
                        <CardContent className="px-5">
                            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                Draft / voided
                            </p>
                            <p className="mt-2 font-[Manrope] text-3xl font-semibold text-amber-700 dark:text-amber-300">
                                {computedSummary.draft}
                                <span className="mx-2 text-base font-normal text-muted-foreground">
                                    /
                                </span>
                                <span className="text-destructive">
                                    {computedSummary.voided}
                                </span>
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Editable / retained for audit
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="gap-3 py-5 shadow-none">
                        <CardContent className="px-5">
                            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                <CircleDollarSign
                                    className="size-3.5"
                                    aria-hidden="true"
                                />
                                Service cost
                            </p>
                            <p className="mt-2 font-[Manrope] text-2xl font-semibold">
                                {currency.format(computedSummary.cost / 100)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Current filtered period
                            </p>
                        </CardContent>
                    </Card>
                </section>

                <Card className="gap-0 overflow-hidden py-0 shadow-sm">
                    <CardHeader className="border-b bg-muted/20 px-5 py-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                            <div>
                                <CardTitle>Encounter register</CardTitle>
                                <CardDescription className="mt-1">
                                    Drafts can be edited; posted and voided
                                    records remain read-only.
                                </CardDescription>
                            </div>
                            <form
                                onSubmit={applyFilters}
                                className="grid w-full min-w-0 gap-2 sm:grid-cols-2 xl:max-w-3xl xl:grid-cols-[minmax(220px,1fr)_140px_120px_auto]"
                            >
                                <div className="relative min-w-0 sm:col-span-2 xl:col-span-1">
                                    <Label
                                        htmlFor="encounter-search"
                                        className="sr-only"
                                    >
                                        Search encounters
                                    </Label>
                                    <Search
                                        className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                    <Input
                                        id="encounter-search"
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                        className="pl-9"
                                        placeholder="Reference or beneficiary"
                                    />
                                </div>
                                <Select
                                    value={status}
                                    onValueChange={setStatus}
                                >
                                    <SelectTrigger
                                        className="w-full"
                                        aria-label="Encounter status"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            All statuses
                                        </SelectItem>
                                        <SelectItem value="draft">
                                            Draft
                                        </SelectItem>
                                        <SelectItem value="posted">
                                            Posted
                                        </SelectItem>
                                        <SelectItem value="void">
                                            Voided
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={year} onValueChange={setYear}>
                                    <SelectTrigger
                                        className="w-full"
                                        aria-label="Encounter year"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {yearOptions.map((option) => (
                                            <SelectItem
                                                key={option}
                                                value={String(option)}
                                            >
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="flex gap-2">
                                    <Button type="submit" className="flex-1">
                                        Apply
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={clearFilters}
                                    >
                                        Clear
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </CardHeader>

                    {rows.length ? (
                        <>
                            <div className="divide-y md:hidden">
                                {rows.map((encounter) => (
                                    <article
                                        key={encounter.id}
                                        className="space-y-4 p-5"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <Link
                                                    href={`/encounters/${encounter.id}`}
                                                    className="font-mono text-sm font-semibold hover:text-teal-700 dark:hover:text-teal-300"
                                                >
                                                    {encounter.reference ??
                                                        `Encounter ${encounter.id}`}
                                                </Link>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {friendlyDate(
                                                        encounter.encounter_date,
                                                    )}
                                                </p>
                                            </div>
                                            <StatusBadge
                                                status={encounter.status}
                                            />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">
                                                {fullName(encounter) ||
                                                    'Unknown beneficiary'}
                                            </p>
                                            <p className="mt-1 font-mono text-xs text-muted-foreground">
                                                {encounter.beneficiary_reference ??
                                                    encounter.beneficiary
                                                        ?.reference ??
                                                    '—'}
                                            </p>
                                        </div>
                                        <div className="flex items-end justify-between gap-4">
                                            <div>
                                                <p className="text-xs text-muted-foreground">
                                                    Service lines
                                                </p>
                                                <p className="mt-1 text-sm font-medium">
                                                    {encounter.item_count ??
                                                        encounter.items_count ??
                                                        encounter.items
                                                            ?.length ??
                                                        encounter
                                                            .encounter_items
                                                            ?.length ??
                                                        0}
                                                </p>
                                            </div>
                                            <p className="font-[Manrope] text-lg font-semibold">
                                                {currency.format(
                                                    totalCentavos(encounter) /
                                                        100,
                                                )}
                                            </p>
                                        </div>
                                    </article>
                                ))}
                            </div>

                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full text-left text-sm">
                                    <thead className="border-b bg-muted/30 text-xs tracking-wide text-muted-foreground uppercase">
                                        <tr>
                                            <th
                                                scope="col"
                                                className="px-5 py-3 font-medium"
                                            >
                                                Encounter
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-5 py-3 font-medium"
                                            >
                                                Beneficiary
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-5 py-3 font-medium"
                                            >
                                                Date
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-5 py-3 font-medium"
                                            >
                                                Lines
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-5 py-3 font-medium"
                                            >
                                                Status
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-5 py-3 text-right font-medium"
                                            >
                                                Cost
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-5 py-3 text-right font-medium"
                                            >
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {rows.map((encounter) => (
                                            <tr
                                                key={encounter.id}
                                                className="transition-colors hover:bg-muted/25"
                                            >
                                                <td className="px-5 py-4 font-mono text-sm font-medium">
                                                    {encounter.reference ??
                                                        `Encounter ${encounter.id}`}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="font-medium">
                                                        {fullName(encounter) ||
                                                            'Unknown beneficiary'}
                                                    </p>
                                                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                                                        {encounter.beneficiary_reference ??
                                                            encounter
                                                                .beneficiary
                                                                ?.reference ??
                                                            '—'}
                                                    </p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    {friendlyDate(
                                                        encounter.encounter_date,
                                                    )}
                                                </td>
                                                <td className="px-5 py-4">
                                                    {encounter.item_count ??
                                                        encounter.items_count ??
                                                        encounter.items
                                                            ?.length ??
                                                        encounter
                                                            .encounter_items
                                                            ?.length ??
                                                        0}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <StatusBadge
                                                        status={
                                                            encounter.status
                                                        }
                                                    />
                                                </td>
                                                <td className="px-5 py-4 text-right font-semibold tabular-nums">
                                                    {currency.format(
                                                        totalCentavos(
                                                            encounter,
                                                        ) / 100,
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        asChild
                                                    >
                                                        <Link
                                                            href={`/encounters/${encounter.id}`}
                                                        >
                                                            View
                                                            <span className="sr-only">
                                                                {' '}
                                                                {
                                                                    encounter.reference
                                                                }
                                                            </span>
                                                        </Link>
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {page?.links?.length ? (
                                <footer className="flex flex-col gap-3 border-t px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-muted-foreground">
                                        Showing {page.from ?? 1}–
                                        {page.to ?? rows.length} of{' '}
                                        {page.total ?? rows.length}
                                    </p>
                                    <nav
                                        aria-label="Encounter pagination"
                                        className="flex flex-wrap gap-1"
                                    >
                                        {page.links.map((link, index) =>
                                            link.url ? (
                                                <Button
                                                    key={`${link.label}-${index}`}
                                                    variant={
                                                        link.active
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    size="sm"
                                                    asChild
                                                >
                                                    <Link
                                                        href={link.url}
                                                        preserveScroll
                                                        aria-current={
                                                            link.active
                                                                ? 'page'
                                                                : undefined
                                                        }
                                                    >
                                                        {paginationLabel(
                                                            link.label,
                                                        )}
                                                    </Link>
                                                </Button>
                                            ) : (
                                                <Button
                                                    key={`${link.label}-${index}`}
                                                    variant="outline"
                                                    size="sm"
                                                    disabled
                                                >
                                                    {paginationLabel(
                                                        link.label,
                                                    )}
                                                </Button>
                                            ),
                                        )}
                                    </nav>
                                </footer>
                            ) : null}
                        </>
                    ) : (
                        <div className="grid min-h-72 place-items-center px-6 py-12 text-center">
                            <div>
                                <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                                    <ClipboardList aria-hidden="true" />
                                </div>
                                <h2 className="mt-4 font-semibold">
                                    No encounters found
                                </h2>
                                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                                    Adjust the filters or record the first
                                    service encounter for this period.
                                </p>
                                <div className="mt-5 flex justify-center gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={clearFilters}
                                    >
                                        Reset filters
                                    </Button>
                                    {canCreate ? (
                                        <Button asChild>
                                            <Link href="/encounters/create">
                                                New encounter
                                            </Link>
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    )}
                </Card>
            </main>
        </>
    );
}

EncountersIndex.layout = {
    breadcrumbs: [
        {
            title: 'Service encounters',
            href: '/encounters',
        },
    ],
};

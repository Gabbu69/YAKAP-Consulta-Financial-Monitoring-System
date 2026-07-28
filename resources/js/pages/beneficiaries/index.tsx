import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    Archive,
    CheckCircle2,
    Download,
    FileSpreadsheet,
    Search,
    ShieldAlert,
    Upload,
    UserPlus,
    UsersRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
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

type Readiness = {
    year?: number;
    selected?: boolean;
    fpe_completed?: boolean;
    pcu_reference?: string | null;
    yes_confirmed?: boolean;
    sap1_ready?: boolean;
};

type Beneficiary = {
    id: number | string;
    reference?: string;
    full_name?: string;
    first_name?: string;
    middle_name?: string | null;
    last_name?: string;
    suffix?: string | null;
    philhealth_pin?: string;
    masked_pin?: string;
    philhealth_pin_masked?: string;
    masked_philhealth_pin?: string;
    birth_date?: string;
    sex?: string;
    beneficiary_type?: string;
    patient_type?: string;
    archived_at?: string | null;
    readiness?: Readiness;
    year_record?: Readiness;
    beneficiary_year?: Readiness;
    current_year?: Readiness;
    yearly_statuses?: Readiness[];
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
    year?: string | number;
    readiness?: string;
    status?: string;
};

type Summary = {
    total?: number;
    ready?: number;
    action_required?: number;
    archived?: number;
};

type PageProps = {
    beneficiaries: Paginated<Beneficiary> | Beneficiary[];
    filters?: Filters;
    years?: number[];
    selectedYear?: number;
    selected_year?: number;
    summary?: Summary;
    importPreview?: {
        rows?: Array<Record<string, unknown>>;
        errors?: string[];
        year?: number;
        validCount?: number;
        valid_count?: number;
    } | null;
    can?: {
        create?: boolean;
        import?: boolean;
        export?: boolean;
    };
};

const currentYear = new Date().getFullYear();

function rowsFrom<T>(value: Paginated<T> | T[] | undefined): T[] {
    if (Array.isArray(value)) {
        return value;
    }

    return value?.data ?? [];
}

function readinessFor(beneficiary: Beneficiary): Readiness {
    return (
        beneficiary.readiness ??
        beneficiary.year_record ??
        beneficiary.beneficiary_year ??
        beneficiary.current_year ??
        beneficiary.yearly_statuses?.[0] ??
        {}
    );
}

function isReady(readiness: Readiness): boolean {
    return (
        readiness.sap1_ready ??
        Boolean(
            readiness.selected &&
            readiness.fpe_completed &&
            readiness.pcu_reference &&
            readiness.yes_confirmed,
        )
    );
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

function maskedPin(beneficiary: Beneficiary): string {
    return (
        beneficiary.philhealth_pin_masked ??
        beneficiary.masked_pin ??
        beneficiary.masked_philhealth_pin ??
        'Not provided'
    );
}

function titleCase(value?: string): string {
    if (!value) {
        return '—';
    }

    return value
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());
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

function ReadinessBadge({ beneficiary }: { beneficiary: Beneficiary }) {
    const readiness = readinessFor(beneficiary);

    if (beneficiary.archived_at) {
        return (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
                <Archive aria-hidden="true" />
                Archived
            </Badge>
        );
    }

    return isReady(readiness) ? (
        <Badge className="border-0 bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200">
            <CheckCircle2 aria-hidden="true" />
            SAP1 ready
        </Badge>
    ) : (
        <Badge
            variant="outline"
            className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
        >
            <ShieldAlert aria-hidden="true" />
            Action needed
        </Badge>
    );
}

export default function BeneficiariesIndex({
    beneficiaries,
    filters = {},
    years,
    selectedYear,
    selected_year,
    summary,
    importPreview,
    can,
}: PageProps) {
    const rows = rowsFrom(beneficiaries);
    const page = Array.isArray(beneficiaries) ? undefined : beneficiaries;
    const activeYear =
        selectedYear ?? selected_year ?? Number(filters.year ?? currentYear);
    const yearOptions = years?.length
        ? years
        : [activeYear - 1, activeYear, activeYear + 1];
    const [search, setSearch] = useState(filters.search ?? '');
    const [year, setYear] = useState(String(activeYear));
    const [readiness, setReadiness] = useState(
        filters.readiness ?? filters.status ?? 'all',
    );
    const [importOpen, setImportOpen] = useState(false);
    const { auth } = usePage<{ auth: Auth }>().props;
    const importForm = useForm<{ file: File | null; year: number }>({
        file: null,
        year: activeYear,
    });
    const computedSummary = useMemo(() => {
        const ready = rows.filter(
            (beneficiary) =>
                !beneficiary.archived_at && isReady(readinessFor(beneficiary)),
        ).length;
        const archived = rows.filter(
            (beneficiary) => beneficiary.archived_at,
        ).length;

        return {
            total: summary?.total ?? page?.total ?? rows.length,
            ready: summary?.ready ?? ready,
            actionRequired:
                summary?.action_required ??
                Math.max(rows.length - ready - archived, 0),
            archived: summary?.archived ?? archived,
        };
    }, [page?.total, rows, summary]);

    function applyFilters(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        router.get(
            '/beneficiaries',
            {
                search: search || undefined,
                year,
                readiness: readiness === 'all' ? undefined : readiness,
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
        setYear(String(activeYear));
        setReadiness('all');
        router.get(
            '/beneficiaries',
            { year: activeYear },
            { preserveState: true, replace: true },
        );
    }

    function submitImport(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        importForm.post('/beneficiaries/import/preview', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                importForm.reset();
                setImportOpen(false);
            },
        });
    }

    function commitImport() {
        router.post('/beneficiaries/import', {}, { preserveScroll: true });
    }

    const exportFilters: Filters = {
        search: filters.search,
        year,
        readiness: readiness === 'all' ? undefined : readiness,
    };
    const canManage = ['administrator', 'encoder'].includes(
        String(auth.user.role),
    );
    const canCreate = can?.create ?? canManage;
    const canImport = can?.import ?? canManage;
    const canExport = can?.export ?? true;

    return (
        <>
            <Head title="Beneficiaries" />

            <main className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                <section className="overflow-hidden rounded-2xl border border-teal-900/10 bg-gradient-to-br from-teal-950 via-teal-900 to-cyan-900 px-5 py-6 text-white shadow-sm sm:px-7">
                    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                        <div className="max-w-2xl">
                            <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-teal-100 uppercase">
                                <UsersRound
                                    className="size-4"
                                    aria-hidden="true"
                                />
                                Member registry
                            </div>
                            <h1 className="font-[Manrope] text-2xl font-semibold tracking-tight sm:text-3xl">
                                Beneficiaries
                            </h1>
                            <p className="mt-2 max-w-xl text-sm leading-6 text-teal-50/80">
                                Maintain member identity and verify each annual
                                FPE, PCU, and digital YES requirement before
                                financial batching.
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
                                        href={queryUrl(
                                            '/beneficiaries/export',
                                            exportFilters,
                                        )}
                                    >
                                        <Download aria-hidden="true" />
                                        Export CSV
                                    </a>
                                </Button>
                            ) : null}
                            {canImport ? (
                                <Dialog
                                    open={importOpen}
                                    onOpenChange={setImportOpen}
                                >
                                    <DialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                                        >
                                            <Upload aria-hidden="true" />
                                            Import
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>
                                                Import beneficiaries
                                            </DialogTitle>
                                            <DialogDescription>
                                                Upload the completed CSV
                                                template. You will receive a
                                                validation preview before any
                                                records are committed.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <form
                                            className="space-y-5"
                                            onSubmit={submitImport}
                                        >
                                            <div className="rounded-lg border border-dashed bg-muted/30 p-4">
                                                <Label htmlFor="beneficiary-file">
                                                    CSV file
                                                </Label>
                                                <Input
                                                    id="beneficiary-file"
                                                    type="file"
                                                    className="mt-2"
                                                    accept=".csv,text/csv"
                                                    required
                                                    onChange={(event) =>
                                                        importForm.setData(
                                                            'file',
                                                            event.target
                                                                .files?.[0] ??
                                                                null,
                                                        )
                                                    }
                                                />
                                                <InputError
                                                    className="mt-2"
                                                    message={
                                                        importForm.errors.file
                                                    }
                                                />
                                            </div>
                                            <a
                                                href="/beneficiaries/import/template"
                                                className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 underline-offset-4 hover:underline dark:text-teal-300"
                                            >
                                                <FileSpreadsheet
                                                    className="size-4"
                                                    aria-hidden="true"
                                                />
                                                Download CSV template
                                            </a>
                                            <DialogFooter>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() =>
                                                        setImportOpen(false)
                                                    }
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    disabled={
                                                        importForm.processing ||
                                                        !importForm.data.file
                                                    }
                                                >
                                                    {importForm.processing
                                                        ? 'Checking…'
                                                        : 'Validate file'}
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            ) : null}
                            {canCreate ? (
                                <Button
                                    className="bg-orange-500 text-white shadow-sm hover:bg-orange-600"
                                    asChild
                                >
                                    <Link href="/beneficiaries/create">
                                        <UserPlus aria-hidden="true" />
                                        Add beneficiary
                                    </Link>
                                </Button>
                            ) : null}
                        </div>
                    </div>
                </section>

                <section
                    aria-label="Beneficiary summary"
                    className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                >
                    {[
                        {
                            label: 'Registered',
                            value: computedSummary.total,
                            helper: `Across ${activeYear} records`,
                            tone: 'text-slate-900 dark:text-slate-100',
                        },
                        {
                            label: 'SAP1 ready',
                            value: computedSummary.ready,
                            helper: 'All readiness checks complete',
                            tone: 'text-teal-700 dark:text-teal-300',
                        },
                        {
                            label: 'Action required',
                            value: computedSummary.actionRequired,
                            helper: 'One or more checks missing',
                            tone: 'text-amber-700 dark:text-amber-300',
                        },
                        {
                            label: 'Archived',
                            value: computedSummary.archived,
                            helper: 'Retained for audit history',
                            tone: 'text-muted-foreground',
                        },
                    ].map((item) => (
                        <Card
                            key={item.label}
                            className="gap-3 py-5 shadow-none"
                        >
                            <CardContent className="px-5">
                                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                    {item.label}
                                </p>
                                <p
                                    className={`mt-2 font-[Manrope] text-3xl font-semibold ${item.tone}`}
                                >
                                    {item.value.toLocaleString('en-PH')}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {item.helper}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </section>

                {importPreview ? (
                    <Card className="gap-0 overflow-hidden border-cyan-200 py-0 shadow-sm dark:border-cyan-900">
                        <CardHeader className="border-b bg-cyan-50/70 px-5 py-5 dark:bg-cyan-950/30">
                            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                                <div>
                                    <CardTitle>
                                        CSV validation preview
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        {importPreview.validCount ??
                                            importPreview.valid_count ??
                                            0}{' '}
                                        valid rows for{' '}
                                        {importPreview.year ?? activeYear}.
                                        Review any issues before importing.
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() =>
                                            router.get('/beneficiaries', {
                                                year:
                                                    importPreview.year ??
                                                    activeYear,
                                            })
                                        }
                                    >
                                        Cancel preview
                                    </Button>
                                    <Button
                                        className="bg-teal-700 text-white hover:bg-teal-800"
                                        onClick={commitImport}
                                        disabled={
                                            (importPreview.validCount ??
                                                importPreview.valid_count ??
                                                0) < 1
                                        }
                                    >
                                        Import valid rows
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4 px-5 py-5">
                            {importPreview.errors?.length ? (
                                <div
                                    className="max-h-36 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                                    role="alert"
                                >
                                    <p className="font-semibold">
                                        Validation issues
                                    </p>
                                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                                        {importPreview.errors.map(
                                            (error, index) => (
                                                <li key={`${error}-${index}`}>
                                                    {error}
                                                </li>
                                            ),
                                        )}
                                    </ul>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 rounded-lg bg-teal-50 p-3 text-sm text-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
                                    <CheckCircle2
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    Every row passed validation.
                                </div>
                            )}
                            {importPreview.rows?.length ? (
                                <div className="overflow-x-auto rounded-lg border">
                                    <table className="w-full text-left text-xs">
                                        <thead className="border-b bg-muted/30 text-muted-foreground">
                                            <tr>
                                                <th className="px-3 py-2 font-medium">
                                                    Name
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Birth date
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Type
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Row status
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {importPreview.rows
                                                .slice(0, 8)
                                                .map((row, index) => (
                                                    <tr key={index}>
                                                        <td className="px-3 py-2">
                                                            {[
                                                                row.first_name,
                                                                row.middle_name,
                                                                row.last_name,
                                                            ]
                                                                .filter(Boolean)
                                                                .join(' ')}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {String(
                                                                row.birth_date ??
                                                                    '—',
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {titleCase(
                                                                String(
                                                                    row.beneficiary_type ??
                                                                        '',
                                                                ),
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {Array.isArray(
                                                                row._errors,
                                                            ) ? (
                                                                <Badge variant="destructive">
                                                                    Invalid
                                                                </Badge>
                                                            ) : (
                                                                <Badge className="bg-teal-700">
                                                                    Valid
                                                                </Badge>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>
                ) : null}

                <Card className="gap-0 overflow-hidden py-0 shadow-sm">
                    <CardHeader className="border-b bg-muted/20 px-5 py-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                            <div>
                                <CardTitle>Member directory</CardTitle>
                                <CardDescription className="mt-1">
                                    PINs are masked throughout the workspace.
                                </CardDescription>
                            </div>
                            <form
                                onSubmit={applyFilters}
                                className="grid w-full min-w-0 gap-2 sm:grid-cols-2 xl:max-w-3xl xl:grid-cols-[minmax(220px,1fr)_130px_170px_auto]"
                            >
                                <div className="relative min-w-0 sm:col-span-2 xl:col-span-1">
                                    <Label
                                        htmlFor="beneficiary-search"
                                        className="sr-only"
                                    >
                                        Search beneficiaries
                                    </Label>
                                    <Search
                                        className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                    <Input
                                        id="beneficiary-search"
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                        className="pl-9"
                                        placeholder="Name, reference, or PIN"
                                    />
                                </div>
                                <Select
                                    value={year}
                                    onValueChange={(value) => {
                                        setYear(value);
                                        importForm.setData(
                                            'year',
                                            Number(value),
                                        );
                                    }}
                                >
                                    <SelectTrigger
                                        className="w-full"
                                        aria-label="Registry year"
                                    >
                                        <SelectValue placeholder="Year" />
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
                                <Select
                                    value={readiness}
                                    onValueChange={setReadiness}
                                >
                                    <SelectTrigger
                                        className="w-full"
                                        aria-label="Readiness status"
                                    >
                                        <SelectValue placeholder="Readiness" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            All readiness
                                        </SelectItem>
                                        <SelectItem value="ready">
                                            SAP1 ready
                                        </SelectItem>
                                        <SelectItem value="not_ready">
                                            Action required
                                        </SelectItem>
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
                                {rows.map((beneficiary) => {
                                    const readiness = readinessFor(beneficiary);

                                    return (
                                        <article
                                            key={beneficiary.id}
                                            className="space-y-4 p-5"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <Link
                                                        href={`/beneficiaries/${beneficiary.id}`}
                                                        className="font-semibold text-foreground hover:text-teal-700 dark:hover:text-teal-300"
                                                    >
                                                        {fullName(beneficiary)}
                                                    </Link>
                                                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                                                        {beneficiary.reference ??
                                                            'Reference pending'}
                                                    </p>
                                                </div>
                                                <ReadinessBadge
                                                    beneficiary={beneficiary}
                                                />
                                            </div>
                                            <dl className="grid grid-cols-2 gap-3 text-sm">
                                                <div>
                                                    <dt className="text-xs text-muted-foreground">
                                                        PIN
                                                    </dt>
                                                    <dd className="mt-1 font-mono">
                                                        {maskedPin(beneficiary)}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt className="text-xs text-muted-foreground">
                                                        Type
                                                    </dt>
                                                    <dd className="mt-1">
                                                        {titleCase(
                                                            beneficiary.beneficiary_type ??
                                                                beneficiary.patient_type,
                                                        )}
                                                    </dd>
                                                </div>
                                            </dl>
                                            <div className="flex flex-wrap gap-1.5">
                                                {[
                                                    [
                                                        'Selected',
                                                        readiness.selected,
                                                    ],
                                                    [
                                                        'FPE',
                                                        readiness.fpe_completed,
                                                    ],
                                                    [
                                                        'PCU',
                                                        Boolean(
                                                            readiness.pcu_reference,
                                                        ),
                                                    ],
                                                    [
                                                        'YES',
                                                        readiness.yes_confirmed,
                                                    ],
                                                ].map(([label, complete]) => (
                                                    <Badge
                                                        key={String(label)}
                                                        variant="outline"
                                                        className={
                                                            complete
                                                                ? 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-300'
                                                                : 'text-muted-foreground'
                                                        }
                                                    >
                                                        {String(label)}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>

                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full text-left text-sm">
                                    <thead className="border-b bg-muted/30 text-xs tracking-wide text-muted-foreground uppercase">
                                        <tr>
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
                                                Masked PIN
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-5 py-3 font-medium"
                                            >
                                                Type
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-5 py-3 font-medium"
                                            >
                                                Annual checks
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
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {rows.map((beneficiary) => {
                                            const readiness =
                                                readinessFor(beneficiary);

                                            return (
                                                <tr
                                                    key={beneficiary.id}
                                                    className="transition-colors hover:bg-muted/25"
                                                >
                                                    <td className="px-5 py-4">
                                                        <p className="font-medium">
                                                            {fullName(
                                                                beneficiary,
                                                            )}
                                                        </p>
                                                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                                                            {beneficiary.reference ??
                                                                'Reference pending'}
                                                        </p>
                                                    </td>
                                                    <td className="px-5 py-4 font-mono text-xs">
                                                        {maskedPin(beneficiary)}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        {titleCase(
                                                            beneficiary.beneficiary_type ??
                                                                beneficiary.patient_type,
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div
                                                            className="flex gap-1.5"
                                                            aria-label="Readiness checks"
                                                        >
                                                            {[
                                                                [
                                                                    'S',
                                                                    'Selected',
                                                                    readiness.selected,
                                                                ],
                                                                [
                                                                    'F',
                                                                    'FPE complete',
                                                                    readiness.fpe_completed,
                                                                ],
                                                                [
                                                                    'P',
                                                                    'PCU recorded',
                                                                    Boolean(
                                                                        readiness.pcu_reference,
                                                                    ),
                                                                ],
                                                                [
                                                                    'Y',
                                                                    'YES confirmed',
                                                                    readiness.yes_confirmed,
                                                                ],
                                                            ].map(
                                                                ([
                                                                    short,
                                                                    label,
                                                                    complete,
                                                                ]) => (
                                                                    <span
                                                                        key={String(
                                                                            short,
                                                                        )}
                                                                        title={String(
                                                                            label,
                                                                        )}
                                                                        className={`grid size-7 place-items-center rounded-full border text-[11px] font-bold ${
                                                                            complete
                                                                                ? 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-300'
                                                                                : 'border-dashed text-muted-foreground'
                                                                        }`}
                                                                    >
                                                                        {String(
                                                                            short,
                                                                        )}
                                                                    </span>
                                                                ),
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <ReadinessBadge
                                                            beneficiary={
                                                                beneficiary
                                                            }
                                                        />
                                                    </td>
                                                    <td className="px-5 py-4 text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            asChild
                                                        >
                                                            <Link
                                                                href={`/beneficiaries/${beneficiary.id}`}
                                                            >
                                                                View
                                                                <span className="sr-only">
                                                                    {' '}
                                                                    {fullName(
                                                                        beneficiary,
                                                                    )}
                                                                </span>
                                                            </Link>
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
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
                                        aria-label="Beneficiary pagination"
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
                                    <UsersRound aria-hidden="true" />
                                </div>
                                <h2 className="mt-4 font-semibold">
                                    No beneficiaries found
                                </h2>
                                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                                    Adjust the filters or add the first member
                                    to this year&apos;s registry.
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
                                            <Link href="/beneficiaries/create">
                                                Add beneficiary
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

BeneficiariesIndex.layout = {
    breadcrumbs: [
        {
            title: 'Beneficiaries',
            href: '/beneficiaries',
        },
    ],
};

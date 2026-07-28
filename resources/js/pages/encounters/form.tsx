import { Head, Link, useForm, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarDays,
    ClipboardCheck,
    FileClock,
    Info,
    LoaderCircle,
    LockKeyhole,
    UserRound,
} from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { EncounterComposer } from '@/components/yakap/encounter-composer';
import type {
    EncounterComposerItem,
    ServiceOption,
} from '@/components/yakap/encounter-composer';

type BeneficiaryOption = {
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
    archived_at?: string | null;
};

type Paginated<T> = {
    data: T[];
};

type EncounterPayload = {
    beneficiary_id: string;
    encounter_date: string;
    post_now: boolean;
    items: EncounterComposerItem[];
};

type PageProps = {
    beneficiaries: BeneficiaryOption[] | Paginated<BeneficiaryOption>;
    services: ServiceOption[] | Paginated<ServiceOption>;
    selectedBeneficiaryId?: number | string;
    selected_beneficiary_id?: number | string;
    today?: string;
};

function rowsFrom<T>(value: T[] | Paginated<T>): T[] {
    return Array.isArray(value) ? value : (value.data ?? []);
}

function fullName(beneficiary: BeneficiaryOption): string {
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

function manilaDate(): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());
    const value = Object.fromEntries(
        parts.map((part) => [part.type, part.value]),
    );

    return `${value.year}-${value.month}-${value.day}`;
}

export default function EncounterForm({
    beneficiaries,
    services,
    selectedBeneficiaryId,
    selected_beneficiary_id,
    today,
}: PageProps) {
    const beneficiaryOptions = rowsFrom(beneficiaries).filter(
        (beneficiary) => !beneficiary.archived_at,
    );
    const serviceOptions = rowsFrom(services);
    const { url } = usePage();
    const beneficiaryFromQuery = new URL(
        url,
        'https://yakap.local',
    ).searchParams.get('beneficiary_id');
    const initialBeneficiary =
        selectedBeneficiaryId ??
        selected_beneficiary_id ??
        beneficiaryFromQuery ??
        '';
    const form = useForm<EncounterPayload>({
        beneficiary_id: String(initialBeneficiary),
        encounter_date: today?.slice(0, 10) ?? manilaDate(),
        post_now: false,
        items: [
            {
                client_key: 'service-line-1',
                service_id: '',
                quantity: 1,
                is_repeat_laboratory: false,
            },
        ],
    });
    const selectedBeneficiary = beneficiaryOptions.find(
        (beneficiary) => String(beneficiary.id) === form.data.beneficiary_id,
    );
    const hasIncompleteLine = form.data.items.some(
        (item) => !item.service_id || item.quantity < 1,
    );

    function save(status: 'draft' | 'posted') {
        form.transform((data) => ({
            ...data,
            post_now: status === 'posted',
            items: data.items.map((item) => ({
                service_id: item.service_id,
                quantity: item.quantity,
                is_repeat_laboratory: item.is_repeat_laboratory,
            })),
        }));

        form.post('/encounters', { preserveScroll: true });
    }

    function submitDraft(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        save('draft');
    }

    return (
        <>
            <Head title="New service encounter" />

            <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                <header>
                    <Button variant="ghost" size="sm" className="-ml-3" asChild>
                        <Link href="/encounters">
                            <ArrowLeft aria-hidden="true" />
                            Back to encounters
                        </Link>
                    </Button>
                    <div className="mt-4 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                        <div>
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="font-[Manrope] text-2xl font-semibold tracking-tight sm:text-3xl">
                                    New service encounter
                                </h1>
                            </div>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                                Compose a non-clinical service record. Costs are
                                snapshotted from the catalog when the encounter
                                is saved.
                            </p>
                        </div>
                        <Badge
                            variant="outline"
                            className="w-fit border-cyan-200 bg-cyan-50 px-3 py-1 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-200"
                        >
                            <LockKeyhole aria-hidden="true" />
                            No clinical notes stored
                        </Badge>
                    </div>
                </header>

                <Alert className="border-teal-200 bg-teal-50/70 text-teal-950 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-50">
                    <Info aria-hidden="true" />
                    <AlertTitle>Drafts remain editable</AlertTitle>
                    <AlertDescription className="text-teal-800 dark:text-teal-200">
                        Posting freezes service names, classifications, and unit
                        costs for financial reporting. Posted records can only
                        be voided, never deleted.
                    </AlertDescription>
                </Alert>

                <form onSubmit={submitDraft} className="space-y-6">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="space-y-6">
                            <Card className="gap-5 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Encounter context</CardTitle>
                                    <CardDescription>
                                        Identify the beneficiary and service
                                        date.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]">
                                    <div>
                                        <Label htmlFor="beneficiary_id">
                                            Beneficiary
                                        </Label>
                                        <Select
                                            value={form.data.beneficiary_id}
                                            onValueChange={(value) =>
                                                form.setData(
                                                    'beneficiary_id',
                                                    value,
                                                )
                                            }
                                            disabled={form.processing}
                                            required
                                        >
                                            <SelectTrigger
                                                id="beneficiary_id"
                                                className="mt-2 w-full"
                                                aria-invalid={Boolean(
                                                    form.errors.beneficiary_id,
                                                )}
                                            >
                                                <SelectValue placeholder="Search or select a beneficiary" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {beneficiaryOptions.map(
                                                    (beneficiary) => (
                                                        <SelectItem
                                                            key={beneficiary.id}
                                                            value={String(
                                                                beneficiary.id,
                                                            )}
                                                        >
                                                            <span className="flex items-center gap-2">
                                                                <span>
                                                                    {fullName(
                                                                        beneficiary,
                                                                    )}
                                                                </span>
                                                                {beneficiary.reference ? (
                                                                    <span className="font-mono text-xs text-muted-foreground">
                                                                        {
                                                                            beneficiary.reference
                                                                        }
                                                                    </span>
                                                                ) : null}
                                                            </span>
                                                        </SelectItem>
                                                    ),
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <InputError
                                            className="mt-2"
                                            message={form.errors.beneficiary_id}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="encounter_date">
                                            Encounter date
                                        </Label>
                                        <div className="relative mt-2">
                                            <CalendarDays
                                                className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
                                                aria-hidden="true"
                                            />
                                            <Input
                                                id="encounter_date"
                                                type="date"
                                                className="pl-9"
                                                value={form.data.encounter_date}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'encounter_date',
                                                        event.target.value,
                                                    )
                                                }
                                                max={today ?? manilaDate()}
                                                required
                                                aria-invalid={Boolean(
                                                    form.errors.encounter_date,
                                                )}
                                            />
                                        </div>
                                        <InputError
                                            className="mt-2"
                                            message={form.errors.encounter_date}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="gap-5 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Services provided</CardTitle>
                                    <CardDescription>
                                        Add one line for each service, medicine,
                                        or laboratory activity.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <EncounterComposer
                                        services={serviceOptions}
                                        items={form.data.items}
                                        onChange={(items) =>
                                            form.setData('items', items)
                                        }
                                        errors={
                                            form.errors as Partial<
                                                Record<string, string>
                                            >
                                        }
                                        disabled={form.processing}
                                    />
                                </CardContent>
                            </Card>
                        </div>

                        <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
                            <Card className="gap-4 border-teal-900/10 bg-gradient-to-b from-teal-950 to-cyan-950 text-white shadow-sm">
                                <CardHeader>
                                    <div className="grid size-10 place-items-center rounded-xl bg-white/10">
                                        <UserRound
                                            className="size-5"
                                            aria-hidden="true"
                                        />
                                    </div>
                                    <CardTitle className="mt-2">
                                        Encounter summary
                                    </CardTitle>
                                    <CardDescription className="text-teal-100/70">
                                        Review the key details before posting.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                        <p className="text-xs text-teal-100/65">
                                            Beneficiary
                                        </p>
                                        <p className="mt-1 text-sm font-semibold">
                                            {selectedBeneficiary
                                                ? fullName(selectedBeneficiary)
                                                : 'Not selected'}
                                        </p>
                                        {selectedBeneficiary ? (
                                            <p className="mt-1 font-mono text-xs text-teal-100/65">
                                                {selectedBeneficiary.reference ??
                                                    selectedBeneficiary.philhealth_pin_masked ??
                                                    selectedBeneficiary.masked_pin ??
                                                    selectedBeneficiary.masked_philhealth_pin}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                        <p className="text-xs text-teal-100/65">
                                            Service date
                                        </p>
                                        <p className="mt-1 text-sm font-semibold">
                                            {form.data.encounter_date ||
                                                'Not selected'}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                        <p className="text-xs text-teal-100/65">
                                            Service lines
                                        </p>
                                        <p className="mt-1 font-[Manrope] text-2xl font-semibold">
                                            {form.data.items.length}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="gap-4 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        Financial safeguards
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-3 text-xs leading-5 text-muted-foreground">
                                        <li className="flex gap-2">
                                            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal-600" />
                                            Catalog prices are snapshotted
                                            server-side.
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal-600" />
                                            Repeat labs require an earlier
                                            matching service.
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal-600" />
                                            Every save, post, and void action is
                                            audited.
                                        </li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </aside>
                    </div>

                    <div className="flex flex-col-reverse gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs leading-5 text-muted-foreground">
                            Save as draft to continue later, or post now to
                            freeze this encounter for reporting.
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button variant="outline" asChild>
                                <Link href="/encounters">Cancel</Link>
                            </Button>
                            <Button
                                type="submit"
                                variant="outline"
                                disabled={
                                    form.processing ||
                                    hasIncompleteLine ||
                                    !form.data.beneficiary_id
                                }
                            >
                                {form.processing ? (
                                    <LoaderCircle
                                        className="animate-spin"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <FileClock aria-hidden="true" />
                                )}
                                Save draft
                            </Button>
                            <Button
                                type="button"
                                className="bg-teal-700 text-white hover:bg-teal-800"
                                onClick={() => save('posted')}
                                disabled={
                                    form.processing ||
                                    hasIncompleteLine ||
                                    !form.data.beneficiary_id
                                }
                            >
                                {form.processing ? (
                                    <LoaderCircle
                                        className="animate-spin"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <ClipboardCheck aria-hidden="true" />
                                )}
                                Save &amp; post
                            </Button>
                        </div>
                    </div>
                </form>
            </main>
        </>
    );
}

EncounterForm.layout = {
    breadcrumbs: [
        {
            title: 'Service encounters',
            href: '/encounters',
        },
        {
            title: 'Encounter form',
            href: '#',
        },
    ],
};

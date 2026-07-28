import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarCheck2,
    CircleHelp,
    ContactRound,
    LoaderCircle,
    MapPin,
    Save,
    ShieldCheck,
    UserRound,
} from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

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
};

type Beneficiary = {
    id: number | string;
    reference?: string;
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
    address?: string | null;
    readiness?: YearRecord;
    year_record?: YearRecord;
    beneficiary_year?: YearRecord;
    current_year?: YearRecord;
    beneficiary_years?: YearRecord[];
    year_records?: YearRecord[];
    yearly_statuses?: YearRecord[];
};

type BeneficiaryPayload = {
    philhealth_pin: string;
    first_name: string;
    middle_name: string;
    last_name: string;
    suffix: string;
    birth_date: string;
    sex: string;
    beneficiary_type: string;
    contact_number: string;
    address: string;
    year_record: {
        year: number;
        selected: boolean;
        selected_at: string;
        fpe_completed: boolean;
        fpe_completed_at: string;
        pcu_reference: string;
        yes_confirmed: boolean;
        yes_confirmed_at: string;
    };
};

type PageProps = {
    beneficiary?: Beneficiary | null;
    yearRecord?: YearRecord;
    year_record?: YearRecord;
    yearStatus?: YearRecord;
    year_status?: YearRecord;
    readiness?: YearRecord;
    years?: number[];
    year?: number;
    selectedYear?: number;
    selected_year?: number;
    beneficiaryTypes?: Array<
        string | { value: string; label?: string; name?: string }
    >;
};

const currentYear = new Date().getFullYear();

function dateValue(value?: string | null): string {
    return value ? value.slice(0, 10) : '';
}

function emptyYearRecord(year: number): BeneficiaryPayload['year_record'] {
    return {
        year,
        selected: false,
        selected_at: '',
        fpe_completed: false,
        fpe_completed_at: '',
        pcu_reference: '',
        yes_confirmed: false,
        yes_confirmed_at: '',
    };
}

function normalizedYearRecord(
    record: YearRecord | undefined,
    year: number,
): BeneficiaryPayload['year_record'] {
    return {
        year: record?.year ?? year,
        selected: Boolean(record?.selected),
        selected_at: dateValue(record?.selected_at),
        fpe_completed: Boolean(record?.fpe_completed),
        fpe_completed_at: dateValue(record?.fpe_completed_at),
        pcu_reference: record?.pcu_reference ?? '',
        yes_confirmed: Boolean(record?.yes_confirmed),
        yes_confirmed_at: dateValue(record?.yes_confirmed_at),
    };
}

function checkCount(record: BeneficiaryPayload['year_record']): number {
    return [
        record.selected,
        record.fpe_completed,
        Boolean(record.pcu_reference.trim()),
        record.yes_confirmed,
    ].filter(Boolean).length;
}

function titleCase(value: string): string {
    return value
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function errorFor(
    errors: Partial<Record<string, string>>,
    key: string,
): string | undefined {
    return errors[key] ?? errors[key.replace(/^year_record\./, '')];
}

function ReadinessCheck({
    id,
    label,
    description,
    checked,
    onCheckedChange,
    children,
}: {
    id: string;
    label: string;
    description: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    children?: ReactNode;
}) {
    return (
        <div className="rounded-xl border bg-background p-4">
            <div className="flex items-start gap-3">
                <Checkbox
                    id={id}
                    className="mt-0.5"
                    checked={checked}
                    onCheckedChange={(value) => onCheckedChange(value === true)}
                />
                <div className="min-w-0 flex-1">
                    <Label htmlFor={id} className="leading-5">
                        {label}
                    </Label>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {description}
                    </p>
                </div>
            </div>
            {children ? <div className="mt-3 pl-7">{children}</div> : null}
        </div>
    );
}

export default function BeneficiaryForm({
    beneficiary,
    yearRecord,
    year_record,
    yearStatus,
    year_status,
    readiness,
    years,
    year,
    selectedYear,
    selected_year,
    beneficiaryTypes,
}: PageProps) {
    const isEdit = Boolean(beneficiary);
    const availableRecords =
        beneficiary?.year_records ??
        beneficiary?.beneficiary_years ??
        beneficiary?.yearly_statuses ??
        [];
    const activeYear =
        selectedYear ??
        selected_year ??
        year ??
        yearRecord?.year ??
        year_record?.year ??
        yearStatus?.year ??
        year_status?.year ??
        readiness?.year ??
        beneficiary?.year_record?.year ??
        beneficiary?.readiness?.year ??
        currentYear;
    const initialRecord =
        yearRecord ??
        year_record ??
        yearStatus ??
        year_status ??
        readiness ??
        beneficiary?.year_record ??
        beneficiary?.readiness ??
        beneficiary?.beneficiary_year ??
        beneficiary?.current_year ??
        availableRecords.find((record) => record.year === activeYear);
    const yearOptions = years?.length
        ? years
        : [activeYear - 1, activeYear, activeYear + 1];
    const typeOptions = (
        beneficiaryTypes ?? [
            'member',
            'dependent',
            'sponsored',
            'indigent',
            'senior_citizen',
        ]
    ).map((option) =>
        typeof option === 'string'
            ? { value: option, label: titleCase(option) }
            : {
                  value: option.value,
                  label: option.label ?? titleCase(option.value),
              },
    );
    const form = useForm<BeneficiaryPayload>({
        philhealth_pin: '',
        first_name: beneficiary?.first_name ?? '',
        middle_name: beneficiary?.middle_name ?? '',
        last_name: beneficiary?.last_name ?? '',
        suffix: beneficiary?.suffix ?? '',
        birth_date: dateValue(beneficiary?.birth_date),
        sex: beneficiary?.sex ?? '',
        beneficiary_type:
            beneficiary?.beneficiary_type ??
            beneficiary?.patient_type ??
            'member',
        contact_number: beneficiary?.contact_number ?? '',
        address: beneficiary?.address ?? '',
        year_record: normalizedYearRecord(initialRecord, activeYear),
    });
    const completedChecks = checkCount(form.data.year_record);
    const maskedPin =
        beneficiary?.philhealth_pin_masked ??
        beneficiary?.masked_pin ??
        beneficiary?.masked_philhealth_pin ??
        '••••-••••••••-•';

    function updateYearRecord(
        values: Partial<BeneficiaryPayload['year_record']>,
    ) {
        form.setData('year_record', {
            ...form.data.year_record,
            ...values,
        });
    }

    function changeYear(value: string) {
        const nextYear = Number(value);
        const existingRecord = availableRecords.find(
            (record) => record.year === nextYear,
        );
        form.setData(
            'year_record',
            existingRecord
                ? normalizedYearRecord(existingRecord, nextYear)
                : emptyYearRecord(nextYear),
        );
    }

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.transform((data) => ({
            philhealth_pin: data.philhealth_pin,
            first_name: data.first_name,
            middle_name: data.middle_name,
            last_name: data.last_name,
            suffix: data.suffix,
            birth_date: data.birth_date,
            sex: data.sex,
            beneficiary_type: data.beneficiary_type,
            contact_number: data.contact_number,
            address: data.address,
            year: data.year_record.year,
            selected: data.year_record.selected,
            selected_at: data.year_record.selected_at || null,
            fpe_completed: data.year_record.fpe_completed,
            fpe_completed_at: data.year_record.fpe_completed_at || null,
            pcu_reference: data.year_record.pcu_reference,
            yes_confirmed: data.year_record.yes_confirmed,
            yes_confirmed_at: data.year_record.yes_confirmed_at || null,
        }));

        if (beneficiary) {
            form.patch(`/beneficiaries/${beneficiary.id}`, {
                preserveScroll: true,
            });

            return;
        }

        form.post('/beneficiaries', { preserveScroll: true });
    }

    return (
        <>
            <Head title={isEdit ? 'Edit beneficiary' : 'Add beneficiary'} />

            <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                    <div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3"
                            asChild
                        >
                            <Link
                                href={
                                    beneficiary
                                        ? `/beneficiaries/${beneficiary.id}`
                                        : '/beneficiaries'
                                }
                            >
                                <ArrowLeft aria-hidden="true" />
                                Back to{' '}
                                {beneficiary ? 'beneficiary' : 'registry'}
                            </Link>
                        </Button>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <h1 className="font-[Manrope] text-2xl font-semibold tracking-tight sm:text-3xl">
                                {isEdit
                                    ? 'Edit beneficiary'
                                    : 'Add beneficiary'}
                            </h1>
                            {beneficiary?.reference ? (
                                <Badge variant="outline" className="font-mono">
                                    {beneficiary.reference}
                                </Badge>
                            ) : null}
                        </div>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                            Keep identity information concise and record only
                            the non-clinical readiness data required for program
                            monitoring.
                        </p>
                    </div>
                    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
                        <p className="text-xs font-medium text-muted-foreground">
                            {form.data.year_record.year} readiness
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                            <div className="flex gap-1" aria-hidden="true">
                                {[1, 2, 3, 4].map((step) => (
                                    <span
                                        key={step}
                                        className={`h-1.5 w-7 rounded-full ${
                                            step <= completedChecks
                                                ? 'bg-teal-600'
                                                : 'bg-muted'
                                        }`}
                                    />
                                ))}
                            </div>
                            <span className="text-xs font-semibold">
                                {completedChecks}/4
                            </span>
                        </div>
                    </div>
                </header>

                <Alert className="border-teal-200 bg-teal-50/70 text-teal-950 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-50">
                    <CircleHelp aria-hidden="true" />
                    <AlertTitle>Year-specific readiness</AlertTitle>
                    <AlertDescription className="text-teal-800 dark:text-teal-200">
                        Selection, FPE, PCU reference, and digital YES are
                        tracked independently. All four are required for SAP1
                        readiness.
                    </AlertDescription>
                </Alert>

                <form onSubmit={submit} className="space-y-6">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
                        <div className="space-y-6">
                            <Card className="gap-5 shadow-sm">
                                <CardHeader>
                                    <div className="flex items-start gap-3">
                                        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                                            <UserRound
                                                className="size-5"
                                                aria-hidden="true"
                                            />
                                        </div>
                                        <div>
                                            <CardTitle>
                                                Identity and membership
                                            </CardTitle>
                                            <CardDescription className="mt-1">
                                                Use the member&apos;s legal name
                                                and active PhilHealth PIN.
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="grid gap-5 sm:grid-cols-2">
                                    <div className="sm:col-span-2">
                                        <Label htmlFor="philhealth_pin">
                                            PhilHealth PIN
                                        </Label>
                                        <Input
                                            id="philhealth_pin"
                                            type="text"
                                            value={form.data.philhealth_pin}
                                            onChange={(event) =>
                                                form.setData(
                                                    'philhealth_pin',
                                                    event.target.value,
                                                )
                                            }
                                            className="mt-2 font-mono"
                                            placeholder={
                                                isEdit
                                                    ? maskedPin
                                                    : '123456789012'
                                            }
                                            required={!isEdit}
                                            inputMode="numeric"
                                            pattern="\d{12}"
                                            maxLength={12}
                                            autoComplete="off"
                                            aria-describedby="pin-help"
                                            aria-invalid={Boolean(
                                                form.errors.philhealth_pin,
                                            )}
                                        />
                                        <p
                                            id="pin-help"
                                            className="mt-2 text-xs text-muted-foreground"
                                        >
                                            {isEdit
                                                ? 'Leave blank to retain the current encrypted PIN.'
                                                : 'The saved PIN is encrypted and shown only in masked form.'}
                                        </p>
                                        <InputError
                                            className="mt-2"
                                            message={form.errors.philhealth_pin}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="first_name">
                                            First name
                                        </Label>
                                        <Input
                                            id="first_name"
                                            value={form.data.first_name}
                                            onChange={(event) =>
                                                form.setData(
                                                    'first_name',
                                                    event.target.value,
                                                )
                                            }
                                            className="mt-2"
                                            required
                                            autoComplete="given-name"
                                            aria-invalid={Boolean(
                                                form.errors.first_name,
                                            )}
                                        />
                                        <InputError
                                            className="mt-2"
                                            message={form.errors.first_name}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="middle_name">
                                            Middle name{' '}
                                            <span className="font-normal text-muted-foreground">
                                                (optional)
                                            </span>
                                        </Label>
                                        <Input
                                            id="middle_name"
                                            value={form.data.middle_name}
                                            onChange={(event) =>
                                                form.setData(
                                                    'middle_name',
                                                    event.target.value,
                                                )
                                            }
                                            className="mt-2"
                                            autoComplete="additional-name"
                                            aria-invalid={Boolean(
                                                form.errors.middle_name,
                                            )}
                                        />
                                        <InputError
                                            className="mt-2"
                                            message={form.errors.middle_name}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="last_name">
                                            Last name
                                        </Label>
                                        <Input
                                            id="last_name"
                                            value={form.data.last_name}
                                            onChange={(event) =>
                                                form.setData(
                                                    'last_name',
                                                    event.target.value,
                                                )
                                            }
                                            className="mt-2"
                                            required
                                            autoComplete="family-name"
                                            aria-invalid={Boolean(
                                                form.errors.last_name,
                                            )}
                                        />
                                        <InputError
                                            className="mt-2"
                                            message={form.errors.last_name}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="suffix">
                                            Suffix{' '}
                                            <span className="font-normal text-muted-foreground">
                                                (optional)
                                            </span>
                                        </Label>
                                        <Input
                                            id="suffix"
                                            value={form.data.suffix}
                                            onChange={(event) =>
                                                form.setData(
                                                    'suffix',
                                                    event.target.value,
                                                )
                                            }
                                            className="mt-2"
                                            placeholder="Jr., III"
                                            aria-invalid={Boolean(
                                                form.errors.suffix,
                                            )}
                                        />
                                        <InputError
                                            className="mt-2"
                                            message={form.errors.suffix}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="gap-5 shadow-sm">
                                <CardHeader>
                                    <div className="flex items-start gap-3">
                                        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
                                            <ContactRound
                                                className="size-5"
                                                aria-hidden="true"
                                            />
                                        </div>
                                        <div>
                                            <CardTitle>Demographics</CardTitle>
                                            <CardDescription className="mt-1">
                                                Minimum details used for member
                                                identification and reporting.
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="grid gap-5 sm:grid-cols-2">
                                    <div>
                                        <Label htmlFor="birth_date">
                                            Birth date
                                        </Label>
                                        <Input
                                            id="birth_date"
                                            type="date"
                                            value={form.data.birth_date}
                                            onChange={(event) =>
                                                form.setData(
                                                    'birth_date',
                                                    event.target.value,
                                                )
                                            }
                                            className="mt-2"
                                            max={new Date()
                                                .toISOString()
                                                .slice(0, 10)}
                                            required
                                            aria-invalid={Boolean(
                                                form.errors.birth_date,
                                            )}
                                        />
                                        <InputError
                                            className="mt-2"
                                            message={form.errors.birth_date}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="sex">Sex</Label>
                                        <Select
                                            value={form.data.sex}
                                            onValueChange={(value) =>
                                                form.setData('sex', value)
                                            }
                                            required
                                        >
                                            <SelectTrigger
                                                id="sex"
                                                className="mt-2 w-full"
                                                aria-invalid={Boolean(
                                                    form.errors.sex,
                                                )}
                                            >
                                                <SelectValue placeholder="Select sex" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="female">
                                                    Female
                                                </SelectItem>
                                                <SelectItem value="male">
                                                    Male
                                                </SelectItem>
                                                <SelectItem value="intersex">
                                                    Intersex
                                                </SelectItem>
                                                <SelectItem value="not_stated">
                                                    Prefer not to disclose
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <InputError
                                            className="mt-2"
                                            message={form.errors.sex}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="beneficiary_type">
                                            Beneficiary type
                                        </Label>
                                        <Select
                                            value={form.data.beneficiary_type}
                                            onValueChange={(value) =>
                                                form.setData(
                                                    'beneficiary_type',
                                                    value,
                                                )
                                            }
                                        >
                                            <SelectTrigger
                                                id="beneficiary_type"
                                                className="mt-2 w-full"
                                                aria-invalid={Boolean(
                                                    form.errors
                                                        .beneficiary_type,
                                                )}
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {typeOptions.map((option) => (
                                                    <SelectItem
                                                        key={option.value}
                                                        value={option.value}
                                                    >
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <InputError
                                            className="mt-2"
                                            message={
                                                form.errors.beneficiary_type
                                            }
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="contact_number">
                                            Contact number{' '}
                                            <span className="font-normal text-muted-foreground">
                                                (optional)
                                            </span>
                                        </Label>
                                        <Input
                                            id="contact_number"
                                            type="tel"
                                            value={form.data.contact_number}
                                            onChange={(event) =>
                                                form.setData(
                                                    'contact_number',
                                                    event.target.value,
                                                )
                                            }
                                            className="mt-2"
                                            placeholder="09XX XXX XXXX"
                                            autoComplete="tel"
                                            aria-invalid={Boolean(
                                                form.errors.contact_number,
                                            )}
                                        />
                                        <InputError
                                            className="mt-2"
                                            message={form.errors.contact_number}
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <Label htmlFor="address">
                                            Address{' '}
                                            <span className="font-normal text-muted-foreground">
                                                (optional)
                                            </span>
                                        </Label>
                                        <div className="relative mt-2">
                                            <MapPin
                                                className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground"
                                                aria-hidden="true"
                                            />
                                            <textarea
                                                id="address"
                                                value={form.data.address}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'address',
                                                        event.target.value,
                                                    )
                                                }
                                                rows={3}
                                                autoComplete="street-address"
                                                aria-invalid={Boolean(
                                                    form.errors.address,
                                                )}
                                                className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 pl-9 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
                                            />
                                        </div>
                                        <InputError
                                            className="mt-2"
                                            message={form.errors.address}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="h-fit gap-5 shadow-sm lg:sticky lg:top-6">
                            <CardHeader>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <CardTitle>Annual readiness</CardTitle>
                                        <CardDescription className="mt-1">
                                            Evidence for the selected program
                                            year.
                                        </CardDescription>
                                    </div>
                                    <CalendarCheck2
                                        className="size-5 text-teal-700 dark:text-teal-300"
                                        aria-hidden="true"
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="readiness_year">
                                        Program year
                                    </Label>
                                    <Select
                                        value={String(
                                            form.data.year_record.year,
                                        )}
                                        onValueChange={changeYear}
                                    >
                                        <SelectTrigger
                                            id="readiness_year"
                                            className="mt-2 w-full"
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
                                    <InputError
                                        className="mt-2"
                                        message={errorFor(
                                            form.errors,
                                            'year_record.year',
                                        )}
                                    />
                                </div>

                                <ReadinessCheck
                                    id="selected"
                                    label="Selected / empanelled"
                                    description="The beneficiary selected this facility for the program year."
                                    checked={form.data.year_record.selected}
                                    onCheckedChange={(checked) =>
                                        updateYearRecord({
                                            selected: checked,
                                            selected_at: checked
                                                ? form.data.year_record
                                                      .selected_at
                                                : '',
                                        })
                                    }
                                >
                                    <Label htmlFor="selected_at">
                                        Selection date
                                    </Label>
                                    <Input
                                        id="selected_at"
                                        type="date"
                                        className="mt-2"
                                        value={
                                            form.data.year_record.selected_at
                                        }
                                        onChange={(event) =>
                                            updateYearRecord({
                                                selected_at: event.target.value,
                                            })
                                        }
                                        disabled={
                                            !form.data.year_record.selected
                                        }
                                        required={
                                            form.data.year_record.selected
                                        }
                                    />
                                    <InputError
                                        className="mt-2"
                                        message={errorFor(
                                            form.errors,
                                            'year_record.selected_at',
                                        )}
                                    />
                                </ReadinessCheck>

                                <ReadinessCheck
                                    id="fpe_completed"
                                    label="FPE completed"
                                    description="The first patient encounter was completed and validated."
                                    checked={
                                        form.data.year_record.fpe_completed
                                    }
                                    onCheckedChange={(checked) =>
                                        updateYearRecord({
                                            fpe_completed: checked,
                                            fpe_completed_at: checked
                                                ? form.data.year_record
                                                      .fpe_completed_at
                                                : '',
                                        })
                                    }
                                >
                                    <Label htmlFor="fpe_completed_at">
                                        FPE completion date
                                    </Label>
                                    <Input
                                        id="fpe_completed_at"
                                        type="date"
                                        className="mt-2"
                                        value={
                                            form.data.year_record
                                                .fpe_completed_at
                                        }
                                        onChange={(event) =>
                                            updateYearRecord({
                                                fpe_completed_at:
                                                    event.target.value,
                                            })
                                        }
                                        disabled={
                                            !form.data.year_record.fpe_completed
                                        }
                                        required={
                                            form.data.year_record.fpe_completed
                                        }
                                    />
                                    <InputError
                                        className="mt-2"
                                        message={errorFor(
                                            form.errors,
                                            'year_record.fpe_completed_at',
                                        )}
                                    />
                                </ReadinessCheck>

                                <div className="rounded-xl border bg-background p-4">
                                    <Label htmlFor="pcu_reference">
                                        PCU reference
                                    </Label>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                        Store the confirmed patient consultation
                                        upload reference separately from FPE.
                                    </p>
                                    <Input
                                        id="pcu_reference"
                                        className="mt-3 font-mono"
                                        value={
                                            form.data.year_record.pcu_reference
                                        }
                                        onChange={(event) =>
                                            updateYearRecord({
                                                pcu_reference:
                                                    event.target.value,
                                            })
                                        }
                                        placeholder="PCU-2026-…"
                                        aria-invalid={Boolean(
                                            errorFor(
                                                form.errors,
                                                'year_record.pcu_reference',
                                            ),
                                        )}
                                    />
                                    <InputError
                                        className="mt-2"
                                        message={errorFor(
                                            form.errors,
                                            'year_record.pcu_reference',
                                        )}
                                    />
                                </div>

                                <ReadinessCheck
                                    id="yes_confirmed"
                                    label="Digital YES confirmed"
                                    description="The required digital eligibility/selection confirmation is on record."
                                    checked={
                                        form.data.year_record.yes_confirmed
                                    }
                                    onCheckedChange={(checked) =>
                                        updateYearRecord({
                                            yes_confirmed: checked,
                                            yes_confirmed_at: checked
                                                ? form.data.year_record
                                                      .yes_confirmed_at
                                                : '',
                                        })
                                    }
                                >
                                    <Label htmlFor="yes_confirmed_at">
                                        Confirmation date
                                    </Label>
                                    <Input
                                        id="yes_confirmed_at"
                                        type="date"
                                        className="mt-2"
                                        value={
                                            form.data.year_record
                                                .yes_confirmed_at
                                        }
                                        onChange={(event) =>
                                            updateYearRecord({
                                                yes_confirmed_at:
                                                    event.target.value,
                                            })
                                        }
                                        disabled={
                                            !form.data.year_record.yes_confirmed
                                        }
                                        required={
                                            form.data.year_record.yes_confirmed
                                        }
                                    />
                                    <InputError
                                        className="mt-2"
                                        message={errorFor(
                                            form.errors,
                                            'year_record.yes_confirmed_at',
                                        )}
                                    />
                                </ReadinessCheck>

                                <div
                                    className={`flex items-start gap-3 rounded-xl border p-4 ${
                                        completedChecks === 4
                                            ? 'border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-100'
                                            : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                                    }`}
                                >
                                    <ShieldCheck
                                        className="mt-0.5 size-5 shrink-0"
                                        aria-hidden="true"
                                    />
                                    <div>
                                        <p className="text-sm font-semibold">
                                            {completedChecks === 4
                                                ? 'Ready for SAP1'
                                                : `${4 - completedChecks} requirement${4 - completedChecks === 1 ? '' : 's'} remaining`}
                                        </p>
                                        <p className="mt-1 text-xs opacity-80">
                                            Readiness is derived automatically;
                                            it is not a manual status field.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex flex-col-reverse gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs leading-5 text-muted-foreground">
                            Saving creates an audit entry. Financial and
                            identity history remains recoverable.
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" asChild>
                                <Link
                                    href={
                                        beneficiary
                                            ? `/beneficiaries/${beneficiary.id}`
                                            : '/beneficiaries'
                                    }
                                >
                                    Cancel
                                </Link>
                            </Button>
                            <Button
                                type="submit"
                                className="bg-teal-700 text-white hover:bg-teal-800"
                                disabled={form.processing}
                            >
                                {form.processing ? (
                                    <LoaderCircle
                                        className="animate-spin"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <Save aria-hidden="true" />
                                )}
                                {form.processing
                                    ? 'Saving…'
                                    : isEdit
                                      ? 'Save changes'
                                      : 'Add beneficiary'}
                            </Button>
                        </div>
                    </div>
                </form>
            </main>
        </>
    );
}

BeneficiaryForm.layout = {
    breadcrumbs: [
        {
            title: 'Beneficiaries',
            href: '/beneficiaries',
        },
        {
            title: 'Beneficiary form',
            href: '#',
        },
    ],
};

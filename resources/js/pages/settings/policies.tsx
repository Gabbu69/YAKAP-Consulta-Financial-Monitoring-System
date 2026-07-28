import { Head, useForm } from '@inertiajs/react';
import {
    BookOpenCheck,
    Check,
    CirclePlus,
    ExternalLink,
    FileLock2,
    Pencil,
    RotateCcw,
} from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
    EmptyState,
    PageContainer,
    PageHeader,
    SectionHeading,
} from '@/components/yakap/page-elements';
import {
    formatDate,
    formatMoney,
    formatPercent,
    toPesoInput,
} from '@/lib/yakap';
import type { Facility, PerformanceRule, PolicyVersion } from '@/types';

type Props = {
    facility?: Facility;
    policies?: PolicyVersion[];
    defaultPerformanceRules?: PerformanceRule[];
};

const fallbackRules: PerformanceRule[] = [
    {
        key: 'consultation_utilization',
        label: 'Primary care consultation',
        target: 1,
        weight: 0.3,
    },
    {
        key: 'laboratory_utilization',
        label: 'Laboratory utilization',
        target: 0.5,
        weight: 0.3,
    },
    {
        key: 'antibiotic_access',
        label: 'Antibiotic dispensing',
        target: 0.15,
        weight: 0.1,
    },
    {
        key: 'ncd_medicine_access',
        label: 'NCD medicine dispensing',
        target: 0.2,
        weight: 0.3,
    },
];

function newPolicy(rules: PerformanceRule[]) {
    return {
        effective_year: new Date().getFullYear(),
        source_circular: 'PhilHealth Circular 2024-0013, Annex I',
        source_url:
            'https://www.philhealth.gov.ph/circulars/2024/0013/Annex_I_Approved_Benefit_Payment.pdf',
        per_capita_rate_centavos: 170000,
        sap1_percentage_bps: 4000,
        sap2_percentage_bps: 6000,
        withholding_tax_bps: 0,
        copayment_cap_centavos: 90000,
        performance_rules: rules.map((rule) => ({ ...rule })),
    };
}

export default function PolicySettings({
    facility,
    policies = [],
    defaultPerformanceRules = fallbackRules,
}: Props) {
    const [editing, setEditing] = useState<PolicyVersion | null>(null);
    const form = useForm(newPolicy(defaultPerformanceRules));
    const weightTotal = form.data.performance_rules.reduce(
        (sum, rule) => sum + Number(rule.weight),
        0,
    );

    const clear = () => {
        setEditing(null);
        form.setData(newPolicy(defaultPerformanceRules));
        form.clearErrors();
    };

    const selectPolicy = (policy: PolicyVersion) => {
        setEditing(policy);
        form.setData({
            effective_year: policy.effective_year,
            source_circular: policy.source_circular,
            source_url: policy.source_url ?? '',
            per_capita_rate_centavos: policy.per_capita_rate_centavos,
            sap1_percentage_bps: policy.sap1_percentage_bps,
            sap2_percentage_bps: policy.sap2_percentage_bps,
            withholding_tax_bps: policy.withholding_tax_bps,
            copayment_cap_centavos: policy.copayment_cap_centavos,
            performance_rules: policy.performance_rules.map((rule) => ({
                ...rule,
            })),
        });
        form.clearErrors();
    };

    const updateRule = (
        index: number,
        field: 'target' | 'weight',
        value: number,
    ) => {
        form.setData(
            'performance_rules',
            form.data.performance_rules.map((rule, ruleIndex) =>
                ruleIndex === index ? { ...rule, [field]: value } : rule,
            ),
        );
    };

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: clear };

        if (editing) {
            form.patch(`/settings/policies/${editing.id}`, options);
        } else {
            form.post('/settings/policies', options);
        }
    };

    return (
        <>
            <Head title="Policy Settings" />
            <PageContainer>
                <PageHeader
                    eyebrow="Administration"
                    title="Policy versions"
                    description={`Keep year-effective reimbursement rules explicit and auditable${facility?.name ? ` for ${facility.name}` : ''}.`}
                    actions={
                        editing ? (
                            <Button variant="outline" onClick={clear}>
                                <RotateCcw className="size-4" />
                                Create new version
                            </Button>
                        ) : (
                            <Badge variant="outline" className="py-1.5">
                                <FileLock2 className="size-3.5" />
                                Locks after batch use
                            </Badge>
                        )
                    }
                />

                <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,.75fr)_minmax(28rem,1.25fr)]">
                    <Card>
                        <CardHeader>
                            <SectionHeading
                                title="Version history"
                                description="A policy becomes immutable as soon as a SAP batch references it."
                            />
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {policies.length > 0 ? (
                                policies.map((policy) => {
                                    const locked = Boolean(policy.locked_at);

                                    return (
                                        <article
                                            key={policy.id}
                                            className="rounded-xl border bg-background/50 p-4"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="font-display text-lg font-bold">
                                                            {
                                                                policy.effective_year
                                                            }
                                                        </h3>
                                                        <Badge
                                                            variant={
                                                                locked
                                                                    ? 'secondary'
                                                                    : 'outline'
                                                            }
                                                        >
                                                            {locked ? (
                                                                <FileLock2 className="size-3" />
                                                            ) : (
                                                                <Pencil className="size-3" />
                                                            )}
                                                            {locked
                                                                ? 'Locked'
                                                                : 'Editable'}
                                                        </Badge>
                                                    </div>
                                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                                        {policy.source_circular}
                                                    </p>
                                                </div>
                                                {!locked ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`Edit ${policy.effective_year} policy`}
                                                        onClick={() =>
                                                            selectPolicy(policy)
                                                        }
                                                    >
                                                        <Pencil className="size-4" />
                                                    </Button>
                                                ) : null}
                                            </div>
                                            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                                                <div>
                                                    <dt className="text-muted-foreground">
                                                        Per capita
                                                    </dt>
                                                    <dd className="mt-1 font-semibold tabular-nums">
                                                        {formatMoney(
                                                            policy.per_capita_rate_centavos,
                                                        )}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt className="text-muted-foreground">
                                                        SAP split
                                                    </dt>
                                                    <dd className="mt-1 font-semibold tabular-nums">
                                                        {(
                                                            policy.sap1_percentage_bps /
                                                            100
                                                        ).toFixed(0)}
                                                        % /{' '}
                                                        {(
                                                            policy.sap2_percentage_bps /
                                                            100
                                                        ).toFixed(0)}
                                                        %
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt className="text-muted-foreground">
                                                        Co-pay cap
                                                    </dt>
                                                    <dd className="mt-1 font-semibold tabular-nums">
                                                        {formatMoney(
                                                            policy.copayment_cap_centavos,
                                                        )}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt className="text-muted-foreground">
                                                        Created
                                                    </dt>
                                                    <dd className="mt-1 font-semibold">
                                                        {formatDate(
                                                            policy.created_at,
                                                        )}
                                                    </dd>
                                                </div>
                                            </dl>
                                            {policy.source_url ? (
                                                <a
                                                    href={policy.source_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                                                >
                                                    Review source circular
                                                    <ExternalLink className="size-3" />
                                                </a>
                                            ) : null}
                                        </article>
                                    );
                                })
                            ) : (
                                <EmptyState
                                    icon={BookOpenCheck}
                                    title="No policy versions"
                                    description="Create the first year-effective policy to enable SAP batch calculations."
                                />
                            )}
                        </CardContent>
                    </Card>

                    <Card className="xl:sticky xl:top-24">
                        <CardHeader>
                            <SectionHeading
                                title={
                                    editing
                                        ? `Edit ${editing.effective_year} policy`
                                        : 'Create a policy version'
                                }
                                description="Rates use centavos and basis points in storage; this form presents pesos and percentages."
                            />
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submit} className="space-y-6">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="policy-year">
                                            Effective year
                                        </Label>
                                        <Input
                                            id="policy-year"
                                            type="number"
                                            min="2020"
                                            max="2100"
                                            value={form.data.effective_year}
                                            onChange={(event) =>
                                                form.setData(
                                                    'effective_year',
                                                    Number(event.target.value),
                                                )
                                            }
                                            required
                                        />
                                        <InputError
                                            message={form.errors.effective_year}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="policy-rate">
                                            Per-capita rate (PHP)
                                        </Label>
                                        <Input
                                            id="policy-rate"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={toPesoInput(
                                                form.data
                                                    .per_capita_rate_centavos,
                                            )}
                                            onChange={(event) =>
                                                form.setData(
                                                    'per_capita_rate_centavos',
                                                    Math.round(
                                                        Number(
                                                            event.target.value,
                                                        ) * 100,
                                                    ),
                                                )
                                            }
                                            required
                                        />
                                        <InputError
                                            message={
                                                form.errors
                                                    .per_capita_rate_centavos
                                            }
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="policy-sap1">
                                            SAP1 percentage
                                        </Label>
                                        <Input
                                            id="policy-sap1"
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={
                                                form.data.sap1_percentage_bps /
                                                100
                                            }
                                            onChange={(event) =>
                                                form.setData(
                                                    'sap1_percentage_bps',
                                                    Math.round(
                                                        Number(
                                                            event.target.value,
                                                        ) * 100,
                                                    ),
                                                )
                                            }
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="policy-sap2">
                                            SAP2 percentage
                                        </Label>
                                        <Input
                                            id="policy-sap2"
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={
                                                form.data.sap2_percentage_bps /
                                                100
                                            }
                                            onChange={(event) =>
                                                form.setData(
                                                    'sap2_percentage_bps',
                                                    Math.round(
                                                        Number(
                                                            event.target.value,
                                                        ) * 100,
                                                    ),
                                                )
                                            }
                                            required
                                        />
                                        <InputError
                                            message={
                                                form.errors.sap2_percentage_bps
                                            }
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="policy-tax">
                                            Private withholding tax (%)
                                        </Label>
                                        <Input
                                            id="policy-tax"
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={
                                                form.data.withholding_tax_bps /
                                                100
                                            }
                                            onChange={(event) =>
                                                form.setData(
                                                    'withholding_tax_bps',
                                                    Math.round(
                                                        Number(
                                                            event.target.value,
                                                        ) * 100,
                                                    ),
                                                )
                                            }
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="policy-copay">
                                            Private co-pay cap (PHP)
                                        </Label>
                                        <Input
                                            id="policy-copay"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={toPesoInput(
                                                form.data
                                                    .copayment_cap_centavos,
                                            )}
                                            onChange={(event) =>
                                                form.setData(
                                                    'copayment_cap_centavos',
                                                    Math.round(
                                                        Number(
                                                            event.target.value,
                                                        ) * 100,
                                                    ),
                                                )
                                            }
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-2 sm:col-span-2">
                                        <Label htmlFor="policy-source">
                                            Source circular
                                        </Label>
                                        <Input
                                            id="policy-source"
                                            value={form.data.source_circular}
                                            onChange={(event) =>
                                                form.setData(
                                                    'source_circular',
                                                    event.target.value,
                                                )
                                            }
                                            required
                                        />
                                        <InputError
                                            message={
                                                form.errors.source_circular
                                            }
                                        />
                                    </div>
                                    <div className="grid gap-2 sm:col-span-2">
                                        <Label htmlFor="policy-url">
                                            Source URL
                                        </Label>
                                        <Input
                                            id="policy-url"
                                            type="url"
                                            value={form.data.source_url}
                                            onChange={(event) =>
                                                form.setData(
                                                    'source_url',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={form.errors.source_url}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4 border-t pt-5">
                                    <div className="flex items-end justify-between gap-3">
                                        <div>
                                            <h3 className="font-display text-sm font-semibold">
                                                SAP2 performance rules
                                            </h3>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Targets and weights are entered
                                                as percentages.
                                            </p>
                                        </div>
                                        <Badge
                                            variant={
                                                Math.abs(weightTotal - 1) <
                                                0.0001
                                                    ? 'secondary'
                                                    : 'destructive'
                                            }
                                        >
                                            {formatPercent(weightTotal)} total
                                        </Badge>
                                    </div>
                                    <Progress
                                        value={weightTotal * 100}
                                        label="Total performance indicator weight"
                                    />
                                    <div className="space-y-3">
                                        {form.data.performance_rules.map(
                                            (rule, index) => (
                                                <div
                                                    key={rule.key}
                                                    className="grid gap-3 rounded-xl border bg-background/50 p-4 sm:grid-cols-[1fr_8rem_8rem]"
                                                >
                                                    <div>
                                                        <Label
                                                            htmlFor={`rule-target-${rule.key}`}
                                                            className="text-sm"
                                                        >
                                                            {rule.label}
                                                        </Label>
                                                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                                                            {rule.key}
                                                        </p>
                                                    </div>
                                                    <div className="grid gap-1.5">
                                                        <Label
                                                            htmlFor={`rule-target-${rule.key}`}
                                                            className="text-xs"
                                                        >
                                                            Target %
                                                        </Label>
                                                        <Input
                                                            id={`rule-target-${rule.key}`}
                                                            type="number"
                                                            min="0.01"
                                                            max="100"
                                                            step="0.1"
                                                            value={
                                                                rule.target *
                                                                100
                                                            }
                                                            onChange={(event) =>
                                                                updateRule(
                                                                    index,
                                                                    'target',
                                                                    Number(
                                                                        event
                                                                            .target
                                                                            .value,
                                                                    ) / 100,
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                    <div className="grid gap-1.5">
                                                        <Label
                                                            htmlFor={`rule-weight-${rule.key}`}
                                                            className="text-xs"
                                                        >
                                                            Weight %
                                                        </Label>
                                                        <Input
                                                            id={`rule-weight-${rule.key}`}
                                                            type="number"
                                                            min="0.01"
                                                            max="100"
                                                            step="0.1"
                                                            value={
                                                                rule.weight *
                                                                100
                                                            }
                                                            onChange={(event) =>
                                                                updateRule(
                                                                    index,
                                                                    'weight',
                                                                    Number(
                                                                        event
                                                                            .target
                                                                            .value,
                                                                    ) / 100,
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                    <InputError
                                        message={form.errors.performance_rules}
                                    />
                                </div>

                                <div className="grid gap-2 border-t pt-5">
                                    <Label htmlFor="policy-note">
                                        Version note
                                    </Label>
                                    <Textarea
                                        id="policy-note"
                                        readOnly
                                        value="Policy versions are locked when first used by a SAP batch. Create a new year-effective version for future changes."
                                        className="resize-none bg-muted/40 text-muted-foreground"
                                    />
                                </div>

                                <div className="flex justify-end gap-2">
                                    {editing ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={clear}
                                        >
                                            Cancel
                                        </Button>
                                    ) : null}
                                    <Button
                                        type="submit"
                                        disabled={
                                            form.processing ||
                                            Math.abs(weightTotal - 1) > 0.0001
                                        }
                                    >
                                        {editing ? (
                                            <Check className="size-4" />
                                        ) : (
                                            <CirclePlus className="size-4" />
                                        )}
                                        {editing
                                            ? 'Save policy changes'
                                            : 'Create policy version'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </PageContainer>
        </>
    );
}

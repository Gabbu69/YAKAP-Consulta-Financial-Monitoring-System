import { AlertCircle, FlaskConical, Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

export type ServiceOption = {
    id: number | string;
    code?: string;
    name: string;
    unit?: string;
    classification?: string;
    default_cost_centavos?: number;
    unit_cost_centavos?: number;
    is_active?: boolean;
    service_category?: {
        name?: string;
        classification?: string;
    };
    category?: {
        name?: string;
        classification?: string;
    };
};

export type EncounterComposerItem = {
    client_key: string;
    service_id: string;
    quantity: number;
    is_repeat_laboratory: boolean;
};

export type EncounterComposerProps = {
    services: ServiceOption[];
    items: EncounterComposerItem[];
    onChange: (items: EncounterComposerItem[]) => void;
    errors?: Partial<Record<string, string>>;
    disabled?: boolean;
};

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

let nextClientKey = 1;

export function createEncounterItem(
    values: Partial<EncounterComposerItem> = {},
): EncounterComposerItem {
    const clientKey = `service-line-${Date.now()}-${nextClientKey}`;
    nextClientKey += 1;

    return {
        client_key: clientKey,
        service_id: '',
        quantity: 1,
        is_repeat_laboratory: false,
        ...values,
    };
}

export function serviceClassification(service?: ServiceOption): string {
    return (
        service?.classification ??
        service?.service_category?.classification ??
        service?.category?.classification ??
        'other'
    );
}

export function serviceUnitCost(service?: ServiceOption): number {
    return service?.default_cost_centavos ?? service?.unit_cost_centavos ?? 0;
}

export function encounterItemsTotal(
    items: EncounterComposerItem[],
    services: ServiceOption[],
): number {
    const serviceMap = new Map(
        services.map((service) => [String(service.id), service]),
    );

    return items.reduce((sum, item) => {
        const service = serviceMap.get(item.service_id);
        const quantity = Number.isFinite(item.quantity)
            ? Math.max(item.quantity, 0)
            : 0;

        return sum + serviceUnitCost(service) * quantity;
    }, 0);
}

function titleCase(value: string): string {
    return value
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function lineError(
    errors: Partial<Record<string, string>>,
    index: number,
    field: 'service_id' | 'quantity' | 'is_repeat_laboratory',
): string | undefined {
    return (
        errors[`items.${index}.${field}`] ?? errors[`items[${index}].${field}`]
    );
}

export function EncounterComposer({
    services,
    items,
    onChange,
    errors = {},
    disabled = false,
}: EncounterComposerProps) {
    const activeServices = useMemo(
        () => services.filter((service) => service.is_active !== false),
        [services],
    );
    const serviceMap = useMemo(
        () =>
            new Map(
                activeServices.map((service) => [String(service.id), service]),
            ),
        [activeServices],
    );
    const totalCentavos = useMemo(
        () => encounterItemsTotal(items, activeServices),
        [activeServices, items],
    );

    function updateItem(index: number, values: Partial<EncounterComposerItem>) {
        onChange(
            items.map((item, itemIndex) =>
                itemIndex === index ? { ...item, ...values } : item,
            ),
        );
    }

    function selectService(index: number, serviceId: string) {
        const service = serviceMap.get(serviceId);
        const laboratory =
            serviceClassification(service).toLowerCase() === 'laboratory';

        updateItem(index, {
            service_id: serviceId,
            is_repeat_laboratory: laboratory
                ? (items[index]?.is_repeat_laboratory ?? false)
                : false,
        });
    }

    function removeItem(index: number) {
        onChange(items.filter((_, itemIndex) => itemIndex !== index));
    }

    function addItem() {
        onChange([...items, createEncounterItem()]);
    }

    return (
        <div className="space-y-4">
            {!activeServices.length ? (
                <Alert>
                    <AlertCircle aria-hidden="true" />
                    <AlertTitle>No active services</AlertTitle>
                    <AlertDescription>
                        Add or activate a service in the catalog before
                        recording an encounter.
                    </AlertDescription>
                </Alert>
            ) : null}

            <div className="space-y-3">
                {items.map((item, index) => {
                    const service = serviceMap.get(item.service_id);
                    const classification = serviceClassification(service);
                    const isLaboratory =
                        classification.toLowerCase() === 'laboratory';
                    const subtotal =
                        serviceUnitCost(service) *
                        (Number.isFinite(item.quantity)
                            ? Math.max(item.quantity, 0)
                            : 0);
                    const serviceInputId = `${item.client_key}-service`;
                    const quantityInputId = `${item.client_key}-quantity`;
                    const repeatInputId = `${item.client_key}-repeat`;

                    return (
                        <fieldset
                            key={item.client_key}
                            className="rounded-xl border bg-background p-4 shadow-xs"
                            disabled={disabled}
                        >
                            <legend className="sr-only">
                                Service line {index + 1}
                            </legend>
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="grid size-7 place-items-center rounded-full bg-teal-50 text-xs font-bold text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                                        {index + 1}
                                    </span>
                                    <p className="text-sm font-semibold">
                                        Service line {index + 1}
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() => removeItem(index)}
                                    disabled={disabled || items.length === 1}
                                    aria-label={`Remove service line ${index + 1}`}
                                >
                                    <Trash2 aria-hidden="true" />
                                    <span className="hidden sm:inline">
                                        Remove
                                    </span>
                                </Button>
                            </div>

                            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_110px_150px] md:items-start">
                                <div>
                                    <Label htmlFor={serviceInputId}>
                                        Service
                                    </Label>
                                    <Select
                                        value={item.service_id}
                                        onValueChange={(value) =>
                                            selectService(index, value)
                                        }
                                        disabled={disabled}
                                        required
                                    >
                                        <SelectTrigger
                                            id={serviceInputId}
                                            className="mt-2 w-full"
                                            aria-invalid={Boolean(
                                                lineError(
                                                    errors,
                                                    index,
                                                    'service_id',
                                                ),
                                            )}
                                        >
                                            <SelectValue placeholder="Choose a catalog service" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {activeServices.map((option) => (
                                                <SelectItem
                                                    key={option.id}
                                                    value={String(option.id)}
                                                >
                                                    <span className="flex min-w-0 items-center gap-2">
                                                        {option.code ? (
                                                            <span className="font-mono text-xs text-muted-foreground">
                                                                {option.code}
                                                            </span>
                                                        ) : null}
                                                        <span>
                                                            {option.name}
                                                        </span>
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError
                                        className="mt-2"
                                        message={lineError(
                                            errors,
                                            index,
                                            'service_id',
                                        )}
                                    />
                                    {service ? (
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                            <Badge
                                                variant="outline"
                                                className="font-normal"
                                            >
                                                {titleCase(classification)}
                                            </Badge>
                                            <span>
                                                {currency.format(
                                                    serviceUnitCost(service) /
                                                        100,
                                                )}{' '}
                                                per {service.unit ?? 'service'}
                                            </span>
                                        </div>
                                    ) : null}
                                </div>

                                <div>
                                    <Label htmlFor={quantityInputId}>
                                        Quantity
                                    </Label>
                                    <Input
                                        id={quantityInputId}
                                        type="number"
                                        min={1}
                                        step={1}
                                        className="mt-2"
                                        value={item.quantity}
                                        onChange={(event) =>
                                            updateItem(index, {
                                                quantity:
                                                    event.target.value === ''
                                                        ? 0
                                                        : Number(
                                                              event.target
                                                                  .value,
                                                          ),
                                            })
                                        }
                                        required
                                        aria-invalid={Boolean(
                                            lineError(
                                                errors,
                                                index,
                                                'quantity',
                                            ),
                                        )}
                                    />
                                    <InputError
                                        className="mt-2"
                                        message={lineError(
                                            errors,
                                            index,
                                            'quantity',
                                        )}
                                    />
                                </div>

                                <div className="rounded-lg bg-muted/40 px-3 py-2.5 md:mt-6">
                                    <p className="text-xs text-muted-foreground">
                                        Line total
                                    </p>
                                    <p className="mt-1 font-[Manrope] text-sm font-semibold tabular-nums">
                                        {currency.format(subtotal / 100)}
                                    </p>
                                </div>
                            </div>

                            {isLaboratory ? (
                                <div className="mt-4 flex items-start gap-3 rounded-lg border border-cyan-200 bg-cyan-50/70 p-3 dark:border-cyan-900 dark:bg-cyan-950/30">
                                    <Checkbox
                                        id={repeatInputId}
                                        className="mt-0.5"
                                        checked={item.is_repeat_laboratory}
                                        onCheckedChange={(checked) =>
                                            updateItem(index, {
                                                is_repeat_laboratory:
                                                    checked === true,
                                            })
                                        }
                                    />
                                    <div>
                                        <Label
                                            htmlFor={repeatInputId}
                                            className="flex items-center gap-2"
                                        >
                                            <FlaskConical
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                            Repeat laboratory service
                                        </Label>
                                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                            Mark only when an earlier matching
                                            laboratory service exists for this
                                            beneficiary. The server validates
                                            that history.
                                        </p>
                                        <InputError
                                            className="mt-2"
                                            message={lineError(
                                                errors,
                                                index,
                                                'is_repeat_laboratory',
                                            )}
                                        />
                                    </div>
                                </div>
                            ) : null}
                        </fieldset>
                    );
                })}
            </div>

            <InputError message={errors.items} />

            <div className="flex flex-col gap-4 rounded-xl border border-teal-900/10 bg-gradient-to-r from-teal-50 to-cyan-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:from-teal-950/40 dark:to-cyan-950/30">
                <Button
                    type="button"
                    variant="outline"
                    onClick={addItem}
                    disabled={disabled || !activeServices.length}
                    className="bg-background"
                >
                    <Plus aria-hidden="true" />
                    Add service line
                </Button>
                <div
                    className="text-left sm:text-right"
                    role="status"
                    aria-live="polite"
                >
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Encounter total
                    </p>
                    <p className="mt-1 font-[Manrope] text-2xl font-semibold text-teal-900 tabular-nums dark:text-teal-100">
                        {currency.format(totalCentavos / 100)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {totalCentavos.toLocaleString('en-PH')} centavos
                    </p>
                </div>
            </div>
        </div>
    );
}

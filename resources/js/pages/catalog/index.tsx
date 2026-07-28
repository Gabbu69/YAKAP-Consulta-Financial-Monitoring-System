import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    Check,
    CirclePlus,
    FlaskConical,
    Pencil,
    RotateCcw,
    Search,
} from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
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
import {
    EmptyState,
    PageContainer,
    PageHeader,
    Pagination,
    SectionHeading,
    StatusBadge,
    getRows,
} from '@/components/yakap/page-elements';
import { formatMoney, titleCase, toPesoInput } from '@/lib/yakap';
import type { PaginatedOrArray, Service, ServiceClassification } from '@/types';

type ServiceForm = {
    category_name: string;
    code: string;
    name: string;
    unit: string;
    classification: ServiceClassification | string;
    default_cost_centavos: number;
    is_active: boolean;
};

const classifications = [
    'consultation',
    'laboratory',
    'antibiotic',
    'ncd_medicine',
    'other_drug',
    'other',
] as const;

type Props = {
    services?: PaginatedOrArray<Service>;
    filters?: { search?: string; classification?: string; status?: string };
};

export default function CatalogIndex({ services, filters = {} }: Props) {
    const rows = getRows(services);
    const role = usePage().props.auth.user.role;
    const canManage = role === 'administrator';
    const [editing, setEditing] = useState<Service | null>(null);
    const [search, setSearch] = useState(filters.search ?? '');
    const form = useForm<ServiceForm>({
        category_name: 'General care',
        code: '',
        name: '',
        unit: 'service',
        classification: 'consultation',
        default_cost_centavos: 0,
        is_active: true,
    });

    const selectService = (service: Service) => {
        setEditing(service);
        form.setData({
            category_name: service.category?.name ?? 'General care',
            code: service.code,
            name: service.name,
            unit: service.unit ?? 'service',
            classification:
                service.category?.classification ??
                service.classification ??
                'other',
            default_cost_centavos:
                service.default_cost_centavos ??
                service.unit_cost_centavos ??
                0,
            is_active: service.is_active ?? true,
        });
        form.clearErrors();
    };

    const clearForm = () => {
        setEditing(null);
        form.reset();
        form.clearErrors();
    };

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: clearForm };

        if (editing) {
            form.patch(`/catalog/${editing.id}`, options);
        } else {
            form.post('/catalog', options);
        }
    };

    return (
        <>
            <Head title="Service Catalog" />
            <PageContainer>
                <PageHeader
                    eyebrow="Care operations"
                    title="Service catalog"
                    description="Define explicit service classifications and standard costs used in encounter snapshots."
                    actions={
                        editing ? (
                            <Button variant="outline" onClick={clearForm}>
                                <RotateCcw className="size-4" />
                                Add new instead
                            </Button>
                        ) : undefined
                    }
                />

                <div
                    className={`grid items-start gap-4 ${canManage ? 'xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,.55fr)]' : ''}`}
                >
                    <Card className="gap-0 py-0">
                        <CardHeader className="border-b py-5">
                            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                                <SectionHeading
                                    title="Available services"
                                    description={`${rows.length} service${rows.length === 1 ? '' : 's'} on this page`}
                                />
                                <form
                                    className="flex gap-2"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        router.get(
                                            '/catalog',
                                            { search },
                                            {
                                                preserveState: true,
                                                replace: true,
                                            },
                                        );
                                    }}
                                    role="search"
                                >
                                    <Label
                                        htmlFor="catalog-search"
                                        className="sr-only"
                                    >
                                        Search service catalog
                                    </Label>
                                    <div className="relative">
                                        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            id="catalog-search"
                                            value={search}
                                            onChange={(event) =>
                                                setSearch(event.target.value)
                                            }
                                            className="w-full pl-9 sm:w-64"
                                            placeholder="Code or service name"
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        variant="outline"
                                        size="icon"
                                        aria-label="Search catalog"
                                    >
                                        <Search className="size-4" />
                                    </Button>
                                </form>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {rows.length > 0 ? (
                                <>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Service</TableHead>
                                                <TableHead>
                                                    Classification
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Unit cost
                                                </TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="w-12">
                                                    <span className="sr-only">
                                                        Edit
                                                    </span>
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {rows.map((service) => (
                                                <TableRow key={service.id}>
                                                    <TableCell>
                                                        <p className="font-medium">
                                                            {service.name}
                                                        </p>
                                                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                                                            {service.code}
                                                        </p>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary">
                                                            {titleCase(
                                                                service.category
                                                                    ?.classification ??
                                                                    service.classification,
                                                            )}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium tabular-nums">
                                                        {formatMoney(
                                                            service.default_cost_centavos ??
                                                                service.unit_cost_centavos,
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <StatusBadge
                                                            status={
                                                                (service.is_active ??
                                                                true)
                                                                    ? 'active'
                                                                    : 'inactive'
                                                            }
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        {canManage ? (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() =>
                                                                    selectService(
                                                                        service,
                                                                    )
                                                                }
                                                                aria-label={`Edit ${service.name}`}
                                                            >
                                                                <Pencil className="size-4" />
                                                            </Button>
                                                        ) : null}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <Pagination collection={services} />
                                </>
                            ) : (
                                <EmptyState
                                    icon={FlaskConical}
                                    title="No services found"
                                    description="Add the first service or change your search terms."
                                />
                            )}
                        </CardContent>
                    </Card>

                    {canManage ? (
                        <Card className="xl:sticky xl:top-24">
                            <CardHeader>
                                <SectionHeading
                                    title={
                                        editing
                                            ? `Edit ${editing.code}`
                                            : 'Add a service'
                                    }
                                    description="Costs are stored as integer centavos and frozen into posted encounter lines."
                                />
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={submit} className="space-y-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="service-code">
                                            Service code
                                        </Label>
                                        <Input
                                            id="service-code"
                                            value={form.data.code}
                                            onChange={(event) =>
                                                form.setData(
                                                    'code',
                                                    event.target.value.toUpperCase(),
                                                )
                                            }
                                            placeholder="CONS-001"
                                            required
                                            aria-invalid={Boolean(
                                                form.errors.code,
                                            )}
                                        />
                                        <InputError
                                            message={form.errors.code}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="service-name">
                                            Service name
                                        </Label>
                                        <Input
                                            id="service-name"
                                            value={form.data.name}
                                            onChange={(event) =>
                                                form.setData(
                                                    'name',
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="Primary care consultation"
                                            required
                                            aria-invalid={Boolean(
                                                form.errors.name,
                                            )}
                                        />
                                        <InputError
                                            message={form.errors.name}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="service-category">
                                            Category name
                                        </Label>
                                        <Input
                                            id="service-category"
                                            value={form.data.category_name}
                                            onChange={(event) =>
                                                form.setData(
                                                    'category_name',
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="Primary care services"
                                            required
                                            aria-invalid={Boolean(
                                                form.errors.category_name,
                                            )}
                                        />
                                        <InputError
                                            message={form.errors.category_name}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="service-classification">
                                            Classification
                                        </Label>
                                        <Select
                                            value={form.data.classification}
                                            onValueChange={(value) =>
                                                form.setData(
                                                    'classification',
                                                    value,
                                                )
                                            }
                                        >
                                            <SelectTrigger
                                                id="service-classification"
                                                className="w-full"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {classifications.map((item) => (
                                                    <SelectItem
                                                        key={item}
                                                        value={item}
                                                    >
                                                        {titleCase(item)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <InputError
                                            message={form.errors.classification}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="service-unit">
                                            Unit
                                        </Label>
                                        <Input
                                            id="service-unit"
                                            value={form.data.unit}
                                            onChange={(event) =>
                                                form.setData(
                                                    'unit',
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="service"
                                            required
                                        />
                                        <InputError
                                            message={form.errors.unit}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="service-cost">
                                            Standard unit cost (PHP)
                                        </Label>
                                        <Input
                                            id="service-cost"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={toPesoInput(
                                                form.data.default_cost_centavos,
                                            )}
                                            onChange={(event) =>
                                                form.setData(
                                                    'default_cost_centavos',
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
                                                    .default_cost_centavos
                                            }
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="service-status">
                                            Availability
                                        </Label>
                                        <Select
                                            value={
                                                form.data.is_active
                                                    ? 'active'
                                                    : 'inactive'
                                            }
                                            onValueChange={(value) =>
                                                form.setData(
                                                    'is_active',
                                                    value === 'active',
                                                )
                                            }
                                        >
                                            <SelectTrigger
                                                id="service-status"
                                                className="w-full"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="active">
                                                    Active
                                                </SelectItem>
                                                <SelectItem value="inactive">
                                                    Inactive
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={form.processing}
                                    >
                                        {editing ? (
                                            <Check className="size-4" />
                                        ) : (
                                            <CirclePlus className="size-4" />
                                        )}
                                        {editing
                                            ? 'Save service changes'
                                            : 'Add service to catalog'}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    ) : null}
                </div>
            </PageContainer>
        </>
    );
}

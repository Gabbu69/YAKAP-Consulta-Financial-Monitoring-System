import { Head, useForm } from '@inertiajs/react';
import { Building2, Check, Info, ReceiptText, ShieldCheck } from 'lucide-react';
import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Textarea } from '@/components/ui/textarea';
import {
    InfoPair,
    PageContainer,
    PageHeader,
    SectionHeading,
} from '@/components/yakap/page-elements';
import { titleCase } from '@/lib/yakap';
import type { Facility } from '@/types';

type FacilityTypeOption = { name?: string; value?: string } | string;

type Props = {
    facility: Facility;
    facilityTypes?: FacilityTypeOption[];
};

function optionValue(option: FacilityTypeOption): string {
    return typeof option === 'string'
        ? option
        : (option.value ?? option.name ?? '');
}

export default function FacilitySettings({
    facility,
    facilityTypes = ['public', 'private'],
}: Props) {
    const form = useForm({
        name: facility.name ?? '',
        facility_code: facility.facility_code ?? '',
        type: facility.type ?? 'public',
        city: facility.city ?? '',
        province: facility.province ?? '',
        address: facility.address ?? '',
        contact_email: facility.contact_email ?? '',
        contact_number: facility.contact_number ?? '',
    });
    const isPrivate = form.data.type === 'private';

    return (
        <>
            <Head title="Facility Settings" />
            <PageContainer>
                <PageHeader
                    eyebrow="Administration"
                    title="Facility settings"
                    description="Maintain the single facility identity used throughout internal records and reports."
                    actions={
                        <Badge variant="outline" className="py-1.5">
                            <Building2 className="size-3.5" />
                            Single-facility workspace
                        </Badge>
                    }
                />

                <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,.5fr)]">
                    <Card>
                        <CardHeader>
                            <SectionHeading
                                title="Organization profile"
                                description="Use the facility’s official name and current contact details."
                            />
                        </CardHeader>
                        <CardContent>
                            <form
                                className="space-y-5"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    form.patch('/settings/facility', {
                                        preserveScroll: true,
                                    });
                                }}
                            >
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="grid gap-2 sm:col-span-2">
                                        <Label htmlFor="facility-name">
                                            Official facility name
                                        </Label>
                                        <Input
                                            id="facility-name"
                                            value={form.data.name}
                                            onChange={(event) =>
                                                form.setData(
                                                    'name',
                                                    event.target.value,
                                                )
                                            }
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
                                        <Label htmlFor="facility-code">
                                            Facility code
                                        </Label>
                                        <Input
                                            id="facility-code"
                                            value={form.data.facility_code}
                                            onChange={(event) =>
                                                form.setData(
                                                    'facility_code',
                                                    event.target.value.toUpperCase(),
                                                )
                                            }
                                            required
                                        />
                                        <InputError
                                            message={form.errors.facility_code}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="facility-type">
                                            Facility classification
                                        </Label>
                                        <Select
                                            value={form.data.type}
                                            onValueChange={(value) =>
                                                form.setData(
                                                    'type',
                                                    value as
                                                        'public' | 'private',
                                                )
                                            }
                                        >
                                            <SelectTrigger
                                                id="facility-type"
                                                className="w-full"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {facilityTypes.map((type) => {
                                                    const value =
                                                        optionValue(type);

                                                    return (
                                                        <SelectItem
                                                            key={value}
                                                            value={value}
                                                        >
                                                            {titleCase(value)}
                                                        </SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                        <InputError
                                            message={form.errors.type}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="facility-city">
                                            City or municipality
                                        </Label>
                                        <Input
                                            id="facility-city"
                                            value={form.data.city}
                                            onChange={(event) =>
                                                form.setData(
                                                    'city',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={form.errors.city}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="facility-province">
                                            Province
                                        </Label>
                                        <Input
                                            id="facility-province"
                                            value={form.data.province}
                                            onChange={(event) =>
                                                form.setData(
                                                    'province',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={form.errors.province}
                                        />
                                    </div>
                                    <div className="grid gap-2 sm:col-span-2">
                                        <Label htmlFor="facility-address">
                                            Complete address
                                        </Label>
                                        <Textarea
                                            id="facility-address"
                                            rows={3}
                                            value={form.data.address}
                                            onChange={(event) =>
                                                form.setData(
                                                    'address',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={form.errors.address}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="facility-email">
                                            Contact email
                                        </Label>
                                        <Input
                                            id="facility-email"
                                            type="email"
                                            value={form.data.contact_email}
                                            onChange={(event) =>
                                                form.setData(
                                                    'contact_email',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={form.errors.contact_email}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="facility-contact">
                                            Contact number
                                        </Label>
                                        <Input
                                            id="facility-contact"
                                            value={form.data.contact_number}
                                            onChange={(event) =>
                                                form.setData(
                                                    'contact_number',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={form.errors.contact_number}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end border-t pt-5">
                                    <Button
                                        type="submit"
                                        disabled={
                                            form.processing || !form.isDirty
                                        }
                                    >
                                        <Check className="size-4" />
                                        Save facility settings
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <div className="space-y-4 lg:sticky lg:top-24">
                        <Card>
                            <CardHeader>
                                <SectionHeading
                                    title="Current identity"
                                    description="Shown in report headings and contextual labels."
                                />
                            </CardHeader>
                            <CardContent>
                                <dl className="space-y-5">
                                    <InfoPair
                                        label="Official name"
                                        value={form.data.name}
                                    />
                                    <InfoPair
                                        label="Facility code"
                                        value={form.data.facility_code}
                                    />
                                    <InfoPair
                                        label="Classification"
                                        value={titleCase(form.data.type)}
                                    />
                                    <InfoPair
                                        label="Location"
                                        value={[
                                            form.data.city,
                                            form.data.province,
                                        ]
                                            .filter(Boolean)
                                            .join(', ')}
                                    />
                                </dl>
                            </CardContent>
                        </Card>

                        <Alert
                            className={
                                isPrivate
                                    ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950'
                                    : 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950'
                            }
                        >
                            {isPrivate ? (
                                <ReceiptText className="size-4" />
                            ) : (
                                <ShieldCheck className="size-4" />
                            )}
                            <AlertTitle>
                                {isPrivate
                                    ? 'Co-payment collection enabled'
                                    : 'No co-payment collection'}
                            </AlertTitle>
                            <AlertDescription>
                                {isPrivate
                                    ? 'Private-facility collection remains subject to the active policy’s member-year cap.'
                                    : 'Public facilities cannot record YAKAP Consulta co-payments.'}
                            </AlertDescription>
                        </Alert>

                        <Alert>
                            <Info className="size-4" />
                            <AlertTitle>Prototype boundary</AlertTitle>
                            <AlertDescription>
                                Facility settings do not register or certify
                                this application with PhilHealth.
                            </AlertDescription>
                        </Alert>
                    </div>
                </div>
            </PageContainer>
        </>
    );
}

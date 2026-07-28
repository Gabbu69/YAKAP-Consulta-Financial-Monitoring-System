import { Head, router } from '@inertiajs/react';
import { History, Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
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
    getRows,
} from '@/components/yakap/page-elements';
import { formatDate, titleCase } from '@/lib/yakap';
import type { AuditEvent, PaginatedOrArray } from '@/types';

type AuditRow = AuditEvent & {
    user?: { name: string; email?: string };
    auditable_type?: string | null;
    auditable_id?: number | null;
};

type Props = {
    logs?: PaginatedOrArray<AuditRow>;
    events?: string[];
    years?: number[];
    filters?: {
        search?: string;
        event?: string;
        year?: number;
    };
};

export default function AuditLogIndex({
    logs,
    events = [],
    years = [],
    filters = {},
}: Props) {
    const rows = getRows(logs);
    const [search, setSearch] = useState(filters.search ?? '');
    const [eventType, setEventType] = useState(filters.event || 'all');
    const [year, setYear] = useState(filters.year ?? new Date().getFullYear());
    const availableYears =
        years.length > 0 ? years : [new Date().getFullYear()];

    const apply = () =>
        router.get(
            '/audit-log',
            {
                search: search || undefined,
                event: eventType === 'all' ? undefined : eventType,
                year,
            },
            { preserveState: true, replace: true },
        );

    return (
        <>
            <Head title="Audit Log" />
            <PageContainer>
                <PageHeader
                    eyebrow="Insights"
                    title="Audit log"
                    description="A chronological, read-only record of sensitive, financial, and administrative activity."
                    actions={
                        <Badge variant="outline" className="py-1.5">
                            <ShieldCheck className="size-3.5" />
                            Immutable history
                        </Badge>
                    }
                />

                <Card className="gap-0 py-0">
                    <CardHeader className="border-b py-5">
                        <div className="flex flex-col gap-4">
                            <SectionHeading
                                title="Recorded activity"
                                description={`${rows.length} event${rows.length === 1 ? '' : 's'} on this page`}
                            />
                            <form
                                className="grid gap-2 md:grid-cols-[minmax(14rem,1fr)_13rem_8rem_auto]"
                                role="search"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    apply();
                                }}
                            >
                                <div className="relative">
                                    <Label
                                        htmlFor="audit-search"
                                        className="sr-only"
                                    >
                                        Search audit descriptions or users
                                    </Label>
                                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        id="audit-search"
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                        className="pl-9"
                                        placeholder="Description or user"
                                    />
                                </div>
                                <Select
                                    value={eventType}
                                    onValueChange={setEventType}
                                >
                                    <SelectTrigger
                                        className="w-full"
                                        aria-label="Filter by event type"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            All event types
                                        </SelectItem>
                                        {events.map((event) => (
                                            <SelectItem
                                                key={event}
                                                value={event}
                                            >
                                                {event}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={String(year)}
                                    onValueChange={(value) =>
                                        setYear(Number(value))
                                    }
                                >
                                    <SelectTrigger
                                        className="w-full"
                                        aria-label="Filter by year"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableYears.map((option) => (
                                            <SelectItem
                                                key={option}
                                                value={String(option)}
                                            >
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button type="submit" variant="outline">
                                    Apply filters
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
                                            <TableHead className="w-44">
                                                Date and time
                                            </TableHead>
                                            <TableHead>Event</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead>Actor</TableHead>
                                            <TableHead>Record</TableHead>
                                            <TableHead>IP address</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rows.map((log) => (
                                            <TableRow key={log.id}>
                                                <TableCell className="text-xs text-muted-foreground tabular-nums">
                                                    {formatDate(
                                                        log.created_at,
                                                        {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: 'numeric',
                                                            minute: '2-digit',
                                                        },
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">
                                                        {log.event ??
                                                            log.action ??
                                                            'event'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="max-w-lg">
                                                    {log.description ?? '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <p className="text-sm font-medium">
                                                        {log.user?.name ??
                                                            log.actor?.name ??
                                                            log.user_name ??
                                                            'System'}
                                                    </p>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {log.auditable_type
                                                        ? `${titleCase(log.auditable_type.split('\\').at(-1))} #${log.auditable_id}`
                                                        : '—'}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground">
                                                    {log.ip_address ?? '—'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                <Pagination collection={logs} />
                            </>
                        ) : (
                            <EmptyState
                                icon={History}
                                title="No matching audit events"
                                description="No activity matches the selected filters."
                            />
                        )}
                    </CardContent>
                </Card>
            </PageContainer>
        </>
    );
}

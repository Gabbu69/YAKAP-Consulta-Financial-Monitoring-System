import { Link } from '@inertiajs/react';
import { CircleAlert, Inbox, LoaderCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PaginatedOrArray, Paginator } from '@/types';

export function PageContainer({ children }: { children: ReactNode }) {
    return (
        <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
        </div>
    );
}

export function PageHeader({
    eyebrow,
    title,
    description,
    actions,
}: {
    eyebrow?: string;
    title: string;
    description?: string;
    actions?: ReactNode;
}) {
    return (
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="max-w-3xl">
                {eyebrow ? (
                    <p className="mb-2 text-[11px] font-bold tracking-[0.14em] text-primary uppercase">
                        {eyebrow}
                    </p>
                ) : null}
                <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[2rem]">
                    {title}
                </h1>
                {description ? (
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {description}
                    </p>
                ) : null}
            </div>
            {actions ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {actions}
                </div>
            ) : null}
        </div>
    );
}

export function SectionHeading({
    title,
    description,
    action,
}: {
    title: string;
    description?: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div>
                <h2 className="font-display text-base font-semibold">
                    {title}
                </h2>
                {description ? (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {description}
                    </p>
                ) : null}
            </div>
            {action}
        </div>
    );
}

export function EmptyState({
    title,
    description,
    icon: Icon = Inbox,
    action,
}: {
    title: string;
    description: string;
    icon?: LucideIcon;
    action?: ReactNode;
}) {
    return (
        <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
            <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
                <Icon className="size-5" />
            </div>
            <h3 className="font-display text-sm font-semibold">{title}</h3>
            <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">
                {description}
            </p>
            {action ? <div className="mt-4">{action}</div> : null}
        </div>
    );
}

export function ErrorState({
    title = 'Unable to load this information',
    description = 'Refresh the page or try again in a moment.',
}: {
    title?: string;
    description?: string;
}) {
    return (
        <Card className="border-destructive/25 bg-destructive/5">
            <CardContent className="flex items-start gap-3">
                <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {description}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
    return (
        <div
            className="flex min-h-36 items-center justify-center gap-2 text-sm text-muted-foreground"
            role="status"
        >
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
            {label}
        </div>
    );
}

const statusStyles: Record<string, string> = {
    draft: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200',
    submitted:
        'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200',
    approved:
        'border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-700 dark:bg-teal-950 dark:text-teal-200',
    partially_paid:
        'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200',
    paid: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200',
    posted: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200',
    returned:
        'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-200',
    cancelled:
        'border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    void: 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-200',
    active: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200',
    inactive:
        'border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

export function StatusBadge({
    status,
    className,
}: {
    status: string;
    className?: string;
}) {
    const normalized = status.toLowerCase().replaceAll(' ', '_');
    const label = normalized
        .split('_')
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join(' ');

    return (
        <Badge
            variant="outline"
            className={cn(statusStyles[normalized], className)}
        >
            {label}
        </Badge>
    );
}

export function getRows<T>(collection?: PaginatedOrArray<T> | null): T[] {
    if (!collection) {
        return [];
    }

    return Array.isArray(collection) ? collection : collection.data;
}

export function getPaginator<T>(
    collection?: PaginatedOrArray<T> | null,
): Paginator<T> | null {
    return collection && !Array.isArray(collection) ? collection : null;
}

export function Pagination<T>({
    collection,
}: {
    collection?: PaginatedOrArray<T> | null;
}) {
    const paginator = getPaginator(collection);

    if (!paginator || !paginator.links || paginator.last_page === 1) {
        return null;
    }

    return (
        <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
            <p className="text-xs text-muted-foreground">
                Showing {paginator.from ?? 0}–{paginator.to ?? 0} of{' '}
                {paginator.total ?? 0}
            </p>
            <nav className="flex flex-wrap gap-1" aria-label="Pagination">
                {paginator.links.map((link, index) => {
                    const label =
                        index === 0
                            ? 'Previous'
                            : index === paginator.links!.length - 1
                              ? 'Next'
                              : link.label.replace(/&[^;]+;/g, '');

                    return link.url ? (
                        <Button
                            asChild
                            variant={link.active ? 'default' : 'outline'}
                            size="sm"
                            key={`${label}-${index}`}
                        >
                            <Link href={link.url} preserveScroll>
                                {label}
                            </Link>
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            disabled
                            key={`${label}-${index}`}
                        >
                            {label}
                        </Button>
                    );
                })}
            </nav>
        </div>
    );
}

export function InfoPair({
    label,
    value,
    className,
}: {
    label: string;
    value: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('space-y-1', className)}>
            <dt className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                {label}
            </dt>
            <dd className="text-sm font-medium">{value || '—'}</dd>
        </div>
    );
}

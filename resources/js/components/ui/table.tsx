import * as React from 'react';
import { cn } from '@/lib/utils';

function Table({
    className,
    ...props
}: React.ComponentPropsWithoutRef<'table'>) {
    return (
        <div className="relative w-full overflow-x-auto">
            <table
                className={cn('w-full caption-bottom text-sm', className)}
                {...props}
            />
        </div>
    );
}

function TableHeader({
    className,
    ...props
}: React.ComponentPropsWithoutRef<'thead'>) {
    return (
        <thead
            className={cn('[&_tr]:border-b', className)}
            {...props}
        />
    );
}

function TableBody({
    className,
    ...props
}: React.ComponentPropsWithoutRef<'tbody'>) {
    return (
        <tbody
            className={cn('[&_tr:last-child]:border-0', className)}
            {...props}
        />
    );
}

function TableFooter({
    className,
    ...props
}: React.ComponentPropsWithoutRef<'tfoot'>) {
    return (
        <tfoot
            className={cn(
                'border-t bg-muted/50 font-medium [&>tr]:last:border-b-0',
                className,
            )}
            {...props}
        />
    );
}

function TableRow({
    className,
    ...props
}: React.ComponentPropsWithoutRef<'tr'>) {
    return (
        <tr
            className={cn(
                'border-b transition-colors hover:bg-muted/45 data-[state=selected]:bg-muted',
                className,
            )}
            {...props}
        />
    );
}

function TableHead({
    className,
    ...props
}: React.ComponentPropsWithoutRef<'th'>) {
    return (
        <th
            className={cn(
                'h-10 px-4 text-left align-middle text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase [&:has([role=checkbox])]:pr-0',
                className,
            )}
            {...props}
        />
    );
}

function TableCell({
    className,
    ...props
}: React.ComponentPropsWithoutRef<'td'>) {
    return (
        <td
            className={cn(
                'px-4 py-3.5 align-middle [&:has([role=checkbox])]:pr-0',
                className,
            )}
            {...props}
        />
    );
}

function TableCaption({
    className,
    ...props
}: React.ComponentPropsWithoutRef<'caption'>) {
    return (
        <caption
            className={cn('mt-4 text-sm text-muted-foreground', className)}
            {...props}
        />
    );
}

export {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
};

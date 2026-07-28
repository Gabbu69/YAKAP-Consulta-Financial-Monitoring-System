import type { PaginatedOrArray } from '@/types';

export const phpCurrency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export function formatMoney(centavos?: number | null): string {
    return phpCurrency.format((centavos ?? 0) / 100);
}

export function formatNumber(value?: number | null): string {
    return new Intl.NumberFormat('en-PH').format(value ?? 0);
}

export function formatPercent(
    value?: number | null,
    maximumFractionDigits = 1,
): string {
    return new Intl.NumberFormat('en-PH', {
        style: 'percent',
        maximumFractionDigits,
    }).format((value ?? 0) > 1 ? (value ?? 0) / 100 : (value ?? 0));
}

export function formatDate(
    value?: string | null,
    options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    },
): string {
    if (!value) {
        return '-';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila',
        ...options,
    }).format(date);
}

export function manilaDateInput(value: Date = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(value);
    const dateParts = new Map(parts.map((part) => [part.type, part.value]));

    return `${dateParts.get('year')}-${dateParts.get('month')}-${dateParts.get('day')}`;
}

export function collectionRows<T>(
    collection?: PaginatedOrArray<T> | null,
): T[] {
    if (!collection) {
        return [];
    }

    return Array.isArray(collection) ? collection : collection.data;
}

export function toPesoInput(centavos?: number | null): string {
    return ((centavos ?? 0) / 100).toFixed(2);
}

export function toCentavos(value: string | number): number {
    const amount = typeof value === 'number' ? value : Number(value);

    return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function titleCase(value?: string | null): string {
    if (!value) {
        return '-';
    }

    return value
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

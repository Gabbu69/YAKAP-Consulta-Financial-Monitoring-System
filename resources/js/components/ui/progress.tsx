import { cn } from '@/lib/utils';

type ProgressProps = {
    value?: number;
    max?: number;
    className?: string;
    indicatorClassName?: string;
    label?: string;
};

function Progress({
    value = 0,
    max = 100,
    className,
    indicatorClassName,
    label,
}: ProgressProps) {
    const normalized = Math.min(Math.max(value, 0), max);
    const percentage = max > 0 ? (normalized / max) * 100 : 0;

    return (
        <div
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={normalized}
            className={cn(
                'h-2.5 w-full overflow-hidden rounded-full bg-secondary',
                className,
            )}
        >
            <div
                className={cn(
                    'h-full rounded-full bg-primary transition-[width] duration-500',
                    indicatorClassName,
                )}
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
}

export { Progress };

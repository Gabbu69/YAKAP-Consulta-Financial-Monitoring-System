import AppLogoIcon from '@/components/app-logo-icon';
import { cn } from '@/lib/utils';

export default function AppLogo({ onWhite = false }: { onWhite?: boolean }) {
    return (
        <>
            <div className="flex aspect-square size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <AppLogoIcon className="size-7" />
            </div>
            <div className="grid min-w-0 flex-1 text-left">
                <span
                    className={cn(
                        'truncate font-display text-[15px] leading-tight font-bold',
                        onWhite && 'text-slate-950',
                    )}
                >
                    YAKAP Consulta
                </span>
                <span
                    className={cn(
                        'truncate text-[10px] leading-tight tracking-[0.08em] text-muted-foreground uppercase',
                        onWhite && 'text-slate-600',
                    )}
                >
                    Financial Monitoring System
                </span>
            </div>
        </>
    );
}

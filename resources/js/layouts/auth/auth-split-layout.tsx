import { Link } from '@inertiajs/react';
import {
    BadgeCheck,
    ChartNoAxesCombined,
    LockKeyhole,
    PhilippinePeso,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { AuthLayoutProps } from '@/types';

const highlights = [
    {
        icon: PhilippinePeso,
        title: 'Reconcile every peso',
        description:
            'SAP receivables, payments, costs, and variances in one view.',
    },
    {
        icon: ChartNoAxesCombined,
        title: 'See readiness clearly',
        description:
            'Track the path from selection and FPE to PCU and digital YES.',
    },
    {
        icon: LockKeyhole,
        title: 'Built for responsible access',
        description:
            'Role-based workflows with masked identifiers and audit history.',
    },
];

export default function AuthSplitLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <div className="grid min-h-svh bg-background lg:grid-cols-[1.05fr_.95fr]">
            <section className="relative hidden overflow-hidden bg-primary px-10 py-9 text-primary-foreground lg:flex lg:flex-col">
                <div className="surface-grid absolute inset-0 opacity-[0.09]" />
                <div className="absolute -top-32 -right-36 size-[30rem] rounded-full bg-white/8 blur-3xl" />
                <div className="absolute -bottom-40 -left-36 size-[28rem] rounded-full bg-[var(--coral)]/15 blur-3xl" />

                <Link
                    href="/"
                    className="relative z-10 flex w-fit items-center gap-3 rounded-xl bg-white px-3 py-2 text-foreground shadow-lg shadow-black/10"
                >
                    <AppLogo onWhite />
                </Link>

                <div className="relative z-10 my-auto max-w-xl py-16">
                    <Badge className="mb-6 border-white/20 bg-white/10 text-white">
                        <BadgeCheck className="size-3.5" />
                        Pitch-ready monitoring workspace
                    </Badge>
                    <h1 className="max-w-lg font-display text-4xl leading-[1.12] font-bold tracking-tight xl:text-5xl">
                        Clear finances make primary care stronger.
                    </h1>
                    <p className="mt-5 max-w-lg text-base leading-7 text-white/72">
                        A focused workspace for the teams keeping YAKAP Consulta
                        services funded, accounted for, and ready to deliver.
                    </p>

                    <div className="mt-10 grid gap-3">
                        {highlights.map(
                            ({ icon: Icon, title, description: copy }) => (
                                <div
                                    key={title}
                                    className="flex items-start gap-3 rounded-xl border border-white/12 bg-white/[0.065] p-4"
                                >
                                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/12">
                                        <Icon className="size-4.5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold">
                                            {title}
                                        </p>
                                        <p className="mt-0.5 text-xs leading-5 text-white/64">
                                            {copy}
                                        </p>
                                    </div>
                                </div>
                            ),
                        )}
                    </div>
                </div>

                <p className="relative z-10 text-xs text-white/55">
                    Internal monitoring prototype · Synthetic demo data only
                </p>
            </section>

            <main className="flex min-h-svh items-center justify-center px-5 py-10 sm:px-8">
                <div className="w-full max-w-md">
                    <Link
                        href="/"
                        className="mx-auto mb-8 flex w-fit items-center gap-3 rounded-xl lg:hidden"
                    >
                        <AppLogo />
                    </Link>
                    <Card className="gap-0 border-border/80 py-0 shadow-[0_20px_70px_-40px_rgba(14,61,58,.45)]">
                        <CardContent className="p-6 sm:p-8">
                            <div className="mb-7">
                                <p className="mb-2 text-[11px] font-bold tracking-[0.14em] text-primary uppercase">
                                    Secure workspace
                                </p>
                                <h2 className="font-display text-2xl font-bold">
                                    {title}
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    {description}
                                </p>
                            </div>
                            {children}
                        </CardContent>
                    </Card>
                    <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
                        This is an internal monitoring tool and does not submit
                        claims to PhilHealth.
                    </p>
                </div>
            </main>
        </div>
    );
}

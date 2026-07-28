import { Link, usePage } from '@inertiajs/react';
import {
    Activity,
    BookOpenCheck,
    Building2,
    ChevronDown,
    ClipboardList,
    CreditCard,
    FileBarChart,
    FlaskConical,
    History,
    LayoutDashboard,
    Menu,
    Moon,
    PhilippinePeso,
    ReceiptText,
    Sun,
    Users,
    UsersRound,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { UserMenuContent } from '@/components/user-menu-content';
import { useAppearance } from '@/hooks/use-appearance';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem, NavItem } from '@/types';

type Props = {
    breadcrumbs?: BreadcrumbItem[];
};

type NavGroup = {
    label: string;
    items: NavItem[];
};

const navGroups: NavGroup[] = [
    {
        label: 'Care operations',
        items: [
            {
                title: 'Beneficiaries',
                href: '/beneficiaries',
                icon: UsersRound,
            },
            {
                title: 'Service encounters',
                href: '/encounters',
                icon: Activity,
            },
            { title: 'Service catalog', href: '/catalog', icon: FlaskConical },
        ],
    },
    {
        label: 'Finance',
        items: [
            {
                title: 'SAP batches',
                href: '/finance/sap-batches',
                icon: ClipboardList,
            },
            {
                title: 'Payments',
                href: '/finance/payments',
                icon: CreditCard,
            },
            {
                title: 'Co-payments',
                href: '/finance/copayments',
                icon: ReceiptText,
            },
        ],
    },
    {
        label: 'Insights',
        items: [
            { title: 'Reports', href: '/reports', icon: FileBarChart },
            { title: 'Audit log', href: '/audit-log', icon: History },
        ],
    },
    {
        label: 'Administration',
        items: [
            { title: 'Users', href: '/users', icon: Users },
            {
                title: 'Facility settings',
                href: '/settings/facility',
                icon: Building2,
            },
            {
                title: 'Policy settings',
                href: '/settings/policies',
                icon: BookOpenCheck,
            },
        ],
    },
];

function matchesPath(current: string, href: string): boolean {
    return href === '/dashboard'
        ? current === '/dashboard'
        : current === href || current.startsWith(`${href}/`);
}

function DesktopNavGroup({
    group,
    currentPath,
}: {
    group: NavGroup;
    currentPath: string;
}) {
    const active = group.items.some((item) =>
        matchesPath(currentPath, String(item.href)),
    );

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        'gap-1.5 rounded-lg text-muted-foreground',
                        active && 'bg-accent text-accent-foreground',
                    )}
                >
                    {group.label}
                    <ChevronDown className="size-3.5 opacity-60" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-xs tracking-wide text-muted-foreground uppercase">
                    {group.label}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {group.items.map((item) => {
                    const Icon = item.icon;

                    return (
                        <DropdownMenuItem key={item.title} asChild>
                            <Link
                                href={item.href}
                                className={cn(
                                    'flex cursor-pointer gap-2.5',
                                    matchesPath(
                                        currentPath,
                                        String(item.href),
                                    ) && 'font-medium text-primary',
                                )}
                            >
                                {Icon ? <Icon className="size-4" /> : null}
                                {item.title}
                            </Link>
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function AppHeader({ breadcrumbs = [] }: Props) {
    const page = usePage();
    const { auth } = page.props;
    const { resolvedAppearance, updateAppearance } = useAppearance();
    const getInitials = useInitials();
    const currentPath = page.url.split('?')[0];
    const role = auth.user?.role;
    const visibleNavGroups = navGroups
        .filter(
            (group) =>
                group.label !== 'Administration' || role === 'administrator',
        )
        .map((group) =>
            group.label === 'Insights'
                ? {
                      ...group,
                      items: group.items.filter(
                          (item) =>
                              item.title !== 'Audit log' ||
                              role === 'administrator' ||
                              role === 'auditor',
                      ),
                  }
                : group,
        );

    return (
        <>
            <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
                <div className="mx-auto flex h-[4.5rem] max-w-[96rem] items-center gap-3 px-4 sm:px-6 lg:px-8">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="lg:hidden"
                                aria-label="Open navigation menu"
                            >
                                <Menu className="size-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent
                            side="left"
                            className="flex w-[min(22rem,88vw)] flex-col p-0"
                        >
                            <SheetHeader className="border-b p-5 text-left">
                                <SheetTitle>
                                    <Link
                                        href="/dashboard"
                                        className="flex items-center gap-3"
                                    >
                                        <AppLogo />
                                    </Link>
                                </SheetTitle>
                            </SheetHeader>
                            <nav
                                aria-label="Primary navigation"
                                className="flex-1 space-y-5 overflow-y-auto p-5"
                            >
                                <SheetClose asChild>
                                    <Link
                                        href="/dashboard"
                                        className={cn(
                                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                                            matchesPath(
                                                currentPath,
                                                '/dashboard',
                                            )
                                                ? 'bg-primary text-primary-foreground'
                                                : 'hover:bg-accent',
                                        )}
                                    >
                                        <LayoutDashboard className="size-4" />
                                        Dashboard
                                    </Link>
                                </SheetClose>
                                {visibleNavGroups.map((group) => (
                                    <div key={group.label}>
                                        <p className="mb-2 px-3 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                                            {group.label}
                                        </p>
                                        <div className="space-y-1">
                                            {group.items.map((item) => {
                                                const Icon = item.icon;

                                                return (
                                                    <SheetClose
                                                        asChild
                                                        key={item.title}
                                                    >
                                                        <Link
                                                            href={item.href}
                                                            className={cn(
                                                                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm',
                                                                matchesPath(
                                                                    currentPath,
                                                                    String(
                                                                        item.href,
                                                                    ),
                                                                )
                                                                    ? 'bg-accent font-medium text-accent-foreground'
                                                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                                            )}
                                                        >
                                                            {Icon ? (
                                                                <Icon className="size-4" />
                                                            ) : null}
                                                            {item.title}
                                                        </Link>
                                                    </SheetClose>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </nav>
                            <div className="border-t p-5">
                                <Badge
                                    variant="outline"
                                    className="text-coral w-full justify-center border-[color-mix(in_oklab,var(--coral)_35%,var(--border))] py-1.5"
                                >
                                    <PhilippinePeso className="size-3.5" />
                                    Synthetic demo data
                                </Badge>
                            </div>
                        </SheetContent>
                    </Sheet>

                    <Link
                        href="/dashboard"
                        className="flex min-w-0 items-center gap-2.5 focus-visible:rounded-xl"
                    >
                        <AppLogo />
                    </Link>

                    <Separator
                        orientation="vertical"
                        className="mx-2 hidden h-7 lg:block"
                    />

                    <nav
                        aria-label="Primary navigation"
                        className="hidden items-center gap-1 lg:flex"
                    >
                        <Button
                            asChild
                            variant={
                                matchesPath(currentPath, '/dashboard')
                                    ? 'secondary'
                                    : 'ghost'
                            }
                            size="sm"
                        >
                            <Link href="/dashboard">
                                <LayoutDashboard className="size-4" />
                                Dashboard
                            </Link>
                        </Button>
                        {visibleNavGroups.map((group) => (
                            <DesktopNavGroup
                                key={group.label}
                                group={group}
                                currentPath={currentPath}
                            />
                        ))}
                    </nav>

                    <div className="ml-auto flex items-center gap-1.5">
                        <Badge
                            variant="outline"
                            className="text-coral hidden border-[color-mix(in_oklab,var(--coral)_35%,var(--border))] xl:inline-flex"
                        >
                            <PhilippinePeso className="size-3.5" />
                            Synthetic demo data
                        </Badge>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Switch to ${resolvedAppearance === 'dark' ? 'light' : 'dark'} theme`}
                            onClick={() =>
                                updateAppearance(
                                    resolvedAppearance === 'dark'
                                        ? 'light'
                                        : 'dark',
                                )
                            }
                        >
                            {resolvedAppearance === 'dark' ? (
                                <Sun className="size-4.5" />
                            ) : (
                                <Moon className="size-4.5" />
                            )}
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="size-10 rounded-full p-1"
                                    aria-label="Open account menu"
                                >
                                    <Avatar className="size-8">
                                        <AvatarImage
                                            src={auth.user?.avatar}
                                            alt=""
                                        />
                                        <AvatarFallback className="bg-primary/12 text-xs font-semibold text-primary">
                                            {getInitials(
                                                auth.user?.name ?? 'User',
                                            )}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-60" align="end">
                                {auth.user ? (
                                    <UserMenuContent user={auth.user} />
                                ) : null}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>
            {breadcrumbs.length > 1 ? (
                <div className="border-b bg-card/55">
                    <div className="mx-auto flex h-10 max-w-[96rem] items-center px-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
                        {breadcrumbs.map((item, index) => (
                            <span
                                key={item.title}
                                className="flex items-center"
                            >
                                {index > 0 ? (
                                    <span className="mx-2 opacity-45">/</span>
                                ) : null}
                                {index === breadcrumbs.length - 1 ? (
                                    <span className="text-foreground">
                                        {item.title}
                                    </span>
                                ) : (
                                    <Link
                                        href={item.href}
                                        className="hover:text-foreground"
                                    >
                                        {item.title}
                                    </Link>
                                )}
                            </span>
                        ))}
                    </div>
                </div>
            ) : null}
        </>
    );
}

import { Head, router, useForm } from '@inertiajs/react';
import {
    Check,
    CirclePlus,
    Pencil,
    RotateCcw,
    Search,
    Shield,
    UserRoundCog,
} from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { useInitials } from '@/hooks/use-initials';
import { formatDate, titleCase } from '@/lib/yakap';
import type { PaginatedOrArray, User } from '@/types';

type RoleOption = { name?: string; value?: string } | string;

type Props = {
    users?: PaginatedOrArray<User>;
    roles?: RoleOption[];
    filters?: { search?: string };
};

type UserForm = {
    name: string;
    email: string;
    role: string;
    password: string;
    password_confirmation: string;
    is_active: boolean;
};

function roleValue(role: RoleOption): string {
    return typeof role === 'string' ? role : (role.value ?? role.name ?? '');
}

export default function UsersIndex({
    users,
    roles = ['administrator', 'encoder', 'finance_officer', 'auditor'],
    filters = {},
}: Props) {
    const rows = getRows(users);
    const initials = useInitials();
    const [editing, setEditing] = useState<User | null>(null);
    const [search, setSearch] = useState(filters.search ?? '');
    const form = useForm<UserForm>({
        name: '',
        email: '',
        role: 'encoder',
        password: '',
        password_confirmation: '',
        is_active: true,
    });

    const clear = () => {
        setEditing(null);
        form.reset();
        form.clearErrors();
    };

    const edit = (user: User) => {
        setEditing(user);
        form.setData({
            name: user.name,
            email: user.email,
            role: user.role ?? 'encoder',
            password: '',
            password_confirmation: '',
            is_active: user.is_active ?? true,
        });
        form.clearErrors();
    };

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: clear };

        if (editing) {
            form.patch(`/users/${editing.id}`, options);
        } else {
            form.post('/users', options);
        }
    };

    return (
        <>
            <Head title="Users" />
            <PageContainer>
                <PageHeader
                    eyebrow="Administration"
                    title="Users and access"
                    description="Issue internal accounts and keep each person within the role needed for their work."
                    actions={
                        editing ? (
                            <Button variant="outline" onClick={clear}>
                                <RotateCcw className="size-4" />
                                Add new instead
                            </Button>
                        ) : (
                            <Badge variant="outline" className="py-1.5">
                                <Shield className="size-3.5" />
                                Role-based access
                            </Badge>
                        )
                    }
                />

                <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,.55fr)]">
                    <Card className="gap-0 py-0">
                        <CardHeader className="border-b py-5">
                            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                                <SectionHeading
                                    title="Workspace accounts"
                                    description={`${rows.length} account${rows.length === 1 ? '' : 's'} on this page`}
                                />
                                <form
                                    role="search"
                                    className="flex gap-2"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        router.get(
                                            '/users',
                                            { search: search || undefined },
                                            {
                                                preserveState: true,
                                                replace: true,
                                            },
                                        );
                                    }}
                                >
                                    <div className="relative">
                                        <Label
                                            htmlFor="user-search"
                                            className="sr-only"
                                        >
                                            Search users
                                        </Label>
                                        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            id="user-search"
                                            value={search}
                                            onChange={(event) =>
                                                setSearch(event.target.value)
                                            }
                                            className="w-full pl-9 sm:w-60"
                                            placeholder="Name or email"
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        variant="outline"
                                        size="icon"
                                        aria-label="Search users"
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
                                                <TableHead>User</TableHead>
                                                <TableHead>Role</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Added</TableHead>
                                                <TableHead className="w-12">
                                                    <span className="sr-only">
                                                        Edit
                                                    </span>
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {rows.map((user) => (
                                                <TableRow key={user.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="size-8">
                                                                <AvatarFallback className="bg-secondary text-xs font-semibold text-primary">
                                                                    {initials(
                                                                        user.name,
                                                                    )}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <p className="font-medium">
                                                                    {user.name}
                                                                </p>
                                                                <p className="mt-0.5 text-xs text-muted-foreground">
                                                                    {user.email}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary">
                                                            {titleCase(
                                                                user.role,
                                                            )}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <StatusBadge
                                                            status={
                                                                (user.is_active ??
                                                                true)
                                                                    ? 'active'
                                                                    : 'inactive'
                                                            }
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">
                                                        {formatDate(
                                                            user.created_at,
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() =>
                                                                edit(user)
                                                            }
                                                            aria-label={`Edit ${user.name}`}
                                                        >
                                                            <Pencil className="size-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <Pagination collection={users} />
                                </>
                            ) : (
                                <EmptyState
                                    icon={UserRoundCog}
                                    title="No users found"
                                    description="Add an account or change your search terms."
                                />
                            )}
                        </CardContent>
                    </Card>

                    <Card className="xl:sticky xl:top-24">
                        <CardHeader>
                            <SectionHeading
                                title={
                                    editing
                                        ? `Edit ${editing.name}`
                                        : 'Add a user'
                                }
                                description={
                                    editing
                                        ? 'Leave the password blank to keep the current credential.'
                                        : 'Public registration is disabled; administrators issue every account.'
                                }
                            />
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submit} className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="user-name">
                                        Complete name
                                    </Label>
                                    <Input
                                        id="user-name"
                                        value={form.data.name}
                                        onChange={(event) =>
                                            form.setData(
                                                'name',
                                                event.target.value,
                                            )
                                        }
                                        autoComplete="name"
                                        required
                                    />
                                    <InputError message={form.errors.name} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="user-email">
                                        Email address
                                    </Label>
                                    <Input
                                        id="user-email"
                                        type="email"
                                        value={form.data.email}
                                        onChange={(event) =>
                                            form.setData(
                                                'email',
                                                event.target.value,
                                            )
                                        }
                                        autoComplete="email"
                                        required
                                    />
                                    <InputError message={form.errors.email} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="user-role">Role</Label>
                                    <Select
                                        value={form.data.role}
                                        onValueChange={(value) =>
                                            form.setData('role', value)
                                        }
                                    >
                                        <SelectTrigger
                                            id="user-role"
                                            className="w-full"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roles.map((role) => {
                                                const value = roleValue(role);

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
                                    <InputError message={form.errors.role} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="user-status">
                                        Account status
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
                                            id="user-status"
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
                                    <InputError
                                        message={form.errors.is_active}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="user-password">
                                        {editing
                                            ? 'New password (optional)'
                                            : 'Temporary password'}
                                    </Label>
                                    <Input
                                        id="user-password"
                                        type="password"
                                        value={form.data.password}
                                        onChange={(event) =>
                                            form.setData(
                                                'password',
                                                event.target.value,
                                            )
                                        }
                                        autoComplete="new-password"
                                        required={!editing}
                                    />
                                    <InputError
                                        message={form.errors.password}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="user-password-confirmation">
                                        Confirm password
                                    </Label>
                                    <Input
                                        id="user-password-confirmation"
                                        type="password"
                                        value={form.data.password_confirmation}
                                        onChange={(event) =>
                                            form.setData(
                                                'password_confirmation',
                                                event.target.value,
                                            )
                                        }
                                        autoComplete="new-password"
                                        required={
                                            !editing ||
                                            form.data.password.length > 0
                                        }
                                    />
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
                                        ? 'Save user changes'
                                        : 'Create user account'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </PageContainer>
        </>
    );
}

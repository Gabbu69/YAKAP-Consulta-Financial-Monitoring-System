<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Http\Requests\UserRequest;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim((string) $request->string('search'));

        return Inertia::render('users/index', [
            'users' => User::query()
                ->when($search, fn ($query) => $query->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%");
                }))->orderBy('name')->paginate(20)->withQueryString(),
            'roles' => UserRole::cases(),
            'filters' => ['search' => $search],
        ]);
    }

    public function store(UserRequest $request, AuditLogger $audit): RedirectResponse
    {
        $data = $request->validated();
        $user = User::create([
            ...$data,
            'email_verified_at' => now(),
        ]);
        $audit->log('user.created', "Created user {$user->email}", $user, request: $request);

        return back()->with('success', 'User created.');
    }

    public function update(UserRequest $request, User $user, AuditLogger $audit): RedirectResponse
    {
        $data = $request->validated();
        if ($request->user()->is($user) && ! $data['is_active']) {
            throw ValidationException::withMessages(['is_active' => 'You cannot deactivate your own account.']);
        }
        if (blank($data['password'] ?? null)) {
            unset($data['password']);
        }
        $old = $user->toArray();
        $user->update($data);
        $audit->log('user.updated', "Updated user {$user->email}", $user, $old, $user->fresh()->toArray(), $request);

        return back()->with('success', 'User updated.');
    }
}

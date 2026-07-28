<?php

use App\Enums\UserRole;
use Tests\Support\YakapFixtures;

it('requires authentication for the monitoring workspace', function () {
    $this->get('/dashboard')->assertRedirect('/login');
});

it('keeps public self-registration disabled', function () {
    $this->get('/register')->assertNotFound();
    $this->post('/register', [
        'name' => 'Uninvited User',
        'email' => 'uninvited@example.test',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertNotFound();
});

it('allows only administrators to manage users and facility policy settings', function () {
    $this->withoutVite();
    YakapFixtures::facility();
    $administrator = YakapFixtures::user(UserRole::Administrator);
    $encoder = YakapFixtures::user(UserRole::Encoder);

    $this->actingAs($administrator)->get(route('users.index'))->assertOk();
    $this->actingAs($administrator)->get(route('facility.edit'))->assertOk();
    $this->actingAs($administrator)->get(route('policies.index'))->assertOk();

    $this->actingAs($encoder)->get(route('users.index'))->assertForbidden();
    $this->actingAs($encoder)->get(route('facility.edit'))->assertForbidden();
    $this->actingAs($encoder)->get(route('policies.index'))->assertForbidden();
});

it('separates encoder and finance mutations', function () {
    $facility = YakapFixtures::facility();
    $policy = YakapFixtures::policy($facility);
    $encoder = YakapFixtures::user(UserRole::Encoder);
    $finance = YakapFixtures::user(UserRole::FinanceOfficer);
    $auditor = YakapFixtures::user(UserRole::Auditor);

    $this->actingAs($finance)->post(route('beneficiaries.store'), [])->assertForbidden();
    $this->actingAs($encoder)->post(route('finance.sap-batches.store'), [
        'policy_version_id' => $policy->id,
        'tranche' => 1,
        'year' => 2026,
        'month' => 1,
    ])->assertForbidden();
    $this->actingAs($auditor)->post(route('finance.sap-batches.store'), [])->assertForbidden();
});

it('restricts audit history to administrators and read-only auditors', function () {
    $this->withoutVite();
    YakapFixtures::facility();
    $administrator = YakapFixtures::user(UserRole::Administrator);
    $auditor = YakapFixtures::user(UserRole::Auditor);
    $finance = YakapFixtures::user(UserRole::FinanceOfficer);

    $this->actingAs($administrator)->get(route('audit-log.index'))->assertOk();
    $this->actingAs($auditor)->get(route('audit-log.index'))->assertOk();
    $this->actingAs($finance)->get(route('audit-log.index'))->assertForbidden();
});

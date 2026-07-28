import { execSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

test('login through beneficiary, encounter, SAP, payment, and report export', async ({
    page,
    isMobile,
}, testInfo) => {
    test.skip(
        Boolean(isMobile),
        'The full mutation flow runs once on desktop; responsive layouts are checked separately.',
    );

    execSync('php artisan migrate:fresh --seed --force', {
        cwd: process.cwd(),
        stdio: 'pipe',
    });

    await page.goto('/login');
    await page.getByLabel('Email address').fill('admin@yakap.test');
    await page.locator('#password').fill('password');
    await page.getByRole('button', { name: 'Sign in to workspace' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
        page.getByRole('heading', { name: 'Financial pulse' }),
    ).toBeVisible();

    await page.goto('/beneficiaries/create');
    await page.getByLabel('PhilHealth PIN').fill('900000000001');
    await page.getByLabel('First name').fill('Browser');
    await page.getByLabel('Last name').fill('Flow');
    await page.locator('#birth_date').fill('1990-06-15');
    await page.getByRole('combobox', { name: 'Sex' }).click();
    await page.getByRole('option', { name: 'Male', exact: true }).click();
    await page.getByLabel('Selected / empanelled').check();
    await page.locator('#selected_at').fill('2026-01-15');
    await page.getByLabel('FPE completed').check();
    await page.locator('#fpe_completed_at').fill('2026-01-20');
    await page.getByLabel('PCU reference').fill('PCU-E2E-2026-001');
    await page.getByLabel('Digital YES confirmed').check();
    await page.locator('#yes_confirmed_at').fill('2026-01-21');
    await page.getByRole('button', { name: 'Add beneficiary' }).click();
    await expect(page).toHaveURL(/\/beneficiaries\/\d+$/);
    await expect(page.getByText('********0001')).toBeVisible();

    const beneficiaryId = page.url().split('/').at(-1);
    await page.goto(`/encounters/create?beneficiary_id=${beneficiaryId}`);
    await expect(
        page.getByRole('combobox', { name: 'Beneficiary' }),
    ).toContainText('Browser Flow');
    await page.locator('#service-line-1-service').click();
    await page
        .getByRole('option')
        .filter({ hasText: 'First patient encounter' })
        .click();
    await page.getByRole('button', { name: 'Save & post' }).click();
    await expect(page).toHaveURL(/\/encounters\/\d+$/);
    await expect(
        page.getByText('Posted', { exact: true }).first(),
    ).toBeVisible();

    await page.goto('/finance/sap-batches');
    await page.locator('#batch-tranche').click();
    await page
        .getByRole('option', { name: /SAP2.*annual performance close/i })
        .click();
    await expect(
        page.getByRole('button', { name: 'Not yet available' }),
    ).toBeDisabled();
    await expect(
        page.getByText(/SAP2 for 2026 becomes available on January 8, 2027/i),
    ).toBeVisible();
    await page.locator('#batch-tranche').click();
    await page.getByRole('option', { name: /SAP1.*initial 40%/i }).click();
    await page.getByRole('button', { name: 'Generate draft batch' }).click();
    await expect(page).toHaveURL(/\/finance\/sap-batches\/\d+$/);
    await expect(
        page.getByRole('cell', { name: /Browser Flow/ }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Update batch status' }).click();
    await expect(page.getByText('Current status: submitted')).toBeVisible();
    await expect(page.getByLabel('Approved gross amount (PHP)')).toHaveValue(
        /\d+/,
    );
    await page.getByRole('button', { name: 'Update batch status' }).click();
    await expect(page.getByText('Current status: approved')).toBeVisible();

    await page.getByRole('link', { name: 'Record payment' }).click();
    await page.getByLabel('Amount received (PHP)').fill('500');
    await page
        .getByLabel('External reference')
        .fill(`E2E-${testInfo.project.name}-2026`);
    await page.getByRole('button', { name: 'Record payment' }).click();
    await expect(page.getByText('₱500.00', { exact: true })).toBeVisible();

    await page.goto('/reports');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: 'CSV' }).first().click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(
        'yakap-financial-summary-2026.csv',
    );
});

test('key registers stay within mobile, tablet, and desktop viewports', async ({
    page,
    isMobile,
}) => {
    test.skip(
        Boolean(isMobile),
        'One Chrome session checks all three explicit viewport widths.',
    );

    execSync('php artisan migrate:fresh --seed --force', {
        cwd: process.cwd(),
        stdio: 'pipe',
    });

    await page.goto('/login');
    await page.getByLabel('Email address').fill('admin@yakap.test');
    await page.locator('#password').fill('password');
    await page.getByRole('button', { name: 'Sign in to workspace' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const routes = [
        '/beneficiaries',
        '/encounters',
        '/finance/sap-batches',
        '/finance/payments',
        '/finance/copayments',
    ];

    for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });

        for (const route of routes) {
            await page.goto(route);
            await page.waitForLoadState('networkidle');
            await expect
                .poll(
                    () =>
                        page.evaluate(
                            () =>
                                document.documentElement.scrollWidth <=
                                document.documentElement.clientWidth,
                        ),
                    {
                        message: `${route} should not overflow the ${width}px viewport`,
                    },
                )
                .toBe(true);
        }
    }
});

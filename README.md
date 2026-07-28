# YAKAP Consulta Financial Monitoring System

A standalone, pitch-ready internal monitoring and reconciliation application for YAKAP primary-care finances. It tracks beneficiary readiness, service utilization and cost, SAP1/SAP2 receivables, payments, co-payments, variances, reports, and audit history.

This is a monitoring prototype. It is **not** a certified EMR, HCI Portal, PCU, XML, eClaims client, or proof of PhilHealth accreditation, and it does not submit data to PhilHealth.

## Technology

- Laravel 13, PHP 8.3+, SQLite, Pest, and DomPDF
- React 19, TypeScript, Inertia 3, Tailwind CSS 4, and shadcn/ui
- Recharts, Vitest, Testing Library, and Playwright

## Local setup

```bash
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate:fresh --seed
npm install
npm run build
composer run dev
```

Open `http://127.0.0.1:8000`. The synthetic demo accounts all use the password `password`:

| Role | Email |
| --- | --- |
| Administrator | `admin@yakap.test` |
| Encoder | `encoder@yakap.test` |
| Finance officer | `finance@yakap.test` |
| Read-only auditor | `auditor@yakap.test` |

The seeded names, member identifiers, transactions, and financial data are fictional and are visibly marked as demo data in the application.

## Quality checks

```bash
composer test
npm run lint:check
npm run format:check
npm run types:check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

To run against an already-installed Google Chrome instead, set
`PLAYWRIGHT_CHANNEL=chrome` before `npm run test:e2e`.

## Policy model

Policy values are stored as immutable, year-effective records rather than patient wallets or hard-coded perpetual rules. The demo policy starts with:

- ₱1,700 annual per-capita rate
- 40% SAP1 and 60% maximum SAP2 allocation
- source-backed SAP2 targets and weights: consultation (100%/30%), laboratory (50%/30%), antibiotics (15%/10%), and NCD medicines (20%/30%)
- one monthly SAP1 snapshot and one December annual-close SAP2 snapshot per benefit year
- ₱900 member-year co-payment cap for private facilities; entry requires an active, selected member with completed FPE and remains disabled for public facilities

Reference material:

- [Approved Benefit Payment Mechanism](https://www.philhealth.gov.ph/circulars/2024/0013/Annex_I_Approved_Benefit_Payment.pdf)
- [2026 digital YES requirements](https://www.philhealth.gov.ph/advisories/2026/PA2026-0029.pdf)
- [Co-payment guidance](https://www.philhealth.gov.ph/advisories/2025/PA2025-0057.pdf)

## Data boundaries

The application stores only the minimum beneficiary and financial-monitoring data needed for the prototype. PhilHealth PIN values are encrypted at rest and paired with a one-way uniqueness hash; the interface shows masked identifiers. Financial records are voided rather than hard-deleted, and important changes are captured in the audit log. Dashboard and report year filters use the YAKAP benefit/program year, and receipts (including succeeding-year receipts) reconcile to the originating SAP reporting month; this is not a cash-basis general ledger. Biometric images and detailed clinical notes are intentionally excluded.

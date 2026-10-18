# Verification record

Verified locally on **18 October 2026 (Asia/Bangkok)**. Application calendar dates use Asia/Jakarta.

## Environment

- Node.js 24.15.0; Next.js 16.4.2; React 19.3.1; Prisma 6.19.3.
- Real PostgreSQL 17, running in a dedicated local test instance on loopback.
- Windows; installed Google Chrome; desktop 1280 × 720 and emulated iPhone viewport 390 × 844.
- Source deliverable is in this project directory. Dependencies, test database and runtime verification used a copy on D: because C: had insufficient space. No runtime credentials are included in the source archive.

## Results actually obtained

| Check | Result |
|---|---|
| Prisma client generation | Passed |
| Initial PostgreSQL migration deployment | Passed |
| Development demo seed | Passed; two isolated demo accounts and household records |
| Vitest unit/integration suite | **17 passed, 0 failed**, across 8 files |
| Real PostgreSQL privacy/financial tests | **4 passed**, included in the 17 tests |
| Strict TypeScript check | Passed |
| ESLint | Passed, **0 errors and 2 advisories** |
| Production build, webpack | Passed, including all static pages and route collection |
| Production server startup | Passed; HTTP 200 |
| Playwright against production server | **4 passed, 0 failed** in the final complete run |
| HTTP authentication/financial workflow | Passed |
| Desktop/mobile visual review | Passed; saved production screenshots |
| Mobile document width | **390 px at a 390 px viewport**, no overflow |

The two lint advisories concern a deliberate full document navigation after authentication and TanStack Table's compatibility with automatic React Compiler memoization. React Compiler is not enabled. Table input data is explicitly memoized.

## Financial/privacy coverage

- Exact rupiah validation, large-integer totals, budget percentages and split remainders.
- Transfers and contributions do not create additional income.
- Private wallets remain private inside a household and across different households.
- A different user cannot change another creator's posting or use an unauthorized wallet.
- A concurrent duplicate transfer request creates exactly one posting.
- Retrying an old request after editing/deleting does not repost the original transfer.
- Balances remain correct after edits and deletion.
- Missing transfer destination/payment wallet IDs are rejected, rather than selecting an arbitrary wallet.
- Goal allocation retries are deduplicated; withdrawals cannot exceed allocations; allocations do not change wallet balances.
- Duplicate bill payments roll back atomically and cannot debit the wallet twice.
- Future-month expenses do not produce current-month budget warnings.
- Jakarta ledger dates are correct across UTC month/year boundaries.
- Password validation rejects inputs that bcrypt would truncate, including multibyte strings.
- Invitation callback validation rejects external redirects.

## Browser workflows

Both desktop and mobile production scenarios covered registration, login, onboarding, wallet creation, income, expense, dashboard balance, household creation, invitation creation, authentication while following an invitation, acceptance, shared wallet/expense creation, private-data isolation, category filtering, goal creation/allocation, budget creation, CSV/PDF download and logout. The PDF download was checked for a valid `%PDF` file signature.

The public scenarios covered landing-to-demo navigation, layout width, manifest icons, an empty Cache Storage, and the offline notice. Desktop checks also covered collapsed navigation labels. Screenshots use explicitly labeled illustrative demo data, never another user's private finances.

## HTTP workflow

The standalone smoke test exercised actual HTTP route handlers with separate cookie jars: registration, Auth.js CSRF exchange and login, authenticated sessions, private/shared authorization, invitations, wallet/transaction persistence, duplicate-safe contribution, goal funding and withdrawal limits, budgets, duplicate-safe bill payment, persisted contribution plans, authorized CSV/PDF generation, logout and rejection of subsequent protected requests.

## Verification limits

- External SMTP delivery and a live Vercel/managed-PostgreSQL deployment were not run; credentials and production configuration are required.
- Mobile tests used Chromium device emulation, not a physical iPhone or Safari.
- PWA manifest/offline behavior was tested; operating-system installation UI was not automated.
- This is automated and functional verification, not an independent security audit or a load test.
- Remaining feature limitations are listed accurately in README.md.

## Reproduce

Follow README.md to install dependencies, configure `.env` and migrate a **disposable test database**. Run:

```powershell
npm run lint
npm run typecheck
$env:TEST_DATABASE_URL = '<your disposable, migrated PostgreSQL URL>'
npm test
npm run build
npm start
```

In another terminal, with the production server running:

```powershell
$env:E2E_DATABASE = '1'
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:e2e
$env:RUN_HTTP_SMOKE = '1'
node tests/http.smoke.mjs
```

During this Windows run, `NEXT_BUILD_DIR=.next-final-validated` was set consistently for build/start. The supplied preparation script avoids the transient directory-creation errors encountered in the restricted Windows environment.

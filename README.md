# DuaDompet

**Dua Dompet, Satu Tujuan.** Indonesian personal and household finance recordkeeping, built with Next.js App Router, TypeScript, PostgreSQL, Prisma and Auth.js/NextAuth.

This application records manually entered finances. Balances are not verified bank balances. It does not initiate bank transfers. Do not describe the project as audited or certified.

## Start locally

Use Node.js 24 (24.15.0 tested), npm, and PostgreSQL 17. Docker is optional. Allow at least 2 GB free for dependencies and build output; use a short project path on Windows.

```powershell
npm ci
Copy-Item .env.example .env
# Edit .env: DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET
docker compose up -d
npm run db:generate
npm run db:migrate
npm run dev
```

Open http://127.0.0.1:3000. Register a new account; no demo data is inserted into real accounts. After login, create your first wallet through onboarding. The public `/demo` dashboard is read-only and clearly uses illustrations. Keep `NEXTAUTH_URL` identical to the origin you open; the test configurations use this loopback address too.

Generate each secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Never reuse development secrets in production.

## Features

- Registration, credentials login, logout, hashed passwords, session version invalidation, profile and password changes.
- Forgot/reset password with hashed, expiring, single-use tokens. SMTP integration; without SMTP, development prints a reset link to the local server console only. Production never prints tokens.
- Personal and shared wallets with opening balances, calculated balances, renaming and archiving.
- Income, expenses, paired transfers, contributions and positive adjustments. Transaction editing and confirmed deletion recalculate balances through ledger entries.
- Transaction search, date/wallet/category/creator filtering, sorting, pagination and CSV export.
- Household creation, two-adult membership, email-bound invite links, acceptance/rejection, expiry checks and revocation.
- Private-wallet isolation even within the same household. Shared transfer responses omit the other private wallet's details.
- Default Indonesian categories and custom scoped categories.
- Dashboard summaries, cash-flow chart, category chart, budget warnings and savings allocation progress.
- Monthly category budgets; personal/shared goals with allocation and withdrawal history.
- Recurring bill definitions and explicitly confirmed payments, deduplicated per bill/period. No automatic paid transactions.
- Persisted equal, percentage, fixed and declared-income contribution plans. Actual contribution transfers are shown separately and excluded from income totals.
- Authorized CSV and PDF reports, persisted notifications, preferences and a secret-protected daily reminder endpoint.
- Responsive sidebar and mobile navigation, accessible Radix dialogs, keyboard controls, dark theme, loading/empty/error states, PWA manifest and network-only offline fallback.

## Structure

```text
src/app/                 Next.js routes, public/auth pages and API handlers
src/components/          Interface, financial workspace, charts, UI primitives
src/lib/auth.ts          Auth.js credentials + database-backed user validation
src/lib/security.ts      Origin checks, hashed tokens, DB-backed rate limits
src/lib/service.ts       Authorization and transactional application services
src/lib/finance.ts       BigInt currency, totals, allocation arithmetic
src/lib/validation.ts    Password limits, including UTF-8 length protection
src/lib/dates.ts         Jakarta calendar dates for ledger records
src/lib/insights.ts      Rule-based insight provider abstraction
scripts/prepare-build.mjs Windows build directory preparation
prisma/schema.prisma     PostgreSQL schema
prisma/migrations/       Deployable initial migration
tests/                   Finance and real-PostgreSQL privacy tests
e2e/                     Playwright browser workflows
public/                  Manifest, icons and privacy-preserving service worker
```

## Financial and authorization model

Money is stored as PostgreSQL BIGINT in whole rupiah. Input accepts integer digit strings; authoritative arithmetic uses BigInt. Chart coordinates are approximate display numbers only. Balances are calculated from opening balance plus ledger entries; there is no independently mutable balance column.

`Posting` groups entries. Income/expense creates one entry. Transfers/contributions create exactly two opposing entries in one serializable database transaction. A durable unique request key and mutation receipts prevent retries from reposting edited or deleted transactions. Deletions leave a posting tombstone and audit event. Database serialization conflicts fail safely; retry with the same request key. The form retains its request key until success or closure.

Every data access is scoped to either `(ownerId = current user AND householdId IS NULL)` or the authenticated user's household membership. The client never selects the acting user. Shared metrics include only shared entries. Each participant sees their authorized side of a private-to-shared transfer. Only the creator can edit or delete a posting, and must still have access to every affected wallet. Bill payments cannot be edited/deleted through the generic transaction screen, preserving payment history.

Goal completion estimates appear after at least seven days of positive allocation history and are projections, not promises. Goals are explicit allocations of existing savings, not income and not wallet movements. A goal allocation does not alter wallet balances. Move funds with a transfer when appropriate, then record an allocation once. Withdrawals cannot exceed recorded allocations. Contribution plans are stored per household; saving a plan does not create postings.

## Database entities

Users own wallets/categories/resources. Households have memberships and hashed invitations. A user belongs to at most one household; membership creation caps the initial implementation at two adults. The table supports future membership expansion. Wallets have explicit private/shared scope. Posting/Entry is the financial ledger. Resources are typed budget/goal/bill configuration; ResourceEvent stores allocation/payment history, with unique bill periods. Notifications are per recipient and deduplicated. AuditLog records financial changes. RateLimit uses an atomic PostgreSQL upsert.

Financial parent deletion uses restrictive foreign keys. No account/household deletion endpoint is exposed. Password-reset tokens are deleted after use. JWT sessions last up to 12 hours and are checked against the persisted user's session version on every protected request; changing/resetting a password invalidates prior sessions. Credentials sessions use Auth.js's JWT strategy, not the OAuth-only database-session adapter workflow.

## Environment

| Variable            | Purpose                                                                     |
| ------------------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`      | PostgreSQL connection string, including provider-required SSL configuration |
| `NEXTAUTH_URL`      | Exact application origin; also used for strict mutation origin validation   |
| `NEXTAUTH_SECRET`   | Random authentication encryption/signing secret                             |
| `SMTP_URL`          | SMTP connection URL for password-reset email                                |
| `MAIL_FROM`         | Verified sender address                                                     |
| `CRON_SECRET`       | Independent secret for `Authorization: Bearer …` on `/api/cron`             |
| `ENABLE_DEMO`       | Set `true` only for optional development seed                               |
| `DEMO_PASSWORD`     | User-chosen strong password required for development demo seed              |
| `TEST_DATABASE_URL` | Disposable migrated PostgreSQL used by integration tests                    |
| `E2E_DATABASE`      | Set `1` to enable authenticated Playwright scenarios                        |

In production, configure SMTP before offering password recovery. Use a pooled managed PostgreSQL URL compatible with Prisma, with SSL enabled. Review proxy headers and edge-level IP rate limiting for your deployment. Application limits persist in PostgreSQL; protect database access and backups separately.

## Tests and build

```powershell
npm run lint
npm run typecheck
npm test
# Against a disposable, migrated database only:
$env:TEST_DATABASE_URL = 'postgresql://duadompet:duadompet@127.0.0.1:5432/duadompet_test?schema=public'
npm test
npx playwright install chromium
$env:E2E_DATABASE = '1'
npm run test:e2e
npm run build
npm start
```

The integration suite creates uniquely named test accounts; use a disposable database and recreate it to clean test records. Without `TEST_DATABASE_URL`, integration tests are explicitly skipped, not reported as passing. See `VERIFICATION.md` for checks actually executed in the provided environment.

The test URL above is an example, not an automatically created database. With the supplied Docker service, create it using `docker compose exec db psql -U duadompet -c "CREATE DATABASE duadompet_test;"`, then migrate it with `DATABASE_URL` set to that test URL. Test setup selects `TEST_DATABASE_URL` before Prisma is imported. `.env` does not automatically export variables into the parent PowerShell terminal. The browser/HTTP test server must also use the disposable database.

For an installed local Chrome, set `$env:PLAYWRIGHT_CHANNEL = 'chrome'` instead of downloading Chromium. The HTTP workflow test exercises real Auth.js cookies, CSRF login, permissions, financial mutations and exports against the running local server:

```powershell
$env:RUN_HTTP_SMOKE = '1'
node tests/http.smoke.mjs
```

On Windows, builds use one worker and pre-create output directories serially to avoid filesystem `EPERM` races. Windows preserves the dedicated Next.js output directory; Linux/Vercel retains the normal clean build behavior. To use a separate output directory, set `NEXT_BUILD_DIR=.next-release` for both `npm run build` and `npm start`. Never point this setting at a folder containing unrelated files.

## Demo

`/demo` works without a database and does not persist mutations. For optional isolated development accounts, set `ENABLE_DEMO=true` and `DEMO_PASSWORD`, then run `npm run db:seed`. It creates `nadia@demo.invalid` and `raka@demo.invalid`; it never overwrites existing accounts and refuses production mode. Use a dedicated disposable database for any mutable portfolio demo. Reset by recreating that database and rerunning migrations and the seed. Never point a public mutable demo at real-user data.

## Deploy to Vercel

1. Push the source to a repository and import it into Vercel as a Next.js project.
2. Provision managed PostgreSQL. Set all production environment variables with the deployed HTTPS origin in `NEXTAUTH_URL`; configure SMTP sender/domain.
3. Run `npm ci`, `npm run db:generate`, and `npm run db:migrate` against the target database in a controlled release step. Back up existing databases before subsequent migrations.
4. Use `npm run build` as the build command. Vercel serves Next.js; no persistent background process is required.
5. `vercel.json` schedules `/api/cron` daily at 00:00 UTC (07:00 Jakarta). Vercel injects the configured `CRON_SECRET` as its bearer token. With another scheduler, send that exact authorization header. Invocations deduplicate notifications and never generate paid transactions.
6. Run database integration and browser checks against staging before exposing real accounts. Set up error monitoring, database backups, uptime monitoring and data retention policies appropriate to your deployment.

Sensitive routes send private/no-store headers. The service worker only handles navigation failure with an inline offline notice and never stores authenticated pages/API responses. It does not implement offline transaction synchronization. Only the theme preference is stored in localStorage.

API routes, including CSV/PDF downloads, bypass the service worker completely. Passwords are validated against bcrypt's UTF-8 input limit instead of silently truncating long passwords. Date-only ledger records are anchored at noon Jakarta; audit timestamps retain their actual times.

## Current limitations

Receipt uploads, bank integrations, OAuth, email verification, MFA, household removal/ownership transfer, automated bank reconciliation and offline transaction synchronization are not implemented. Invite delivery uses a copyable email-bound link; automatic invitation email is not configured. The public demo previews the dashboard; full module navigation uses a registered account. The initial onboarding is compact rather than a seven-screen wizard. Notification preferences are global rather than per type. Resource configuration shares a typed table rather than one table per module; goal descriptions and explicit paused/archived goal controls are not exposed. PDF typography uses built-in Latin fonts and replaces unsupported characters. CSV exports transaction rows; the on-screen report and PDF include broader summaries. The reminder job currently processes resources in one invocation; larger deployments should introduce batches. External SMTP delivery, managed-database deployment, physical devices and Safari were not verified in this environment. Review `VERIFICATION.md` for actual checks before deployment.

Technical references: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Auth.js credentials](https://authjs.dev/getting-started/authentication/credentials), [Prisma authentication guide](https://docs.prisma.io/docs/guides/authentication/authjs/nextjs).

Scheduler reference: [Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

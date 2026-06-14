# Testing

Toastily has three test layers, each using the right tool for the job:

| Layer | Tool | What it covers | Needs a DB? |
|---|---|---|---|
| **Unit** | [Vitest](https://vitest.dev) | Pure, framework-free logic (no DB, no Nitro) | No |
| **Integration** | [Playwright `request`](https://playwright.dev/docs/api-testing) | Server API endpoints / contracts, RBAC enforcement, data effects | Yes (test DB) |
| **E2E** | Playwright (browser) | Full user journeys per RBAC role through the real UI | Yes (test DB) |

Anything DB-bound (capabilities, meeting authority, vote derivation, renumbering)
is tested at the **integration** layer against the real Postgres schema, because
those functions depend on the database and Nitro auto-imports — unit-testing them
would mean mocking away the very thing under test.

## Quick start

```sh
nvm use                 # Node 22.14 (pnpm needs ≥ 20.19 / 22.12)
pnpm install
pnpm exec playwright install chromium   # once, for the e2e/integration browser

# Unit tests (fast, no DB)
pnpm test:unit

# Integration + e2e (boots the app against a dedicated test DB)
docker compose up -d db   # Postgres must be running
pnpm test:e2e             # prepares the test DB, then runs all Playwright tests
```

| Command | What it does |
|---|---|
| `pnpm test` / `pnpm test:unit` | Run the Vitest unit suite once |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm test:db:prepare` | Drop + recreate + migrate + seed the test database |
| `pnpm test:integration` | Prepare the DB, run only the API/integration project |
| `pnpm test:e2e` | Prepare the DB, run **all** Playwright tests (integration + e2e) |
| `pnpm test:e2e:ui` | Same, in Playwright's interactive UI mode |
| `pnpm test:e2e:install` | Install the Playwright browser (+ OS deps) |
| `pnpm test:all` | Unit, then the full Playwright suite |

Run a single test: `pnpm test:unit roles` (Vitest filter) or
`pnpm exec playwright test tests/integration/voting-api.spec.ts:103` (file:line).

## How the harness works

- **Dedicated test database.** Tests never touch dev data. The URL is
  `TEST_DATABASE_URL`, or derived from `DATABASE_URL` by appending `_test` to the
  db name, or the compose default. `pnpm test:db:prepare`
  ([tests/setup/prepare-test-db.ts](../tests/setup/prepare-test-db.ts))
  drops + recreates it every run for a clean slate.
- **Dedicated port.** The test server runs on **3100**, so it never reuses a dev
  server already running on 3000 (which points at the dev DB).
- **Per-role accounts + fixtures.** [tests/setup/global-setup.ts](../tests/setup/global-setup.ts)
  registers one account per RBAC rung through the real `register` endpoint (correct
  password hashing), promotes each to its status in the DB, and saves a sealed
  session as `tests/.auth/<role>.json`. Specs then ask for the role they need via
  [tests/fixtures/roles.ts](../tests/fixtures/roles.ts):
  `guestPage`, `memberPage`, `officerPage`, `adminPage`, `managerPage`, and
  `apiAs(role)` for authenticated API contexts.
- **Test accounts** ([tests/setup/accounts.ts](../tests/setup/accounts.ts)) — all on
  the reserved `@toastily.test` domain so they can never email a real person:

  | Key | Status | Purpose |
  |---|---|---|
  | `guest` | guest (email-verified) | the guest gate / membership requests |
  | `member` | member | the members area, self-signup |
  | `officer` | officer | the executive hub, approvals |
  | `admin` | admin | everything |
  | `manager` | member + holds an authority-granting meeting role per test | contextual meeting-manager authority |

- **Email is mocked for free.** With no Resend key configured, the app's
  `sendEmail()` logs instead of sending, so nothing leaves the process. The
  verification/reset **token** still lands in `email_tokens`, and
  [tests/setup/email.ts](../tests/setup/email.ts) reads it — the contract-level
  stand-in for clicking the emailed link. QR codes are generated locally (no
  external call), so nothing else needs mocking.

## Coverage matrix (feature × layer)

✅ implemented · 🔲 planned (good next tests to add)

| Feature (PRD) | Unit | Integration | E2E |
|---|---|---|---|
| RBAC ladder `hasMinRole` (§3.1) | ✅ | ✅ (route enforcement) | ✅ (per-role redirects) |
| Effective capabilities (§3.1/§3.2) | — (DB-bound) | ✅ | 🔲 exec-hub card visibility |
| Public site: landing/news/i18n (§5) | — | 🔲 `content`/`news` API | ✅ |
| Register → verify → login (§4) | — | ✅ | 🔲 full UI sign-up |
| Password reset (§4) | — | 🔲 request → reset → login | 🔲 |
| Membership request → approval (§4.3) | — | ✅ (+ promotion, RBAC) | 🔲 officer approves in UI |
| Meeting roles / agenda template admin (§6) | — | 🔲 CRUD + 409-on-in-use | 🔲 |
| Agenda generation & timing (§6.3/§6.4) | ✅ `agendaSpeechMinutes` | 🔲 `GET /api/agenda/[date]` expansion | 🔲 print view |
| Meeting signup authority (§3 contextual) | — (DB-bound) | ✅ | 🔲 assign panel in UI |
| Speech signup + timing (§6.3) | — | 🔲 claim/assign/release, title/timing edit | 🔲 |
| Calendar: generate-year, renumber, holidays (§6.1) | — (DB-bound) | 🔲 generate + `renumberMeetings` | 🔲 |
| Voting lifecycle + tally visibility (§8) | ✅ category constants | ✅ | 🔲 vote + results UI |
| QR check-in (§9) | — | 🔲 checkin post/delete, current | 🔲 |
| Scheduled/triggered emails (§10) | — | 🔲 dispatch due schedules (stubbed send) | 🔲 admin notifications UI |
| Roster / members area (§7.1) | — | 🔲 `GET /api/members/roster` | ✅ (nav + access) |
| Executive hub (§7.2) | — | — | ✅ (access) |
| Settings admin + public split (§13) | — | 🔲 admin-only vs public endpoints | 🔲 |
| Participation tracking (§11) | — | 🔲 (when built) | 🔲 |

### Known issue surfaced while building this suite

A **fresh, all-at-once migration apply fails**: migration `0003` adds the enum
value `agenda_item_type.evaluations` and `0012` uses it, which Postgres forbids in
a single transaction (`unsafe use of new value`). Both `drizzle-kit migrate` and
the drizzle-orm migrator batch migrations into one transaction, so a brand-new DB
(`docker compose up` / a new contributor / CI) can't migrate. The dev DB only
works because it was migrated incrementally over time.
`prepare-test-db.ts` works around it by applying each statement with autocommit;
the underlying migration bug is tracked in
[issue #22](https://github.com/geldan01/toastily/issues/22).

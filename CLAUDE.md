# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**Foundation + public site + auth/membership + meetings/agenda built** (PRD phases P0/P1/P1b + P2 + **P3/§6 complete**). The Nuxt 4 app is scaffolded with the planned stack; the bilingual public site (landing, News list/detail) renders from `settings` + `content_blocks` + `news`. **Auth is live** (`nuxt-auth-utils` sealed sessions): register → email-confirm → login/logout, password reset, request-membership → officer/admin approval, with RBAC enforced in server utils. **Meetings & agenda are live**: calendar/holidays, role + speech signup (member self / officer-assigns-guest), and template-driven agenda generation with Print/Save-as-PDF. Voting, QR, emails, and tracking (PRD §8–§11) are **not built yet**. **[docs/PRD.md](docs/PRD.md) remains the source of truth** — read it before implementing any feature.

### Meetings & Agenda notes (P3)
- **Schema** ([server/db/schema/meetings.ts](server/db/schema/meetings.ts)): `meeting_roles` (flags: `grants_meeting_authority`, `counts_as_evaluator`, **`is_meeting_officer`** — officers are listed in the agenda's Meeting Officers block for the chair's introductions), `agenda_templates` + `agenda_template_items` (item type `item`|`speeches`|`evaluations`; `item` rows optionally bind to a `meeting_role`; each item carries a **`section`** enum `administrative`|`speeches`|`table_topics`|`evaluations` — the agenda renders a heading on every section change, with a one-time "Educative Session" parent heading before the first educative subsection; the administrative segment typically opens AND closes the meeting), `meetings`, `calendar_exceptions`, `meeting_role_signups` (unique per meeting+role; member `user_id` **or** `guest_name`), `speeches` (unique per meeting+slot; presenter/evaluator each member-or-guest, `pathways_project` placeholder). The **`speeches` block expands to each speech's presenter; `evaluations` expands to each speech's evaluator** — but **only for speeches that have a speaker** (an evaluator on a speakerless slot emits no agenda line; the signup page still offers all `speeches.max_per_meeting` slots). The agenda table shows a running **clock column** from the `meeting.start_time` setting (HH:MM, default 18:00, editable at /admin/settings).
- **Admin editors (admin-only):** meeting roles ([/admin/meeting-roles](app/pages/admin/meeting-roles.vue)) — per-row REST + `reorder`; deleting an in-use role is blocked **409 → deactivate instead**. Agenda template ([/admin/agenda-template](app/pages/admin/agenda-template.vue)) — single replace-style **PUT** (safe: nothing references template items historically). Calendar ([/admin/meetings](app/pages/admin/meetings.vue)) — create/delete meetings + holidays.
- **Calendar managers** = admin OR the delegable `calendar_manage` grant ([server/utils/calendar.ts](server/utils/calendar.ts) `requireCalendarManager`). Until the grant UI ships (executive section), admins manage the calendar; the admin pages are gated by the `admin` middleware accordingly.
- **Public:** [/meetings](app/pages/meetings/index.vue) (next-5 upcoming/holidays/past; members also see the **sign-up board** — [MeetingSignupMatrix.vue](app/components/MeetingSignupMatrix.vue): roles + speech slots as rows × the next 5 scheduled meetings as columns, fed by member-gated `GET /api/meetings/matrix` (returns per-meeting `canManage`); each cell opens a popover (new [ui/popover](app/components/ui/popover/index.ts)) with the same claim/assign/release actions, posting to the per-meeting signup/speech endpoints; sticky first column + horizontal scroll keeps ~2 date columns visible on mobile). **The meeting page is agenda-first**: [/meeting/[date]](app/pages/meeting/[date]/index.vue) renders the agenda via `GET /api/agenda/[date]` (expands the template, fills role-bound items from signups, fans out speeches/evaluations by `speeches.max_per_meeting`; also returns `status`/`notesEn/Fr`/`holiday`, with `lines: []` when cancelled) with **Print / Save as PDF** (`window.print()`; chrome carries `print:hidden`) and a `print:hidden` button bar — **Signup** and **Guests** (member+ only) and **Vote** (everyone). Subpages: [/meeting/[date]/signup](app/pages/meeting/[date]/signup.vue) (role + speech signup: members self-claim open roles, managers assign members or guests and can reassign/release any; `POST`/`DELETE /api/meetings/signup`), [/meeting/[date]/guests](app/pages/meeting/[date]/guests.vue) (member-gated via the `member` middleware: guest list, add-guest form, manager QR block), plus the existing vote/results pages. The legacy **/agenda?date=YYYY-MM-DD** route 302-redirects to `/meeting/[date]`. A server-side headless-Chromium PDF can replace print-to-PDF later (needed when agendas are emailed in P7).
- **Speech signup** (PRD §6.3) is live on the meeting page: per-slot **title + timing window + speaker + evaluator**, each claimed by a member or assigned to a member/guest by a meeting manager (`POST`/`PATCH`/`DELETE /api/meetings/speech`). Slot count = max(existing speeches, `speeches.max_per_meeting` setting). Title/timing editable by the slot's speaker or a meeting manager. Releasing the last participant with no title deletes the empty row. **Note: the user-facing label is "Speaker"** (i18n `meetings.speaker`); the DB columns remain `presenter_*` — terminology only, not renamed.
- **Speech timing** (PRD §6.3): each speech carries a `min_minutes`/`max_minutes` window ([speeches](server/db/schema/meetings.ts)), seeded at creation from club-configurable settings `speech.default_min_minutes`/`default_max_minutes` (5/7) and falling back to them when null. The agenda allots **`max` + `speech.agenda_buffer_minutes` (2)** per speech — see `speechTiming()`/`agendaSpeechMinutes()` ([server/utils/speeches.ts](server/utils/speeches.ts)); the `evaluations` block still uses its template item's nominal duration. `PATCH /api/meetings/speech` accepts `minMinutes`/`maxMinutes` (validated min ≤ max, positive ints). These three settings have no admin UI yet — edit via the `settings` table (a future admin-settings field can expose them).

### Scheduling, numbering & executive RBAC (extends P3)
- **Executive positions/assignments** ([server/db/schema/executives.ts](server/db/schema/executives.ts), PRD §3.2): admin-managed positions carry **capability flags** (`can_manage_calendar`, `can_manage_content`, `can_assign_officers`) — authority is data, never hard-coded against a position name. Assignments are temporal (current holder = `ended_at` null; history kept). Assigning a position **promotes a member → officer** with a role-history entry. Seed: standard 7 positions; President = all caps, VP Education = calendar, VP PR = content. Managed at [/admin/executives](app/pages/admin/executives.vue) (admin; assign also allowed to a `can_assign_officers` holder via API).
- **Effective capabilities** are the single source of truth: `effectiveCapabilities(user)` ([server/utils/executives.ts](server/utils/executives.ts)) = admin (all) ∪ current exec-position flags ∪ delegable per-user grants. Exposed to the client at `GET /api/me/capabilities` via [useCapabilities()](app/composables/useCapabilities.ts); the **`calendar` route middleware** and nav gate the meetings UI on `canManageCalendar`. `requireCalendarManager` enforces it server-side.
- **Meeting lifecycle:** `meetings.status` (`scheduled`/`cancelled`) + `meeting_number` + `minutes_en/fr` (minutes UI later). **Cancel** keeps the row (struck-through, no number); **holidays delete** any meeting on that date. **Numbering is auto & contiguous** — `renumberMeetings()` ([server/utils/meetings.ts](server/utils/meetings.ts)) numbers non-cancelled meetings in date order from the `meeting.number_start` setting, called after every add/delete/cancel/generate/holiday change.
- **Generate-year:** `POST /api/admin/meetings/generate` ({firstDate, untilDate, everyWeeks, numberStart, location}) creates recurring meetings, skipping holidays and existing dates. UI on [/admin/meetings](app/pages/admin/meetings.vue) defaults to the upcoming Jul 1 → Jun 30 span.
- **Per-meeting signup authority (PRD §3, contextual):** a meeting role can carry `grants_meeting_authority` ([meeting_roles](server/db/schema/meetings.ts)); the member signed up for such a role on a given meeting becomes a **meeting manager** for that meeting — independent of executive rank. `isMeetingManager(user, meetingId)` ([server/utils/meeting-authority.ts](server/utils/meeting-authority.ts)) = officer/admin **OR** holds an authority-granting role on that meeting. Managers can **assign any member or a guest, reassign a filled role/speech slot, release anyone's signup, and edit any speech title**; plain members may only self-claim open roles and release their own. Enforced in `signup.post/delete` + `speech.post/patch/delete`; surfaced to the client as `canManageSignups` on `GET /api/meetings/[date]`, which drives the **Assign/Reassign dropdown** ([MeetingAssignPanel.vue](app/components/MeetingAssignPanel.vue), member-or-guest) on [/meeting/[date]/signup](app/pages/meeting/[date]/signup.vue). The dropdown's roster comes from `GET /api/meetings/members` (any logged-in member, id+name only). Authority is **data, never a hard-coded role name** — admins toggle it per role at [/admin/meeting-roles](app/pages/admin/meeting-roles.vue); seed grants it to the Toastmaster. This same flag will back the SAA/Toastmaster voting controls in §8.
- **Next phases:** voting (§8), QR check-in (§9), participation tracking (§11), minutes entry, the internal **Messages** feature (deferred from §7.1), and the delegable-grant admin UI.

### Private sections (P? / §7) — Members & Executive hubs
- **Members area** ([/members](app/pages/members/index.vue), member-gated via the new [`member` middleware](app/middleware/member.ts)): shows the club **Roster** plus placeholder **Messages**/**Tools** cards (both "coming soon" — Messages is the deferred §7.1 internal-announcements feature). Roster data comes from **`GET /api/members/roster`** ([server/api/members/roster.get.ts](server/api/members/roster.get.ts), `requireMinRole 'member'`): all member/officer/admin users with their **current executive position labels** (EN/FR), email, and join date. No new schema — reads `users` + active `executive_assignments`.
- **Executive area** ([/executive](app/pages/executive/index.vue), officer-gated via the existing `officer` middleware, PRD §7.2 = officers + admin): a hub of cards linking to the existing management pages (requests, calendar, notifications, executives, meeting-roles, agenda-template, settings). Each card is shown only when the user holds the capability the target page already enforces — gated on `useCapabilities()` + account status, **never a hard-coded position name**.
- **Nav consolidation:** [AppHeader.vue](app/components/AppHeader.vue) replaced its flat list of per-admin links with single **Members** (member+) and **Executive** (officer+) entries. A non-officer holding a delegated `calendar_manage` grant still gets a direct `/admin/meetings` link (`calendarOnly`), since they can't reach the officer-gated Executive hub.

### Auth notes (P2)
- **First registered user becomes a verified admin** (bootstrap); everyone after is a `guest` who must confirm their email. Subsequent promotion is via the membership-request → approve flow (officer/admin).
- **Email is dev-stubbed**: verification/reset links are printed to the **server console** (search the dev log for `dev email stub`) — no Resend key needed locally. Real Resend delivery lands in P7; replace the body of `deliverAuthLink` in [server/utils/auth-email.ts](server/utils/auth-email.ts).
- RBAC: `requireMinRole(event, 'officer')` etc. in [server/utils/auth.ts](server/utils/auth.ts); shared ladder helper `hasMinRole` in [shared/utils/roles.ts](shared/utils/roles.ts); client route middleware `auth` / `officer` in [app/middleware/](app/middleware/).
- ⚠️ Don't `TRUNCATE users CASCADE` — `news.author_id` FKs to `users`, so cascade also empties `news`. Re-run `pnpm db:seed` if you do.

### Toolchain & commands

- **Node** ≥ 20.19 / 22.12 (pinned in `.nvmrc` to 22.14.0). **Package manager: pnpm** (via corepack). Run `nvm use` before pnpm commands — on older Node (e.g. 20.18) corepack/pnpm fails with `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`.
- App lives under `app/` (Nuxt 4 srcDir); server code under `server/`; DB schema/migrations/seed under `server/db/`.

| Task | Command |
|---|---|
| Install deps | `pnpm install` |
| Dev server | `pnpm dev` |
| Production build | `pnpm build` (preview: `pnpm preview`) |
| Lint / autofix | `pnpm lint` / `pnpm lint:fix` |
| Typecheck | `pnpm typecheck` |
| Generate a migration from schema | `pnpm db:generate` |
| Apply migrations | `pnpm db:migrate` |
| Seed generic dev data | `pnpm db:seed` |
| Drizzle Studio | `pnpm db:studio` |

There is **no test runner yet** — add one (e.g. Vitest + Playwright) in a later phase and document how to run a single test here.

**Local DB:** `docker compose up -d db` (Postgres; host port via `DB_PORT`, default 5432). Copy `.env.example` → `.env` first. Full stack (app + db, runs migrations on start): `docker compose up --build`.

## What Toastily is

An open-source, **club-agnostic** website platform for Toastmasters clubs. It ships generic and is configured per-club via the database — the first deployment is the CN Collaborators club, but the repo is **public on GitHub**, so this is a hard architectural rule, not a preference:

- **No club-specific data in code.** Club name, schedule, branding, roles, agenda templates, email/QR settings all live in the `settings` table or seed data, never hard-coded.
- **No secrets in code.** Resend keys, DB URL, session secret, etc. come from environment variables (injected by Coolify) or the admin-only `settings` table.

## Planned stack

Nuxt 4 (Vue 3 + Nitro, TypeScript) · Tailwind CSS · **shadcn-vue** · PostgreSQL via **Drizzle ORM** · auth via **nuxt-auth-utils** · i18n via **@nuxtjs/i18n** · email via **Resend** · agenda PDF via headless-Chromium print-to-PDF. Deployed as a Docker image (multi-stage build → Nitro runtime, `docker-compose` with Postgres) on **Coolify / Hostinger**.

## Architecture rules that span multiple features

These cut across the codebase; getting them wrong in one place breaks consistency everywhere.

- **Bilingual (EN/FR) is end-to-end, two distinct mechanisms — don't conflate them:**
  - *UI strings* → `@nuxtjs/i18n` locale files.
  - *User-generated content* (News, editable landing content blocks) → **paired `*_en` / `*_fr` columns**, both required before publishing.
  - *DB-managed labels* (meeting roles, executive positions, agenda items, holidays) also carry `*_en` / `*_fr` fields.
- **RBAC is layered.** Base account status is a linear ladder `guest → member → officer → admin` (officer implies member; only members can be officers). On top of that, two capabilities are **delegable grants** (content-edit, calendar-manage) stored separately, and some authority is **contextual to a meeting** (e.g. the meeting's Sergeant-at-Arms or Toastmaster can open/close voting and view results — independent of executive rank). Enforce all of this in server middleware, not just the UI. See the permissions matrix in the PRD §3.
- **Roles are data, not enums.** Meeting roles and executive positions are DB rows that admins edit; never hard-code their names or hard-code business logic against a specific role label.
- **Participants may be a member OR a guest.** Role signups, speeches (presenter/evaluator), and check-ins all support either a `user_id` or a free-text `guest_name`. Members self-sign-up when logged in; officers may assign a guest (which reveals a manual Name field). Model both paths everywhere participation is recorded.
- **History is first-class.** Role/executive assignments, signups, speeches, and votes are kept over time to power the member-visible participation tracking (PRD §11) and role-allocation history — prefer append/temporal records over destructive updates for these.
- **Agenda generation is template-driven.** An agenda = an ordered list of timed agenda items (DB-managed template, each item optionally bound to a meeting role); generating fills each item from current signups. The on-screen `/agenda` and the downloadable PDF render the same template.

## Phasing

v1 = PRD §3–§12 (public site, news, auth/membership, meetings/agenda+PDF, member/executive sections, voting, QR check-in, scheduled emails, tracking). **Phase 2** = dues/Stripe (treasurer paid/unpaid tracking + reminders), Pathways catalog, expanded member Tools — model `pathways_project` as a placeholder field for now.

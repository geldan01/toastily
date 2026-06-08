# Toastily — Product Requirements Document

## 1. Overview

Toastily is an open-source website platform for Toastmasters clubs. It provides a public bilingual marketing site, member/officer management, a meeting & agenda system with role signup and PDF generation, in-meeting voting, guest check-in via QR, and historical tracking — all club-agnostic, with club-specific values held in configuration and the database.

Because the repository is **public on GitHub**, no club-specific data may be hard-coded; all of it lives in configuration and the database.

**Reference deployment:** CN Collaborators — bilingual club in downtown Montréal, meeting Mondays 18:00–20:00 (`cncollaborators.ca`).

### 1.1 Goals
- Reusable base any club can fork/configure (no hard-coded club data).
- Bilingual (EN/FR) end-to-end: UI strings and user-generated content.
- Let members self-serve agenda role signup; let officers manage meetings, content, people, and voting.
- Track participation history (roles, speeches, votes) transparently for all members.

### 1.2 Non-Goals (v1)
- Online dues payment (Stripe) — **Phase 2**.
- Pathways project catalog — modeled as a placeholder field now, fully defined later.
- Native mobile apps (responsive web only).

## 2. Tech Stack
- **Framework:** Nuxt 4 (Vue 3, Nitro server, TypeScript).
- **Styling:** Tailwind CSS + **shadcn-vue** (shadcn-nuxt) component library.
- **Database:** PostgreSQL (self-hosted), accessed via an ORM (**Drizzle ORM** recommended for type-safety + SQL migrations; Prisma acceptable).
- **Auth:** `nuxt-auth-utils` (sealed session cookies) with email/password + email confirmation. RBAC enforced in server middleware.
- **Email:** Resend via Nitro server routes. Provider credentials (API key, from-address) are **DB-configurable by admin only** — never committed.
- **i18n:** `@nuxtjs/i18n` (EN default, FR). Locale-prefixed routes (`prefix_except_default` or `/en` `/fr`).
- **Images/uploads:** stored on disk or S3-compatible bucket via config; served through Nitro.
- **PDF:** server-side agenda rendering (recommend HTML-template → headless-Chromium print-to-PDF for fidelity with the on-screen agenda).
- **QR:** generated from a DB-configured target URL.

### 2.1 Deployment
- **Containerized with Docker.** The app ships a `Dockerfile` (multi-stage Nuxt build → Nitro runtime) and a `docker-compose.yml` (app + PostgreSQL) so it runs identically locally and in production.
- **Deployed on Coolify**, self-hosted on **Hostinger**, initially on a **temporary subdomain for testing**. Coolify builds from the repo (Dockerfile/compose), injects env vars (DB URL, session secret, Resend key, image-storage config), runs migrations on deploy, and provisions TLS for the subdomain.
- All environment-specific and secret values come from Coolify env vars / the `settings` table — never committed (public repo).

### 2.2 Configuration Principle
A `settings` table (key/value, some admin-only) holds all club-specific and sensitive values: club name & contact, meeting place/time, default locale, Resend config, QR target URL, max speeches per meeting, branding accents. Seed data ships generic; CN Collaborators values are applied via migration/seed in the deployment, not in shared code.

## 3. Roles & Permissions

### 3.1 Access roles (account level)
`guest` → `member` → `officer` → `admin`. A user has one base account status; **officer** additionally implies member. Only **members** can become officers.

| Capability | Guest | Member | Officer | Admin |
|---|---|---|---|---|
| View public site, news, agenda, history | ✅ | ✅ | ✅ | ✅ |
| Sign up for a meeting role / speech / evaluation | ❌ | ✅ | ✅ | ✅ |
| Request membership | ✅ | — | — | — |
| Approve membership / promote to member | ❌ | ❌ | ✅ | ✅ |
| Edit landing content & News | ❌ | ❌ | ✅ (if delegated) | ✅ |
| Manage meetings / calendar / holidays | ❌ | ❌ | ✅ (allowed officers) | ✅ |
| Grant a role to a Guest (manual name) | ❌ | ❌ | ✅ | ✅ |
| Open/close voting | ❌ | ✅ if meeting Sergeant-at-Arms; Toastmaster fallback | ✅ | ✅ |
| View voting results link | ❌ | Toastmaster of meeting | ✅ | ✅ |
| Manage meeting-role & agenda-template definitions | ❌ | ❌ | ❌ | ✅ |
| Assign executive officers | ❌ | ❌ | President only | ✅ |
| Configure email/QR/settings | ❌ | ❌ | ❌ | ✅ |

Content-edit and calendar-management permissions are **delegable**: admin/president can grant specific officers (or members) the right to edit content or manage the calendar. Delegation is stored as permission flags/grants.

### 3.2 Executive officer positions (the executive team)
DB-managed list: **President, VP Education, VP Membership, VP Public Relations, Treasurer, Secretary, Sergeant-at-Arms**. Assigned by **President or admin**. Every assignment is recorded with start/end dates → **role-allocation history** (who held which position when, who assigned them).

### 3.3 Meeting roles (DB-managed, not hard-coded)
Seeded list, fully editable by admin (name EN/FR, description, sort order, active flag): **Chair (Président), Toastmaster, General Evaluator, Table Topics Master, Secretary, Sergeant-at-Arms (Huissier), Toast, Moment of Reflection, Moment of Humour, Grammarian.** Plus dynamically per speech: **Speaker** and **Evaluator** slots.

## 4. Authentication & Membership Flow
1. Anyone can self-register (email + password + name + locale).
2. A confirmation email (Resend) with a tokenized link is sent; clicking verifies the account. New verified accounts are **guests**.
3. A guest may **request membership** from their profile; an officer/admin approves (or declines). Approval promotes to **member** and writes a role-history entry.
4. Officers are named from existing members by the president/admin (§3.2).
5. Simple login (email/password), session via `nuxt-auth-utils`. Password reset via emailed token.

## 5. Public Site (modern redesign, inspired by cncollaborators.ca)

### 5.1 Landing page (`/`)
Sections, each an **editable content block** (dual EN/FR, image where relevant), managed by users with the content-edit permission:
- **Hero carousel** — rotating bilingual banners with CTAs (e.g. "Awaken the confident public speaker within you!", location near Bonaventure Metro, leadership messaging).
- **Key Benefits** — communication, leadership, self-confidence pillars.
- **Why Join** — bilingual programming, open membership, mentorship, welcoming environment, downtown location, Monday schedule.
- **Latest News** — the **last 3** published News items (image + title), each linking to its detail page, plus a link to `/news`.
- **Footer** — contact info, meeting schedule & address (from settings), Toastmasters branding.

Branding: Toastmasters palette (maroon, navy, yellow/gold accents); polished shadcn UI; fully responsive.

### 5.2 Navigation
Home, News, Meetings (When & Where / Schedule), Our Club (About / Members / FAQ), Contact, plus language toggle and login/account menu. Member/Officer/Executive areas appear only when authorized.

### 5.3 News
- `/news` — all published News, newest first, list with image + title + excerpt, each clickable.
- `/news/[id]` — full article (image, title, content).
- Each News item: `title`, `content`, `image` — **dual entry EN + FR required** to publish. Landing shows last 3.
- Create/edit/publish requires content-edit permission.

## 6. Meetings & Agenda

### 6.1 Calendar & meetings
- Allowed officers/admin **add meetings** (date, location, theme, optional notes) and **add holidays / no-meeting exceptions** (date + bilingual label).
- Anyone can **view** a meeting: `/meeting/[date]` (e.g. `/meeting/2026-06-15`).
- A meeting shows: theme, its agenda, role signups, speeches, current guests, and (for authorized people) the voting-results link.

### 6.2 Role signup
- Each meeting exposes its active **meeting roles** + speech speaker/evaluator slots.
- **Logged-in members** can claim/release an open role for themselves.
- **Officers** can assign a role to anyone, including a **Guest**: selecting "Guest" reveals an extra **Name** free-text field (for non-member participants the club occasionally invites).
- Unauthenticated/guest visitors cannot self-sign-up.

### 6.3 Speeches
- **Max speeches per meeting** is a DB setting (club-configurable).
- Each speech slot: `title`, `presenter` (member or guest name), `pathways_project` (placeholder field, defined later), `evaluator` (member or guest name).
- Speaker and Evaluator are signup roles, fillable by members or granted to guests by officers.

### 6.4 Agenda generation & PDF (`/agenda`)
- An **agenda template** is an **ordered list of timed agenda items**: each item has sort order, bilingual label, duration/time, and an **optional assigned meeting role**. Templates and items are **DB-managed**; admin can create/edit templates and **assign a role to each item** ("assign roles to actions").
- The `/agenda` page generates the agenda for a selected meeting by expanding the template and filling each item with the **currently signed-up** person (or guest name) for its role; speech items expand per speech with title/presenter/evaluator.
- The agenda is **downloadable as a PDF** that follows the template layout.

## 7. Private Sections

### 7.1 Members section (members + officers + admin)
- **Messages** — internal announcements/messaging to members.
- **Roster** — list of all members.
- **Tools** — placeholder hub for member utilities (extensible).

### 7.2 Executive section (officers + admin only)
- Visible only to executive officers and admin.
- Houses executive-team workspace (e.g. officer management, content/calendar delegation controls, settings entry points per permission).
- **Treasurer dues area (Phase 2):** track who has/hasn't paid; send reminders. v1 may stub the navigation; functionality is Phase 2.

## 8. Voting
- Categories: **Best Speaker, Best Speech Evaluator** (must be one of the meeting's evaluators or the Grammarian), **Best Table Topics Speaker, Best Table Topics Evaluator**.
- **Ties are allowed** in results.
- A **ballot is opened per meeting per category** by the meeting's **Sergeant-at-Arms** (any member holding that meeting role, not necessarily the executive SAA); **Toastmaster is the fallback** opener/closer; officers/admin can also open/close. The opener can **close** and **reopen** to fix mistakes.
- While open, **anyone present can vote** once per category (lightweight identity via session/device token; accessed through the meeting page/QR).
- **Results** are revealed after closing and announced by the meeting's **Toastmaster or any officer**. The results link on `/meeting/[date]` is visible only to the Toastmaster of that meeting and officers/admin.
- Candidate lists are derived from that meeting's speakers/evaluators/grammarian as appropriate per category.

## 9. Guest Check-in & QR
- A **QR code** points to a **DB-configured URL** (admin-set). Displayed for guests/members to reach the site/check-in.
- On arrival, a **guest can add their name + optional email**, or a member can add them. Check-ins are **per-meeting** → feed the meeting's **attendee list** and a **follow-up guest list**.
- **Any member can view the current meeting's guests** (e.g. the Chair welcomes each guest; the Table Topics Master may invite them to try an impromptu speech).

## 10. Member Notifications & Scheduled Emails
- Officers/admin can email **all members** (recipient list derived from members; the **from/sender address is DB-configured**) using a **managed email template**.
- **Two trigger modes:**
  - **Manual** — a "Send now" button (e.g. from the Executive/Members area or a meeting page).
  - **Scheduled** — recurring sends on **DB-configured times** (e.g. every Sunday); **multiple schedules can be defined** in the database (day/time/cadence), executed by a Nitro cron/scheduled task.
- **Email content (template-driven, EN/FR):** list of **unfilled roles** for the upcoming meeting(s), a **link to sign up** (this site), and **links to role descriptions**, plus configurable intro/outro copy.
- Templates are **DB-managed** (subject + body, EN/FR, with placeholders for unfilled-roles list and links). Sent via Resend using the admin-configured email settings (§2.2 settings).
- Send history/log is recorded (when, to whom, which template, trigger).

## 11. Participation Tracking & History
- Track over time: roles taken, speeches given (title/date), evaluations done, votes won, executive positions held.
- **All members can view** the tracking/history (per-person and aggregate). Backed by role-history, signup, speech, and vote records.

## 12. Internationalization
- **UI strings:** EN + FR locale files via `@nuxtjs/i18n`; language toggle in header; locale persisted to user profile when logged in.
- **User content:** News and editable content blocks require **both EN and FR** before publishing; site renders the visitor's locale.
- DB-managed labels (meeting roles, executive positions, agenda items, holidays) carry `*_en` / `*_fr` fields.

## 13. Data Model (high level)
- `users` (status: guest/member/officer/admin, email, verified, locale, …)
- `membership_requests`, `role_history` (account-role and executive-position assignments with assigned_by + start/end)
- `permission_grants` (delegated content-edit / calendar-manage)
- `executive_positions` (DB-managed), `executive_assignments` (history)
- `meeting_roles` (DB-managed, EN/FR)
- `meetings`, `calendar_exceptions` (holidays)
- `meeting_role_signups` (meeting, role, user **or** guest_name, assigned_by)
- `speeches` (meeting, slot, title, presenter user/guest, pathways_project_id nullable, evaluator user/guest)
- `agenda_templates`, `agenda_template_items` (order, label EN/FR, duration, meeting_role_id nullable)
- `content_blocks` (page/section, title/body EN+FR, image), `news` (title/content EN+FR, image, published_at, author)
- `guest_checkins` (meeting, name, email nullable, added_by)
- `vote_sessions` (meeting, category, status, opened_by, closed_by), `vote_ballots` (session, candidate, voter_token)
- `settings` (key/value; admin-only flags for Resend, QR URL, email config, max speeches, club info)
- `email_templates` (subject/body EN+FR, placeholders), `email_schedules` (cadence/day/time, template, active), `email_send_log` (sent_at, template, trigger, recipients)
- *(Phase 2)* `dues`, `payments`

## 14. Phasing
- **v1:** §3–§12 in full — public site (i18n + editable content), News, auth/roles/membership, meetings/calendar/holidays, role & speech signup, agenda generation + PDF, members & executive sections, voting, QR guest check-in, participation tracking, admin settings (incl. Resend/QR config).
- **Phase 2:** dues payment via **Stripe**, treasurer paid/unpaid tracking + reminders, Pathways project catalog, expanded member Tools.

> Note: §10 scheduled emails plus §6 role signup together drive the weekly "unfilled roles" reminder to members.

## 15. Open Items / Later
- Pathways project catalog structure.
- Voting anti-double-vote identity strength (device token vs. light auth) — finalize in implementation.
- Image storage backend (local vs S3) per deployment.

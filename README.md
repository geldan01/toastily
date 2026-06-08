# Toastily

Toastily is an open-source website platform for **Toastmasters clubs**. It provides a public bilingual (EN/FR) marketing site, member and officer management, a meeting & agenda system with role signup and PDF generation, in-meeting voting, guest check-in via QR code, member email notifications, and participation history tracking.

The platform is **club-agnostic**: it ships generic, and all club-specific data (name, schedule, branding, email/QR configuration, roles, agenda templates) lives in configuration and the database — never in the code. This repository is public, so no club secrets or club-specific values are committed.

The reference deployment is the **CN Collaborators** club (`cncollaborators.ca`).

## Stack
Nuxt 4 · Tailwind CSS · shadcn-vue · PostgreSQL · Dockerized, deployed on Coolify.

## Getting started

**Use the pinned Node version (22.14.0, in `.nvmrc`) before anything else.** The package manager is pnpm via corepack.

```bash
nvm use            # reads .nvmrc → Node 22.14.0 (nvm install first if missing)
pnpm install
cp .env.example .env
docker compose up -d db
pnpm db:migrate && pnpm db:seed
pnpm dev
```

> **`pnpm install` fails with `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`?** You're on an older Node (e.g. 20.18) — corepack/pnpm needs Node ≥ 20.19 / 22.12. Run `nvm use` (or `nvm alias default 22.14.0`) and retry.

## Documentation
See the full **[Product Requirements Document](docs/PRD.md)** for features, roles & permissions, data model, and phasing.

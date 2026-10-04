# Vela AI Academy

Enterprise learning operations for a fourteen-week beginner AI-trainer certification. The product combines a polished Udacity-inspired learner experience with tenant-scoped administration, deterministic timezone scheduling, gated progression, assessment review, reporting, notifications, support, and verifiable certification.

## Production architecture

- Next.js 16 App Router and React 19
- PostgreSQL with Drizzle ORM and generated SQL migrations
- signed, HTTP-only, revocable session cookies
- bcrypt password hashing, login lockout, tenant-scoped RBAC, audit history, and rate limiting
- Vercel Blob direct uploads for lecture assets
- Resend transactional email through a durable database outbox
- Vercel Cron for scheduled unlocks, reminders, email delivery, and maintenance
- Vitest unit tests and Playwright desktop/mobile smoke tests
- WebMCP tools for authorised learner and administrator agent workflows

The UI supports light, dark, and system appearance modes and remains responsive from mobile through executive desktop dashboards.

## Local setup

Requirements: Node.js 20.11 or newer and PostgreSQL 15 or newer.

1. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

2. Set `DATABASE_URL`, generate independent values for `SESSION_SECRET` and `CRON_SECRET`, then install dependencies:

   ```bash
   npm ci
   ```

3. Apply the committed database migration and seed the demonstration organisation:

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. Start the application:

   ```bash
   npm run dev
   ```

The seed command creates two isolated tenants: a clean enterprise workspace with one owner account, and an executive-demo workspace with exactly one demo administrator and one demo learner. Bootstrap passwords are read from the environment and are never printed. Change every seeded credential before using any non-development environment.

## Curriculum operations

- Programs, phases, and lectures can be edited from **Admin → Curriculum management**. Changes are read live by learner workspaces.
- Creating a phase requires its planned lecture count and creates schedule-aware placeholder slots. Use the pencil action on a placeholder to publish its real title, content, assignment, duration, and pass rules.
- Deleting unused curriculum recalculates positions, release windows, prerequisites, and learner percentages. Items with cohort or submission history are protected; archive an in-use program instead of deleting it.
- Learners receive only the real titles and content they are entitled to see. Future phases are returned as `PART`, and future lectures are returned with placeholder metadata until schedule and prerequisite rules unlock them.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

Run browser smoke tests after installing the Playwright browser once with `npx playwright install chromium`:

```bash
npm run test:e2e
```

## Deploy to Vercel

1. Create an empty GitHub repository on the account that will own the project.
2. Add it as this checkout’s remote and push `main`.
3. Import that repository in Vercel.
4. Provision a managed PostgreSQL database and Vercel Blob store.
5. Add every required value from [.env.example](./.env.example) to the Vercel project. Use production URLs and new secrets.
6. Run `npm run db:migrate` against the production `DATABASE_URL`; run `npm run db:seed` only if the demonstration curriculum and accounts are wanted.
7. Deploy. Vercel detects Next.js and reads [vercel.json](./vercel.json), including the release and notification cron jobs.

The project contains no committed credentials, provider IDs, or account-specific Git remote. See [Deployment](./docs/DEPLOYMENT.md) for the complete release checklist.

## Important commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start local development |
| `npm run build` | Produce the Vercel-ready production build |
| `npm run db:generate` | Generate a migration after schema changes |
| `npm run db:migrate` | Apply pending PostgreSQL migrations |
| `npm run db:seed` | Seed one empty enterprise tenant plus the isolated two-account demo tenant |
| `npm run typecheck` | Validate TypeScript |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run browser tests |
| `npm run verify` | Typecheck, unit test, and production build |

## Documentation

- [Architecture and security](./docs/ARCHITECTURE.md)
- [Feature coverage and implementation order](./docs/FEATURES.md)
- [GitHub and Vercel deployment](./docs/DEPLOYMENT.md)
- [Security policy](./SECURITY.md)

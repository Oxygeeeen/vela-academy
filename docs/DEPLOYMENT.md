# GitHub and Vercel deployment

## Before the first push

```bash
npm ci
npm run verify
git status
git add .
git commit -m "Build Vela AI Academy enterprise platform"
git remote add origin <your-new-github-repository-url>
git push -u origin main
```

If `origin` already exists, inspect it with `git remote -v` and change it only when it is not the intended account.

## Vercel environment

Create production values for:

- `DATABASE_URL`
- `SESSION_SECRET` — at least 32 random characters
- `APP_URL` — the canonical HTTPS URL
- `APP_ENV=production`
- `CRON_SECRET` — a separate random secret
- `BLOB_READ_WRITE_TOKEN`
- `RESEND_API_KEY` and a verified `EMAIL_FROM`
- password, session, and upload policy values when overriding defaults

Do not copy development secrets into preview or production. Vercel preview environments should use an isolated database.

The committed cron schedules run once per day and are compatible with Vercel Hobby. Lesson availability does not depend on cron precision: the curriculum API refreshes an enrolment against the learner's timezone whenever the workspace is opened. Upgrade the schedules only after moving the project to a Vercel plan that supports more frequent cron execution.

## Database release

Apply migrations from a trusted local/CI environment with the production `DATABASE_URL`:

```bash
npm ci
npm run db:migrate
```

Seed only a new demonstration environment. For production, create the initial owner through a controlled bootstrap process and rotate the password immediately.

## Acceptance checklist

- sign in as owner, reviewer, and learner;
- enrol a learner in each supported timezone policy;
- verify midnight release and the prior-pass gate;
- upload and play a lecture asset with captions or transcript;
- submit, request changes, resubmit, and pass an assessment;
- complete a test enrolment and verify its certificate code;
- confirm inbox and email delivery;
- subscribe to the ICS calendar;
- export the programme report and personal privacy archive;
- confirm tenant isolation with two test organisations;
- confirm cron responses in Vercel logs;
- run a PostgreSQL backup and restore drill.

Vercel creates deployments from GitHub pushes. No code in this repository pushes, publishes, seeds, or deploys automatically without the account owner taking that action.

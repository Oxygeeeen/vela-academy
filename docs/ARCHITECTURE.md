# Architecture and security

## Boundaries

Every business record carries or inherits an organisation identifier. API routes resolve the signed-in user from an HTTP-only session and apply organisation filters before reading or mutating data. Administrator UI controls are convenience only; authorisation is enforced again in every protected route.

Roles are `owner`, `admin`, `reviewer`, `trainer`, and `student`. Session tokens contain a session-version claim. Password resets, explicit revocation, and other sensitive account actions increment the stored version so existing sessions stop validating.

## Learning state machine

```text
scheduled + prerequisite passed
        │ release at 00:00 learner timezone
        ▼
    available → in_progress → submitted → passed
                       ▲           │
                       └ changes_requested
```

The database, not the browser, owns the state. A lesson becomes available only when its calculated release instant has arrived and the prior lesson is passed. Submission requires lecture completion. Reviewer decisions update progress atomically; passing the final lesson completes the enrolment and issues one certificate with a public verification code.

Class dates are calculated from the assigned start date and programme weekday policy. Time instants use an IANA timezone so daylight-saving transitions do not introduce one-hour drift.

## Data and integrations

- PostgreSQL is the system of record. The first migration creates all 24 tables, indexes, foreign keys, and uniqueness rules.
- Vercel Blob upload tokens are issued only after tenant ownership, content type, and size validation.
- Email is written to an outbox first. The cron delivery worker retries transient provider failures with exponential delay.
- Calendar events are available as JSON and as an authenticated ICS feed; lesson releases and deadlines are included automatically.
- Audit records contain action, actor, entity, safe metadata, user agent, and a keyed hash of the source IP rather than the raw address.

## Security controls

- bcrypt with cost 12
- password complexity and forced first-login changes
- generic authentication errors, account lockout, and persistent rate limits
- HS256 sessions with expiry, secure/SameSite cookies, and revocation
- same-origin checks on browser mutations
- server-side RBAC and organisation scoping
- Zod request validation and bounded pagination
- restrictive browser security headers
- content-type and upload-size allowlists
- audit trail, consent records, privacy export, retention settings, and certificate revocation fields
- no secrets in source control

For high-scale deployments, place the application behind the Vercel Firewall and replace the database-backed login limiter with a globally distributed limiter if traffic volume warrants it.

## Reliability

Vercel cron calls are authenticated with `CRON_SECRET`. Scheduled jobs are safe to repeat: progress unlocks are conditional, deadline reminders use stable per-lesson keys, and email records move through explicit outbox states. Database constraints protect idempotency at the enrolment, submission-attempt, review, and certificate boundaries.

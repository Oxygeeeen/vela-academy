# Feature coverage

The repository implements the requested enterprise areas:

1. Authentication and authorisation — secure cookie sessions, hashing, lockout, revocation, RBAC.
2. Database and API integration — PostgreSQL, Drizzle schema/migration, validated route handlers.
3. Student enrolment — manual profile creation, temporary password, cohort assignment, welcome email.
4. Dates, schedules, and timezones — per-enrolment IANA timezone with Tuesday/Friday/Sunday releases.
5. Progression gates — release time plus prior pass, server-owned state transitions.
6. Lecture delivery — assets, video/resources, objectives, progress, duration, local deadlines.
7. Curriculum administration — programmes, phases, lessons, assessments, publishing, file upload.
8. Assessments and submissions — attempts, text/structured answers, status history, limits.
9. Reviewer workflow — queue, scoring, rubric payload, feedback, pass/change decisions.
10. Certification and capstone — final completion detection and public verification endpoint.
11. Student management — search, suspend, pause data model, password reset, session revocation.
12. Search/filter/pagination — bounded tenant-scoped endpoints and connected UI.
13. Reporting — live operational metrics and CSV export.
14. Calendar — custom events, learning releases, deadlines, and ICS export.
15. Notifications — in-app inbox, email outbox, reminders, retry handling.
16. Support — categorised tracked tickets and threaded messages.
17. Organisation and multi-tenancy — organisation settings, branding fields, per-tenant keys and filters.
18. Governance/privacy/security — audit log, consent, privacy export, retention settings, security headers.
19. Reliability/operations — authenticated cron jobs, idempotent constraints, health-oriented metrics, CI.
20. Accessibility/internationalisation — semantic controls, keyboard-ready components, theme modes, locale/timezone fields, captions/transcript asset types, responsive layouts.
21. Agent functionality — WebMCP navigation, curriculum/schedule retrieval, search, support, review-queue, and enrolment tools; each uses the same authenticated APIs and roles as the visible interface.

## Recommended delivery order

The implementation follows the risk-first sequence below. Keep this order for future environments and major extensions:

1. provision PostgreSQL and secrets;
2. apply schema and migration;
3. establish tenant, user, session, and audit boundaries;
4. seed or create programmes, phases, cohorts, and lessons;
5. enrol users and verify timezone release calculations;
6. validate lecture, submission, reviewer, and progression flows end to end;
7. connect Blob and email providers;
8. enable cron schedules;
9. validate reporting, privacy export, calendar, support, and certificate verification;
10. run unit, browser, security, accessibility, and restore tests before production traffic.

Provider-backed behaviour requires its environment variable: uploads need Vercel Blob, email delivery needs Resend, and all persistent features need PostgreSQL. When a provider is absent, the application preserves the database record or shows a controlled error rather than silently reporting success.

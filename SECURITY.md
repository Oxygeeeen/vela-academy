# Security policy

Do not open a public issue for a suspected vulnerability. Report it privately to the repository owner with reproduction steps, impact, affected version, and suggested remediation.

Never commit `.env.local`, database URLs, session or cron secrets, provider tokens, exported learner data, or production logs. Rotate a secret immediately if it is exposed.

Before each release, run `npm run verify`, review dependency advisories, apply database migrations in a controlled environment, verify tenant isolation, and confirm that backup restoration works. Production administrators should use unique passwords distributed through an approved secret channel and rotate every seeded credential.

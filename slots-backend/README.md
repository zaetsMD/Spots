# Spots backend

This Cloudflare Worker serves the complete Spots site from `../dist` and its API from the same origin. It uses the existing `slots` D1 database and `slots-logos` R2 bucket.

## Deploy

Production deploys run automatically from GitHub Actions after a push to `main`.
Add these repository secrets in GitHub before the first deploy:

- `CLOUDFLARE_API_TOKEN` — an API token with Workers Scripts edit permission and access to this account.
- `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account ID that owns the `slots-api` Worker, D1 database and R2 bucket.

The Worker serves the root project directory directly, so the root site files are the single source of truth. Backend, Git metadata and workflow files are excluded from the uploaded assets.

For a local deploy, from the repository root run:

```sh
cd slots-backend
npx wrangler deploy --config wrangler.jsonc
```

For a new database:

```sh
npx wrangler d1 execute slots --remote --file=schema.sql
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put MAILER_URL
npx wrangler secret put MAILER_TOKEN
npx wrangler secret put APPLICATIONS_STATS_URL
npx wrangler secret put APPLICATIONS_STATS_TOKEN
npx wrangler deploy
```

For an existing database, run each migration in `migrations/` once, in filename order, before deploying the worker. Migration `0002` adds the manually entered approval amount plus rejection timestamp:

```sh
npx wrangler d1 execute slots --remote --file=migrations/0002_add_review_amount_and_timestamps.sql
```

`MAILER_URL` and `MAILER_TOKEN` are added after the Gmail Apps Script is deployed as a private token-protected web endpoint. Until then, all application and review records work; email delivery is simply skipped.

`APPLICATIONS_STATS_URL` and `APPLICATIONS_STATS_TOKEN` connect the public applications counter to the token-protected Google Apps Script in `../gmail-application-stats.gs`. In Apps Script, set the project time zone to `Europe/Berlin`, add the same random token as the `STATS_TOKEN` script property, and deploy it as a web app that executes as the owner and is accessible to anyone. The Worker keeps the token private and exposes only aggregate counts. Without these secrets, the site falls back to 412 applications.

## Endpoints

- `POST /api/applications` — accepts `spot`, `website`, `email`, `message`, and `logo` multipart data.
- `GET /` — serves the public site and static assets from `../dist`.
- `GET /api/counts` — returns the Gmail-backed total and per-day application counts, with a 412 fallback.
- `GET /api/spots` — lists live spots for the public site.
- `GET /go/:applicationId` — records a click and redirects to the advertiser with `ref=spots`. Public sponsor links use `rel="sponsored"`.

Click tracking counts every redirect as a total click. A unique click is one IP + user-agent fingerprint per calendar day, so the current unique counter is best read as unique visitor-days. Before a spot expires, these counters are visible in the password-protected `/admin` page; the expiry email also reports the totals.
- `/admin` — password-protected review panel.
- `POST /api/admin/applications` — admin-only multipart form to create and immediately publish a spot (`spot`, `website`, `email`, `amount`, `logo`, optional `message`); sends no email.
- `DELETE /api/admin/applications/:id` — admin-only removal of any application and its logo; sends no email.

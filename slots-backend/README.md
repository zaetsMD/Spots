# Spots backend

This Cloudflare Worker serves the complete Spots site from `../dist` and its API from the same origin. It uses the existing `slots` D1 database and `slots-logos` R2 bucket.

## Deploy

For a new database:

```sh
npx wrangler d1 execute slots --remote --file=schema.sql
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put MAILER_URL
npx wrangler secret put MAILER_TOKEN
npx wrangler deploy
```

For an existing database, run each migration in `migrations/` once, in filename order, before deploying the worker. Migration `0002` adds the manually entered approval amount plus rejection timestamp:

```sh
npx wrangler d1 execute slots --remote --file=migrations/0002_add_review_amount_and_timestamps.sql
```

`MAILER_URL` and `MAILER_TOKEN` are added after the Gmail Apps Script is deployed as a private token-protected web endpoint. Until then, all application and review records work; email delivery is simply skipped.

## Endpoints

- `POST /api/applications` — accepts `spot`, `website`, `email`, `message`, and `logo` multipart data.
- `GET /` — serves the public site and static assets from `../dist`.
- `GET /api/spots` — lists live spots for the public site.
- `GET /go/:applicationId` — records a click and redirects to the advertiser with `utm_source=spots`, `utm_medium=sponsor`, and `utm_campaign=spot[number]`.

Click tracking counts every redirect as a total click. A unique click is one IP + user-agent fingerprint per calendar day, so the current unique counter is best read as unique visitor-days. Before a spot expires, these counters are visible in the password-protected `/admin` page; the expiry email also reports the totals.
- `/admin` — password-protected review panel.
- `POST /api/admin/applications` — admin-only multipart form to create and immediately publish a spot (`spot`, `website`, `email`, `amount`, `logo`, optional `message`); sends no email.
- `DELETE /api/admin/applications/:id` — admin-only removal of any application and its logo; sends no email.

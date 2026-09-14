# Spots backend

This is a standalone Cloudflare Worker for Spots. The current deployment continues to use the existing `slots` D1 database and `slots-logos` R2 bucket.

## Deploy

For a new database:

```sh
npx wrangler d1 execute slots --remote --file=schema.sql
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put MAILER_URL
npx wrangler secret put MAILER_TOKEN
npx wrangler deploy
```

For an existing database created before this rename, run `migrations/0001_rename_slot_to_spot.sql` once before deploying the worker.

`MAILER_URL` and `MAILER_TOKEN` are added after the Gmail Apps Script is deployed as a private token-protected web endpoint. Until then, all application and review records work; email delivery is simply skipped.

## Endpoints

- `POST /api/applications` — accepts `spot`, `website`, `email`, `message`, and `logo` multipart data.
- `GET /api/spots` — lists live spots for the public site.
- `GET /go/:applicationId` — records a click and redirects to the advertiser.
- `/admin` — password-protected review panel.

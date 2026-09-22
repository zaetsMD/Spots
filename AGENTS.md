# Repository workflow

## Production deployments

- Never deploy this project directly from a local checkout or an agent session.
- Do not run `wrangler deploy`, publish through the Cloudflare dashboard, or upload the static files manually.
- Make and verify changes locally, commit them to Git, and push the commit to the GitHub `main` branch. Pushing must not deploy automatically.
- Production is deployed only when a person manually runs `.github/workflows/deploy.yml` from GitHub Actions. The workflow deploys the selected Git commit.
- Do not expose, copy, or add production Cloudflare credentials to local files. Production credentials belong in GitHub Actions secrets.

For urgent fixes, use the same Git-first, manually triggered path so the deployed version always has a matching commit and can be rolled back.

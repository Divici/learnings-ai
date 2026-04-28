# Deploying Learnings AI to Railway

## One-time setup

1. **Install Railway CLI** (if not already):
   ```bash
   pnpm add -g @railway/cli
   railway login
   ```

2. **Create the Railway project** (interactive):
   ```bash
   cd "C:/Users/doa92/Desktop/Gauntlet Projects/learningsAI"
   railway init
   ```
   Answer prompts: name the project (e.g., `learnings-ai`), pick a region close to you (e.g., `us-west2` or `us-east4`).

3. **Add the Postgres + pgvector service.** In the Railway dashboard:
   - Click "+ New" → "Database" → "Add PostgreSQL".
   - Once provisioned, open the Postgres service → "Data" tab → connect via "psql" or run a query: `CREATE EXTENSION IF NOT EXISTS vector;` (Railway's stock Postgres image doesn't ship with pgvector pre-loaded — you may need the pgvector flavor, or use the [Postgres + pgvector template](https://railway.app/template/pgvector) which has it baked in).

4. **Configure env vars on the `web` service.** In the Railway dashboard or via CLI:
   ```bash
   railway variables --set DATABASE_URL='${{Postgres.DATABASE_URL}}'
   railway variables --set DATABASE_URL_UNPOOLED='${{Postgres.DATABASE_PUBLIC_URL}}'
   railway variables --set LEARNINGS_AI_TOKEN="$(openssl rand -hex 32)"
   railway variables --set NEXT_PUBLIC_APP_URL="https://<your-railway-domain>"
   railway variables --set NODE_ENV=production
   ```
   Save the `LEARNINGS_AI_TOKEN` value somewhere safe — you'll need it to log into the deployed app. (For OpenRouter integration in later plans, you'll add `OPENROUTER_API_KEY` then.)

5. **Confirm the build command picks up `railway.toml`.** The repo's `railway.toml` should be detected automatically. If not, paste the contents into the service's Build settings.

## Deploying

From the project root:

```bash
railway up
```

This pushes the current working tree to Railway, runs the build (`pnpm install --frozen-lockfile && pnpm db:migrate && pnpm db:seed && pnpm build`), then starts the server (`pnpm start`).

Watch the deploy logs for:
- Migration success: `[migrate] X migrations applied`.
- Seed success: `seeded settings singleton`.
- Build success: Next.js build summary with route table.
- Server start: `Ready on http://0.0.0.0:3000`.

## Verifying

```bash
curl https://<your-railway-domain>/api/health
```

Expected:
```json
{
  "ok": true,
  "db_ok": true,
  "llm_ok": null,
  "version": "0.1.0",
  "checked_at": "2026-04-27T...",
  "db_latency_ms": 12
}
```

If `db_ok: false`: check that `pgvector` extension is created in the Postgres service, and that `DATABASE_URL` points at the right place.

Visit the URL in a browser. You should see the auth gate. Paste the `LEARNINGS_AI_TOKEN` from step 4 above to unlock.

## Subsequent deploys

After making changes locally:

```bash
git push origin main           # if you've pushed to GitHub; optional
railway up                     # always — this is the actual deploy command
```

`railway up` runs against the local working tree (not GitHub), so committing to GitHub is optional but recommended for backup.

## Rollback

```bash
railway down --service web --to <previous-deploy-id>
```

Or use the Railway dashboard's deploy history to roll back via UI.

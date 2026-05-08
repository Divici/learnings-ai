# Deploying Learnings AI to Railway

## One-time setup

1. **Install Railway CLI** (if not already) and log in:
   ```bash
   pnpm add -g @railway/cli
   railway login
   ```
   The `railway login` command must be run in a real interactive terminal — it opens a browser for OAuth.

2. **Create the Railway project**:
   ```bash
   cd "C:/Users/doa92/Desktop/Gauntlet Projects/learningsAI"
   railway init
   ```
   Name it `learnings-ai`, pick a region close to you (e.g., `us-east4` or `us-west2`).

3. **Add the Postgres + pgvector service via template** (do this in the dashboard, not the CLI). The default Railway Postgres image does NOT ship with the `pgvector` extension, but our schema uses `vector(1024)` columns for embeddings, so we MUST use the pgvector template:
   - Open the Railway dashboard for the project.
   - Click **+ Create** → **Template** → search **pgvector** → deploy [Postgres pgvector](https://railway.app/template/pgvector).
   - The service will be named `pgvector` (this matters — env-var references below depend on the exact name).
   - Wait ~30s for it to provision.

4. **Configure env vars on the web service.** ⚠️ The pgvector template exposes **non-standard variable names** — see [Gotchas](#gotchas) below for context.

   Link the web service first, then set the vars:
   ```bash
   railway service link learnings-ai
   railway variables \
     --set 'DATABASE_URL=${{pgvector.DATABASE_URL_PRIVATE}}' \
     --set 'DATABASE_URL_UNPOOLED=${{pgvector.DATABASE_URL}}' \
     --set "LEARNINGS_AI_TOKEN=$(openssl rand -hex 32)" \
     --set 'NEXT_PUBLIC_APP_URL=https://<your-railway-domain>' \
     --set 'NODE_ENV=production'
   ```

   Variable mapping rationale:
   - `DATABASE_URL` → **internal** hostname (`pgvector.railway.internal`). Used by `lib/db/index.ts` at runtime — fastest path inside Railway's private network.
   - `DATABASE_URL_UNPOOLED` → **public proxy** URL (`tramway.proxy.rlwy.net:<port>`). Used by `drizzle.config.ts` and `scripts/seed.ts` during the build phase, where private DNS does NOT resolve.

   The `LEARNINGS_AI_TOKEN` value is what you paste at `/auth` to unlock the app — save it. Retrieve any time with `railway variables --kv | grep LEARNINGS_AI_TOKEN`. (For OpenRouter integration in Plan 2+, add `OPENROUTER_API_KEY` then.)

5. **Generate the public domain** (if not already auto-assigned):
   ```bash
   railway domain
   ```
   Update `NEXT_PUBLIC_APP_URL` to this value.

6. **Confirm the repo is wired for Node 22 and reads `railway.toml`.** Both the `.nvmrc` (`22`) and `package.json` `engines.node` field (`>=22.0.0`) tell Nixpacks to use Node 22 — required because Next.js 16 needs Node ≥20.9 and Nixpacks defaults to Node 18. The build/deploy commands come from `railway.toml`.

## Deploying

From the project root:
```bash
railway up
```

This uploads the current working tree to Railway (independent of the GitHub remote), runs:
```
pnpm install --frozen-lockfile && pnpm db:migrate && pnpm db:seed && pnpm build
```
then starts the server (`pnpm start`).

Healthy build log markers:
- `[✓] migrations applied successfully!` — Drizzle migrate.
- `seeded settings singleton` — `scripts/seed.ts` succeeded.
- Next.js build summary table — `pnpm build` complete.
- Status flips to `DEPLOYING` then `SUCCESS`.

If you've connected the project to GitHub (Settings → Source), pushes to `main` will also trigger deploys automatically. `railway up` and the GitHub-integration path are independent — either works.

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
  "checked_at": "2026-05-08T...",
  "db_latency_ms": 12
}
```

`llm_ok: null` is correct until `OPENROUTER_API_KEY` is set in Plan 2.

Visit the URL in a browser. You should see the auth gate. Paste `LEARNINGS_AI_TOKEN` to unlock.

## Subsequent deploys

```bash
railway up           # uploads working tree, deploys immediately
# or, if GitHub integration is on:
git push origin main # triggers an auto-deploy from the connected branch
```

## Gotchas

**The pgvector template uses different variable names than Railway's stock Postgres.** Stock Postgres exposes `DATABASE_URL` (private) + `DATABASE_PUBLIC_URL` (proxy). The pgvector template exposes `DATABASE_URL` (proxy!) + `DATABASE_URL_PRIVATE` (internal). The naming is inverted. If you reference `${{pgvector.DATABASE_PUBLIC_URL}}` it silently resolves to empty string — Drizzle will then crash with `url: undefined` at the migrate step.

**Build-phase scripts can't reach `*.railway.internal` hostnames.** Railway's private network is only available at runtime, not in the Nixpacks build container. That's why `drizzle.config.ts` (build-time migrate) and `scripts/seed.ts` (build-time seed) both use `lib/db/oneshot-url.ts`'s `resolveOneShotDatabaseUrl(env)` helper, which prefers `DATABASE_URL_UNPOOLED` (public proxy) over `DATABASE_URL`.

**Next.js 16 requires Node ≥20.9.0.** Nixpacks defaults to Node 18.20.5, which fails the `pnpm build` step with `Node.js version ">=20.9.0" is required`. The `.nvmrc` + `engines.node` pin Node 22 so this is handled automatically — don't remove either file.

**`railway logs --build` only shows the latest completed build's logs.** It's not a live tail of an in-progress build. To watch a deploy in progress, poll `railway service status` (returns `BUILDING` → `DEPLOYING` → `SUCCESS`/`FAILED`) or watch the dashboard.

## Rollback

```bash
railway down --service learnings-ai --to <previous-deploy-id>
```

Or use the Railway dashboard's deploy history to roll back via UI.

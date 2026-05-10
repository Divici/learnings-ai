# Claude Code Context — Learnings AI

## What this project is

Personal AI engineering tool with two surfaces: a flashcard-based **Learning** review system over Gauntlet AI lecture material, and a wizard-driven **Planning** tab that produces senior-engineer-style system design walkthroughs from app ideas.

See [`PRD.md`](./PRD.md) for product intent and [`docs/superpowers/specs/2026-04-27-learnings-ai-design.md`](./docs/superpowers/specs/2026-04-27-learnings-ai-design.md) for the implementation spec. Visual fidelity to [`docs/design/lumina-style-reference.html`](./docs/design/lumina-style-reference.html).

## Stack

Next.js (App Router) + TypeScript (strict) + Tailwind v4 + shadcn/ui + Drizzle ORM + Postgres 16 + pgvector + OpenRouter (Claude Haiku/Sonnet, Voyage embeddings) + Railway.

## Where things live

- `app/` — Next.js routes and API endpoints. Per spec § 2.1.
- `components/` — UI primitives. `glass/` holds the design-system base components; everything else composes them.
- `lib/` — domain modules. Each subdirectory has one job (`auth/`, `db/`, `llm/`, `srs/`, `grading/`, `planning/`, `ingest/`, `retrieval/`, `log/`).
- `db/migrations/` — Drizzle Kit-generated SQL.
- `gauntlet_ai_resources/` — Gauntlet markdown lectures (input to the ingest pipeline). Each file uses `## Page N` boundaries.
- `tests/{unit,component,e2e,fixtures}/` — three test layers + shared helpers.
- `docs/superpowers/{specs,plans}/` — product design + implementation plans.
- `docs/adr/` — architecture decision records (numbered).

## Conventions

- **TDD always** (per `~/.claude/rules/tdd.md`). Every behavior change starts with a failing test. Bug fixes start with a regression test.
- **Strict TypeScript**: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` all on.
- **Pure modules where possible**: `lib/srs/`, `lib/planning/stages/`, and graders are designed to take state in and return state out, no hidden side effects.
- **Single source of truth for config**: `lib/env.ts` validates and exports all env vars. Don't read `process.env` elsewhere.
- **Glass visual system**: every new surface composes `GlassPanel` / `GlassCard` rather than styling from scratch. Color tokens in `app/globals.css` `:root`.
- **Auth**: every protected route is gated by `middleware.ts`; `/auth`, `/api/health`, and logout are the only public paths.
- **Commits**: short imperative-style, lowercase start, single-sentence (per `~/.claude/rules/commit-message.md`). Include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>` for AI-assisted work.

## Common tasks

- New table → add to `lib/db/schema.ts`, run `pnpm db:generate`, review/edit the generated SQL, run `pnpm db:migrate`.
- New page → create under `app/<route>/page.tsx`. If protected, no extra work — middleware covers it.
- New LLM-touching server route → use `lib/llm/` client (added in Plan 2). Always log to `llm_calls`.
- New component → place in `components/<area>/`. Add a `tests/component/<name>.test.tsx`. Run `pnpm test:component`.
- Ingest new lecture markdown → drop the file in `gauntlet_ai_resources/`, then `pnpm ingest`. Re-runs are idempotent (file hash + corpus signature). Use `--dry-run` to preview chunk counts without LLM calls.

## What NOT to do

- Don't read `process.env` outside `lib/env.ts`.
- Don't issue raw SQL outside `lib/db/`. All queries go through Drizzle for parameterization + types.
- Don't add cookies / sessions / user tables. Single-user via env-secret token only.
- Don't skip the failing-test step. Even for visual changes, write a component test first.
- Don't expose `LEARNINGS_AI_TOKEN`, `OPENROUTER_API_KEY`, or any secret in logs (the pino redaction config catches common cases — but be careful in custom log calls).

## What was deliberately not built

Per user direction (post-launch simplification of the Foundation plan):

- **Sentry** — single-user app + Railway log streaming covers error visibility.
- **GitHub Actions CI** — solo dev workflow, Railway build runs tests on deploy.
- **Testcontainer integration tests** — Docker is not used on this dev machine; schema verification happens on Railway deploy.

If you're tempted to add any of the above, confirm with the user first.

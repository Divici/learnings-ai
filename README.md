# Learnings AI

A personal AI engineering tool with two surfaces — a flashcard-based **Learning** review system over the user's Gauntlet AI lecture material, and a wizard-driven **Planning** tab that produces senior-engineer-style system design walkthroughs from app ideas.

See [`PRD.md`](./PRD.md) for product intent and [`docs/superpowers/specs/2026-04-27-learnings-ai-design.md`](./docs/superpowers/specs/2026-04-27-learnings-ai-design.md) for the implementation spec.

## Stack

Next.js (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Drizzle + Postgres + pgvector · OpenRouter (Claude Haiku/Sonnet, Voyage embeddings) · Railway.

## Local Setup

Prerequisites: Node 20+, pnpm 9+, Postgres 16 with `pgvector`, Railway CLI (for deploys).

```bash
cp .env.example .env.local
# fill in values

pnpm install
pnpm db:migrate
pnpm dev
```

Visit `http://localhost:3000`. Paste your `LEARNINGS_AI_TOKEN` at `/auth`.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Start dev server with Turbopack |
| `pnpm build` | Production build |
| `pnpm test:unit` | Vitest unit tests |
| `pnpm test:component` | Vitest component tests |
| `pnpm test:e2e` | Playwright E2E (auto-starts preview) |
| `pnpm db:generate` | Drizzle Kit: generate SQL from schema |
| `pnpm db:migrate` | Apply pending migrations |

## Documentation

- [`PRD.md`](./PRD.md) — product requirements
- [`docs/superpowers/specs/`](./docs/superpowers/specs/) — implementation specs
- [`docs/superpowers/plans/`](./docs/superpowers/plans/) — implementation plans
- [`docs/adr/`](./docs/adr/) — architecture decision records
- [`docs/design/`](./docs/design/) — visual reference HTML

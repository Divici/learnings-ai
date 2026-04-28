# 0001 — Stack choice: Next.js + Drizzle + Postgres + Railway

**Status:** Accepted (2026-04-27)

## Context

Building a personal AI engineering tool with two surfaces (Learning + Planning). Requirements: SSE streaming, server-rendered components, an embeddable vector store, a single deployment target, single-user auth.

## Decision

- **Framework:** Next.js (App Router) — Server Components + SSE streaming + first-class TypeScript.
- **ORM:** Drizzle — typed schema, migration tooling, no codegen step.
- **Database:** Postgres 16 with pgvector — keeps the data layer to one DB instead of running a separate vector store.
- **Hosting:** Railway — Postgres + Next.js in one project; supports long-running connections better than Vercel for SSE-heavy workloads.

## Alternatives considered

- **Vite + Express + Pinecone**: more components, no SSR, would need a second deploy target.
- **Qdrant for vectors**: better at scale but unnecessary for ~150 chunks.
- **Vercel**: simpler but Vercel's serverless model fights long SSE streams.

## Consequences

- One repo, one deploy, one DB.
- pgvector limits us to ~1M vectors before we'd want to migrate; well above this project's needs.
- Switching providers later is straightforward (Drizzle is portable to most Postgres).

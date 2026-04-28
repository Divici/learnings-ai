# Learnings AI — Product Requirements Document

> **Status:** Locked after brainstorming (2026-04-27).
> **Implementation spec:** [`docs/superpowers/specs/2026-04-27-learnings-ai-design.md`](./docs/superpowers/specs/2026-04-27-learnings-ai-design.md)
> **Visual reference:** [`docs/design/lumina-style-reference.html`](./docs/design/lumina-style-reference.html)

---

## 1. Product Summary

Learnings AI is a personal AI engineering tool with two surfaces:

1. **Learning** — a flashcard-based reinforcement system for the user's Gauntlet AI lecture material. Spaced repetition with SM-2 scheduling; mixed card types (multiple-choice, cloze, free-response). Strictly a review surface — it exists so the user can return to it over time and continue cementing concepts they have already studied.
2. **Planning** — a system-design-walkthrough generator. The user types an app idea and the app produces a structured walkthrough modeled on a senior engineer running a system design interview: functional requirements, non-functional requirements, core entities, API, high-level design (with diagram), deep dives, and a verification pass. Output is exportable as markdown.

The two tabs are intentionally decoupled. There is no cross-linking, no mastery feedback loop from Planning into Learning, and no reverse loop from Planning recommendations back into the review queue. Each surface does one thing well.

---

## 2. Problem

The user is learning AI engineering quickly through lectures, decks, and project work. Two things go wrong without a tool:

1. **Retention decays.** Concepts seen once in a lecture fade unless actively recalled.
2. **Architecture intuition stays shallow.** Knowing what RAG is is not the same as knowing when to reach for it, when not to, and what the alternatives cost.

Learning addresses #1. Planning addresses #2. They are separate problems served by separate tools that happen to share a visual shell and an ingestion pipeline.

---

## 3. Vision

A polished personal AI engineering companion that makes daily review frictionless and turns vague app ideas into senior-quality system design walkthroughs.

---

## 4. Reference Material

**Primary source of truth:** the user's uploaded Gauntlet AI lecture markdown files in `/sources/`. Initial set (six files):

- `AI_Agents_Lecture.md`
- `Designing RAG Systems.md`
- `Introduction to RAG, Fusion, & Similarity Search.md`
- `recording_1771968245636_slides.md`
- `slides.md`
- `spec-driven development.md`

**Style reference for Planning output:** `Uber System Design Walkthrough.md` — used as the structural template for what a "good" Planning output looks like (functional → non-functional → entities → API → high-level → deep dives, with explicit out-of-scope callouts and tradeoff framing).

**Known knowledge gap:** multimodal RAG / vision-based retrieval has no source coverage. Out of scope for this build.

---

## 5. Product Principles

1. **Grounded in source material (Learning side).** Every flashcard is tied to specific source chunks; "view source" is one click away.
2. **Architectural reasoning over generic advice (Planning side).** Output mirrors the Uber walkthrough's structure: tight, opinionated, tradeoffs explicit, out-of-scope items called out by name.
3. **Active recall, not passive reading.** Learning forces the user to answer before showing the answer.
4. **Tradeoffs visible.** Planning's deep dives always frame as *naïve approach → why it breaks → better approach → tradeoffs*. No silent recommendations.
5. **Polished and complete from day one.** This is not an MVP. Cross-cutting concerns (auth, observability, error handling, accessibility, testing) are part of the build, not deferred.

---

## 6. Target User

The creator. Single-user app. Opinionated for one practitioner workflow: actively studying AI engineering material and actively planning real builds. No multi-user features, no auth flows beyond an env-secret token to protect the deployed URL.

---

## 7. User Jobs To Be Done

### Learning

- Help me revisit concepts from Gauntlet lectures repeatedly so they stick.
- Help me distinguish between similar concepts (RAG vs fusion, ReAct vs LLM+tools).
- Quiz me on tradeoffs and "when to use" judgments, not just definitions.
- Track which concepts I'm weak on and surface them more often.

### Planning

- Take my app idea and produce a senior-engineer system-design walkthrough.
- Force me to confirm/edit each stage before moving on (interview pacing, not a wall of text).
- Show me real architectural tradeoffs, not vendor pitches.
- Let me export the result as markdown to seed a build.

---

## 8. Core Product Surfaces

## 8.1 Learning

**Mode 1 — SRS Daily Queue.** The default and primary experience. Open the app, the queue shows what's due based on SM-2 scheduling. Review one card at a time. Three card types are mixed in:

- **Multiple choice** (4 options, deterministic grading)
- **Cloze deletion** (fill-in-the-blank with typo tolerance)
- **Free response** (LLM-graded against a per-card rubric)

After answering, the user grades themselves Anki-style: Again / Hard / Good / Easy (1-4). The grade feeds SM-2; the next due date updates.

**Mode 2 — Topic-Pick.** A side mode for when the user wants to focus on a specific concept. Pick a concept, get a session of N cards from that concept. Two toggles:

- **Generate variants** — calls Claude Haiku to produce live rephrasings of base cards. Useful when the same prompts feel stale.
- **Count toward SRS** — when on, grades update the parent card's review state. When off, it's pure practice with no scheduling effect.

**Card bank construction.** A one-pass ingestion script chunks the source markdown, extracts concepts, and pre-generates a fixed card bank (8 cards/concept, 3 MC + 3 cloze + 2 freeform). Re-ingesting a changed file refreshes its chunks; obsolete cards are soft-disabled (review history preserved) and new cards are added.

**Card editor.** A table view of the entire card bank. Edit prompts/answers/options/rubrics, disable bad cards, regenerate single cards via Claude. Critical because the only thing that quietly kills SRS adherence is bad cards in the deck.

## 8.2 Planning

**Wizard pacing.** A user enters their app idea and the planner walks them through seven stages, one at a time. After each stage completes, the user can edit, regenerate, or accept and continue. Editing an upstream stage marks downstream stages stale (yellow border + "regenerate to refresh" CTA); regeneration is explicit, never automatic.

The seven stages match the Uber walkthrough structure plus a final verification:

| # | Stage | Output |
|---|---|---|
| 1 | Functional Requirements | "Users should be able to..." statements + explicit out-of-scope items |
| 2 | Non-Functional Requirements | Quality + contextualized + quantified for each. CAP choice if relevant. |
| 3 | Core Entities | Bullet list with 3-6 fields each (not a full schema) |
| 4 | API Design | One endpoint per functional requirement, REST verbs, no over-typing |
| 5 | High-Level Design | Prose walkthrough + auto-validated mermaid diagram + component list |
| 6 | Deep Dives | User picks 2-3 from suggested candidates. Each: naïve → problems → better → tradeoffs |
| 7 | Verification | Snapshot check across all stages: unsupported claims, overengineering, missing eval/guardrail considerations, pattern fit. Issues grouped by severity. |

**Grounding.** Planning is *not* RAG-grounded by default. The Claude Sonnet model already knows AI architecture deeply; ingesting the six lectures into the planner adds latency without making it smarter. The planner cites Gauntlet material only when a user's idea naturally maps to a covered topic (e.g., a RAG-heavy app prompt may surface lecture references).

**Export.** Once any stage is complete, the user can export the session as a structured markdown document — title, date, all stages with prose and mermaid in fenced code blocks, verification issues grouped by severity. Suitable for pasting into a PRESEARCH.md or PRD seed.

---

## 9. Visual Design

The visual system matches `docs/design/lumina-style-reference.html` with perfect fidelity:

- Glassmorphism throughout (heavy backdrop-blur for major panels, light for inner cards).
- Watercolor blob background (blue/purple/teal) + 4% noise overlay, animated.
- Floating pill header (centered, glass-panel rounded-full).
- Persistent left sidebar (avatar, primary nav, "Current Focus" topic folders, 21-day activity heatmap).
- Phosphor icons throughout.
- Inter (sans) + JetBrains Mono (code/labels/timestamps).
- 3D flip flashcard for Learning reviews — front face shows the prompt and answer area, back face shows the answer and grading; flip animation 600ms cubic-bezier.
- Vertical timeline for Planning stages — gradient line (blue → purple → fade), node circles with status (completed = green check + glow, in-progress = blue pulse + ping ring, locked = dim, stale = amber).
- Color tokens: `--accent-blue #3b82f6`, `--accent-purple #8b5cf6`, `--accent-teal #14b8a6`, dark surface `#050508`.
- Dark mode default; light theme parallel palette ships at the same time.

---

## 10. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) | Forge default; supports Server Components + SSE streaming |
| Language | TypeScript (strict) | All code |
| UI | shadcn/ui + Tailwind v4 | Primitives wrapped to apply the glass visual system |
| Icons | `@phosphor-icons/react` | Match mockup |
| Database | Postgres 16 + pgvector | Single DB; no separate vector store |
| ORM | Drizzle | Typed schema + migrations |
| LLM gateway | OpenRouter | Single API, easy model swapping |
| Models | Claude Haiku 4.5 (bulk gen, grading), Claude Sonnet 4.6 (planner reasoning), `voyage-3` (embeddings) | Configurable in settings |
| Auth | Env-secret token cookie | Single user, no Clerk/NextAuth |
| Deployment | Railway | Postgres + web service in one project |
| Observability | pino structured logs + Sentry + `llm_calls` cost ledger | |
| Testing | Vitest + RTL + Playwright + axe-core | TDD per global rule |

---

## 11. Functional Requirements

### 11.1 Content Ingestion
- Two-pass pipeline: chunk + embed (per file, idempotent by content hash); concept + card synthesis (corpus-wide, idempotent by corpus signature).
- Heading-aware chunking targeting 200-500 tokens per chunk; preserves heading paths and slide/page references.
- Soft topic tagging at ingest time using a fixed tag list.
- Re-ingestion preserves SRS history: obsolete cards are soft-disabled, never deleted.

### 11.2 Knowledge Layer
- pgvector HNSW index over chunk embeddings.
- Concept extraction produces a small graph: each concept lists its constituent chunk IDs and parent topic.
- "View source" available on every flashcard, opening the linked chunks.

### 11.3 Learning Engine
- SM-2 scheduler implemented as pure functions (typed, side-effect-free, table-test-driven).
- Daily queue prioritized by overdue-ness with intra-bucket interleaving by concept (no two consecutive cards from the same concept).
- Mixed card types per Section 8.1.
- Free-response grading via single Claude Haiku call against a per-card rubric, returning per-criterion scores + summary feedback + suggested follow-up concept.
- Card editor + per-card disable/regenerate.

### 11.4 Planning Engine
- Seven-stage wizard per Section 8.2.
- Each stage is a pure async function in `lib/planning/stages/`, taking prior state and returning typed output validated by Zod.
- Server-Sent Events stream stage output to the UI.
- Mermaid output is parse-validated server-side; one auto-retry on syntax error.
- Edit/staleness propagation: editing stage N flags stages N+1..7 stale; regeneration is explicit.
- Verification stage runs a structured checklist; issues grouped by severity; "Apply suggestion" injects fixes as user edits.
- Export to markdown via templated renderer.

### 11.5 Cross-Cutting (Per Section 5 Principle)
- Auth, observability, error handling, accessibility, and testing are part of the design from day one — not "v2."
- LLM calls auto-retry with exponential backoff (3 attempts).
- Every LLM call writes a row to `llm_calls` (cost, latency, status).
- Hard monthly cost cap configurable in settings.
- Per-IP rate limiting on LLM-triggering routes.

---

## 12. Non-Goals

This build does **not** include:

- Multi-user features, social/learning collaboration, or shared decks.
- A public content marketplace.
- Concept graph visualization or knowledge map UI.
- Cross-linking from Planning recommendations into Learning queue.
- Mastery model that feeds Planning recommendations.
- Multimodal (image/vision) RAG.
- Game mechanics, simulation, or competitive elements.
- A coding agent that generates application code from Planning output.
- Mobile-native apps (responsive web only).

These are explicit non-goals, not deferred features. They are not in the build.

---

## 13. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Bad cards in the bank kill SRS adherence | Card editor is first-class. Disable + regenerate are one click each. Soft-disable preserves history. |
| Planner hallucinates patterns not grounded in requirements | Verification stage explicitly checks for unsupported claims and overengineering. |
| Mermaid syntax errors break the diagram | Server-side parse validation + one auto-retry; falls back to prose with a "regenerate diagram" button. |
| Cost runaway from a leaked URL or runaway loop | Per-IP rate limiting + monthly hard cap + per-call cost ledger visible in Settings. |
| Source material updates orphan SRS history | Re-ingest soft-disables obsolete cards instead of deleting them. |
| Single user means single point of failure for backups | Railway daily snapshots + weekly off-platform `pg_dump` to Backblaze B2. |

---

## 14. Open Questions

None blocking the build. Decisions deferred to the implementation phase only:

- Exact monthly cost cap default (suggested $50/month — adjustable in Settings).
- Number of cards per concept at ingest (suggested 8, mixed types — configurable in Settings).
- Daily review target default (suggested 20 cards/day — slider 5-50).

---

## 15. Acceptance Criteria

The build is considered complete when:

- All seven sections of the implementation spec are implemented.
- Every test layer passes (unit ≥ 90% on `lib/`, component ≥ 75%, E2E happy paths green, axe-core 0 violations on every page).
- Visual regression matches the mockup within 0.1% diff threshold across all routes × states × themes × motion preferences.
- Daily review of all three card types works end-to-end with grading flowing into SM-2 state.
- A full planning session can be created, navigated through all seven stages, edited with stale propagation working, verified, and exported as markdown.
- The deployed app on Railway passes its `/api/health` check; Sentry receives test errors; cost ledger populates after the first reviews.
- Documentation deliverables exist: `README.md`, `CLAUDE.md`, `docs/sources.md`, `docs/runbook.md`, `docs/qa-checklist.md`, ADRs `0001` through `0005`.

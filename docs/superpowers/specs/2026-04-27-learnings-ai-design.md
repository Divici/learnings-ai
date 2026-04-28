# Learnings AI — Implementation Design Spec

**Date:** 2026-04-27
**Status:** Approved by user, ready for implementation planning
**PRD:** [`/PRD.md`](../../../PRD.md)
**Visual reference:** [`/docs/design/lumina-style-reference.html`](../../design/lumina-style-reference.html)
**Style reference for Planning output:** [`/Uber System Design Walkthrough.md`](../../../Uber%20System%20Design%20Walkthrough.md)

---

## 1. Overview

Learnings AI is a single-user web app with two surfaces — a flashcard-based **Learning** tab over the user's Gauntlet AI lecture material, and a wizard-driven **Planning** tab that produces senior-engineer-style system design walkthroughs from app ideas. Both surfaces share an ingestion pipeline that chunks and embeds the source markdown, but the two tabs are otherwise decoupled.

This document specifies the implementation in seven sections matching the brainstorming structure: high-level architecture, data model, ingestion pipeline, learning engine, planning engine, UI/visual system, and cross-cutting concerns.

This is not an MVP. Per the user's standing rule, the build targets a polished, complete product with cross-cutting concerns (auth, observability, error handling, accessibility, testing) implemented from day one.

---

## 2. High-Level Architecture & Components

### 2.1 Topology

```
┌──────────────────────────────────────────────────────────────────┐
│                      Next.js (App Router)                         │
│                                                                   │
│  /                  → redirect → /learning                        │
│  /learning          → SRS queue + active session                  │
│  /learning/topics   → Topic-pick mode                             │
│  /learning/cards    → Card editor                                 │
│  /planning          → Sessions list + new-session input           │
│  /planning/[id]     → Wizard timeline (7 stages)                  │
│  /settings          → Daily target, models, sources, costs, auth  │
│  /auth              → Paste-token entry                           │
│                                                                   │
│  /api/review/grade           POST card grade → SM-2 update        │
│  /api/review/freeform-grade  POST → Claude Haiku grades           │
│  /api/cards/regenerate-variant  POST topic-mode live variant      │
│  /api/cards/[id]             PATCH/DELETE card edits              │
│  /api/cards/[id]/regenerate  POST regenerate single card          │
│  /api/planning/sessions      POST new session                     │
│  /api/planning/[id]/stage    POST advance/regenerate (SSE stream) │
│  /api/planning/[id]/edit     POST stage edit                      │
│  /api/planning/[id]/export   GET → markdown file                  │
│  /api/ingest                 POST trigger ingestion (also CLI)    │
│  /api/health                 GET status                           │
└──────────────────────────────────────────────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
       ┌─────────────┐   ┌─────────────┐   ┌──────────────┐
       │ Postgres +  │   │ OpenRouter  │   │  Local FS    │
       │  pgvector   │   │  → Claude   │   │  /sources/   │
       │             │   │             │   │  *.md        │
       │  • chunks   │   │ Haiku 4.5:  │   │              │
       │  • concepts │   │  - card gen │   │              │
       │  • cards    │   │  - grading  │   │              │
       │  • reviews  │   │ Sonnet 4.6: │   │              │
       │  • attempts │   │  - planner  │   │              │
       │  • sessions │   │ voyage-3:   │   │              │
       │  • llm_calls│   │  - embeds   │   │              │
       └─────────────┘   └─────────────┘   └──────────────┘
```

### 2.2 Internal modules (`lib/`)

| Module | Responsibility |
|---|---|
| `lib/llm/` | OpenRouter client, model routing (Haiku vs Sonnet vs voyage-3), retry/backoff, structured-output helper (Zod-validated JSON), SSE streaming helpers |
| `lib/ingest/` | Markdown chunker, embedder, concept extractor, card generator. Runnable as CLI (`pnpm ingest`) and via `/api/ingest`. |
| `lib/retrieval/` | pgvector similarity search, source-chunk lookup by card, optional MMR reranking |
| `lib/srs/` | SM-2 scheduler (pure functions: `nextReview(state, grade) → state`), due-queue query, mastery aggregates |
| `lib/grading/` | Free-response grader (Claude Haiku call with rubric), MC and cloze deterministic graders |
| `lib/planning/` | Seven stage runners (each pure async fn taking prior state in, returning next state out), mermaid validator, verification checker, markdown exporter |
| `lib/db/` | Drizzle schema + typed query helpers |
| `lib/auth/` | Single-user middleware: validates `LEARNINGS_AI_TOKEN` env secret on protected routes |
| `lib/log/` | Pino structured logger |

### 2.3 Module boundaries — design rationale

- `lib/srs` is pure functions (testable without DB).
- `lib/planning` decomposes into seven stage runners that each take state in and return state out — no hidden side effects, easy to test stage-by-stage.
- `lib/llm` is the only place that knows about OpenRouter. Provider swap is a one-file change.
- `lib/ingest` is the only place that touches the filesystem.
- `lib/db` is the only place that issues queries; everything else uses typed helpers.

### 2.4 Cross-cutting baked in

- **Observability:** structured logs (pino) on every LLM call (model, tokens in/out, latency, cost). Sentry for error tracking. Per-stage planner timings persisted in `llm_calls` for cost dashboards.
- **Error handling:** OpenRouter failures retry with exponential backoff (3 attempts: 1s, 4s, 16s). Mermaid validation failures auto-reprompt once with the parse error. Stale planner stages flagged when upstream stage edited.
- **Auth:** middleware checks for `LEARNINGS_AI_TOKEN` cookie on all routes except `/auth`. No login UI, no user table.
- **Accessibility:** keyboard-first review (1-4 grade keys, Anki standard). Focus management on stage transitions. shadcn primitives accessible by default (Radix under the hood).

---

## 3. Data Model

Drizzle ORM. Postgres 16 with pgvector extension. All tables get `created_at` / `updated_at` `timestamptz` columns by convention; only specific columns called out below.

### 3.1 Sources & Knowledge

```ts
source_files
  id              uuid pk
  filename        text                        // "Designing RAG Systems.md"
  title           text
  content_hash    text                        // sha256, used for re-ingest detection
  ingested_at     timestamptz
  chunk_count     int

source_chunks
  id              uuid pk
  file_id         fk → source_files (cascade)
  position        int                         // order within file
  content         text
  heading_path    text[]                      // ["Page 3", "Why fusion matters"]
  embedding       vector(1024)                // voyage-3 dimension
  token_count     int
  topic_tags      text[]                      // soft-tagged at ingest by Haiku
  index hnsw on (embedding vector_cosine_ops)

concepts
  id                      uuid pk
  name                    text uniq           // "RAG Fundamentals", "ReAct Loop"
  canonical_summary       text                // 2-3 sentences, generated at ingest
  parent_topic            text                // "retrieval", "agents", "evals", ...
  source_chunk_ids        uuid[]              // chunks covering this concept

concept_notes              -- user-added notes attached to a concept
  id              uuid pk
  concept_id      fk → concepts (cascade)
  content         text
```

### 3.2 Cards & Reviews

```ts
cards
  id                uuid pk
  concept_id        fk → concepts (restrict)
  card_type         enum('mc' | 'cloze' | 'freeform')
  prompt            text
  canonical_answer  text                      // free-text reference answer
  rubric            jsonb                     // freeform: [{criterion, weight}, ...]
  mc_options        jsonb                     // mc: [{text, isCorrect}]
  cloze_answers     jsonb                     // cloze: [{cloze_id: "c1", answer: "fusion"}]
  explanation       text                      // shown after grading
  source_chunk_ids  uuid[]                    // for "view source"
  difficulty        smallint                  // 1-3
  parent_card_id    fk → cards null           // null = base; set = live-gen variant
  is_live_generated boolean default false
  is_disabled       boolean default false     // user-curated bad cards
  created_at        timestamptz

review_state                                  -- per-card SM-2 state
  card_id           fk → cards pk
  ease              real default 2.5          // EF, floor 1.3
  interval_days     real default 0
  repetitions       int default 0
  lapses            int default 0
  due_at            timestamptz null          // null = unseen
  last_grade        smallint null             // 1=Again 2=Hard 3=Good 4=Easy
  last_reviewed_at  timestamptz null
  index on (due_at)

attempts                                      -- every review attempt
  id           uuid pk
  card_id      fk → cards (restrict)
  user_answer  text null                      // freeform; null for mc/cloze
  score        real                           // 0-1 normalized
  grade        smallint                       // 1-4 SM-2 grade applied
  feedback     text null                      // freeform: LLM feedback
  duration_ms  int
  created_at   timestamptz
  index on (card_id, created_at desc)
  index on (created_at desc)                  // for activity heatmap query
```

### 3.3 Planning

```ts
planning_sessions
  id            uuid pk
  title         text                          // user-named or LLM-suggested
  app_idea      text                          // original prompt
  status        enum('in_progress' | 'completed' | 'abandoned')
  current_stage enum                          // see stages below
  created_at    timestamptz
  updated_at    timestamptz
  index on (updated_at desc)

planning_stages
  id              uuid pk
  session_id      fk → planning_sessions (cascade)
  stage           enum('functional_reqs' | 'non_functional_reqs' |
                       'core_entities' | 'api_design' |
                       'high_level_design' | 'deep_dives' | 'verification')
  output          jsonb                       // structured per-stage shape
  user_edits      jsonb null                  // RFC 6902 JSON Patch
  is_stale        boolean default false       // upstream edited
  llm_call_id     fk → llm_calls null
  generated_at    timestamptz
  regenerate_count int default 0
  unique (session_id, stage)
```

Seven stages total. Stage 6 (`deep_dives`) is internally two-phase — picker generates candidates, user selects, then parallel calls generate the dives — but persists as a single row whose `output` accumulates all three keys.

**Stage output shapes** (jsonb structure validated by Zod):

```ts
functional_reqs:    { requirements: [{text, priority: 'P0'|'P1'}], out_of_scope: string[] }
non_functional_reqs:{ requirements: [{quality, contextualized, quantified?}],
                      cap_choice?: string, out_of_scope: string[] }
core_entities:      { entities: [{name, fields: string[], notes?: string}] }
api_design:         { endpoints: [{method, path, request_body?, response, notes?}] }
high_level_design:  { prose: string, mermaid: string, components: [{name, role}] }
deep_dives:         {
                      candidates: [{topic, why_interesting, related_nfr}],   // phase 1: LLM
                      selected: string[],                                     // phase 1.5: user
                      dives: [{topic, naive_approach: {description, mermaid?},
                               problems: string[],
                               better_approach: {description, mermaid?},
                               tradeoffs: [{pro, con}],
                               staff_extension?: string}]                     // phase 2: LLM (parallel)
                    }
verification:       { issues: [{severity: 'blocker'|'warning'|'nit', stage, claim, suggestion}],
                      summary: string, ready_to_ship: boolean }
```

### 3.4 Settings & Observability

```ts
settings                                      -- singleton row, id = 1
  id                int pk default 1
  user_name         text default 'Learner'    // sidebar avatar
  daily_target      int default 20
  monthly_cost_cap  numeric(10,2) default 50.00
  model_haiku       text default 'anthropic/claude-haiku-4-5'
  model_sonnet      text default 'anthropic/claude-sonnet-4-6'
  embedding_model   text default 'voyageai/voyage-3'
  custom_focus      jsonb default '[]'        // user-named virtual collections
  corpus_signature  text null                 // for Pass 2 idempotency
  theme             enum('dark'|'light'|'system') default 'dark'

llm_calls
  id            uuid pk
  module        text                          // 'card_gen' | 'freeform_grade' | 'planner_stage_5' | ...
  model         text
  input_tokens  int
  output_tokens int
  cost_usd      numeric(10,6)
  latency_ms    int
  status        enum('success' | 'retry' | 'failed')
  error         text null
  created_at    timestamptz
  index on (module, created_at desc)
  index on (created_at desc)
```

### 3.5 Migrations

Drizzle Kit (`drizzle-kit generate` → SQL files in `db/migrations/` → `drizzle-kit migrate` to apply).

Initial migration (`0000_init.sql`):

1. `CREATE EXTENSION IF NOT EXISTS vector;`
2. Create all tables above.
3. Seed `settings` row (id=1).
4. Create the HNSW index on `source_chunks.embedding`.

---

## 4. Ingestion Pipeline

Two-pass design. Pass 1 cheap and per-file. Pass 2 expensive and corpus-wide.

```
sources/*.md ──► [Pass 1] ──► source_chunks (embedded + tagged)
                    │
                    ▼
          (all chunks, all files)
                    │
                    ▼
                 [Pass 2] ──► concepts + cards
```

### 4.1 Pass 1 — Chunk & Embed (per file)

**Trigger:** `pnpm ingest [--file=<filename>]` CLI command, or `POST /api/ingest`. Both call `lib/ingest/runPass1()`.

1. **File hash check.** Compute `sha256(file_contents)`. Look up `source_files` by filename. If hash matches stored `content_hash`, skip and log. Otherwise proceed.
2. **Re-processing teardown.** For files being re-processed, delete their existing `source_chunks` rows (cascade). `concepts.source_chunk_ids[]` references will be cleaned up in Pass 2.
3. **Heading-aware chunking** (`lib/ingest/chunker.ts`):
    - Parse markdown via `unified` + `remark-parse`.
    - Split at `##` (the source files use `## Page N` markers as logical boundaries) and `###`.
    - Build `heading_path` for each chunk: `["Page 3", "Why fusion matters"]`.
    - Merge adjacent tiny chunks until each is in **200-500 tokens** range (counted via `tiktoken`). Stop merging across `##` boundaries.
    - Split oversized chunks at sentence boundaries with ~20% overlap.
    - Drop chunks under 50 tokens that can't be merged.
4. **Embed.** Batch chunks (32 at a time) through OpenRouter → `voyage-3` (1024-dim). Write `source_chunks` rows.
5. **Soft topic tagging.** Batched Haiku calls (10 chunks per call, structured-output with one tag-array per chunk) to keep cost and latency low: "For each chunk below, return up to 3 topic tags from this fixed list: [`rag`, `chunking`, `embeddings`, `vector_search`, `fusion`, `reranking`, `agents`, `react_loop`, `tools`, `verification`, `guardrails`, `evals`, `spec_driven`, `system_design`, `multimodal`]." Stored on `topic_tags`.
6. **Update file record.** Write `source_files` row with new `content_hash`, `chunk_count`, `ingested_at`.

### 4.2 Pass 2 — Concepts & Cards (corpus-wide)

**Trigger:** runs automatically after Pass 1 if any file changed. Manually triggerable via `pnpm ingest --pass2-only`.

1. **Corpus signature check.** Hash `concat(chunk.id + chunk.content for all chunks ordered by id)`. If matches stored `settings.corpus_signature`, skip.
2. **Concept extraction.** Single Sonnet call (corpus is small; ~150 chunks × 400 tokens fits well within Sonnet's window). Prompt:
    > "Read all chunks. Identify distinct AI engineering concepts the user should master. For each: name, parent_topic from [`retrieval`/`agents`/`evals`/`spec`/`system_design`], 2-sentence canonical_summary, and the chunk_ids that cover it. Return as structured JSON."
   Validated against a Zod schema. Upsert into `concepts` by name (preserves existing card links if a concept persists across re-ingests).
3. **Card generation** per concept (`lib/ingest/cardGen.ts`):
    - Fetch the concept's source chunks (full text).
    - One Haiku call per concept generates **8 cards** mixed across types (3 MC + 3 cloze + 2 freeform; configurable).
    - Prompt enforces structured output via Zod schema (per type — see 3.2 for column shapes).
    - Each card sets `difficulty` (1-3) and links `source_chunk_ids[]`.
    - **Concept-pairing:** for concepts with strong neighbors (RAG ↔ Fusion, ReAct ↔ LLM+tools), one of the freeform cards is forced to be a *compare/contrast* or *when-to-use-which* question. Wired by passing the concept graph into the prompt.
4. **Card refresh strategy** (Pass 2 re-run after corpus change):
    - New cards: insert.
    - Cards whose source chunks no longer exist: `is_disabled = true`. Review history preserved.
    - Cards whose chunks changed but concept persists: leave unless explicitly regenerated (`pnpm ingest --regenerate-cards=concept-name`).
5. **Update corpus signature.**

### 4.3 Idempotency Summary

| Trigger | Pass 1? | Pass 2? | Effect on review state |
|---|---|---|---|
| No file changes | ❌ | ❌ | None |
| File contents changed | ✅ that file | ✅ corpus | New cards added; obsolete cards disabled (history kept) |
| New file added | ✅ that file | ✅ corpus | New cards added |
| File deleted | manual | ✅ corpus | Cards from deleted concepts disabled |
| `--regenerate-cards=X` | ❌ | partial | Cards under X disabled + replaced |

### 4.4 Observability + Resilience

- Every Claude call from ingest writes an `llm_calls` row.
- CLI prints summary at end: total cost, total cards, total tokens.
- Errors (refusal, JSON validation failure): retry up to 3× with backoff. Fatal failures dump the offending chunk/concept to `logs/ingest-failures.jsonl` and continue.

### 4.5 Testing

- `lib/ingest/chunker.test.ts` — fixture markdown with known headings/sizes, asserts chunk boundaries and `heading_path`s.
- `lib/ingest/cardGen.test.ts` — mocks Claude client, verifies prompt construction, Zod validation, card-shape correctness for all 3 types.
- `lib/ingest/integration.test.ts` — small fixture corpus (3 chunks → 1 concept → 4 cards) end-to-end against a test Postgres (testcontainers); verifies idempotency (running twice produces identical state).

---

## 5. Learning Engine

Three deterministic grading paths (MC, cloze, freeform via LLM), one shared SM-2 scheduler, two entry points (SRS queue + topic-pick).

### 5.1 SM-2 Scheduler

`lib/srs/sm2.ts` — pure functions, no DB, no IO.

```ts
type Grade = 1 | 2 | 3 | 4   // Again | Hard | Good | Easy
type ReviewState = {
  ease: number
  interval_days: number
  repetitions: number
  lapses: number
}

nextReview(state: ReviewState, grade: Grade): ReviewState
```

Rules:

| Grade | Ease | Interval transition |
|---|---|---|
| 1 (Again) | `ease -= 0.20` | `interval = 0`, `repetitions = 0`, `lapses += 1` |
| 2 (Hard) | `ease -= 0.15` | `interval *= 1.2`, `repetitions += 1` |
| 3 (Good) | unchanged | first→1d, second→6d, then `interval *= ease` |
| 4 (Easy) | `ease += 0.15` | `interval *= ease * 1.3` |

`ease` floored at 1.3. `interval` capped at 365 days. `due_at = now + interval_days * 1day` with ±10% jitter to spread reviews.

### 5.2 Daily Queue

```ts
// lib/srs/queue.ts
dueQueue(target: number): Card[]
```

Query: `SELECT card.* FROM cards JOIN review_state USING (card_id) WHERE due_at <= now() AND NOT is_disabled ORDER BY due_at ASC LIMIT target`.

**Interleaving:** after fetch, shuffle within "overdue buckets" (today / yesterday / older) so the same concept doesn't appear back-to-back. Implemented as a stable group-and-rotate over `concept_id`.

**New cards:** if due-queue is shorter than `daily_target`, fill with unseen cards (`due_at IS NULL`), prioritizing concepts with the lowest current mastery.

### 5.3 Review Session — Shared Flow

1. Fetch `dueQueue(daily_target)`.
2. Render card 1 by `card_type`.
3. User answers.
4. Grader returns a default `Grade` (1-4).
5. User confirms or overrides via 1-4 keys.
6. `POST /api/review/grade` → SM-2 update + attempt log.
7. Next card. End → summary screen.

**Keyboard map:**

| Key | Action |
|---|---|
| Space | Reveal answer (or trigger flip on MC after selection) |
| 1 / 2 / 3 / 4 | Grade Again / Hard / Good / Easy |
| Enter | Advance to next card |
| `s` | Open source chunks Sheet |
| `e` | Open card editor for current card |
| `d` | Disable current card |
| Esc | End session early (with confirmation) |

### 5.4 Card-Type Grading Paths

**MC** (`lib/grading/mc.ts`):
- Click one of 4 options.
- Default grade: correct → 3 (Good); incorrect → 1 (Again).
- Show explanation + correct option + source links.
- User can override 1-4.

**Cloze** (`lib/grading/cloze.ts`):
- Render prompt with `{{c1::...}}` rendered as input fields.
- Compare each blank to its `cloze_answers` entry — case-insensitive, whitespace-trimmed, Levenshtein ≤ 2 counts as correct.
- Default grade: all correct → 3; any wrong → 1.

**Freeform** (`lib/grading/freeform.ts` + `POST /api/review/freeform-grade`):
- User submits → server makes single Claude Haiku call:
  ```
  Question: {prompt}
  Reference: {canonical_answer}
  Rubric: [{criterion, weight}, ...]
  Answer: {user_answer}

  Return JSON:
  {
    criteria_scores: [{criterion, met: "yes"|"partial"|"no", evidence}],
    overall_score: 0..1,
    summary_feedback: string,         // 2-3 sentences
    what_to_revisit: string | null
  }
  ```
- Zod-validated. One auto-retry on parse failure.
- Score → grade: `≥0.85→4`, `≥0.70→3`, `≥0.50→2`, `<0.50→1`.
- UI shows per-criterion ✓ / partial / ✗ + summary feedback + source links + grade pre-selected.

### 5.5 Topic-Pick Mode

`/learning/topics` lists concepts grouped by `parent_topic` with mastery badges.

```
mastery = (avg(ease) - 1.3) / (3.0 - 1.3) * (1 - lapses_factor)
where lapses_factor = clamp(lapses_total / cards_count, 0, 0.5)
```

Computed on the fly from `review_state` aggregates.

**Session start modal:** number of cards (default 10), toggle "Generate variants" (default off), toggle "Count toward SRS" (default off — practice mode).

**Variant generation** (`POST /api/cards/regenerate-variant`):
- Single Haiku call: "Rephrase this card to test the same concept differently — change wording, scenario, and (for MC) distractors. Keep `card_type` and `difficulty`. Use same source chunks."
- If "Count toward SRS" on: variant is persisted as a `cards` row with `parent_card_id` set + `is_live_generated = true`. **No `review_state` row is created for variants.** The grade resolver at `POST /api/review/grade` looks up `review_state` via `parent_card_id ?? card_id` so grading a variant updates the parent's state. Attempt rows always reference the actual card grading happened on (variant or base) for accurate audit.
- If off (practice mode): variant is generated and rendered in-memory only. No `cards` row created; no `attempts` row written; no SRS effect.

### 5.6 Empty States

- **Queue empty / nothing due:** "No reviews due. Pick a focus area to keep learning →"
- **First-time user:** "Run `pnpm ingest` to populate your card bank, or click here to ingest now."
- **All cards in concept disabled:** hidden from topic-pick.
- **Mid-session abandon:** state persisted in URL params + localStorage. Next visit: "Resume yesterday's session?"
- **Streak indicator:** count of consecutive days reviewed (derived from `attempts` distinct dates).

### 5.7 Card Editor

`/learning/cards`:
- Filter bar: concept, type, difficulty, disabled toggle, search.
- Table: prompt preview · type · concept · ease · last reviewed · status.
- Row actions: edit (Sheet with type-appropriate form + live preview), disable, regenerate (single-card Haiku regen, opens diff view, accept/reject), view source.

### 5.8 Testing

- `lib/srs/sm2.test.ts` — table-driven tests over (state, grade) → expected next state. Covers ease floor, interval cap, lapse counting, jitter range.
- `lib/srs/queue.test.ts` — fixture review states, asserts queue ordering and interleaving.
- `lib/grading/cloze.test.ts` — fuzz over case/whitespace/typo variations.
- `lib/grading/freeform.test.ts` — mock Claude client, assert prompt construction + score-to-grade mapping.
- Component tests for each card-type review component: keyboard input, grade override, error states.
- Integration test: ingest fixture corpus → review 5 cards → assert SM-2 state updated correctly + attempt rows written.

---

## 6. Planning Engine

Seven stages, each backed by a pure async function in `lib/planning/stages/`. UI calls them via SSE-streamed routes for live rendering.

### 6.1 Pipeline

```
app_idea
    ▼
[1] Functional Requirements         (Sonnet, streamed)
    ▼
[2] Non-Functional Requirements     (Sonnet, streamed)
    ▼
[3] Core Entities                   (Haiku, fast)
    ▼
[4] API Design                      (Sonnet, streamed)
    ▼
[5] High-Level Design + Diagram     (Sonnet, streamed; mermaid validated)
    ▼
[6] Deep Dives                      (one stage row, two phases)
      └─ Phase 1: picker — Sonnet suggests 3-5 candidates → user picks 2-3
      └─ Phase 2: dives  — Sonnet generates dives in parallel, streamed
    ▼
[7] Verification                    (Sonnet, structured)
    ▼
Export → polished .md
```

### 6.2 Stage Detail

Each stage's prompt enforces structured output via Zod. The response is JSON; "prose" fields inside the JSON contain narrative.

**Stage 1 — Functional Requirements**
- Output schema in 3.3.
- Prompt: *"Read this app idea. Extract functional requirements as 'Users should be able to...' statements. Identify 3-5 P0 features and a few P1s. List 3-5 explicit out-of-scope items. Match the Uber walkthrough style: tight, focused, opinionated about what to cut."*

**Stage 2 — Non-Functional Requirements**
- Prompt: *"Identify the qualities unique and challenging for this system. For each: name (latency / consistency / availability / throughput / durability / security / cost), contextualize ('low-latency matching < 1 minute or fail', not 'low latency'), quantify if possible. If consistency-vs-availability tension applies, name the CAP choice and where. List explicitly out-of-scope qualities."*

**Stage 3 — Core Entities**
- Prompt: *"List the data objects exchanged and persisted. Bullet form. For each: name + 3-6 key fields. Don't be exhaustive — match the Uber walkthrough's 'Ride / Driver / Rider / Location' level of detail."*

**Stage 4 — API Design**
- Prompt: *"For each functional requirement, design the API endpoint(s). REST verbs. Reference core entities. Note auth via JWT/session header (no user_id in body). Don't over-spec types unless an enum or unusual shape is meaningful."*

**Stage 5 — High-Level Design + Diagram**
- Prompt: *"Walk through the architecture progressively. Go API by API and explain how each is satisfied — exactly like the Uber walkthrough. Build the data flow as you narrate. Output a mermaid `flowchart LR` showing client → gateway → services → datastores → external APIs. Use mermaid `subgraph` to group services. Defer non-functional optimizations to Deep Dives."*
- **Mermaid validation:** parse server-side with `mermaid.parse()`. On error, single auto-retry: *"Your mermaid had this error: `{err}`. Fix and return only the corrected diagram."* If second attempt fails, store with `mermaid_error` field; UI shows prose + "regenerate diagram" button.

**Stage 6 — Deep Dives** (single stage row; two phases)

*Phase 1 — Picker.* One Sonnet call:
- Prompt: *"Given the non-functional requirements and high-level design, suggest 3-5 deep-dive candidates. For each: topic (one of: scaling-X / consistency-of-X / low-latency-X / choice-of-Y / alternative-pattern-Z), why it's interesting for this system, which NFR it pressure-tests."*
- Output: `candidates[]`. Persisted into `deep_dives.output.candidates`.
- UI: candidate cards with checkboxes; user picks 2-3, optionally adds custom topic. Selection persists into `deep_dives.output.selected`.

*Phase 2 — Dives.* On user confirm, one Sonnet call per selected topic, run in parallel:
- Per-dive output shape in 3.3.
- Prompt: *"Deep dive on `{topic}` for this system. (1) Naive approach + why someone reaches for it. (2) Concrete problems at this system's scale and constraints. (3) Better approach. (4) Honest tradeoffs of the better approach. Optional 'staff-level extension' — a deeper detail. Optional sub-mermaid. Match the Uber walkthrough's geohash-vs-quadtree level of specificity."*
- Outputs collected into `deep_dives.output.dives[]`.

**Stage 7 — Verification**
- Prompt: *"Verify this design end-to-end. Surface concrete issues:
  - Are all functional requirements covered by the API + High-Level Design?
  - Are recommendations grounded in the stated requirements (or unsupported)?
  - Is anything overengineered relative to what was asked?
  - For AI/LLM apps: are eval, guardrail, and grounding considerations addressed?
  - Are deep-dive tradeoffs honest, or does 'better approach' avoid acknowledging real downsides?
  - Is the chosen architectural pattern (single LLM / LLM+tools / RAG / workflow / agent) appropriate?
  - Are core entities sufficient to support all endpoints?
  Output issues with severity + stage + suggestion. Set `ready_to_ship=true` if no blockers."*
- UI renders verdict block at top of session: ✅ ready to ship / ⚠ N warnings / ❌ M blockers. Each issue links to its stage + has "Apply suggestion" button that injects the suggestion as a `user_edit` and marks the stage for regen.

### 6.3 Stage State, Edits, Staleness

- Each stage persists `output` (Claude's output) and `user_edits` (RFC 6902 JSON Patch).
- Effective state = `apply(output, user_edits)`. Used everywhere downstream stages need prior state.
- **Edit propagation:** when a stage's effective state changes, all downstream stages get `is_stale = true`. UI shows yellow "Stale — based on older upstream" banner + "Regenerate" button. They remain viewable.
- **Verification** is always re-run on demand, never auto-staled — it's a snapshot check.
- `regenerate_count` increments per stage for audit visibility.
- **Edit UI:** form-based for entities/endpoints/requirements (one input per item), markdown editor for prose, mermaid syntax editor with live preview for diagrams.

### 6.4 Streaming & UI

- Each stage route uses Server-Sent Events.
- Client renders streamed text into placeholder structure; on `done` event, JSON parsed.
- Diagrams render via `mermaid.js` only after stage completion + validation.
- Each stage card has: header (stage name + status pill: idle/streaming/done/stale/error), rendered content, action buttons (Regenerate, Edit, Copy section, View raw JSON).

### 6.5 Export to Markdown

`GET /api/planning/[id]/export`:
1. Load session + all stage rows; apply `user_edits` to outputs.
2. Render via `lib/planning/export.ts` template:
    - Title + app_idea + date
    - Functional requirements / out-of-scope
    - Non-functional requirements (table)
    - Core entities (bullets)
    - API design (table per endpoint)
    - High-level design (prose + mermaid in fenced code block + component list)
    - Deep dives (one section per dive, naive→problems→better→tradeoffs)
    - Verification (issues grouped by severity + summary)
3. Return as `text/markdown` with `Content-Disposition: attachment; filename="{slug}-system-design.md"`.

Mermaid blocks render correctly in GitHub/GitLab/Obsidian/most markdown viewers.

### 6.6 Error Handling

- **OpenRouter/Claude failures:** 3 retries with exponential backoff (1s, 4s, 16s). After all retries: stage status `error`, UI banner with "Retry" + "Open in fallback model" (swap Sonnet↔Haiku for that stage).
- **Zod parse failures:** single auto-retry with parse error in prompt. Second failure: store raw text + show "view raw output / retry" UI.
- **Mermaid parse failures:** see 6.2.
- **Mid-stream disconnect:** client reconnects to SSE endpoint with `?resume=true`; server replays cached partial output. Falls back to "regenerate."
- **Stage interrupted by user:** server detects SSE close, marks stage `interrupted`; on revisit, "Resume?" prompt re-runs stage.

### 6.7 Testing

- `lib/planning/stages/*.test.ts` (one file per stage): mock Claude client; assert prompt construction includes prior-stage state correctly; output validation catches malformed responses; auto-retry on validation failure works.
- `lib/planning/staleness.test.ts` — fixture session, edit Stage 3, assert Stages 4-7 flagged stale.
- `lib/planning/mermaid.test.ts` — invalid mermaid → retry with error → valid mermaid; total invalid → fallback path.
- `lib/planning/export.test.ts` — fixture session → assert markdown structure (all sections present, mermaid in fenced blocks, verification grouped by severity).
- Component tests: stage card with each status, regenerate button, edit form per stage shape.
- E2E (Playwright): full happy path from `/planning/new` to `.md` download.

---

## 7. UI Structure & Visual System

Visual fidelity to `docs/design/lumina-style-reference.html`. Implementation uses Next.js + shadcn/ui + Tailwind v4, but visual primitives are the mockup's, not shadcn defaults.

### 7.1 Globals

- **Background:** `#050508` with three animated watercolor blobs (blue/purple/teal radial gradients, 100px blur, screen blend, 20s float anim) + 4% opacity SVG noise overlay. Fixed-position layers in root layout, behind all content.
- **Glass surfaces:** `glass-panel` (40px backdrop-blur for major surfaces) and `glass-card` (12px blur for inner cards).
- **Typography:** Inter (300/400/500/600) + JetBrains Mono (300/400). Loaded via `next/font/google`.
- **Icons:** `@phosphor-icons/react` (regular weight). Exact set from mockup.
- **Color tokens** (CSS custom properties on `:root`):
    - `--accent-blue: #3b82f6`
    - `--accent-purple: #8b5cf6`
    - `--accent-teal: #14b8a6`
    - `--text-primary: rgba(255,255,255,0.95)`
    - `--text-secondary: rgba(255,255,255,0.6)`
    - `--text-tertiary: rgba(255,255,255,0.4)`
    - `--glass-bg: rgba(15,15,20,0.4)`
    - `--glass-border: rgba(255,255,255,0.08)`
    - `--glass-highlight: rgba(255,255,255,0.03)`
- **Motion:** `float` (20s), `pulse-glow` (2s), `fadeIn` (400ms), card flip (600ms cubic-bezier(0.4,0,0.2,1)). All honor `prefers-reduced-motion`.
- **Custom scrollbars:** 6px, white 10%/20% on hover.

### 7.2 Persistent Shell (`app/layout.tsx`)

Three layers stack across every route:

1. **Background layer** (z-0): blobs + noise overlay.
2. **Floating pill header** (z-50, fixed top-6 center): glass-panel rounded-full pill with brand (`ph-brain` + "Learnings AI") · workspace dropdown ("Gauntlet AI") · version pill (mono, from `package.json`).
3. **Main grid** (z-10, max-w-1600 centered, mt-16): sidebar + main panel + per-route right aside.

### 7.3 Sidebar (`components/Sidebar.tsx`)

Always visible, glass-panel rounded-2xl:

- **Profile block:** avatar gradient (blue→purple) with initials from `settings.user_name`; display name; role line ("Level {N} Scholar" derived from total cards mastered, 50/level).
- **Primary nav:** Learning + Planning. Subtitle changes contextually ("Active Session" / "Ready to study" / "All caught up" for Learning; "{N} sessions" / "Get started" for Planning).
- **Current Focus:** `parent_topic` concept folders with tinted icons (retrieval=blue, agents=purple, evals=teal, system_design=blue, spec=teal). Badge count = due cards in that topic. "+" button adds a custom focus area (saved to `settings.custom_focus`).
- **Activity Stream:** 21-cell heatmap (last 21 days). Intensity from `attempts` count: 0→white/5, 1-5→blue/20, 6-15→blue/40, 16-30→blue/60, 31+→blue/80. Hover shows tooltip; click → `/settings#stats`.

### 7.4 Learning Surface

**State A — Active session** (`/learning?session={id}`): main glass-panel + right contextual aside.

- **Main panel header:** pulsing status dot + "Active Session" + concept name; right side: progress text + gradient progress bar + dots-menu (pause / end early / settings).
- **Center 3D flip flashcard** (perspective-1500 wrapper, max-w-2xl, h-400):
    - Front face by card type:
        - **MC:** Card ID badge + speaker icon; centered prompt; 4 option rows (A/B/C/D labels in mono); click selects → auto-flip.
        - **Cloze:** Same header; prompt with inline `<input>` boxes for each `{{c1::...}}`; "Submit" (Enter).
        - **Freeform:** Same header; prompt; autosizing `<textarea>` (max h-150); "Cmd+Enter to submit" hint. Submit → flip + back face shows shimmer that fills as Claude streams.
    - Back face by card type:
        - **MC:** "Answer" purple pill; correct option highlighted; explanation prose; mono code block if formula/code.
        - **Cloze:** Each cloze shown user input vs canonical (✓/✗); explanation.
        - **Freeform:** Rubric criteria with ✓/partial/✗; LLM `summary_feedback`; optional `what_to_revisit` chip.
- **Below the card:** 4 SRS grade buttons (Again red / Hard orange / Good blue / Easy teal) with dynamic interval labels from current SM-2 state.
- **Right aside (w-80):**
    - **Session Telemetry** (glass-panel): 2×1 grid (Retention %, Time/Card) + horizontal Memory Strength bar.
    - **Source Material** (glass-panel, scrollable): glass-cards for each source chunk this card cites. Icon by file-type heuristic. Click → Sheet with full chunk content. Bottom: dashed "Add Context Note" → persists `concept_notes` row.

**State B — Pre-session / queue summary** (`/learning` no session param): center renders queue hero card (count + topic-breakdown bar + big "Begin Session" button + Enter hint). Tomorrow preview + recent-attempts log in collapsed accordion. Right aside shows lifetime/30-day retention + Recently Reviewed concept chips.

**State C — Empty queue:** empty-state illustration ("Nothing due. Pick a focus area to keep learning →") + tomorrow's count.

**Topic-Pick (`/learning/topics`):** center swaps to a grid of glass-card concept tiles grouped by `parent_topic` (collapsible). Each tile: name, mastery pill, card-count badge, "Start" button. Modal config (count slider, "Generate variants" toggle, "Count toward SRS" toggle).

**Card Editor (`/learning/cards`):** center swaps to glass-panel with filter bar + dense table. Per-row Sheet with type-appropriate form + live preview.

### 7.5 Planning Surface

**Sessions list (`/planning`):** giant glass-panel "Describe an app you want to build" textarea + "Begin" button (purple/blue gradient with magic-wand icon). Below: glass-card session list with title, idea preview, status pill, verification badge, last-edited timestamp.

**Wizard (`/planning/[id]`):** the mockup's roadmap repurposed:
- **Top header:** editable session title + "Regenerate Plan" button + breadcrumb of stages with click-to-jump.
- **Center main panel:** vertical timeline with gradient `timeline-line` (blue → purple → fade) running through stage nodes.
    - **Node circle (w-8 h-8):**
        - Completed = green-500/20 bg, green-500 border-2, `ph-check`, glow shadow
        - In progress = `#050508` bg, blue-500 border-2, blue dot center w/ animate-pulse, animate-ping outer ring
        - Locked = `#050508` bg, white/20 border-2, white/20 dot
        - Stale = same as completed but amber-500 border + amber dot, glow amber
        - Error = red-500 border + `ph-warning`
    - **Stage card (glass-card, flex-1, border-l-4 colored by status):**
        - Header: stage name + status pill (mono small uppercase: "In Progress" blue/10, "Completed Oct 12" white/40, etc.).
        - Description: stage purpose (white/70).
        - Stage-specific expanded content (per 6.2 stage shapes).
        - For streaming: token-progress bar.
        - For stale: amber strip across top + "Regenerate" button.
        - Action menu (top-right dots): Edit / Regenerate / Copy section / View raw JSON.
- **Right aside (w-80, sticky):**
    - **Session Status** card: editable title, app idea preview, status pill, model-in-use badge, running cost, Export button.
    - **Verification Snapshot** card: traffic-light row (Functional ✓ · Tradeoffs ⚠ · Patterns ✓ · Evals ✗). Click → scrolls to Stage 7.
    - **Recent Activity** (Weekly Intensity repurposed): bar chart of LLM cost-per-day for past 7 days.

### 7.6 Settings (`/settings`)

Same shell. Center is a glass-panel with a vertical scroll of glass-card sections (no tabs):

- **Profile:** name, avatar gradient picker.
- **Study:** daily target slider (5-50), default session length, keyboard shortcut reference.
- **Models:** per-role pickers (Haiku, Sonnet, embedding); live-fetched OpenRouter list; cost per 1M tokens displayed.
- **Sources:** ingested files with `last-ingested` timestamps, per-file "Re-ingest" button, drop zone for new `.md` files.
- **Costs:** chart of `llm_calls` by module + by day; hard monthly cap input; top-10 most expensive calls.
- **Auth:** paste/rotate `LEARNINGS_AI_TOKEN`. Generate-secure-random button.
- **Theme:** dark / light / system. Light variant ships at the same time with a parallel palette (paler glass tints, blob opacity reduced, dark text on white-95 surfaces).

### 7.7 Reused State Treatments

Across the app:
- **Stale:** amber-500/30 border + amber-500/10 surface tint + `ph-warning-circle` + amber-500 mono label.
- **Error:** red-500/40 border + red-500/10 tint + `ph-x-circle` + red-500 mono label + "Retry" button.
- **Loading/streaming:** blue pulsing border + animated gradient shimmer overlay + status dot.
- **Disabled / locked:** opacity 0.5 + `ph-lock` + white/30 mono label.

### 7.8 Responsive

- ≥1280px: full layout.
- 1024-1279px: right aside collapses into a slide-over Sheet.
- 768-1023px: sidebar collapses to icons-only (60px).
- <768px: sidebar becomes bottom tab bar (Learning / Planning / Settings). Floating pill header stays. Wizard timeline shifts left edge. Card editor read-only.

### 7.9 Accessibility

- Glass surfaces meet WCAG AA contrast (white-95 on dark = 18:1, white-60 = 6.5:1).
- All animations respect `prefers-reduced-motion`.
- Cmd+K palette (`cmdk`, glass-styled).
- Focus-visible outlines: blue accent ring offset 2px.
- ARIA live regions on streamed planner stages, session card transitions.
- Flashcard front/back use `aria-hidden` on the inactive face.

### 7.10 Component Inventory (`components/`)

`GlobalBackground`, `FloatingHeader`, `Sidebar`, `SidebarFocusList`, `ActivityHeatmap`, `GlassPanel`, `GlassCard`, `Flashcard`, `FlashcardFace<T>` (MC/Cloze/Freeform), `GradeButtons`, `SessionTelemetry`, `SourceMaterialList`, `TimelineNode`, `StageCard<T>`, `MermaidViewer`, `VerificationVerdict`, `VerificationIssueList`, `CommandPalette`, `Sheet`.

### 7.11 Testing

- **Visual regression:** Playwright screenshot per route × (default | empty | error) × (light | dark) × (default | reduced-motion). Diff threshold 0.1%.
- **Component tests** for every primitive.
- **Cross-browser:** Chrome / Safari / Firefox latest. `-webkit-` prefix for `backdrop-filter` (in mockup CSS).
- **A11y:** `@axe-core/playwright` runs on every E2E.

---

## 8. Cross-Cutting Concerns

### 8.1 Repository Structure

```
learningsAI/
├── app/                          Next.js App Router (routes per 2.1)
├── components/                   Per 7.10
├── lib/                          Per 2.2
├── db/
│   ├── schema.ts                 Drizzle schema
│   └── migrations/               Generated SQL
├── sources/                      Gauntlet markdown files
├── scripts/
│   ├── ingest.ts                 pnpm ingest CLI
│   └── seed.ts                   First-run seed
├── tests/{unit,component,e2e}/
├── docs/{design,superpowers/specs,adr}/
├── public/                       Fonts, favicon, OG image
├── .github/workflows/            CI
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── package.json
├── pnpm-lock.yaml
├── .env.example
├── CLAUDE.md
├── README.md
└── STUDY_GUIDE.md                gitignored
```

### 8.2 Environment & Secrets

`.env.example` (variable names only, no values; per `no-env-contents` global rule never display values):

```
DATABASE_URL=
DATABASE_URL_UNPOOLED=
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
EMBEDDING_PROVIDER=openrouter
LEARNINGS_AI_TOKEN=
SENTRY_DSN=
LOG_LEVEL=info
NEXT_PUBLIC_APP_URL=
NODE_ENV=development
```

### 8.3 Deployment (Railway)

Two services in one Railway project:
- **`db`:** Postgres 16 with `pgvector`. 1GB starter.
- **`web`:** Next.js. 1 vCPU / 1GB RAM. Health check at `GET /api/health` (returns `{ ok, db_ok, llm_ok, version }`).

**Pre-deploy hook:** `pnpm db:migrate` runs before each `web` deploy. Atomic.

**Backups:** Railway daily snapshots (7-day retention) + weekly `pg_dump` to Backblaze B2 via Railway cron service.

**Region:** match user's physical location for SRS query latency.

### 8.4 CI/CD

`.github/workflows/ci.yml` (PR + push to main):

```yaml
jobs:
  lint:        pnpm lint
  typecheck:   pnpm tsc --noEmit
  unit:        pnpm test:unit
  component:   pnpm test:component
  build:       pnpm build
  e2e:         pnpm test:e2e            # Postgres service container, fixture data
  a11y:        @axe-core/playwright in e2e
```

`.github/workflows/deploy.yml` (push to main):
- Depends on ci.yml workflow_run success.
- `railway up` via Railway CLI with project token from secrets.
- Posts deploy notification (commit SHA, env URL, version) to commit.

Branch protection on `main`: required CI checks; PR-only; no force-push. Solo dev convenience: auto-merge enabled.

### 8.5 Observability

**Logging:** pino structured JSON. Per request: request ID, method, path, status, duration_ms. For LLM-touching: `module`, `model`, `tokens_in/out`, `cost_usd`, `cache_hit?`.

**Error tracking:** Sentry (`@sentry/nextjs`), browser + server. Source maps uploaded per deploy. PII filter ON.

**Cost tracking:** every LLM call writes `llm_calls`. Aggregated views in `/settings#costs`. Hard monthly cap → 503 + UI explanation when exceeded.

**Performance baselines** (tracked via `llm_calls`):
- Card pre-gen: ≤ 2s/concept
- Free-response grading: ≤ 1.5s
- Planner stage 5: ≤ 8s including mermaid validation
- Embedding (32-chunk batch): ≤ 1s
- Wizard stage stream first-token: ≤ 800ms

### 8.6 Testing Strategy

**TDD enforced** per `tdd.md` global rule.

**Coverage:** `lib/**` ≥ 90%, `components/**` ≥ 75%, `app/**` covered by E2E only.

**Layers:**

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest | All `lib/**` |
| Component | Vitest + RTL | All components × all states |
| Integration | Vitest + `@testcontainers/postgresql` | DB-touching modules; ingest end-to-end on fixture corpus; SRS queue construction |
| E2E | Playwright | Daily review (3 cards, one per type); full planning session through export; edit-and-regenerate; auth gate; settings |
| Visual | Playwright screenshot diff | Each route × state × theme × motion preference |
| A11y | `@axe-core/playwright` | WCAG 2.1 AA on every page |

**Fixtures** in `tests/fixtures/`: small synthetic corpus (3 markdown files, ~10 chunks, ~3 concepts, ~12 cards). Seeded into clean Postgres at test start.

**Manual QA checklist** at `docs/qa-checklist.md`.

### 8.7 Security

- **Auth:** `LEARNINGS_AI_TOKEN` cookie. Middleware (`middleware.ts`) on all protected routes. HttpOnly + Secure + SameSite=Strict.
- **HTTPS:** enforced by Railway + HSTS.
- **CSP:** strict via `next.config.ts` headers — no inline scripts; bundle mermaid (no CDN).
- **XSS:** all LLM-generated markdown via `react-markdown` + `rehype-sanitize`. LLM mermaid validated server-side.
- **SQL injection:** Drizzle parameterized end-to-end; no raw SQL in production paths.
- **Rate limiting:** per-IP token bucket on LLM-triggering routes (`@upstash/ratelimit` with Railway Redis or in-memory). 60 LLM calls / 10 min / IP.
- **Secrets in CI:** GitHub Secrets only. Pino redaction config strips Authorization headers, tokens, common secret patterns.
- **Dependencies:** Renovate weekly. `pnpm audit` in CI.

### 8.8 Performance

- Server Components for read-heavy pages (queue summary, sessions list, settings).
- Streaming for LLM-touching routes (SSE).
- DB indexes per Section 3.
- Postgres pool: pgBouncer-style via `DATABASE_URL` (transaction mode); migrations use `DATABASE_URL_UNPOOLED`.
- Bundle budget: ≤ 200KB gzipped per route. Enforced via `@next/bundle-analyzer` in CI.

### 8.9 Documentation Artifacts

- **`README.md`** — overview, prerequisites (Node 20+, pnpm 9+, Postgres 16 with pgvector, Railway CLI), setup, deploy, troubleshooting.
- **`CLAUDE.md`** — codebase context for Claude Code. Generated via `init` slash command.
- **`docs/adr/`** — initial ADRs: `0001-stack-choice.md`, `0002-srs-algorithm.md`, `0003-card-types.md`, `0004-planner-7-stages.md`, `0005-pgvector-vs-dedicated.md`.
- **`docs/sources.md`** — adding new lecture material guide.
- **`docs/qa-checklist.md`** — manual release checklist.
- **`docs/runbook.md`** — operational responses for common breakages (per 8.10).
- **`STUDY_GUIDE.md`** (gitignored, per `study-guide.md` global rule) — personal interview prep, updated as decisions are made.

### 8.10 Operational Runbook (`docs/runbook.md` content)

| Scenario | Response |
|---|---|
| OpenRouter outage | Banner; LLM-dependent UI shows error states. Read-only paths keep working. |
| Database outage | Full-page maintenance state. `/api/health` reports `db_ok: false`. |
| Migration failure on deploy | Deploy aborts; previous version stays live. Rollback via `railway down --service web --to <prev-deploy>`. |
| Cost cap hit | Banner; LLM endpoints return 503; non-LLM features keep working. User raises cap in settings. |
| Corrupt mermaid loop | Bounded retry (1 auto). On failure: prose renders + "regenerate diagram" button. No infinite loop. |
| Restoring from backup | Documented `pg_restore` flow against most recent Backblaze B2 dump. |

---

## 9. Acceptance Criteria

The implementation is considered complete when:

1. All sections 2-8 above are implemented as specified.
2. Test layers pass: unit ≥ 90% on `lib/`, component ≥ 75%, E2E happy paths green, axe-core 0 violations.
3. Visual regression matches the mockup within 0.1% diff across every route × state × theme × motion preference.
4. Daily review of all three card types works end-to-end with grading flowing into SM-2 state.
5. A full planning session can be created, navigated through all seven stages, edited with stale propagation working, verified, and exported as markdown.
6. Deployed app on Railway passes `/api/health`; Sentry receives test errors; cost ledger populates.
7. All documentation artifacts in 8.9 exist.
8. CLAUDE.md exists and accurately reflects the codebase.

---

## 10. Out of Scope

These are not deferred — they are not in the build:

- Multi-user features, social/learning collaboration, shared decks.
- Public content marketplace.
- Concept graph visualization.
- Cross-linking from Planning into Learning queue.
- Mastery model feeding Planning.
- Multimodal RAG / vision retrieval.
- Game mechanics, simulation.
- Coding agent that generates application code from Planning.
- Native mobile apps (responsive web only).

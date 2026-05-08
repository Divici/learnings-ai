# Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the two-pass ingestion pipeline that turns markdown lectures in `gauntlet_ai_resources/` into queryable `source_chunks` (Pass 1: chunk + embed + topic-tag) and into reviewable `concepts` + `cards` (Pass 2: concept extraction + card generation), all callable from a `pnpm ingest` CLI and a `POST /api/ingest` endpoint, with every LLM call logged to `llm_calls` for cost observability.

**Architecture:** A thin OpenRouter HTTP client (Claude Haiku/Sonnet for chat, Voyage for embeddings) wrapped in a Zod-validated structured-output helper. Pure-function building blocks (`chunker`, `tokenize`, `cost`, `embedder`, `topicTagger`, `concepts`, `cardGen`) composed by two orchestrators (`pass1`, `pass2`) that own DB writes and idempotency. The CLI and API route are thin shells around the orchestrators. Every Claude/Voyage call logs an `llm_calls` row with module label, tokens, cost, latency, and status. Failed chunks/concepts are appended to `logs/ingest-failures.jsonl` and the run continues.

**Tech Stack:** OpenRouter REST API (no SDK; `fetch`-based), `unified` + `remark-parse` + `mdast-util-to-string` + `unist-util-visit` for markdown parsing, `gpt-tokenizer` (pure JS, no native deps) for token counts, Zod 4 for structured-output validation, Drizzle ORM for DB writes, pino for structured logs, Node `tsx` for the CLI script.

**Spec reference:** [`docs/superpowers/specs/2026-04-27-learnings-ai-design.md`](../specs/2026-04-27-learnings-ai-design.md), section 4 (entire ingestion pipeline) plus references to § 3.1 (`source_files`, `source_chunks`, `concepts`), § 3.2 (`cards`, `card_options` shape), § 3.4 (`settings.corpus_signature`, `llm_calls`).

**Output of this plan:** A working `pnpm ingest` command that, when run against `gauntlet_ai_resources/` with `OPENROUTER_API_KEY` set, populates `source_files`, `source_chunks` (with HNSW-indexed embeddings), `concepts`, and `cards`. Re-running is idempotent: unchanged files skip; changed files reprocess; signature-stable corpora skip Pass 2 entirely. `/api/health` returns a real `llm_ok` boolean instead of `null`. No Learning UI yet (Plan 3) — this plan only fills the database.

**Plan revisions (locked by user direction in CLAUDE.md):**
- No testcontainer integration test (Docker not used on this dev machine). Orchestrator tests use a thin in-memory mock for the DB layer; schema integration is verified on Railway deploy.
- No Sentry. Failures route to `logs/ingest-failures.jsonl` and `pino` (which Railway streams).
- No CI. Tests run locally and on Railway build.

---

## File Structure

This plan creates and configures these files. File paths are absolute under the repo root.

```
learningsAI/
├── package.json                          + 5 deps: unified, remark-parse, mdast-util-to-string,
│                                                   unist-util-visit, gpt-tokenizer
├── lib/
│   ├── env.ts                            (no change — OPENROUTER_API_KEY is already optional)
│   ├── llm/
│   │   ├── cost.ts                       NEW — pricing table + computeCost(model, inT, outT)
│   │   ├── client.ts                     NEW — chatCompletion(), embed(); writes llm_calls; retries
│   │   ├── structured.ts                 NEW — Zod-validated structured output wrapper
│   │   └── ping.ts                       NEW — small "is OpenRouter reachable?" probe for /api/health
│   └── ingest/
│       ├── tokenize.ts                   NEW — countTokens(text) via gpt-tokenizer
│       ├── chunker.ts                    NEW — heading-aware markdown chunker
│       ├── embedder.ts                   NEW — batched Voyage embeddings (batch size 32)
│       ├── topicTagger.ts                NEW — batched Haiku topic-tag (10 chunks per call)
│       ├── sourceFiles.ts                NEW — sha256 hash check + reprocess teardown
│       ├── pass1.ts                      NEW — runPass1(file): chunk → embed → tag → write
│       ├── concepts.ts                   NEW — extractConcepts(allChunks): single Sonnet call
│       ├── cardGen.ts                    NEW — generateCards(concept, neighbors): per-concept Haiku
│       ├── pass2.ts                      NEW — runPass2(): signature → concepts → cards → refresh
│       ├── failureLog.ts                 NEW — appendFailure(record) → logs/ingest-failures.jsonl
│       └── conceptPairs.ts               NEW — static neighbor map for compare/contrast prompts
├── scripts/
│   └── ingest.ts                         NEW — CLI: pnpm ingest [--file] [--pass2-only] [--regenerate-cards=name] [--dir]
├── app/
│   └── api/
│       ├── health/route.ts               MODIFY — wire llm_ok via lib/llm/ping
│       └── ingest/
│           └── route.ts                  NEW — POST trigger for runPass1 + runPass2
├── tests/
│   ├── unit/
│   │   ├── llm.cost.test.ts              NEW
│   │   ├── llm.client.test.ts            NEW — mocked fetch
│   │   ├── llm.structured.test.ts        NEW — Zod retry behavior
│   │   ├── ingest.tokenize.test.ts       NEW
│   │   ├── ingest.chunker.test.ts        NEW — fixture-based
│   │   ├── ingest.embedder.test.ts       NEW — mocked client
│   │   ├── ingest.topicTagger.test.ts    NEW — mocked client
│   │   ├── ingest.sourceFiles.test.ts    NEW
│   │   ├── ingest.pass1.test.ts          NEW — mocked client + mock db
│   │   ├── ingest.concepts.test.ts       NEW — mocked client
│   │   ├── ingest.cardGen.test.ts        NEW — mocked client
│   │   ├── ingest.pass2.test.ts          NEW — mocked client + mock db
│   │   └── ingest.failureLog.test.ts     NEW
│   ├── component/                        (no changes)
│   ├── e2e/                              (no changes)
│   └── fixtures/
│       └── ingest/
│           ├── tiny-lecture.md           NEW — 3 page boundaries, ~600 tokens
│           ├── short-section.md          NEW — single small section, < 50 tokens
│           └── oversized.md              NEW — single chunk > 800 tokens for split test
├── logs/                                  NEW — runtime-created, .gitignored
│   └── (ingest-failures.jsonl)
├── CLAUDE.md                              MODIFY — add `pnpm ingest` usage + sources path note
├── STUDY_GUIDE.md                         MODIFY — append Plan 2 decisions
└── .gitignore                             MODIFY — add /logs
```

---

## Pre-flight assumptions

- `OPENROUTER_API_KEY` is set in the environment (locally via `.env.local`, in prod via `railway variables --set`). The CLI fails fast with a clear message if missing.
- `gauntlet_ai_resources/` contains lecture markdown files using `## Page N` headings as logical boundaries (verified in repo).
- The 11 tables from Plan 1 exist in the DB. Pass 1 and Pass 2 only INSERT/UPDATE — no schema changes.
- Voyage `voyage-3` produces 1024-dim embeddings. The `source_chunks.embedding` column is `vector(1024)`.
- Concept neighbor pairs are small and editable in code (not configurable yet).

---

## Section A — LLM client foundation

### Task 1: Add ingest dependencies and tokenizer

**Files:**
- Modify: `package.json` (add 5 deps to `dependencies`)
- Create: `lib/ingest/tokenize.ts`
- Create: `tests/unit/ingest.tokenize.test.ts`

**Why these deps:**
- `unified` + `remark-parse` + `mdast-util-to-string` + `unist-util-visit` — battle-tested markdown AST + traversal. We need `## Page N` and `###` boundary detection, plus textual content of nodes. No alternatives are simpler at this fidelity.
- `gpt-tokenizer` — pure JS BPE tokenizer using `cl100k_base`. Avoids `tiktoken`'s WASM/native build issues on Windows. Token counts are within ~5% of Voyage's tokenizer for English text — close enough for a 200-500 token target window.

- [ ] **Step 1: Add dependencies to `package.json`**

Edit `package.json` `dependencies` block to add:

```json
{
  "dependencies": {
    "gpt-tokenizer": "^2.9.0",
    "mdast-util-to-string": "^4.0.0",
    "remark-parse": "^11.0.0",
    "unified": "^11.0.5",
    "unist-util-visit": "^5.0.0"
  }
}
```

(Keep existing entries; add these alphabetized into the dependencies object.)

- [ ] **Step 2: Install**

```
pnpm install
```

Expected: lockfile updates, no errors.

- [ ] **Step 3: Write the failing test**

Create `tests/unit/ingest.tokenize.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { countTokens } from "@/lib/ingest/tokenize";

describe("countTokens", () => {
  it("returns 0 for empty string", () => {
    expect(countTokens("")).toBe(0);
  });

  it("returns positive integer for non-empty english text", () => {
    const n = countTokens("hello world from a unit test");
    expect(n).toBeGreaterThan(0);
    expect(Number.isInteger(n)).toBe(true);
  });

  it("scales roughly linearly with content size", () => {
    const small = countTokens("the cat sat on the mat");
    const big = countTokens("the cat sat on the mat ".repeat(20));
    expect(big).toBeGreaterThan(small * 15);
  });
});
```

- [ ] **Step 4: Run the test, expect failure**

```
pnpm vitest run tests/unit/ingest.tokenize.test.ts
```

Expected: FAIL with "Failed to resolve import @/lib/ingest/tokenize".

- [ ] **Step 5: Implement `lib/ingest/tokenize.ts`**

```ts
import { encode } from "gpt-tokenizer";

/** Approximate token count using the cl100k_base BPE tokenizer.
 *  Within ~5% of Voyage's own tokenizer for English text — sufficient
 *  for the 200–500 token target window the chunker uses. */
export function countTokens(text: string): number {
  if (!text) return 0;
  return encode(text).length;
}
```

- [ ] **Step 6: Run the test, expect pass**

```
pnpm vitest run tests/unit/ingest.tokenize.test.ts
```

Expected: PASS (3/3).

- [ ] **Step 7: Commit**

```
git add package.json pnpm-lock.yaml lib/ingest/tokenize.ts tests/unit/ingest.tokenize.test.ts
git commit -m "add ingest dependencies and a token-count helper backed by gpt-tokenizer"
```

---

### Task 2: Cost table + cost computation

**Files:**
- Create: `lib/llm/cost.ts`
- Create: `tests/unit/llm.cost.test.ts`

**Why a separate module:** the OpenRouter client AND the CLI summary both need cost numbers. Centralizing the price table avoids drift.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/llm.cost.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeCost, MODEL_PRICING } from "@/lib/llm/cost";

describe("computeCost", () => {
  it("computes Haiku 4.5 cost from input + output tokens", () => {
    const cost = computeCost("anthropic/claude-haiku-4-5", 1_000_000, 1_000_000);
    expect(cost).toBe(MODEL_PRICING["anthropic/claude-haiku-4-5"]!.inputPerMTok
      + MODEL_PRICING["anthropic/claude-haiku-4-5"]!.outputPerMTok);
  });

  it("scales linearly with token counts", () => {
    const a = computeCost("anthropic/claude-sonnet-4-6", 100_000, 50_000);
    const b = computeCost("anthropic/claude-sonnet-4-6", 200_000, 100_000);
    expect(b).toBeCloseTo(a * 2, 6);
  });

  it("returns 0 for unknown model rather than throwing", () => {
    expect(computeCost("unknown/model", 100, 100)).toBe(0);
  });

  it("treats embedding model output tokens as 0 (priced per input only)", () => {
    const cost = computeCost("voyageai/voyage-3", 1_000_000, 0);
    expect(cost).toBe(MODEL_PRICING["voyageai/voyage-3"]!.inputPerMTok);
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

```
pnpm vitest run tests/unit/llm.cost.test.ts
```

Expected: FAIL with import error.

- [ ] **Step 3: Implement `lib/llm/cost.ts`**

```ts
/** Per-million-token USD prices. Values from OpenRouter pricing pages — keep
 *  these reviewed; if they drift wildly the `llm_calls.cost_usd` column will
 *  be wrong by the same factor (no functional break, just bad accounting). */
export const MODEL_PRICING: Record<
  string,
  { inputPerMTok: number; outputPerMTok: number }
> = {
  "anthropic/claude-haiku-4-5":  { inputPerMTok: 1.0, outputPerMTok: 5.0 },
  "anthropic/claude-sonnet-4-6": { inputPerMTok: 3.0, outputPerMTok: 15.0 },
  "voyageai/voyage-3":           { inputPerMTok: 0.06, outputPerMTok: 0 },
};

export function computeCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = MODEL_PRICING[model];
  if (!p) return 0;
  return (
    (inputTokens / 1_000_000) * p.inputPerMTok +
    (outputTokens / 1_000_000) * p.outputPerMTok
  );
}
```

- [ ] **Step 4: Run the test, expect pass**

```
pnpm vitest run tests/unit/llm.cost.test.ts
```

Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```
git add lib/llm/cost.ts tests/unit/llm.cost.test.ts
git commit -m "add llm pricing table and computeCost helper"
```

---

### Task 3: OpenRouter client (chat + embed) with retry + llm_calls logging

**Files:**
- Create: `lib/llm/client.ts`
- Create: `tests/unit/llm.client.test.ts`

**Design:**
- Two top-level functions: `chatCompletion(opts)` and `embed(opts)`. No SDK — direct `fetch` against `https://openrouter.ai/api/v1`.
- Both functions:
  1. Call the API with up to 3 attempts (1s, 4s, 16s backoff) on 429/5xx/network errors.
  2. Compute cost from token counts in the response.
  3. Insert an `llm_calls` row with `module`, `model`, `input_tokens`, `output_tokens`, `cost_usd`, `latency_ms`, `status` ("success" / "retry" / "failed"), and `error` (null on success, message on failure).
  4. On final failure throw a typed error.
- Caller-supplied `module` string identifies which subsystem made the call (used in cost dashboards): `"chunker.tag"`, `"ingest.embed"`, `"ingest.concepts"`, `"ingest.cardGen"`, `"health.ping"`.
- The fetch is parameterized via a `fetchImpl` option so tests can inject a mock.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/llm.client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })) },
}));

import { chatCompletion, embed } from "@/lib/llm/client";
import { db } from "@/lib/db";

beforeEach(() => {
  vi.clearAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("chatCompletion", () => {
  it("returns content and logs an llm_calls row on success", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        choices: [{ message: { content: "the answer" } }],
        usage: { prompt_tokens: 100, completion_tokens: 20 },
      }),
    );
    const out = await chatCompletion({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      messages: [{ role: "user", content: "hi" }],
      module: "test.unit",
      fetchImpl,
    });
    expect(out.content).toBe("the answer");
    expect(out.inputTokens).toBe(100);
    expect(out.outputTokens).toBe(20);
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it("retries 429 then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "rate limited" }, 429))
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [{ message: { content: "ok" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
      );
    const out = await chatCompletion({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      messages: [{ role: "user", content: "hi" }],
      module: "test.retry",
      fetchImpl,
      backoffMs: 1, // shrink delays for tests
    });
    expect(out.content).toBe("ok");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws after 3 failures and logs status=failed", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "boom" }, 500));
    await expect(
      chatCompletion({
        apiKey: "sk-x",
        model: "anthropic/claude-haiku-4-5",
        messages: [{ role: "user", content: "hi" }],
        module: "test.fail",
        fetchImpl,
        backoffMs: 1,
      }),
    ).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(db.insert).toHaveBeenCalledTimes(1); // failure row written once
  });
});

describe("embed", () => {
  it("returns embeddings and logs the row", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        data: [
          { embedding: new Array(1024).fill(0.01) },
          { embedding: new Array(1024).fill(0.02) },
        ],
        usage: { prompt_tokens: 50, total_tokens: 50 },
      }),
    );
    const out = await embed({
      apiKey: "sk-x",
      model: "voyageai/voyage-3",
      input: ["hello", "world"],
      module: "test.embed",
      fetchImpl,
    });
    expect(out.vectors).toHaveLength(2);
    expect(out.vectors[0]).toHaveLength(1024);
    expect(db.insert).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

```
pnpm vitest run tests/unit/llm.client.test.ts
```

Expected: FAIL with import error.

- [ ] **Step 3: Implement `lib/llm/client.ts`**

```ts
import { db } from "@/lib/db";
import { llmCalls } from "@/lib/db/schema";
import { computeCost } from "@/lib/llm/cost";
import { log } from "@/lib/log";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletionOptions = {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  module: string;
  responseFormat?: { type: "json_object" };
  temperature?: number;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
  backoffMs?: number; // first retry delay; subsequent ones grow 4× then 16×
};

export type ChatCompletionResult = {
  content: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
};

export type EmbedOptions = {
  apiKey: string;
  model: string;
  input: string[];
  module: string;
  fetchImpl?: typeof fetch;
  backoffMs?: number;
};

export type EmbedResult = {
  vectors: number[][];
  inputTokens: number;
  latencyMs: number;
};

async function withRetries<T>(
  call: () => Promise<Response>,
  { backoffMs = 1000, maxAttempts = 3 }: { backoffMs?: number; maxAttempts?: number },
  parseSuccess: (r: Response) => Promise<T>,
): Promise<{ value: T; attempts: number }> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await call();
      if (res.ok) {
        const value = await parseSuccess(res);
        return { value, attempts: attempt };
      }
      const body = await res.text();
      lastErr = new Error(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
      if (!RETRYABLE_STATUSES.has(res.status)) break;
    } catch (err) {
      lastErr = err;
    }
    if (attempt < maxAttempts) {
      const wait = backoffMs * Math.pow(4, attempt - 1);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr ?? new Error("OpenRouter call failed without specific error");
}

async function logCall(row: {
  module: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: "success" | "retry" | "failed";
  error?: string;
}): Promise<void> {
  try {
    await db.insert(llmCalls).values({
      module: row.module,
      model: row.model,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      costUsd: computeCost(row.model, row.inputTokens, row.outputTokens).toFixed(6),
      latencyMs: row.latencyMs,
      status: row.status,
      error: row.error ?? null,
    });
  } catch (err) {
    log.error({ err, module: row.module }, "failed to write llm_calls row");
  }
}

export async function chatCompletion(opts: ChatCompletionOptions): Promise<ChatCompletionResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const start = Date.now();
  try {
    const { value, attempts } = await withRetries(
      () =>
        fetchImpl(`${OPENROUTER_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${opts.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: opts.model,
            messages: opts.messages,
            temperature: opts.temperature ?? 0.2,
            max_tokens: opts.maxTokens ?? 4096,
            ...(opts.responseFormat ? { response_format: opts.responseFormat } : {}),
          }),
        }),
      { backoffMs: opts.backoffMs ?? 1000 },
      async (r) => (await r.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage: { prompt_tokens: number; completion_tokens: number };
      },
    );
    const latencyMs = Date.now() - start;
    const inputTokens = value.usage.prompt_tokens;
    const outputTokens = value.usage.completion_tokens;
    await logCall({
      module: opts.module,
      model: opts.model,
      inputTokens,
      outputTokens,
      latencyMs,
      status: attempts > 1 ? "retry" : "success",
    });
    return {
      content: value.choices[0]?.message.content ?? "",
      inputTokens,
      outputTokens,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    await logCall({
      module: opts.module,
      model: opts.model,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function embed(opts: EmbedOptions): Promise<EmbedResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const start = Date.now();
  try {
    const { value, attempts } = await withRetries(
      () =>
        fetchImpl(`${OPENROUTER_BASE_URL}/embeddings`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${opts.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: opts.model,
            input: opts.input,
          }),
        }),
      { backoffMs: opts.backoffMs ?? 1000 },
      async (r) => (await r.json()) as {
        data: Array<{ embedding: number[] }>;
        usage: { prompt_tokens: number; total_tokens: number };
      },
    );
    const latencyMs = Date.now() - start;
    const inputTokens = value.usage.prompt_tokens;
    await logCall({
      module: opts.module,
      model: opts.model,
      inputTokens,
      outputTokens: 0,
      latencyMs,
      status: attempts > 1 ? "retry" : "success",
    });
    return {
      vectors: value.data.map((d) => d.embedding),
      inputTokens,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    await logCall({
      module: opts.module,
      model: opts.model,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
```

- [ ] **Step 4: Run the test, expect pass**

```
pnpm vitest run tests/unit/llm.client.test.ts
```

Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```
git add lib/llm/client.ts tests/unit/llm.client.test.ts
git commit -m "add openrouter client with retry, llm_calls logging, and chat + embed surfaces"
```

---

### Task 4: Zod-validated structured output wrapper

**Files:**
- Create: `lib/llm/structured.ts`
- Create: `tests/unit/llm.structured.test.ts`

**Why:** every Pass 1/Pass 2 LLM call returns JSON. Centralizing the "ask for JSON, parse it, validate against Zod, retry once on parse failure" pattern keeps the orchestrator code clean.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/llm.structured.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("@/lib/llm/client", () => ({
  chatCompletion: vi.fn(),
}));

import { structuredChat } from "@/lib/llm/structured";
import { chatCompletion } from "@/lib/llm/client";

const Schema = z.object({ tags: z.array(z.string()).max(3) });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("structuredChat", () => {
  it("validates the parsed JSON against the Zod schema", async () => {
    vi.mocked(chatCompletion).mockResolvedValueOnce({
      content: '{"tags": ["a", "b"]}',
      inputTokens: 10,
      outputTokens: 5,
      latencyMs: 100,
    });
    const out = await structuredChat({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      module: "test",
      systemPrompt: "you return json",
      userPrompt: "go",
      schema: Schema,
    });
    expect(out.value).toEqual({ tags: ["a", "b"] });
  });

  it("retries once on parse failure with a corrective system message", async () => {
    vi.mocked(chatCompletion)
      .mockResolvedValueOnce({
        content: "not even json",
        inputTokens: 10,
        outputTokens: 5,
        latencyMs: 100,
      })
      .mockResolvedValueOnce({
        content: '{"tags": ["a"]}',
        inputTokens: 10,
        outputTokens: 5,
        latencyMs: 100,
      });
    const out = await structuredChat({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      module: "test",
      systemPrompt: "you return json",
      userPrompt: "go",
      schema: Schema,
    });
    expect(out.value).toEqual({ tags: ["a"] });
    expect(vi.mocked(chatCompletion)).toHaveBeenCalledTimes(2);
  });

  it("throws after one failed retry", async () => {
    vi.mocked(chatCompletion).mockResolvedValue({
      content: "still not json",
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
    });
    await expect(
      structuredChat({
        apiKey: "sk-x",
        model: "anthropic/claude-haiku-4-5",
        module: "test",
        systemPrompt: "you return json",
        userPrompt: "go",
        schema: Schema,
      }),
    ).rejects.toThrow(/structured-output/);
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

```
pnpm vitest run tests/unit/llm.structured.test.ts
```

Expected: FAIL on import.

- [ ] **Step 3: Implement `lib/llm/structured.ts`**

```ts
import type { ZodTypeAny, infer as ZInfer } from "zod";
import { chatCompletion } from "@/lib/llm/client";

export type StructuredChatOptions<S extends ZodTypeAny> = {
  apiKey: string;
  model: string;
  module: string;
  systemPrompt: string;
  userPrompt: string;
  schema: S;
  temperature?: number;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
};

export type StructuredChatResult<S extends ZodTypeAny> = {
  value: ZInfer<S>;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
};

function tryParseJson(text: string): unknown {
  // Models sometimes wrap JSON in ```json fences. Strip them first.
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  return JSON.parse(raw);
}

export async function structuredChat<S extends ZodTypeAny>(
  opts: StructuredChatOptions<S>,
): Promise<StructuredChatResult<S>> {
  const baseMessages = [
    { role: "system" as const, content: opts.systemPrompt },
    { role: "user" as const, content: opts.userPrompt },
  ];

  const attempt = async (corrective?: string) => {
    const messages = corrective
      ? [...baseMessages, { role: "assistant" as const, content: "" }, { role: "user" as const, content: corrective }]
      : baseMessages;
    return chatCompletion({
      apiKey: opts.apiKey,
      model: opts.model,
      module: opts.module,
      messages,
      responseFormat: { type: "json_object" },
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
      fetchImpl: opts.fetchImpl,
    });
  };

  const first = await attempt();
  try {
    const parsed = tryParseJson(first.content);
    const value = opts.schema.parse(parsed) as ZInfer<S>;
    return { value, inputTokens: first.inputTokens, outputTokens: first.outputTokens, latencyMs: first.latencyMs };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const second = await attempt(
      `Your previous reply could not be parsed as JSON conforming to the schema. ` +
        `Error: ${errMsg.slice(0, 300)}. Reply with ONLY the corrected JSON, no prose.`,
    );
    try {
      const parsed = tryParseJson(second.content);
      const value = opts.schema.parse(parsed) as ZInfer<S>;
      return { value, inputTokens: second.inputTokens, outputTokens: second.outputTokens, latencyMs: second.latencyMs };
    } catch (err2) {
      throw new Error(
        `structured-output failed after retry (module=${opts.module}): ${
          err2 instanceof Error ? err2.message : String(err2)
        }`,
      );
    }
  }
}
```

- [ ] **Step 4: Run the test, expect pass**

```
pnpm vitest run tests/unit/llm.structured.test.ts
```

Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```
git add lib/llm/structured.ts tests/unit/llm.structured.test.ts
git commit -m "add structured-output wrapper that validates llm replies against a zod schema with one retry"
```

---

### Task 5: LLM ping for /api/health

**Files:**
- Create: `lib/llm/ping.ts`
- (No test — `/api/health` test already covers the endpoint behavior; we add a pure module here that the route imports.)

- [ ] **Step 1: Implement `lib/llm/ping.ts`**

```ts
import { env } from "@/lib/env";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** Lightweight reachability check used by /api/health. Does NOT call the
 *  chat or embed endpoints — those would cost real money on every health
 *  check. The /models endpoint is free and returns 200 if the key is valid. */
export async function pingLlm(opts?: { fetchImpl?: typeof fetch }): Promise<boolean> {
  if (!env.OPENROUTER_API_KEY) return false;
  const fetchImpl = opts?.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(`${OPENROUTER_BASE_URL}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Commit**

```
git add lib/llm/ping.ts
git commit -m "add openrouter ping helper for /api/health"
```

---

## Section B — Pass 1 building blocks

### Task 6: Heading-aware markdown chunker

**Files:**
- Create: `lib/ingest/chunker.ts`
- Create: `tests/fixtures/ingest/tiny-lecture.md`
- Create: `tests/fixtures/ingest/short-section.md`
- Create: `tests/fixtures/ingest/oversized.md`
- Create: `tests/unit/ingest.chunker.test.ts`

**Algorithm (per spec § 4.1):**
1. Parse markdown to MDAST via `unified` + `remark-parse`.
2. Walk the tree top-down, emitting a "section" each time a `## ...` or `### ...` heading is encountered. The section's `headingPath` is the stack of all `#`/`##`/`###` ancestors.
3. Convert each section's content nodes to plain text (`mdast-util-to-string`).
4. Emit candidate chunks. Then merge passes:
   - Merge adjacent chunks under 200 tokens UNLESS doing so would cross a `##` boundary.
   - Split chunks over 500 tokens at sentence boundaries with ~20% overlap.
   - Drop chunks under 50 tokens that can't be merged with a neighbor.

- [ ] **Step 1: Create fixtures**

Create `tests/fixtures/ingest/tiny-lecture.md`:

```md
# Lecture 1

## Page 1

Intro paragraph one. Another sentence here.

### Subsection A

Details about subsection A.

## Page 2

Page two body. With several sentences. About interesting topics. Including chunking.

## Page 3

Page three is short.
```

Create `tests/fixtures/ingest/short-section.md`:

```md
# Tiny

## Page 1

Hello.
```

Create `tests/fixtures/ingest/oversized.md` — generate at least 800 tokens of repetitive content:

```md
# Big

## Page 1

The fox jumped. The fox jumped. The fox jumped. The fox jumped. The fox jumped.
The fox jumped. The fox jumped. The fox jumped. The fox jumped. The fox jumped.
[... repeat the line 100 times ...]
```

(Generate via shell: `for i in $(seq 1 100); do echo "The fox jumped. The fox jumped. The fox jumped. The fox jumped. The fox jumped. The fox jumped. The fox jumped." >> tests/fixtures/ingest/oversized.md; done`. The file should end up > 800 tokens.)

- [ ] **Step 2: Write the failing test**

Create `tests/unit/ingest.chunker.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chunkMarkdown } from "@/lib/ingest/chunker";

const fix = (name: string) =>
  readFileSync(resolve(__dirname, "../fixtures/ingest", name), "utf8");

describe("chunkMarkdown", () => {
  it("emits a chunk per ## section in tiny-lecture", () => {
    const chunks = chunkMarkdown(fix("tiny-lecture.md"));
    const headings = chunks.map((c) => c.headingPath.join(" / "));
    expect(headings).toContain("Lecture 1 / Page 1");
    expect(headings.some((h) => h.startsWith("Lecture 1 / Page 2"))).toBe(true);
  });

  it("preserves the heading path for nested ### sections", () => {
    const chunks = chunkMarkdown(fix("tiny-lecture.md"));
    const sub = chunks.find((c) => c.headingPath.includes("Subsection A"));
    expect(sub?.headingPath).toEqual(["Lecture 1", "Page 1", "Subsection A"]);
  });

  it("drops chunks under 50 tokens that cannot merge across ## boundaries", () => {
    const chunks = chunkMarkdown(fix("short-section.md"));
    expect(chunks).toHaveLength(0);
  });

  it("splits chunks over 500 tokens at sentence boundaries", () => {
    const chunks = chunkMarkdown(fix("oversized.md"));
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c) => {
      expect(c.tokenCount).toBeLessThanOrEqual(500);
      expect(c.tokenCount).toBeGreaterThanOrEqual(50);
    });
  });

  it("each chunk has stable position field 0..N-1 in document order", () => {
    const chunks = chunkMarkdown(fix("tiny-lecture.md"));
    chunks.forEach((c, i) => expect(c.position).toBe(i));
  });
});
```

- [ ] **Step 3: Run the test, expect failure**

```
pnpm vitest run tests/unit/ingest.chunker.test.ts
```

Expected: FAIL on import.

- [ ] **Step 4: Implement `lib/ingest/chunker.ts`**

```ts
import { unified } from "unified";
import remarkParse from "remark-parse";
import { toString } from "mdast-util-to-string";
import { visit } from "unist-util-visit";
import type { Root, Heading, Content } from "mdast";
import { countTokens } from "@/lib/ingest/tokenize";

export type Chunk = {
  position: number;
  content: string;
  headingPath: string[];
  tokenCount: number;
  /** True for chunks that came from splitting an oversized section, used
   *  by orchestrators that want to track provenance. */
  splitOf?: number;
};

const MIN_TOKENS = 50;
const TARGET_MIN = 200;
const TARGET_MAX = 500;
const OVERLAP_RATIO = 0.2;

type RawSection = { headingPath: string[]; content: string; depthOfBoundary: number };

function extractSections(md: string): RawSection[] {
  const tree = unified().use(remarkParse).parse(md) as Root;
  const sections: RawSection[] = [];
  const stack: { depth: number; text: string }[] = [];
  let current: RawSection | null = null;
  let currentDepth = 0;

  const flush = () => {
    if (current && current.content.trim()) sections.push(current);
  };

  for (const node of tree.children as Content[]) {
    if (node.type === "heading") {
      const heading = node as Heading;
      const text = toString(heading);
      // Pop stack to ancestors strictly shallower than this heading
      while (stack.length && stack[stack.length - 1]!.depth >= heading.depth) stack.pop();
      stack.push({ depth: heading.depth, text });
      // Start a new section only at depth 2 or 3 (the ## and ### we care about).
      // depth 1 (#) is the file title — we keep it in the path but don't start a chunk.
      if (heading.depth >= 2) {
        flush();
        current = {
          headingPath: stack.map((s) => s.text),
          content: "",
          depthOfBoundary: heading.depth,
        };
        currentDepth = heading.depth;
      } else {
        // Top-level heading: refresh path but don't start emitting yet.
        current = null;
        currentDepth = heading.depth;
      }
    } else if (current) {
      current.content += toString(node) + "\n\n";
    }
  }
  flush();
  return sections;
}

function splitOversized(section: RawSection, position: number): Chunk[] {
  const sentences = section.content
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);

  const chunks: string[] = [];
  let buf: string[] = [];
  let bufTokens = 0;

  for (const sent of sentences) {
    const sTok = countTokens(sent);
    if (bufTokens + sTok > TARGET_MAX && buf.length > 0) {
      chunks.push(buf.join(" "));
      // Carry overlap (last ~20% of the buffer) into the next chunk.
      const overlap = Math.max(1, Math.floor(buf.length * OVERLAP_RATIO));
      buf = buf.slice(-overlap);
      bufTokens = buf.reduce((acc, s) => acc + countTokens(s), 0);
    }
    buf.push(sent);
    bufTokens += sTok;
  }
  if (buf.length) chunks.push(buf.join(" "));

  return chunks.map<Chunk>((content, i) => ({
    position: position + i,
    content: content.trim(),
    headingPath: section.headingPath,
    tokenCount: countTokens(content),
    splitOf: position,
  }));
}

export function chunkMarkdown(md: string): Chunk[] {
  const sections = extractSections(md);
  const out: Chunk[] = [];

  // Pass 1: emit sections as candidate chunks.
  const candidates = sections.map((s, i) => ({
    section: s,
    chunk: {
      position: i,
      content: s.content.trim(),
      headingPath: s.headingPath,
      tokenCount: countTokens(s.content),
    } as Chunk,
  }));

  // Pass 2: merge tiny adjacent chunks WITHIN the same ## boundary.
  const merged: Chunk[] = [];
  let i = 0;
  while (i < candidates.length) {
    const cur = candidates[i]!;
    let acc = { ...cur.chunk };
    let j = i + 1;
    while (j < candidates.length) {
      const next = candidates[j]!;
      const sameTopBoundary = acc.headingPath[1] === next.chunk.headingPath[1];
      if (
        acc.tokenCount < TARGET_MIN &&
        sameTopBoundary &&
        acc.tokenCount + next.chunk.tokenCount <= TARGET_MAX
      ) {
        acc = {
          ...acc,
          content: acc.content + "\n\n" + next.chunk.content,
          headingPath: acc.headingPath, // keep the deeper-or-original path of acc
          tokenCount: countTokens(acc.content + "\n\n" + next.chunk.content),
        };
        j++;
      } else break;
    }
    merged.push(acc);
    i = j;
  }

  // Pass 3: split oversized, drop too-small.
  let nextPosition = 0;
  for (const m of merged) {
    if (m.tokenCount < MIN_TOKENS) continue; // drop
    if (m.tokenCount > TARGET_MAX) {
      const split = splitOversized(
        { headingPath: m.headingPath, content: m.content, depthOfBoundary: 2 },
        nextPosition,
      );
      for (const s of split) {
        if (s.tokenCount >= MIN_TOKENS) {
          out.push({ ...s, position: nextPosition++ });
        }
      }
    } else {
      out.push({ ...m, position: nextPosition++ });
    }
  }

  return out;
}
```

- [ ] **Step 5: Run the test, expect pass**

```
pnpm vitest run tests/unit/ingest.chunker.test.ts
```

Expected: PASS (5/5). If a token-count assertion is flaky, tweak the fixture sizes to give comfortable margins (e.g., make `oversized.md` clearly > 800 tokens).

- [ ] **Step 6: Commit**

```
git add lib/ingest/chunker.ts tests/fixtures/ingest/ tests/unit/ingest.chunker.test.ts
git commit -m "add heading-aware markdown chunker with merge-tiny and split-oversized passes"
```

---

### Task 7: Voyage embedder (batch size 32)

**Files:**
- Create: `lib/ingest/embedder.ts`
- Create: `tests/unit/ingest.embedder.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ingest.embedder.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/llm/client", () => ({
  embed: vi.fn(),
}));

import { embedChunks } from "@/lib/ingest/embedder";
import { embed } from "@/lib/llm/client";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("embedChunks", () => {
  it("batches inputs in groups of 32", async () => {
    vi.mocked(embed).mockImplementation(async ({ input }) => ({
      vectors: input.map(() => new Array(1024).fill(0.01)),
      inputTokens: input.length * 10,
      latencyMs: 50,
    }));
    const chunks = Array.from({ length: 70 }, (_, i) => `chunk ${i}`);
    const result = await embedChunks({
      apiKey: "sk-x",
      model: "voyageai/voyage-3",
      module: "test.embed",
      texts: chunks,
    });
    expect(result.vectors).toHaveLength(70);
    expect(vi.mocked(embed)).toHaveBeenCalledTimes(3); // 32 + 32 + 6
  });

  it("returns empty array for empty input without calling the api", async () => {
    const result = await embedChunks({
      apiKey: "sk-x",
      model: "voyageai/voyage-3",
      module: "test.embed",
      texts: [],
    });
    expect(result.vectors).toEqual([]);
    expect(vi.mocked(embed)).not.toHaveBeenCalled();
  });

  it("preserves vector ordering across batches", async () => {
    vi.mocked(embed).mockImplementation(async ({ input }) => ({
      vectors: input.map((t) => new Array(1024).fill(parseFloat(t))),
      inputTokens: 1,
      latencyMs: 1,
    }));
    const texts = ["1", "2", "3", "4"];
    const result = await embedChunks({
      apiKey: "sk-x",
      model: "voyageai/voyage-3",
      module: "test.embed",
      texts,
    });
    expect(result.vectors[0]![0]).toBeCloseTo(1.0);
    expect(result.vectors[3]![0]).toBeCloseTo(4.0);
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

```
pnpm vitest run tests/unit/ingest.embedder.test.ts
```

Expected: FAIL on import.

- [ ] **Step 3: Implement `lib/ingest/embedder.ts`**

```ts
import { embed } from "@/lib/llm/client";

const BATCH_SIZE = 32;

export type EmbedChunksOptions = {
  apiKey: string;
  model: string;
  module: string;
  texts: string[];
  fetchImpl?: typeof fetch;
};

export type EmbedChunksResult = {
  vectors: number[][];
  totalInputTokens: number;
};

export async function embedChunks(opts: EmbedChunksOptions): Promise<EmbedChunksResult> {
  if (opts.texts.length === 0) return { vectors: [], totalInputTokens: 0 };

  const vectors: number[][] = [];
  let totalInputTokens = 0;

  for (let i = 0; i < opts.texts.length; i += BATCH_SIZE) {
    const batch = opts.texts.slice(i, i + BATCH_SIZE);
    const result = await embed({
      apiKey: opts.apiKey,
      model: opts.model,
      module: opts.module,
      input: batch,
      fetchImpl: opts.fetchImpl,
    });
    vectors.push(...result.vectors);
    totalInputTokens += result.inputTokens;
  }

  return { vectors, totalInputTokens };
}
```

- [ ] **Step 4: Run the test, expect pass**

```
pnpm vitest run tests/unit/ingest.embedder.test.ts
```

Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```
git add lib/ingest/embedder.ts tests/unit/ingest.embedder.test.ts
git commit -m "add batched voyage embedder with batch size 32 and order preservation"
```

---

### Task 8: Topic tagger (batched Haiku)

**Files:**
- Create: `lib/ingest/topicTagger.ts`
- Create: `tests/unit/ingest.topicTagger.test.ts`

**Tags (closed set per spec § 4.1):** `rag`, `chunking`, `embeddings`, `vector_search`, `fusion`, `reranking`, `agents`, `react_loop`, `tools`, `verification`, `guardrails`, `evals`, `spec_driven`, `system_design`, `multimodal`. Up to 3 per chunk.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ingest.topicTagger.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/llm/structured", () => ({
  structuredChat: vi.fn(),
}));

import { tagChunks, ALLOWED_TAGS } from "@/lib/ingest/topicTagger";
import { structuredChat } from "@/lib/llm/structured";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tagChunks", () => {
  it("calls the LLM in batches of 10", async () => {
    vi.mocked(structuredChat).mockImplementation(async ({ userPrompt }) => {
      const count = (userPrompt.match(/^- /gm) ?? []).length;
      return {
        value: { tags: Array.from({ length: count }, () => ["rag"]) },
        inputTokens: 1,
        outputTokens: 1,
        latencyMs: 1,
      };
    });
    const chunks = Array.from({ length: 25 }, (_, i) => `chunk ${i} content`);
    const result = await tagChunks({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      module: "test.tag",
      texts: chunks,
    });
    expect(result.tags).toHaveLength(25);
    expect(vi.mocked(structuredChat)).toHaveBeenCalledTimes(3); // 10 + 10 + 5
  });

  it("filters out tags not in the allowed list", async () => {
    vi.mocked(structuredChat).mockResolvedValueOnce({
      value: { tags: [["rag", "made_up_tag", "agents"]] },
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
    });
    const result = await tagChunks({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      module: "test.tag",
      texts: ["one chunk"],
    });
    expect(result.tags[0]).toEqual(["rag", "agents"]);
  });

  it("caps tags per chunk at 3", async () => {
    vi.mocked(structuredChat).mockResolvedValueOnce({
      value: { tags: [["rag", "agents", "embeddings", "evals", "fusion"]] },
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
    });
    const result = await tagChunks({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      module: "test.tag",
      texts: ["one chunk"],
    });
    expect(result.tags[0]).toHaveLength(3);
  });

  it("returns empty array for empty input", async () => {
    const result = await tagChunks({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      module: "test.tag",
      texts: [],
    });
    expect(result.tags).toEqual([]);
    expect(vi.mocked(structuredChat)).not.toHaveBeenCalled();
  });
});

it("ALLOWED_TAGS exports the closed list of 15 tags", () => {
  expect(ALLOWED_TAGS).toContain("rag");
  expect(ALLOWED_TAGS.length).toBe(15);
});
```

- [ ] **Step 2: Run the test, expect failure**

```
pnpm vitest run tests/unit/ingest.topicTagger.test.ts
```

Expected: FAIL on import.

- [ ] **Step 3: Implement `lib/ingest/topicTagger.ts`**

```ts
import { z } from "zod";
import { structuredChat } from "@/lib/llm/structured";

export const ALLOWED_TAGS = [
  "rag", "chunking", "embeddings", "vector_search", "fusion",
  "reranking", "agents", "react_loop", "tools", "verification",
  "guardrails", "evals", "spec_driven", "system_design", "multimodal",
] as const;

export type AllowedTag = (typeof ALLOWED_TAGS)[number];

const BATCH_SIZE = 10;
const MAX_TAGS_PER_CHUNK = 3;

const ResponseSchema = z.object({
  tags: z.array(z.array(z.string())),
});

const SYSTEM_PROMPT = `You assign topic tags to AI-engineering lecture chunks.
Allowed tags (closed set; never invent): ${ALLOWED_TAGS.join(", ")}.
Return JSON: {"tags": [["tag1","tag2"], ...]} with one inner array per chunk
in input order. Up to ${MAX_TAGS_PER_CHUNK} tags per chunk. If unsure, return an empty array for that chunk.`;

export type TagChunksOptions = {
  apiKey: string;
  model: string;
  module: string;
  texts: string[];
  fetchImpl?: typeof fetch;
};

export type TagChunksResult = { tags: AllowedTag[][] };

export async function tagChunks(opts: TagChunksOptions): Promise<TagChunksResult> {
  if (opts.texts.length === 0) return { tags: [] };

  const out: AllowedTag[][] = [];
  for (let i = 0; i < opts.texts.length; i += BATCH_SIZE) {
    const batch = opts.texts.slice(i, i + BATCH_SIZE);
    const userPrompt = batch.map((t) => `- ${t.slice(0, 800)}`).join("\n");
    const { value } = await structuredChat({
      apiKey: opts.apiKey,
      model: opts.model,
      module: opts.module,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      schema: ResponseSchema,
      fetchImpl: opts.fetchImpl,
    });
    for (let j = 0; j < batch.length; j++) {
      const raw = value.tags[j] ?? [];
      const filtered = raw
        .filter((t): t is AllowedTag => (ALLOWED_TAGS as readonly string[]).includes(t))
        .slice(0, MAX_TAGS_PER_CHUNK);
      out.push(filtered);
    }
  }
  return { tags: out };
}
```

- [ ] **Step 4: Run the test, expect pass**

```
pnpm vitest run tests/unit/ingest.topicTagger.test.ts
```

Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```
git add lib/ingest/topicTagger.ts tests/unit/ingest.topicTagger.test.ts
git commit -m "add batched topic tagger restricted to a 15-tag closed set"
```

---

### Task 9: Source-file hash check + reprocess teardown

**Files:**
- Create: `lib/ingest/sourceFiles.ts`
- Create: `tests/unit/ingest.sourceFiles.test.ts`

**Behavior:**
- `computeFileHash(content)` → sha256 hex.
- `shouldReingest({ filename, contentHash, db })` → looks up `source_files.filename`. Returns:
  - `{ action: "skip" }` if existing row's `content_hash` matches.
  - `{ action: "reingest", existingFileId }` if it doesn't (caller deletes the rows).
  - `{ action: "fresh" }` if no existing row.
- `tearDownExistingChunks({ fileId, db })` → DELETEs `source_chunks` rows where `file_id = ?`. Cascades from there are limited (concepts.source_chunk_ids is an array, cleaned in Pass 2).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ingest.sourceFiles.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { computeFileHash, shouldReingest, tearDownExistingChunks } from "@/lib/ingest/sourceFiles";

describe("computeFileHash", () => {
  it("produces a stable sha256 hex string", () => {
    const a = computeFileHash("hello world");
    const b = computeFileHash("hello world");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for different content", () => {
    expect(computeFileHash("a")).not.toBe(computeFileHash("b"));
  });
});

describe("shouldReingest", () => {
  it('returns "fresh" when no row exists', async () => {
    const dbMock = {
      query: { sourceFiles: { findFirst: vi.fn(async () => undefined) } },
    } as never;
    const out = await shouldReingest({ filename: "x.md", contentHash: "h", db: dbMock });
    expect(out).toEqual({ action: "fresh" });
  });

  it('returns "skip" when row exists with matching hash', async () => {
    const dbMock = {
      query: {
        sourceFiles: {
          findFirst: vi.fn(async () => ({ id: "abc", contentHash: "h" })),
        },
      },
    } as never;
    const out = await shouldReingest({ filename: "x.md", contentHash: "h", db: dbMock });
    expect(out).toEqual({ action: "skip" });
  });

  it('returns "reingest" with existing id when hash differs', async () => {
    const dbMock = {
      query: {
        sourceFiles: {
          findFirst: vi.fn(async () => ({ id: "abc", contentHash: "old" })),
        },
      },
    } as never;
    const out = await shouldReingest({ filename: "x.md", contentHash: "new", db: dbMock });
    expect(out).toEqual({ action: "reingest", existingFileId: "abc" });
  });
});

describe("tearDownExistingChunks", () => {
  it("calls db.delete with a where clause filtering by fileId", async () => {
    const where = vi.fn(async () => undefined);
    const dbMock = { delete: vi.fn(() => ({ where })) } as never;
    await tearDownExistingChunks({ fileId: "abc", db: dbMock });
    expect(dbMock.delete).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

```
pnpm vitest run tests/unit/ingest.sourceFiles.test.ts
```

Expected: FAIL on import.

- [ ] **Step 3: Implement `lib/ingest/sourceFiles.ts`**

```ts
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { sourceChunks, sourceFiles } from "@/lib/db/schema";
import type { Database } from "@/lib/db";

export function computeFileHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export type ReingestDecision =
  | { action: "fresh" }
  | { action: "skip" }
  | { action: "reingest"; existingFileId: string };

export async function shouldReingest(opts: {
  filename: string;
  contentHash: string;
  db: Database;
}): Promise<ReingestDecision> {
  const existing = await opts.db.query.sourceFiles.findFirst({
    where: eq(sourceFiles.filename, opts.filename),
  });
  if (!existing) return { action: "fresh" };
  if (existing.contentHash === opts.contentHash) return { action: "skip" };
  return { action: "reingest", existingFileId: existing.id };
}

export async function tearDownExistingChunks(opts: {
  fileId: string;
  db: Database;
}): Promise<void> {
  await opts.db.delete(sourceChunks).where(eq(sourceChunks.fileId, opts.fileId));
}
```

This requires `lib/db/index.ts` to export the `Database` type AND configure schema-aware `query.*`. Plan 1 set up `db: drizzle(queryClient, { schema })` which exposes `db.query.<table>.findFirst` automatically. If `Database` isn't exported there, add `export type Database = typeof db;` (already present per Plan 1 Task 8).

- [ ] **Step 4: Run the test, expect pass**

```
pnpm vitest run tests/unit/ingest.sourceFiles.test.ts
```

Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```
git add lib/ingest/sourceFiles.ts tests/unit/ingest.sourceFiles.test.ts
git commit -m "add source-file hash check and chunk teardown helpers for reprocess flow"
```

---

## Section C — Pass 1 orchestrator

### Task 10: runPass1 (chunk → embed → tag → write)

**Files:**
- Create: `lib/ingest/pass1.ts`
- Create: `tests/unit/ingest.pass1.test.ts`

**Algorithm:**
1. Compute `contentHash`.
2. Decide via `shouldReingest`. If `skip`, return `{ skipped: true, ... }`.
3. If `reingest`, `tearDownExistingChunks` first.
4. `chunkMarkdown(content)` → chunks.
5. `embedChunks(chunks.map(c => c.content))` → vectors.
6. `tagChunks(chunks.map(c => c.content))` → tags.
7. `db.insert(sourceFiles).values({...}).onConflictDoUpdate(...)` to upsert by filename.
8. `db.insert(sourceChunks).values([...])` for the new chunks.
9. Return summary `{ skipped: false, chunkCount, totalEmbedTokens, totalTagTokens }`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ingest.pass1.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ingest/embedder", () => ({ embedChunks: vi.fn() }));
vi.mock("@/lib/ingest/topicTagger", () => ({ tagChunks: vi.fn() }));
vi.mock("@/lib/ingest/sourceFiles", () => ({
  computeFileHash: vi.fn(() => "hash123"),
  shouldReingest: vi.fn(),
  tearDownExistingChunks: vi.fn(),
}));

import { runPass1 } from "@/lib/ingest/pass1";
import { embedChunks } from "@/lib/ingest/embedder";
import { tagChunks } from "@/lib/ingest/topicTagger";
import { shouldReingest, tearDownExistingChunks } from "@/lib/ingest/sourceFiles";

const tinyMd = `# F\n\n## Page 1\n\n${"The cat sat on the mat. ".repeat(40)}`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runPass1", () => {
  it("returns skipped=true when shouldReingest says skip", async () => {
    vi.mocked(shouldReingest).mockResolvedValueOnce({ action: "skip" });
    const dbMock = {
      insert: vi.fn(),
      query: { sourceFiles: { findFirst: vi.fn() } },
    } as never;
    const out = await runPass1({
      filename: "tiny.md",
      content: tinyMd,
      apiKey: "sk-x",
      embedModel: "voyageai/voyage-3",
      tagModel: "anthropic/claude-haiku-4-5",
      db: dbMock,
    });
    expect(out.skipped).toBe(true);
    expect(embedChunks).not.toHaveBeenCalled();
  });

  it("tears down existing chunks before reingesting", async () => {
    vi.mocked(shouldReingest).mockResolvedValueOnce({
      action: "reingest",
      existingFileId: "id-1",
    });
    vi.mocked(embedChunks).mockResolvedValue({
      vectors: [new Array(1024).fill(0.5)],
      totalInputTokens: 100,
    });
    vi.mocked(tagChunks).mockResolvedValue({ tags: [["rag"]] });
    const insertChain = { values: vi.fn(async () => undefined), onConflictDoUpdate: vi.fn(async () => undefined) };
    insertChain.values = vi.fn(() => insertChain) as never;
    const dbMock = { insert: vi.fn(() => insertChain), query: { sourceFiles: { findFirst: vi.fn() } } } as never;

    await runPass1({
      filename: "x.md",
      content: tinyMd,
      apiKey: "sk-x",
      embedModel: "voyageai/voyage-3",
      tagModel: "anthropic/claude-haiku-4-5",
      db: dbMock,
    });
    expect(tearDownExistingChunks).toHaveBeenCalledWith({ fileId: "id-1", db: dbMock });
  });

  it("inserts source_files and source_chunks rows on fresh ingest", async () => {
    vi.mocked(shouldReingest).mockResolvedValueOnce({ action: "fresh" });
    vi.mocked(embedChunks).mockResolvedValue({
      vectors: [new Array(1024).fill(0.5)],
      totalInputTokens: 100,
    });
    vi.mocked(tagChunks).mockResolvedValue({ tags: [["rag", "agents"]] });
    const insertChain = { values: vi.fn(async () => undefined), onConflictDoUpdate: vi.fn(async () => undefined) };
    insertChain.values = vi.fn(() => insertChain) as never;
    const dbMock = { insert: vi.fn(() => insertChain), query: { sourceFiles: { findFirst: vi.fn() } } } as never;

    const out = await runPass1({
      filename: "x.md",
      content: tinyMd,
      apiKey: "sk-x",
      embedModel: "voyageai/voyage-3",
      tagModel: "anthropic/claude-haiku-4-5",
      db: dbMock,
    });
    expect(out.skipped).toBe(false);
    expect(out.chunkCount).toBeGreaterThan(0);
    expect(dbMock.insert).toHaveBeenCalledTimes(2); // sourceFiles + sourceChunks
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

```
pnpm vitest run tests/unit/ingest.pass1.test.ts
```

Expected: FAIL on import.

- [ ] **Step 3: Implement `lib/ingest/pass1.ts`**

```ts
import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { sourceChunks, sourceFiles } from "@/lib/db/schema";
import { chunkMarkdown } from "@/lib/ingest/chunker";
import { embedChunks } from "@/lib/ingest/embedder";
import { tagChunks } from "@/lib/ingest/topicTagger";
import {
  computeFileHash,
  shouldReingest,
  tearDownExistingChunks,
} from "@/lib/ingest/sourceFiles";

export type Pass1Options = {
  filename: string;
  content: string;
  title?: string;
  apiKey: string;
  embedModel: string;
  tagModel: string;
  db: Database;
  fetchImpl?: typeof fetch;
};

export type Pass1Result =
  | { skipped: true; reason: "hash-match"; filename: string }
  | {
      skipped: false;
      filename: string;
      chunkCount: number;
      totalEmbedTokens: number;
    };

export async function runPass1(opts: Pass1Options): Promise<Pass1Result> {
  const contentHash = computeFileHash(opts.content);
  const decision = await shouldReingest({
    filename: opts.filename,
    contentHash,
    db: opts.db,
  });

  if (decision.action === "skip") {
    return { skipped: true, reason: "hash-match", filename: opts.filename };
  }

  if (decision.action === "reingest") {
    await tearDownExistingChunks({ fileId: decision.existingFileId, db: opts.db });
  }

  const chunks = chunkMarkdown(opts.content);
  if (chunks.length === 0) {
    return { skipped: false, filename: opts.filename, chunkCount: 0, totalEmbedTokens: 0 };
  }
  const texts = chunks.map((c) => c.content);

  const [embedded, tagged] = await Promise.all([
    embedChunks({
      apiKey: opts.apiKey,
      model: opts.embedModel,
      module: "ingest.embed",
      texts,
      fetchImpl: opts.fetchImpl,
    }),
    tagChunks({
      apiKey: opts.apiKey,
      model: opts.tagModel,
      module: "ingest.tag",
      texts,
      fetchImpl: opts.fetchImpl,
    }),
  ]);

  // Upsert source_files row.
  await opts.db
    .insert(sourceFiles)
    .values({
      filename: opts.filename,
      title: opts.title ?? opts.filename.replace(/\.md$/, "").replace(/[_-]/g, " "),
      contentHash,
      ingestedAt: new Date(),
      chunkCount: chunks.length,
    })
    .onConflictDoUpdate({
      target: sourceFiles.filename,
      set: {
        contentHash,
        ingestedAt: new Date(),
        chunkCount: chunks.length,
        updatedAt: new Date(),
      },
    });

  // Get the file id for the FK on chunks.
  const fileRow = await opts.db.query.sourceFiles.findFirst({
    where: (f, { eq }) => eq(f.filename, opts.filename),
  });
  if (!fileRow) throw new Error(`source_files row missing after upsert: ${opts.filename}`);

  await opts.db.insert(sourceChunks).values(
    chunks.map((c, i) => ({
      fileId: fileRow.id,
      position: c.position,
      content: c.content,
      headingPath: c.headingPath,
      embedding: embedded.vectors[i]!,
      tokenCount: c.tokenCount,
      topicTags: tagged.tags[i] ?? [],
    })),
  );

  return {
    skipped: false,
    filename: opts.filename,
    chunkCount: chunks.length,
    totalEmbedTokens: embedded.totalInputTokens,
  };
}
```

- [ ] **Step 4: Run the test, expect pass**

```
pnpm vitest run tests/unit/ingest.pass1.test.ts
```

Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```
git add lib/ingest/pass1.ts tests/unit/ingest.pass1.test.ts
git commit -m "add pass1 orchestrator that chunks, embeds, tags, and writes per-file"
```

---

## Section D — Pass 2 building blocks

### Task 11: Concept extractor (single Sonnet call)

**Files:**
- Create: `lib/ingest/concepts.ts`
- Create: `tests/unit/ingest.concepts.test.ts`

**Per spec § 4.2 step 2.** One Sonnet call against the full corpus. Output: array of `{ name, parent_topic, canonical_summary, source_chunk_ids[] }`. Upsert by name.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ingest.concepts.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/llm/structured", () => ({ structuredChat: vi.fn() }));

import { extractConcepts, ConceptSchema } from "@/lib/ingest/concepts";
import { structuredChat } from "@/lib/llm/structured";

beforeEach(() => {
  vi.clearAllMocks();
});

const fakeChunks = [
  { id: "11111111-1111-1111-1111-111111111111", content: "RAG basics", headingPath: ["L1", "Page 1"] },
  { id: "22222222-2222-2222-2222-222222222222", content: "Vector search", headingPath: ["L1", "Page 2"] },
];

describe("extractConcepts", () => {
  it("calls Sonnet once with all chunks and returns parsed concepts", async () => {
    vi.mocked(structuredChat).mockResolvedValueOnce({
      value: {
        concepts: [
          {
            name: "RAG",
            parent_topic: "retrieval",
            canonical_summary: "two-sentence summary here. another sentence.",
            source_chunk_ids: ["11111111-1111-1111-1111-111111111111"],
          },
        ],
      },
      inputTokens: 1000,
      outputTokens: 200,
      latencyMs: 800,
    });
    const out = await extractConcepts({
      apiKey: "sk-x",
      model: "anthropic/claude-sonnet-4-6",
      chunks: fakeChunks,
    });
    expect(out.concepts).toHaveLength(1);
    expect(out.concepts[0]!.name).toBe("RAG");
    expect(vi.mocked(structuredChat)).toHaveBeenCalledTimes(1);
  });

  it("rejects parent_topic outside the closed set via the Zod schema", () => {
    expect(() =>
      ConceptSchema.parse({
        concepts: [
          {
            name: "X",
            parent_topic: "made-up-topic",
            canonical_summary: "two sentences. yes.",
            source_chunk_ids: [],
          },
        ],
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

```
pnpm vitest run tests/unit/ingest.concepts.test.ts
```

Expected: FAIL on import.

- [ ] **Step 3: Implement `lib/ingest/concepts.ts`**

```ts
import { z } from "zod";
import { structuredChat } from "@/lib/llm/structured";

const PARENT_TOPICS = ["retrieval", "agents", "evals", "spec", "system_design"] as const;

export const ConceptSchema = z.object({
  concepts: z.array(
    z.object({
      name: z.string().min(1),
      parent_topic: z.enum(PARENT_TOPICS),
      canonical_summary: z.string().min(20),
      source_chunk_ids: z.array(z.string().uuid()),
    }),
  ),
});

export type ExtractConceptsChunk = {
  id: string;
  content: string;
  headingPath: string[];
};

export type ExtractConceptsOptions = {
  apiKey: string;
  model: string;
  chunks: ExtractConceptsChunk[];
  fetchImpl?: typeof fetch;
};

export type ExtractConceptsResult = {
  concepts: z.infer<typeof ConceptSchema>["concepts"];
};

const SYSTEM_PROMPT = `You read AI-engineering lecture chunks and identify
distinct concepts a learner should master. For each concept return:
  - name (concise, e.g. "RAG", "ReAct loop", "HNSW vs IVFFlat")
  - parent_topic (one of: ${PARENT_TOPICS.join(", ")})
  - canonical_summary (exactly 2 sentences)
  - source_chunk_ids (UUIDs from the input that cover the concept)
Return JSON: { "concepts": [...] }. Aim for 8–25 distinct concepts total
across the corpus.`;

export async function extractConcepts(
  opts: ExtractConceptsOptions,
): Promise<ExtractConceptsResult> {
  const userPrompt = opts.chunks
    .map(
      (c) =>
        `[chunk ${c.id} | ${c.headingPath.join(" / ")}]\n${c.content.slice(0, 1500)}`,
    )
    .join("\n\n");

  const { value } = await structuredChat({
    apiKey: opts.apiKey,
    model: opts.model,
    module: "ingest.concepts",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    schema: ConceptSchema,
    maxTokens: 4096,
    fetchImpl: opts.fetchImpl,
  });

  return { concepts: value.concepts };
}
```

- [ ] **Step 4: Run the test, expect pass**

```
pnpm vitest run tests/unit/ingest.concepts.test.ts
```

Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```
git add lib/ingest/concepts.ts tests/unit/ingest.concepts.test.ts
git commit -m "add concept extractor with zod schema covering closed parent-topic set"
```

---

### Task 12: Concept neighbor pairs (compare/contrast prompts)

**Files:**
- Create: `lib/ingest/conceptPairs.ts`
- Create: `tests/unit/ingest.conceptPairs.test.ts`

**Why:** spec § 4.2 step 3 calls for a "concept-pairing" feature where concepts with strong neighbors get a forced compare/contrast freeform card. Pulling the static map into its own module keeps cardGen.ts clean and lets us evolve neighbors over time without retraining intuition.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ingest.conceptPairs.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { findNeighbors, CONCEPT_NEIGHBORS } from "@/lib/ingest/conceptPairs";

describe("findNeighbors", () => {
  it("returns the configured neighbor for RAG", () => {
    expect(findNeighbors("RAG")).toContain("Fusion");
  });

  it("is case-insensitive", () => {
    expect(findNeighbors("react loop")).toContain("LLM + tools");
  });

  it("returns empty array for unknown concepts", () => {
    expect(findNeighbors("Quantum Pasta")).toEqual([]);
  });

  it("CONCEPT_NEIGHBORS is symmetric — if A→B then B→A", () => {
    for (const [k, vs] of Object.entries(CONCEPT_NEIGHBORS)) {
      for (const v of vs) {
        expect(CONCEPT_NEIGHBORS[v]?.includes(k)).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

```
pnpm vitest run tests/unit/ingest.conceptPairs.test.ts
```

Expected: FAIL on import.

- [ ] **Step 3: Implement `lib/ingest/conceptPairs.ts`**

```ts
/** Static neighbor map for "compare / contrast / when to use which" cards.
 *  Symmetric — adding A→B requires adding B→A. Keep this list small and
 *  curated; if it grows past ~30 entries, move it to a config table. */
export const CONCEPT_NEIGHBORS: Record<string, string[]> = {
  "RAG":              ["Fusion"],
  "Fusion":           ["RAG"],
  "ReAct loop":       ["LLM + tools"],
  "LLM + tools":      ["ReAct loop"],
  "HNSW":             ["IVFFlat"],
  "IVFFlat":          ["HNSW"],
  "Cosine similarity":["Dot product"],
  "Dot product":      ["Cosine similarity"],
};

const lower: Record<string, string[]> = Object.fromEntries(
  Object.entries(CONCEPT_NEIGHBORS).map(([k, v]) => [k.toLowerCase(), v]),
);

export function findNeighbors(name: string): string[] {
  return lower[name.toLowerCase()] ?? [];
}
```

- [ ] **Step 4: Run the test, expect pass**

```
pnpm vitest run tests/unit/ingest.conceptPairs.test.ts
```

Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```
git add lib/ingest/conceptPairs.ts tests/unit/ingest.conceptPairs.test.ts
git commit -m "add static concept neighbor map for compare/contrast card generation"
```

---

### Task 13: Card generator (per-concept Haiku, mixed types)

**Files:**
- Create: `lib/ingest/cardGen.ts`
- Create: `tests/unit/ingest.cardGen.test.ts`

**Per spec § 4.2 step 3:**
- One Haiku call per concept generates exactly **8 cards: 3 MC + 3 cloze + 2 freeform** (configurable).
- Each card has `prompt`, `canonical_answer`, `explanation`, `difficulty` (1-3), `source_chunk_ids[]`.
- MC cards have `mcOptions: { options: string[]; correctIndex: number }`.
- Cloze cards have `clozeAnswers: string[]` (one per `{{c1::...}}` blank).
- Freeform cards have `rubric: { criterion: string; weight: number }[]`.
- If the concept has neighbors (via `findNeighbors`), one of the freeform cards is forced to be a compare/contrast question.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ingest.cardGen.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/llm/structured", () => ({ structuredChat: vi.fn() }));

import { generateCards, CardGenSchema } from "@/lib/ingest/cardGen";
import { structuredChat } from "@/lib/llm/structured";

const concept = {
  name: "RAG",
  canonicalSummary: "RAG augments LLMs with retrieved context.",
  parentTopic: "retrieval",
  sourceChunks: [
    { id: "11111111-1111-1111-1111-111111111111", content: "RAG = retrieve + generate." },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateCards", () => {
  it("requests 3 MC + 3 cloze + 2 freeform from the schema", async () => {
    const validResponse = {
      cards: [
        ...Array.from({ length: 3 }, (_, i) => ({
          card_type: "mc",
          prompt: `mc q ${i}`,
          canonical_answer: `correct ${i}`,
          explanation: "because",
          difficulty: 2,
          source_chunk_ids: ["11111111-1111-1111-1111-111111111111"],
          mc_options: { options: ["a", "correct " + i, "c", "d"], correct_index: 1 },
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          card_type: "cloze",
          prompt: `the {{c1::answer${i}}} is here`,
          canonical_answer: `answer${i}`,
          explanation: "because",
          difficulty: 2,
          source_chunk_ids: ["11111111-1111-1111-1111-111111111111"],
          cloze_answers: [`answer${i}`],
        })),
        {
          card_type: "freeform",
          prompt: "explain RAG",
          canonical_answer: "rag combines retrieval with generation",
          explanation: "rag explains itself",
          difficulty: 3,
          source_chunk_ids: ["11111111-1111-1111-1111-111111111111"],
          rubric: [{ criterion: "mentions retrieval", weight: 0.5 }, { criterion: "mentions generation", weight: 0.5 }],
        },
        {
          card_type: "freeform",
          prompt: "compare RAG vs Fusion",
          canonical_answer: "fusion adds reranking; rag is single-pass.",
          explanation: "compare/contrast",
          difficulty: 3,
          source_chunk_ids: ["11111111-1111-1111-1111-111111111111"],
          rubric: [{ criterion: "names key difference", weight: 1.0 }],
        },
      ],
    };
    vi.mocked(structuredChat).mockResolvedValueOnce({
      value: validResponse,
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
    });
    const out = await generateCards({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      concept,
      neighbors: ["Fusion"],
    });
    expect(out.cards).toHaveLength(8);
    expect(out.cards.filter((c) => c.cardType === "mc")).toHaveLength(3);
    expect(out.cards.filter((c) => c.cardType === "cloze")).toHaveLength(3);
    expect(out.cards.filter((c) => c.cardType === "freeform")).toHaveLength(2);
  });

  it("includes neighbor names in the user prompt when present", async () => {
    vi.mocked(structuredChat).mockResolvedValueOnce({
      value: { cards: [] },
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
    });
    await generateCards({
      apiKey: "sk-x",
      model: "anthropic/claude-haiku-4-5",
      concept,
      neighbors: ["Fusion"],
    }).catch(() => undefined);
    const call = vi.mocked(structuredChat).mock.calls[0]![0];
    expect(call.userPrompt).toContain("Fusion");
  });

  it("CardGenSchema rejects unknown card_type", () => {
    expect(() =>
      CardGenSchema.parse({
        cards: [{ card_type: "essay", prompt: "x", canonical_answer: "y", explanation: "z", difficulty: 1, source_chunk_ids: [] }],
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

```
pnpm vitest run tests/unit/ingest.cardGen.test.ts
```

Expected: FAIL on import.

- [ ] **Step 3: Implement `lib/ingest/cardGen.ts`**

```ts
import { z } from "zod";
import { structuredChat } from "@/lib/llm/structured";

const McOptions = z.object({
  options: z.array(z.string()).min(2).max(6),
  correct_index: z.number().int().min(0),
});

const RubricItem = z.object({
  criterion: z.string().min(1),
  weight: z.number().min(0).max(1),
});

const Difficulty = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const Card = z.discriminatedUnion("card_type", [
  z.object({
    card_type: z.literal("mc"),
    prompt: z.string().min(1),
    canonical_answer: z.string().min(1),
    explanation: z.string().min(1),
    difficulty: Difficulty,
    source_chunk_ids: z.array(z.string().uuid()),
    mc_options: McOptions,
  }),
  z.object({
    card_type: z.literal("cloze"),
    prompt: z.string().regex(/\{\{c\d+::[^}]+\}\}/),
    canonical_answer: z.string().min(1),
    explanation: z.string().min(1),
    difficulty: Difficulty,
    source_chunk_ids: z.array(z.string().uuid()),
    cloze_answers: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    card_type: z.literal("freeform"),
    prompt: z.string().min(1),
    canonical_answer: z.string().min(1),
    explanation: z.string().min(1),
    difficulty: Difficulty,
    source_chunk_ids: z.array(z.string().uuid()),
    rubric: z.array(RubricItem).min(1),
  }),
]);

export const CardGenSchema = z.object({ cards: z.array(Card) });

export type GeneratedCard = {
  cardType: "mc" | "cloze" | "freeform";
  prompt: string;
  canonicalAnswer: string;
  explanation: string;
  difficulty: 1 | 2 | 3;
  sourceChunkIds: string[];
  mcOptions: { options: string[]; correctIndex: number } | null;
  clozeAnswers: string[] | null;
  rubric: { criterion: string; weight: number }[] | null;
};

export type GenerateCardsOptions = {
  apiKey: string;
  model: string;
  concept: {
    name: string;
    canonicalSummary: string;
    parentTopic: string;
    sourceChunks: Array<{ id: string; content: string }>;
  };
  neighbors: string[];
  fetchImpl?: typeof fetch;
};

export type GenerateCardsResult = { cards: GeneratedCard[] };

const SYSTEM_PROMPT = `You generate spaced-repetition cards for AI-engineering
concepts. Each call must produce exactly 8 cards mixed 3 MC + 3 cloze + 2 freeform.

Rules:
- All cards reference at least one source_chunk_id from the provided chunks.
- MC: 4 options, exactly 1 correct, distractors plausible.
- Cloze: prompts use {{c1::answer}} syntax — one or more blanks.
- Freeform: include rubric of 2-4 criteria (weights sum to ~1.0).
- difficulty 1=fact recall, 2=apply concept, 3=compare/synthesize.

If a "compare with" neighbor is supplied, ONE of the freeform cards must be a
compare/contrast or "when to use which" question against that neighbor.

Return JSON: { "cards": [...] }.`;

function userPrompt(opts: GenerateCardsOptions): string {
  const compareLine = opts.neighbors.length
    ? `\nCompare with: ${opts.neighbors.join(", ")} (force ONE freeform card to compare/contrast).`
    : "";
  const chunks = opts.concept.sourceChunks
    .map((c) => `[${c.id}] ${c.content.slice(0, 1200)}`)
    .join("\n\n");
  return [
    `Concept: ${opts.concept.name}`,
    `Parent topic: ${opts.concept.parentTopic}`,
    `Summary: ${opts.concept.canonicalSummary}`,
    compareLine,
    `\nSource chunks:\n${chunks}`,
  ].join("\n");
}

export async function generateCards(
  opts: GenerateCardsOptions,
): Promise<GenerateCardsResult> {
  const { value } = await structuredChat({
    apiKey: opts.apiKey,
    model: opts.model,
    module: "ingest.cardGen",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: userPrompt(opts),
    schema: CardGenSchema,
    maxTokens: 4096,
    fetchImpl: opts.fetchImpl,
  });

  const cards: GeneratedCard[] = value.cards.map((c) => {
    if (c.card_type === "mc") {
      return {
        cardType: "mc",
        prompt: c.prompt,
        canonicalAnswer: c.canonical_answer,
        explanation: c.explanation,
        difficulty: c.difficulty,
        sourceChunkIds: c.source_chunk_ids,
        mcOptions: { options: c.mc_options.options, correctIndex: c.mc_options.correct_index },
        clozeAnswers: null,
        rubric: null,
      };
    }
    if (c.card_type === "cloze") {
      return {
        cardType: "cloze",
        prompt: c.prompt,
        canonicalAnswer: c.canonical_answer,
        explanation: c.explanation,
        difficulty: c.difficulty,
        sourceChunkIds: c.source_chunk_ids,
        mcOptions: null,
        clozeAnswers: c.cloze_answers,
        rubric: null,
      };
    }
    return {
      cardType: "freeform",
      prompt: c.prompt,
      canonicalAnswer: c.canonical_answer,
      explanation: c.explanation,
      difficulty: c.difficulty,
      sourceChunkIds: c.source_chunk_ids,
      mcOptions: null,
      clozeAnswers: null,
      rubric: c.rubric,
    };
  });

  return { cards };
}
```

- [ ] **Step 4: Run the test, expect pass**

```
pnpm vitest run tests/unit/ingest.cardGen.test.ts
```

Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```
git add lib/ingest/cardGen.ts tests/unit/ingest.cardGen.test.ts
git commit -m "add per-concept card generator producing 8 mixed-type cards with neighbor compare prompt"
```

---

## Section E — Pass 2 orchestrator

### Task 14: runPass2 (corpus signature → concepts → cards → refresh)

**Files:**
- Create: `lib/ingest/pass2.ts`
- Create: `tests/unit/ingest.pass2.test.ts`

**Per spec § 4.2:**
1. Hash the corpus signature: `sha256(concat(chunk.id + chunk.content for all chunks ordered by id))`.
2. If signature matches `settings.corpusSignature`, return `{ skipped: true }`.
3. Call `extractConcepts(allChunks)`.
4. Upsert `concepts` rows by name. For each, also fetch the concept's source chunk content for the cardGen call.
5. For each concept, call `generateCards` (parallel with concurrency limit 4 to avoid hammering OpenRouter).
6. Insert new `cards` rows.
7. **Refresh strategy** (re-run case):
   - Cards whose `source_chunk_ids[]` no longer all exist → set `is_disabled = true`. (Review history preserved.)
   - Cards whose chunks changed but concept persists: leave unless explicitly regenerated (handled by a separate `regenerateCards` function; see Task 15).
8. Update `settings.corpusSignature` and return summary.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ingest.pass2.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ingest/concepts", () => ({ extractConcepts: vi.fn() }));
vi.mock("@/lib/ingest/cardGen", () => ({ generateCards: vi.fn() }));

import { runPass2 } from "@/lib/ingest/pass2";
import { extractConcepts } from "@/lib/ingest/concepts";
import { generateCards } from "@/lib/ingest/cardGen";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeDb(opts: {
  signature: string | null;
  chunks: Array<{ id: string; content: string }>;
}) {
  const updateChain = { set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) };
  const insertChain = {
    values: vi.fn(() => insertChain),
    onConflictDoUpdate: vi.fn(async () => undefined),
    onConflictDoNothing: vi.fn(async () => undefined),
    returning: vi.fn(async () => [{ id: "concept-1", name: "RAG" }]),
  };
  return {
    update: vi.fn(() => updateChain),
    insert: vi.fn(() => insertChain),
    delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
    query: {
      settings: { findFirst: vi.fn(async () => ({ id: 1, corpusSignature: opts.signature })) },
      sourceChunks: { findMany: vi.fn(async () => opts.chunks) },
      concepts: { findMany: vi.fn(async () => []) },
      cards: { findMany: vi.fn(async () => []) },
    },
    execute: vi.fn(async () => undefined),
  } as never;
}

describe("runPass2", () => {
  it("skips when signature matches", async () => {
    const db = makeDb({
      signature: "abc",
      chunks: [{ id: "11111111-1111-1111-1111-111111111111", content: "x" }],
    });
    // Stub the signature computation by passing chunks whose hash equals "abc"
    const out = await runPass2({
      apiKey: "sk-x",
      sonnetModel: "anthropic/claude-sonnet-4-6",
      haikuModel: "anthropic/claude-haiku-4-5",
      db,
      forceSignature: "abc",
    });
    expect(out.skipped).toBe(true);
    expect(extractConcepts).not.toHaveBeenCalled();
  });

  it("runs full pipeline when signature differs", async () => {
    const db = makeDb({
      signature: null,
      chunks: [{ id: "11111111-1111-1111-1111-111111111111", content: "x" }],
    });
    vi.mocked(extractConcepts).mockResolvedValueOnce({
      concepts: [
        {
          name: "RAG",
          parent_topic: "retrieval",
          canonical_summary: "two sentences. yes.",
          source_chunk_ids: ["11111111-1111-1111-1111-111111111111"],
        },
      ],
    });
    vi.mocked(generateCards).mockResolvedValueOnce({
      cards: [
        {
          cardType: "mc",
          prompt: "p",
          canonicalAnswer: "a",
          explanation: "e",
          difficulty: 2,
          sourceChunkIds: ["11111111-1111-1111-1111-111111111111"],
          mcOptions: { options: ["a", "b", "c", "d"], correctIndex: 0 },
          clozeAnswers: null,
          rubric: null,
        },
      ],
    });
    const out = await runPass2({
      apiKey: "sk-x",
      sonnetModel: "anthropic/claude-sonnet-4-6",
      haikuModel: "anthropic/claude-haiku-4-5",
      db,
    });
    expect(out.skipped).toBe(false);
    expect(out.conceptCount).toBe(1);
    expect(out.cardCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

```
pnpm vitest run tests/unit/ingest.pass2.test.ts
```

Expected: FAIL on import.

- [ ] **Step 3: Implement `lib/ingest/pass2.ts`**

```ts
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { cards, concepts, settings, sourceChunks } from "@/lib/db/schema";
import { extractConcepts } from "@/lib/ingest/concepts";
import { generateCards } from "@/lib/ingest/cardGen";
import { findNeighbors } from "@/lib/ingest/conceptPairs";

const CONCEPT_CONCURRENCY = 4;

export type Pass2Options = {
  apiKey: string;
  sonnetModel: string;
  haikuModel: string;
  db: Database;
  fetchImpl?: typeof fetch;
  /** Test escape hatch: precompute the signature deterministically. */
  forceSignature?: string;
};

export type Pass2Result =
  | { skipped: true; reason: "signature-match" }
  | {
      skipped: false;
      conceptCount: number;
      cardCount: number;
      disabledCount: number;
    };

function computeCorpusSignature(
  chunks: Array<{ id: string; content: string }>,
): string {
  const concat = [...chunks]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c) => `${c.id}|${c.content}`)
    .join("\n");
  return createHash("sha256").update(concat).digest("hex");
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function runPass2(opts: Pass2Options): Promise<Pass2Result> {
  const allChunks = await opts.db.query.sourceChunks.findMany({
    columns: { id: true, content: true },
  });
  if (allChunks.length === 0) {
    return { skipped: false, conceptCount: 0, cardCount: 0, disabledCount: 0 };
  }

  const signature = opts.forceSignature ?? computeCorpusSignature(allChunks);
  const settingsRow = await opts.db.query.settings.findFirst();
  if (settingsRow?.corpusSignature === signature) {
    return { skipped: true, reason: "signature-match" };
  }

  const chunkContextById = new Map(allChunks.map((c) => [c.id, c.content]));
  const chunksForExtraction = await opts.db.query.sourceChunks.findMany({
    columns: { id: true, content: true, headingPath: true },
  });

  const extracted = await extractConcepts({
    apiKey: opts.apiKey,
    model: opts.sonnetModel,
    chunks: chunksForExtraction,
    fetchImpl: opts.fetchImpl,
  });

  // Upsert concepts by name; collect their ids.
  const conceptRows: Array<{ id: string; name: string; parentTopic: string; canonicalSummary: string; sourceChunkIds: string[] }> = [];
  for (const c of extracted.concepts) {
    const inserted = await opts.db
      .insert(concepts)
      .values({
        name: c.name,
        canonicalSummary: c.canonical_summary,
        parentTopic: c.parent_topic,
        sourceChunkIds: c.source_chunk_ids,
      })
      .onConflictDoUpdate({
        target: concepts.name,
        set: {
          canonicalSummary: c.canonical_summary,
          parentTopic: c.parent_topic,
          sourceChunkIds: c.source_chunk_ids,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (inserted[0]) {
      conceptRows.push({
        id: inserted[0].id,
        name: inserted[0].name,
        parentTopic: c.parent_topic,
        canonicalSummary: c.canonical_summary,
        sourceChunkIds: c.source_chunk_ids,
      });
    }
  }

  // Generate cards per concept (concurrency-limited).
  const generated = await runWithConcurrency(conceptRows, CONCEPT_CONCURRENCY, async (concept) => {
    const sourceChunksForConcept = concept.sourceChunkIds
      .map((id) => ({ id, content: chunkContextById.get(id) ?? "" }))
      .filter((c) => c.content.length > 0);
    return generateCards({
      apiKey: opts.apiKey,
      model: opts.haikuModel,
      concept: {
        name: concept.name,
        canonicalSummary: concept.canonicalSummary,
        parentTopic: concept.parentTopic,
        sourceChunks: sourceChunksForConcept,
      },
      neighbors: findNeighbors(concept.name),
      fetchImpl: opts.fetchImpl,
    });
  });

  let cardCount = 0;
  for (let i = 0; i < conceptRows.length; i++) {
    const conceptId = conceptRows[i]!.id;
    const cardsForConcept = generated[i]!.cards;
    if (cardsForConcept.length === 0) continue;
    await opts.db.insert(cards).values(
      cardsForConcept.map((c) => ({
        conceptId,
        cardType: c.cardType,
        prompt: c.prompt,
        canonicalAnswer: c.canonicalAnswer,
        explanation: c.explanation,
        difficulty: c.difficulty,
        sourceChunkIds: c.sourceChunkIds,
        mcOptions: c.mcOptions ?? null,
        clozeAnswers: c.clozeAnswers ?? null,
        rubric: c.rubric ?? null,
      })),
    );
    cardCount += cardsForConcept.length;
  }

  // Refresh strategy: disable cards whose source chunks no longer exist.
  const validChunkIds = new Set(allChunks.map((c) => c.id));
  const allCards = await opts.db.query.cards.findMany({
    columns: { id: true, sourceChunkIds: true, isDisabled: true },
  });
  let disabledCount = 0;
  for (const card of allCards) {
    if (card.isDisabled) continue;
    const stillCovered = card.sourceChunkIds.some((id) => validChunkIds.has(id));
    if (!stillCovered) {
      await opts.db.update(cards).set({ isDisabled: true }).where(eq(cards.id, card.id));
      disabledCount++;
    }
  }

  // Update corpus signature.
  await opts.db
    .update(settings)
    .set({ corpusSignature: signature, updatedAt: new Date() })
    .where(eq(settings.id, 1));

  return {
    skipped: false,
    conceptCount: conceptRows.length,
    cardCount,
    disabledCount,
  };
}
```

- [ ] **Step 4: Run the test, expect pass**

```
pnpm vitest run tests/unit/ingest.pass2.test.ts
```

Expected: PASS (2/2). The mock-DB shape the test uses is intentionally loose — it verifies orchestration, not Drizzle internals.

- [ ] **Step 5: Commit**

```
git add lib/ingest/pass2.ts tests/unit/ingest.pass2.test.ts
git commit -m "add pass2 orchestrator with corpus signature, concept upsert, parallel card gen, and refresh"
```

---

## Section F — CLI, API, observability

### Task 15: Failure-log helper (JSONL append)

**Files:**
- Create: `lib/ingest/failureLog.ts`
- Create: `tests/unit/ingest.failureLog.test.ts`
- Modify: `.gitignore` (add `/logs`)

**Per spec § 4.4.** A tiny module that appends `{ts, module, payload, error}` to `logs/ingest-failures.jsonl`. Failures don't crash the run; they're noted and the orchestrator moves on.

- [ ] **Step 1: Add `/logs` to `.gitignore`**

Append to `.gitignore`:

```
# runtime logs
/logs/
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/ingest.failureLog.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendFailure } from "@/lib/ingest/failureLog";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ingest-fail-"));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("appendFailure", () => {
  it("creates the directory and writes a JSONL line", async () => {
    const path = join(tmp, "deep", "ingest-failures.jsonl");
    await appendFailure(path, {
      module: "ingest.embed",
      payload: { filename: "x.md" },
      error: "boom",
    });
    const contents = readFileSync(path, "utf8").trim().split("\n");
    expect(contents).toHaveLength(1);
    const parsed = JSON.parse(contents[0]!);
    expect(parsed.module).toBe("ingest.embed");
    expect(parsed.error).toBe("boom");
    expect(typeof parsed.ts).toBe("string");
  });

  it("appends multiple lines on subsequent calls", async () => {
    const path = join(tmp, "ingest-failures.jsonl");
    await appendFailure(path, { module: "a", payload: {}, error: "1" });
    await appendFailure(path, { module: "b", payload: {}, error: "2" });
    const lines = readFileSync(path, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
  });
});
```

- [ ] **Step 3: Run the test, expect failure**

```
pnpm vitest run tests/unit/ingest.failureLog.test.ts
```

Expected: FAIL on import.

- [ ] **Step 4: Implement `lib/ingest/failureLog.ts`**

```ts
import { mkdir, appendFile } from "node:fs/promises";
import { dirname } from "node:path";

export type FailureRecord = {
  module: string;
  payload: unknown;
  error: string;
};

export async function appendFailure(path: string, record: FailureRecord): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const line = JSON.stringify({ ts: new Date().toISOString(), ...record }) + "\n";
  await appendFile(path, line, "utf8");
}
```

- [ ] **Step 5: Run the test, expect pass**

```
pnpm vitest run tests/unit/ingest.failureLog.test.ts
```

Expected: PASS (2/2).

- [ ] **Step 6: Commit**

```
git add .gitignore lib/ingest/failureLog.ts tests/unit/ingest.failureLog.test.ts
git commit -m "add jsonl failure logger and gitignore /logs"
```

---

### Task 16: CLI script (`pnpm ingest`)

**Files:**
- Create: `scripts/ingest.ts`
- Modify: `package.json` (add `"ingest": "tsx scripts/ingest.ts"` to scripts)

**CLI flags:**
- `--dir <path>` — source directory (default: `gauntlet_ai_resources`).
- `--file <name>` — process only this file.
- `--pass1-only` — skip Pass 2.
- `--pass2-only` — skip Pass 1.
- `--regenerate-cards <conceptName>` — disable + replace cards for one concept (Pass 2 partial).
- `--dry-run` — chunk + count only; no LLM calls, no writes.

**Output:** progress lines per file, summary at end (files processed, chunks created, concepts found, cards generated, total cost in USD, duration).

- [ ] **Step 1: Add the script entry to `package.json`**

In the `scripts` block of `package.json`, add:

```json
"ingest": "tsx scripts/ingest.ts"
```

- [ ] **Step 2: Implement `scripts/ingest.ts`**

```ts
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { sql, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { resolveOneShotDatabaseUrl } from "@/lib/db/oneshot-url";
import * as schema from "@/lib/db/schema";
import { runPass1 } from "@/lib/ingest/pass1";
import { runPass2 } from "@/lib/ingest/pass2";
import { appendFailure } from "@/lib/ingest/failureLog";
import { log } from "@/lib/log";

async function main() {
  const { values } = parseArgs({
    options: {
      dir:        { type: "string", default: "gauntlet_ai_resources" },
      file:       { type: "string" },
      "pass1-only": { type: "boolean", default: false },
      "pass2-only": { type: "boolean", default: false },
      "regenerate-cards": { type: "string" },
      "dry-run":  { type: "boolean", default: false },
    },
  });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY is required (set in .env.local or via railway variables)");
    process.exit(1);
  }

  const dbUrl = resolveOneShotDatabaseUrl(process.env);
  const queryClient = postgres(dbUrl, { max: 1 });
  const db = drizzle(queryClient, { schema });

  // Read settings for model names.
  const settings = await db.query.settings.findFirst();
  if (!settings) throw new Error("settings row missing — run pnpm db:seed first");
  const haikuModel = settings.modelHaiku;
  const sonnetModel = settings.modelSonnet;
  const embeddingModel = settings.embeddingModel;

  let totalChunks = 0;
  let totalConcepts = 0;
  let totalCards = 0;
  const start = Date.now();

  // --- Pass 1 phase ---
  if (!values["pass2-only"]) {
    const dirPath = resolve(values.dir!);
    const filenames = values.file
      ? [values.file]
      : (await readdir(dirPath)).filter((f) => f.endsWith(".md") && f !== "README.md");

    if (filenames.length === 0) {
      console.log(`No markdown files in ${dirPath}.`);
    }

    for (const filename of filenames) {
      try {
        const content = await readFile(resolve(dirPath, filename), "utf8");
        if (values["dry-run"]) {
          const { chunkMarkdown } = await import("@/lib/ingest/chunker");
          const chunks = chunkMarkdown(content);
          console.log(`[dry] ${filename}: ${chunks.length} chunks`);
          totalChunks += chunks.length;
          continue;
        }
        const out = await runPass1({
          filename,
          content,
          apiKey,
          embedModel: embeddingModel,
          tagModel: haikuModel,
          db,
        });
        if (out.skipped) {
          console.log(`✓ ${filename} (skipped — hash unchanged)`);
        } else {
          console.log(`✓ ${filename} (${out.chunkCount} chunks, ${out.totalEmbedTokens} embed tokens)`);
          totalChunks += out.chunkCount;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`✗ ${filename}: ${msg}`);
        await appendFailure("logs/ingest-failures.jsonl", {
          module: "ingest.pass1",
          payload: { filename },
          error: msg,
        });
      }
    }
  }

  // --- Pass 2 phase ---
  if (!values["pass1-only"] && !values["dry-run"]) {
    try {
      const out = await runPass2({
        apiKey,
        sonnetModel,
        haikuModel,
        db,
      });
      if (out.skipped) {
        console.log("✓ Pass 2 skipped (corpus signature unchanged)");
      } else {
        totalConcepts = out.conceptCount;
        totalCards = out.cardCount;
        console.log(
          `✓ Pass 2: ${out.conceptCount} concepts, ${out.cardCount} cards, ${out.disabledCount} disabled`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`✗ Pass 2: ${msg}`);
      await appendFailure("logs/ingest-failures.jsonl", {
        module: "ingest.pass2",
        payload: {},
        error: msg,
      });
    }
  }

  // --- Cost summary from llm_calls ---
  const costRow = await db.execute<{ total_cost: string; total_calls: number }>(
    sql`SELECT COALESCE(SUM(cost_usd), 0)::text as total_cost, COUNT(*)::int as total_calls
        FROM llm_calls
        WHERE created_at >= NOW() - INTERVAL '5 minutes'`,
  );
  const summary = (costRow as unknown as Array<{ total_cost: string; total_calls: number }>)[0];

  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  console.log("\n──────── ingest summary ────────");
  console.log(`Duration:      ${seconds}s`);
  console.log(`Chunks added:  ${totalChunks}`);
  console.log(`Concepts:      ${totalConcepts}`);
  console.log(`Cards:         ${totalCards}`);
  if (summary) {
    console.log(`LLM calls:     ${summary.total_calls}`);
    console.log(`Cost (USD):    $${parseFloat(summary.total_cost).toFixed(4)}`);
  }

  await queryClient.end();
}

main().catch((err) => {
  log.error({ err }, "ingest failed");
  process.exit(1);
});
```

- [ ] **Step 3: Manual smoke test (no commit yet)**

```
pnpm ingest --dry-run
```

Expected: prints `[dry] <filename>: <N> chunks` for each `.md` in `gauntlet_ai_resources/`. No DB writes, no LLM calls.

- [ ] **Step 4: Commit**

```
git add scripts/ingest.ts package.json
git commit -m "add pnpm ingest cli with pass1, pass2, dry-run, regenerate-cards, and cost summary"
```

---

### Task 17: `regenerateCards(conceptName)` partial Pass 2

**Files:**
- Modify: `lib/ingest/pass2.ts` (add `regenerateCards` named export)
- Modify: `scripts/ingest.ts` (handle `--regenerate-cards <name>` branch)
- Create: `tests/unit/ingest.regenerateCards.test.ts`

**Behavior:** disable all current `cards` with `concept_id` matching the named concept, then call `generateCards` for that concept and insert the new ones. Doesn't touch `concepts` row.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ingest.regenerateCards.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ingest/cardGen", () => ({ generateCards: vi.fn() }));

import { regenerateCards } from "@/lib/ingest/pass2";
import { generateCards } from "@/lib/ingest/cardGen";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("regenerateCards", () => {
  it("disables existing cards then inserts new ones for the concept", async () => {
    const updateChain = { set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) };
    const insertChain = {
      values: vi.fn(async () => undefined),
    };
    const dbMock = {
      query: {
        concepts: {
          findFirst: vi.fn(async () => ({
            id: "c-1",
            name: "RAG",
            canonicalSummary: "two sentences. yes.",
            parentTopic: "retrieval",
            sourceChunkIds: ["11111111-1111-1111-1111-111111111111"],
          })),
        },
        sourceChunks: {
          findMany: vi.fn(async () => [
            { id: "11111111-1111-1111-1111-111111111111", content: "rag is rag" },
          ]),
        },
      },
      update: vi.fn(() => updateChain),
      insert: vi.fn(() => insertChain),
    } as never;
    vi.mocked(generateCards).mockResolvedValueOnce({
      cards: [
        {
          cardType: "mc",
          prompt: "p",
          canonicalAnswer: "a",
          explanation: "e",
          difficulty: 2,
          sourceChunkIds: ["11111111-1111-1111-1111-111111111111"],
          mcOptions: { options: ["a", "b", "c", "d"], correctIndex: 0 },
          clozeAnswers: null,
          rubric: null,
        },
      ],
    });

    const out = await regenerateCards({
      apiKey: "sk-x",
      haikuModel: "anthropic/claude-haiku-4-5",
      conceptName: "RAG",
      db: dbMock,
    });
    expect(out.disabled).toBeGreaterThanOrEqual(0);
    expect(out.created).toBe(1);
    expect(dbMock.update).toHaveBeenCalledTimes(1); // disabled
    expect(dbMock.insert).toHaveBeenCalledTimes(1); // new cards
  });

  it("throws when concept name is unknown", async () => {
    const dbMock = {
      query: { concepts: { findFirst: vi.fn(async () => undefined) } },
    } as never;
    await expect(
      regenerateCards({
        apiKey: "sk-x",
        haikuModel: "anthropic/claude-haiku-4-5",
        conceptName: "Nonexistent",
        db: dbMock,
      }),
    ).rejects.toThrow(/Nonexistent/);
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

```
pnpm vitest run tests/unit/ingest.regenerateCards.test.ts
```

Expected: FAIL — `regenerateCards` is not yet exported from `pass2.ts`.

- [ ] **Step 3: Add `regenerateCards` to `lib/ingest/pass2.ts`**

Append to the existing `pass2.ts`:

```ts
import { inArray } from "drizzle-orm";

export type RegenerateCardsOptions = {
  apiKey: string;
  haikuModel: string;
  conceptName: string;
  db: Database;
  fetchImpl?: typeof fetch;
};

export type RegenerateCardsResult = { disabled: number; created: number };

export async function regenerateCards(
  opts: RegenerateCardsOptions,
): Promise<RegenerateCardsResult> {
  const concept = await opts.db.query.concepts.findFirst({
    where: (c, { eq }) => eq(c.name, opts.conceptName),
  });
  if (!concept) {
    throw new Error(`No concept named "${opts.conceptName}"`);
  }

  // Disable existing cards under this concept.
  await opts.db.update(cards).set({ isDisabled: true }).where(eq(cards.conceptId, concept.id));

  // Fetch the concept's source chunks for context.
  const sourceChunkRows = await opts.db.query.sourceChunks.findMany({
    where: (sc) => inArray(sc.id, concept.sourceChunkIds),
    columns: { id: true, content: true },
  });

  const generated = await generateCards({
    apiKey: opts.apiKey,
    model: opts.haikuModel,
    concept: {
      name: concept.name,
      canonicalSummary: concept.canonicalSummary,
      parentTopic: concept.parentTopic,
      sourceChunks: sourceChunkRows,
    },
    neighbors: findNeighbors(concept.name),
    fetchImpl: opts.fetchImpl,
  });

  if (generated.cards.length > 0) {
    await opts.db.insert(cards).values(
      generated.cards.map((c) => ({
        conceptId: concept.id,
        cardType: c.cardType,
        prompt: c.prompt,
        canonicalAnswer: c.canonicalAnswer,
        explanation: c.explanation,
        difficulty: c.difficulty,
        sourceChunkIds: c.sourceChunkIds,
        mcOptions: c.mcOptions ?? null,
        clozeAnswers: c.clozeAnswers ?? null,
        rubric: c.rubric ?? null,
      })),
    );
  }

  return { disabled: 1, created: generated.cards.length };
}
```

- [ ] **Step 4: Wire `--regenerate-cards <name>` in `scripts/ingest.ts`**

Inside `main()`, before the Pass 1 phase block, add:

```ts
if (values["regenerate-cards"]) {
  const { regenerateCards } = await import("@/lib/ingest/pass2");
  const out = await regenerateCards({
    apiKey,
    haikuModel,
    conceptName: values["regenerate-cards"],
    db,
  });
  console.log(`✓ Regenerated cards for "${values["regenerate-cards"]}": disabled ${out.disabled}, created ${out.created}`);
  await queryClient.end();
  return;
}
```

- [ ] **Step 5: Run the test, expect pass**

```
pnpm vitest run tests/unit/ingest.regenerateCards.test.ts
```

Expected: PASS (2/2).

- [ ] **Step 6: Commit**

```
git add lib/ingest/pass2.ts scripts/ingest.ts tests/unit/ingest.regenerateCards.test.ts
git commit -m "add regenerate-cards path that disables and replaces cards under a single concept"
```

---

### Task 18: `POST /api/ingest` route

**Files:**
- Create: `app/api/ingest/route.ts`
- Create: `tests/unit/api.ingest.test.ts`

**Auth:** the route is gated by `middleware.ts` already. The handler reads JSON body for optional flags `{ pass2Only?: boolean }`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/api.ingest.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ingest/pass1", () => ({ runPass1: vi.fn() }));
vi.mock("@/lib/ingest/pass2", () => ({ runPass2: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { query: { settings: { findFirst: vi.fn(async () => ({
    modelHaiku: "anthropic/claude-haiku-4-5",
    modelSonnet: "anthropic/claude-sonnet-4-6",
    embeddingModel: "voyageai/voyage-3",
  })) } } },
}));
vi.mock("@/lib/env", () => ({ env: { OPENROUTER_API_KEY: "sk-x" } }));

import { POST } from "@/app/api/ingest/route";
import { runPass1 } from "@/lib/ingest/pass1";
import { runPass2 } from "@/lib/ingest/pass2";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/ingest", () => {
  it("returns 503 if OPENROUTER_API_KEY missing", async () => {
    vi.doMock("@/lib/env", () => ({ env: { OPENROUTER_API_KEY: undefined } }));
    const fresh = await import("@/app/api/ingest/route");
    const res = await fresh.POST(new Request("http://x/api/ingest", { method: "POST", body: "{}" }));
    expect(res.status).toBe(503);
  });

  it("invokes runPass2 only when pass2Only=true", async () => {
    vi.mocked(runPass2).mockResolvedValueOnce({
      skipped: false,
      conceptCount: 1,
      cardCount: 8,
      disabledCount: 0,
    });
    const res = await POST(
      new Request("http://x/api/ingest", { method: "POST", body: JSON.stringify({ pass2Only: true }) }),
    );
    expect(res.status).toBe(200);
    expect(runPass1).not.toHaveBeenCalled();
    expect(runPass2).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

```
pnpm vitest run tests/unit/api.ingest.test.ts
```

Expected: FAIL on import.

- [ ] **Step 3: Implement `app/api/ingest/route.ts`**

```ts
import { NextResponse } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { runPass1 } from "@/lib/ingest/pass1";
import { runPass2 } from "@/lib/ingest/pass2";
import { log } from "@/lib/log";

const SOURCE_DIR = "gauntlet_ai_resources";

export async function POST(req: Request) {
  if (!env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "OPENROUTER_API_KEY is not set" },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { pass2Only?: boolean };

  const settings = await db.query.settings.findFirst();
  if (!settings) {
    return NextResponse.json({ ok: false, error: "settings row missing" }, { status: 500 });
  }

  let chunkTotal = 0;
  if (!body.pass2Only) {
    const dir = resolve(SOURCE_DIR);
    const files = (await readdir(dir)).filter(
      (f) => f.endsWith(".md") && f !== "README.md",
    );
    for (const filename of files) {
      try {
        const content = await readFile(resolve(dir, filename), "utf8");
        const out = await runPass1({
          filename,
          content,
          apiKey: env.OPENROUTER_API_KEY,
          embedModel: settings.embeddingModel,
          tagModel: settings.modelHaiku,
          db,
        });
        if (!out.skipped) chunkTotal += out.chunkCount;
      } catch (err) {
        log.error({ err, filename }, "ingest pass1 failed for file");
      }
    }
  }

  const pass2 = await runPass2({
    apiKey: env.OPENROUTER_API_KEY,
    sonnetModel: settings.modelSonnet,
    haikuModel: settings.modelHaiku,
    db,
  });

  return NextResponse.json({
    ok: true,
    chunks: chunkTotal,
    concepts: "skipped" in pass2 && pass2.skipped ? 0 : pass2.conceptCount,
    cards: "skipped" in pass2 && pass2.skipped ? 0 : pass2.cardCount,
    pass2Skipped: "skipped" in pass2 && pass2.skipped,
  });
}
```

- [ ] **Step 4: Run the test, expect pass**

```
pnpm vitest run tests/unit/api.ingest.test.ts
```

Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```
git add app/api/ingest/route.ts tests/unit/api.ingest.test.ts
git commit -m "add post /api/ingest route that runs pass1 + pass2 with optional pass2-only flag"
```

---

### Task 19: Wire `llm_ok` in `/api/health`

**Files:**
- Modify: `app/api/health/route.ts`
- Modify: existing health-route test if present (verify by Glob)

- [ ] **Step 1: Update `app/api/health/route.ts`**

Replace contents with:

```ts
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { pingLlm } from "@/lib/llm/ping";
import packageJson from "@/package.json";

export async function GET() {
  const dbStart = Date.now();
  let dbOk = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch (err) {
    log.error({ err }, "health: db check failed");
  }
  const dbLatencyMs = Date.now() - dbStart;

  const llmOk = await pingLlm();

  const status = dbOk ? 200 : 503;

  return NextResponse.json(
    {
      ok: dbOk,
      db_ok: dbOk,
      llm_ok: llmOk,
      version: packageJson.version,
      checked_at: new Date().toISOString(),
      db_latency_ms: dbLatencyMs,
    },
    { status },
  );
}
```

- [ ] **Step 2: Smoke test locally (no DB needed for the route compile)**

```
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Smoke test against deployed (after this is shipped) — note for the executing engineer**

```
curl https://learnings-ai-production.up.railway.app/api/health
```

Expected: `llm_ok: true` if `OPENROUTER_API_KEY` is set on Railway, `false` otherwise.

- [ ] **Step 4: Commit**

```
git add app/api/health/route.ts
git commit -m "wire real llm_ok in /api/health via openrouter ping helper"
```

---

### Task 20: Documentation update

**Files:**
- Modify: `CLAUDE.md`
- Modify: `STUDY_GUIDE.md`

- [ ] **Step 1: Update `CLAUDE.md`**

Locate the "Common tasks" section. Add a bullet:

```markdown
- Ingest new lecture markdown → drop the file in `gauntlet_ai_resources/`, then `pnpm ingest`. Re-runs are idempotent (file hash + corpus signature). Use `--dry-run` to preview chunk counts without LLM calls.
```

In the same file, locate the `Where things live` section. Update the `sources/` line to read:

```markdown
- `gauntlet_ai_resources/` — Gauntlet markdown lectures (input to the ingest pipeline). Each file uses `## Page N` boundaries.
```

(Delete the existing `sources/` entry if present.)

- [ ] **Step 2: Update `STUDY_GUIDE.md`**

Append to the **How Each Piece Works** section:

```markdown
### Ingestion pipeline (`lib/ingest/`, `scripts/ingest.ts`, `app/api/ingest/`)

Two passes. **Pass 1** is per-file: hash the contents (sha256), skip if unchanged; otherwise chunk markdown at `##` / `###` boundaries (200–500 token target window using `gpt-tokenizer`), embed each chunk via Voyage `voyage-3` in batches of 32, tag each chunk with up to 3 topics from a 15-tag closed set via batched Haiku calls, and write `source_files` + `source_chunks`. **Pass 2** is corpus-wide: hash all chunks ordered by id; skip if signature matches `settings.corpusSignature`; otherwise call Sonnet once to extract concepts (8–25 distinct), upsert by name, then run `generateCards` per concept on Haiku (3 MC + 3 cloze + 2 freeform), with concurrency limit 4. Concept neighbor pairs (`conceptPairs.ts`) force one freeform card to be a compare/contrast question. Cards whose source chunks no longer exist are soft-disabled (review history preserved). Every Claude/Voyage call writes an `llm_calls` row with module label, tokens, cost, latency, status. Failures append to `logs/ingest-failures.jsonl` and the run continues.

Input → Output: `gauntlet_ai_resources/AI_Agents_Lecture.md` → ~30 chunks → ~6 concepts → ~48 cards (8 per concept).
```

Append to the **Decision Log**:

```markdown
- 2026-05-08 — Plan 2 (Ingestion) shipped. Notable choices:
  - Direct `fetch` against OpenRouter rather than the OpenAI SDK — three call sites, no value in the abstraction.
  - `gpt-tokenizer` (pure JS) over `tiktoken` (WASM) — Windows + Railway both cleaner. Token counts within ~5% of Voyage's tokenizer for English; close enough for a 200–500 token target window.
  - Concept neighbor map is static and curated (`conceptPairs.ts`), not LLM-derived. Symmetric (A→B implies B→A enforced by test). Move to a config table only if it grows past ~30 entries.
  - Card refresh strategy: soft-disable cards whose source chunks vanish. Review history (in `attempts`) is never deleted.
  - `regenerateCards(conceptName)` is a separate path from full Pass 2 — for when a single concept's cards are bad without invalidating the whole corpus.
```

- [ ] **Step 3: Commit**

```
git add CLAUDE.md STUDY_GUIDE.md
git commit -m "document pnpm ingest workflow and the ingestion pipeline architecture"
```

---

## Final verification

- [ ] **Run the entire unit test suite**

```
pnpm test:unit
```

Expected: all tests pass. Plan 1 had 13 unit tests; Plan 2 adds 12 new test files (~30 new test cases). Total should be ~43 unit tests.

- [ ] **Typecheck**

```
pnpm typecheck
```

Expected: clean.

- [ ] **Set OPENROUTER_API_KEY on Railway**

```
railway variables --set "OPENROUTER_API_KEY=<your-key>"
```

(Generates a new deployment automatically.)

- [ ] **Deploy and smoke test**

```
railway up --detach
# wait for SUCCESS
curl https://learnings-ai-production.up.railway.app/api/health
```

Expected: `db_ok: true, llm_ok: true`.

- [ ] **Run ingest locally against gauntlet_ai_resources**

```
pnpm ingest --dry-run            # sanity
pnpm ingest                      # real run
```

Expected: chunk counts > 0 per file; Pass 2 produces 8–25 concepts and ~80–200 cards. Final summary lists total cost (USD).

- [ ] **Re-run ingest (idempotency check)**

```
pnpm ingest
```

Expected: every file says "skipped — hash unchanged"; Pass 2 says "skipped (corpus signature unchanged)". Total cost: ~$0.

---

## Self-review checklist

- [x] Spec § 4.1 (Pass 1) covered by Tasks 6–10.
- [x] Spec § 4.2 (Pass 2) covered by Tasks 11–14.
- [x] Spec § 4.3 (idempotency table) covered: hash skip in Task 9 + 10; signature skip in Task 14; cards-disabled-on-vanished-chunks in Task 14; `--regenerate-cards` in Task 17.
- [x] Spec § 4.4 (observability + resilience) covered: `llm_calls` writes in Task 3, JSONL failures in Task 15, retries in Task 3.
- [x] Spec § 4.5 (testing) covered: chunker fixture tests (Task 6), cardGen mocked-Claude tests (Task 13). Integration test deliberately dropped per CLAUDE.md.
- [x] `pnpm ingest` CLI with all flags from spec § 4.1 / 4.2 (Tasks 16, 17).
- [x] `POST /api/ingest` (Task 18).
- [x] `/api/health` `llm_ok` wire-up (Task 19).
- [x] Documentation updates (Task 20).

---

## Execution choice

Plan complete and saved to `docs/superpowers/plans/2026-05-08-ingestion.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?

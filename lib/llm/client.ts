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

export async function chatCompletion(
  opts: ChatCompletionOptions,
): Promise<ChatCompletionResult> {
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
      async (r) =>
        (await r.json()) as {
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
      async (r) =>
        (await r.json()) as {
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

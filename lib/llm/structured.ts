import { z } from "zod";
import type { ZodType } from "zod";
import { chatCompletion } from "@/lib/llm/client";

export type StructuredChatOptions<S extends ZodType> = {
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

export type StructuredChatResult<S extends ZodType> = {
  value: z.infer<S>;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
};

function tryParseJson(text: string): unknown {
  // Strip markdown fence delimiters independently — some models emit
  // ```json with no closing fence, or fence only one end. Handle both.
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  return JSON.parse(stripped);
}

export async function structuredChat<S extends ZodType>(
  opts: StructuredChatOptions<S>,
): Promise<StructuredChatResult<S>> {
  const baseMessages = [
    { role: "system" as const, content: opts.systemPrompt },
    { role: "user" as const, content: opts.userPrompt },
  ];

  const attempt = async (corrective?: string) => {
    const messages = corrective
      ? [
          ...baseMessages,
          { role: "assistant" as const, content: "" },
          { role: "user" as const, content: corrective },
        ]
      : baseMessages;
    return chatCompletion({
      apiKey: opts.apiKey,
      model: opts.model,
      module: opts.module,
      messages,
      responseFormat: { type: "json_object" },
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      ...(opts.maxTokens !== undefined ? { maxTokens: opts.maxTokens } : {}),
      ...(opts.fetchImpl !== undefined ? { fetchImpl: opts.fetchImpl } : {}),
    });
  };

  const first = await attempt();
  try {
    const parsed = tryParseJson(first.content);
    const value = opts.schema.parse(parsed) as z.infer<S>;
    return {
      value,
      inputTokens: first.inputTokens,
      outputTokens: first.outputTokens,
      latencyMs: first.latencyMs,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const second = await attempt(
      `Your previous reply could not be parsed as JSON conforming to the schema. ` +
        `Error: ${errMsg.slice(0, 300)}. Reply with ONLY the corrected JSON, no prose.`,
    );
    try {
      const parsed = tryParseJson(second.content);
      const value = opts.schema.parse(parsed) as z.infer<S>;
      return {
        value,
        inputTokens: second.inputTokens,
        outputTokens: second.outputTokens,
        latencyMs: second.latencyMs,
      };
    } catch (err2) {
      throw new Error(
        `structured-output failed after retry (module=${opts.module}): ` +
          `attempt1=${errMsg.slice(0, 300)}; attempt2=${(err2 instanceof Error ? err2.message : String(err2)).slice(0, 300)}`,
      );
    }
  }
}

import { z } from "zod";
import { structuredChat } from "@/lib/llm/structured";

export const ALLOWED_TAGS = [
  "rag",
  "chunking",
  "embeddings",
  "vector_search",
  "fusion",
  "reranking",
  "agents",
  "react_loop",
  "tools",
  "verification",
  "guardrails",
  "evals",
  "spec_driven",
  "system_design",
  "multimodal",
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
      ...(opts.fetchImpl !== undefined ? { fetchImpl: opts.fetchImpl } : {}),
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

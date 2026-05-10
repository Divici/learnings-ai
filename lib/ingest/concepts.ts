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
    // 25 concepts × ~300 tokens (name + 2-sentence summary + UUID arrays) can
    // exceed the chat client's 4096 default and truncate the JSON mid-string.
    maxTokens: 16384,
    ...(opts.fetchImpl !== undefined ? { fetchImpl: opts.fetchImpl } : {}),
  });

  return { concepts: value.concepts };
}

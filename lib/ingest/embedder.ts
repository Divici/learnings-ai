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
    const embedOpts: Parameters<typeof embed>[0] = {
      apiKey: opts.apiKey,
      model: opts.model,
      module: opts.module,
      input: batch,
    };
    if (opts.fetchImpl) {
      embedOpts.fetchImpl = opts.fetchImpl;
    }
    const result = await embed(embedOpts);
    vectors.push(...result.vectors);
    totalInputTokens += result.inputTokens;
  }

  return { vectors, totalInputTokens };
}

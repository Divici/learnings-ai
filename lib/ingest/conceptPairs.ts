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

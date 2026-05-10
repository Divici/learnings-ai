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

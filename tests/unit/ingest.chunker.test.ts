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

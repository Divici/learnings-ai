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
    const insertChain: any = { values: vi.fn(() => insertChain), onConflictDoUpdate: vi.fn(async () => undefined) };
    const dbMock = {
      insert: vi.fn(() => insertChain),
      query: { sourceFiles: { findFirst: vi.fn(async () => ({ id: "id-1", filename: "x.md" })) } },
    } as never;

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
    const insertChain: any = { values: vi.fn(() => insertChain), onConflictDoUpdate: vi.fn(async () => undefined) };
    const dbMockRaw = {
      insert: vi.fn(() => insertChain),
      query: { sourceFiles: { findFirst: vi.fn(async () => ({ id: "id-2", filename: "x.md" })) } },
    };

    const out = await runPass1({
      filename: "x.md",
      content: tinyMd,
      apiKey: "sk-x",
      embedModel: "voyageai/voyage-3",
      tagModel: "anthropic/claude-haiku-4-5",
      db: dbMockRaw as never,
    });
    expect(out.skipped).toBe(false);
    if (!out.skipped) {
      expect(out.chunkCount).toBeGreaterThan(0);
    }
    expect(dbMockRaw.insert).toHaveBeenCalledTimes(2); // sourceFiles + sourceChunks
  });
});

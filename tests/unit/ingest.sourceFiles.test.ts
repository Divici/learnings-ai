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
    const dbMock = { delete: vi.fn(() => ({ where })) } as unknown as { delete: typeof vi.fn };
    await tearDownExistingChunks({ fileId: "abc", db: dbMock as never });
    expect(dbMock.delete).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
  });
});

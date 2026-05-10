import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendFailure } from "@/lib/ingest/failureLog";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ingest-fail-"));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("appendFailure", () => {
  it("creates the directory and writes a JSONL line", async () => {
    const path = join(tmp, "deep", "ingest-failures.jsonl");
    await appendFailure(path, {
      module: "ingest.embed",
      payload: { filename: "x.md" },
      error: "boom",
    });
    const contents = readFileSync(path, "utf8").trim().split("\n");
    expect(contents).toHaveLength(1);
    const parsed = JSON.parse(contents[0]!);
    expect(parsed.module).toBe("ingest.embed");
    expect(parsed.error).toBe("boom");
    expect(typeof parsed.ts).toBe("string");
  });

  it("appends multiple lines on subsequent calls", async () => {
    const path = join(tmp, "ingest-failures.jsonl");
    await appendFailure(path, { module: "a", payload: {}, error: "1" });
    await appendFailure(path, { module: "b", payload: {}, error: "2" });
    const lines = readFileSync(path, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
  });
});

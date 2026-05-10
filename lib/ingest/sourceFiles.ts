import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { sourceChunks, sourceFiles } from "@/lib/db/schema";
import type { Database } from "@/lib/db";

export function computeFileHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export type ReingestDecision =
  | { action: "fresh" }
  | { action: "skip" }
  | { action: "reingest"; existingFileId: string };

export async function shouldReingest(opts: {
  filename: string;
  contentHash: string;
  db: Database;
}): Promise<ReingestDecision> {
  const existing = await opts.db.query.sourceFiles.findFirst({
    where: eq(sourceFiles.filename, opts.filename),
  });
  if (!existing) return { action: "fresh" };
  if (existing.contentHash === opts.contentHash) return { action: "skip" };
  return { action: "reingest", existingFileId: existing.id };
}

export async function tearDownExistingChunks(opts: {
  fileId: string;
  db: Database;
}): Promise<void> {
  await opts.db.delete(sourceChunks).where(eq(sourceChunks.fileId, opts.fileId));
}

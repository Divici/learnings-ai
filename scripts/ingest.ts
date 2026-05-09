import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { resolveOneShotDatabaseUrl } from "@/lib/db/oneshot-url";
import * as schema from "@/lib/db/schema";
import { runPass1 } from "@/lib/ingest/pass1";
import { runPass2 } from "@/lib/ingest/pass2";
import { appendFailure } from "@/lib/ingest/failureLog";
import { log } from "@/lib/log";

async function main() {
  const { values } = parseArgs({
    options: {
      dir:        { type: "string", default: "gauntlet_ai_resources" },
      file:       { type: "string" },
      "pass1-only": { type: "boolean", default: false },
      "pass2-only": { type: "boolean", default: false },
      "regenerate-cards": { type: "string" },
      "dry-run":  { type: "boolean", default: false },
    },
  });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY is required (set in .env.local or via railway variables)");
    process.exit(1);
  }

  const dbUrl = resolveOneShotDatabaseUrl(process.env);
  const queryClient = postgres(dbUrl, { max: 1 });
  const db = drizzle(queryClient, { schema });

  // Read settings for model names.
  const settings = await db.query.settings.findFirst();
  if (!settings) throw new Error("settings row missing — run pnpm db:seed first");
  const haikuModel = settings.modelHaiku;
  const sonnetModel = settings.modelSonnet;
  const embeddingModel = settings.embeddingModel;

  let totalChunks = 0;
  let totalConcepts = 0;
  let totalCards = 0;
  const start = Date.now();

  // --- Regenerate-cards path (skips Pass 1 + full Pass 2) ---
  // Note: Task 17 will wire this up. For now, document the flag and exit cleanly if used.
  if (values["regenerate-cards"]) {
    console.log(`(--regenerate-cards path will be wired up in Task 17.)`);
    await queryClient.end();
    return;
  }

  // --- Pass 1 phase ---
  if (!values["pass2-only"]) {
    const dirPath = resolve(values.dir!);
    const filenames = values.file
      ? [values.file]
      : (await readdir(dirPath)).filter((f) => f.endsWith(".md") && f !== "README.md");

    if (filenames.length === 0) {
      console.log(`No markdown files in ${dirPath}.`);
    }

    for (const filename of filenames) {
      try {
        const content = await readFile(resolve(dirPath, filename), "utf8");
        if (values["dry-run"]) {
          const { chunkMarkdown } = await import("@/lib/ingest/chunker");
          const chunks = chunkMarkdown(content);
          console.log(`[dry] ${filename}: ${chunks.length} chunks`);
          totalChunks += chunks.length;
          continue;
        }
        const out = await runPass1({
          filename,
          content,
          apiKey,
          embedModel: embeddingModel,
          tagModel: haikuModel,
          db,
        });
        if (out.skipped) {
          console.log(`✓ ${filename} (skipped — hash unchanged)`);
        } else {
          console.log(`✓ ${filename} (${out.chunkCount} chunks, ${out.totalEmbedTokens} embed tokens)`);
          totalChunks += out.chunkCount;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`✗ ${filename}: ${msg}`);
        await appendFailure("logs/ingest-failures.jsonl", {
          module: "ingest.pass1",
          payload: { filename },
          error: msg,
        });
      }
    }
  }

  // --- Pass 2 phase ---
  if (!values["pass1-only"] && !values["dry-run"]) {
    try {
      const out = await runPass2({
        apiKey,
        sonnetModel,
        haikuModel,
        db,
      });
      if (out.skipped) {
        console.log("✓ Pass 2 skipped (corpus signature unchanged)");
      } else {
        totalConcepts = out.conceptCount;
        totalCards = out.cardCount;
        console.log(
          `✓ Pass 2: ${out.conceptCount} concepts, ${out.cardCount} cards, ${out.disabledCount} disabled`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`✗ Pass 2: ${msg}`);
      await appendFailure("logs/ingest-failures.jsonl", {
        module: "ingest.pass2",
        payload: {},
        error: msg,
      });
    }
  }

  // --- Cost summary from llm_calls ---
  const costRow = await db.execute<{ total_cost: string; total_calls: number }>(
    sql`SELECT COALESCE(SUM(cost_usd), 0)::text as total_cost, COUNT(*)::int as total_calls
        FROM llm_calls
        WHERE created_at >= NOW() - INTERVAL '5 minutes'`,
  );
  const summary = (costRow as unknown as Array<{ total_cost: string; total_calls: number }>)[0];

  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  console.log("\n──────── ingest summary ────────");
  console.log(`Duration:      ${seconds}s`);
  console.log(`Chunks added:  ${totalChunks}`);
  console.log(`Concepts:      ${totalConcepts}`);
  console.log(`Cards:         ${totalCards}`);
  if (summary) {
    console.log(`LLM calls:     ${summary.total_calls}`);
    console.log(`Cost (USD):    $${parseFloat(summary.total_cost).toFixed(4)}`);
  }

  await queryClient.end();
}

main().catch((err) => {
  log.error({ err }, "ingest failed");
  process.exit(1);
});

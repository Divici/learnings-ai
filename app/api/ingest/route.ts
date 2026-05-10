import { NextResponse } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { runPass1 } from "@/lib/ingest/pass1";
import { runPass2 } from "@/lib/ingest/pass2";
import { log } from "@/lib/log";

const SOURCE_DIR = "gauntlet_ai_resources";

export async function POST(req: Request) {
  if (!env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "OPENROUTER_API_KEY is not set" },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { pass2Only?: boolean };

  const settings = await db.query.settings.findFirst();
  if (!settings) {
    return NextResponse.json({ ok: false, error: "settings row missing" }, { status: 500 });
  }

  let chunkTotal = 0;
  if (!body.pass2Only) {
    const dir = resolve(SOURCE_DIR);
    const files = (await readdir(dir)).filter(
      (f) => f.endsWith(".md") && f !== "README.md",
    );
    for (const filename of files) {
      try {
        const content = await readFile(resolve(dir, filename), "utf8");
        const out = await runPass1({
          filename,
          content,
          apiKey: env.OPENROUTER_API_KEY,
          embedModel: settings.embeddingModel,
          tagModel: settings.modelHaiku,
          db,
        });
        if (!out.skipped) chunkTotal += out.chunkCount;
      } catch (err) {
        log.error({ err, filename }, "ingest pass1 failed for file");
      }
    }
  }

  const pass2 = await runPass2({
    apiKey: env.OPENROUTER_API_KEY,
    sonnetModel: settings.modelSonnet,
    haikuModel: settings.modelHaiku,
    db,
  });

  return NextResponse.json({
    ok: true,
    chunks: chunkTotal,
    concepts: "skipped" in pass2 && pass2.skipped ? 0 : pass2.conceptCount,
    cards: "skipped" in pass2 && pass2.skipped ? 0 : pass2.cardCount,
    pass2Skipped: "skipped" in pass2 && pass2.skipped,
  });
}

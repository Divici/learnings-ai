import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { pingLlm } from "@/lib/llm/ping";
import packageJson from "@/package.json";

export async function GET() {
  const dbStart = Date.now();
  let dbOk = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch (err) {
    log.error({ err }, "health: db check failed");
  }
  const dbLatencyMs = Date.now() - dbStart;

  const llmOk = await pingLlm();

  const status = dbOk ? 200 : 503;

  return NextResponse.json(
    {
      ok: dbOk,
      db_ok: dbOk,
      llm_ok: llmOk,
      version: packageJson.version,
      checked_at: new Date().toISOString(),
      db_latency_ms: dbLatencyMs,
    },
    { status },
  );
}

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { masteryByConcept } from "@/lib/srs/mastery";

export async function GET() {
  const rows = await db.execute<{ id: string; name: string; parent_topic: string; card_count: number }>(
    sql`SELECT c.id::text AS id, c.name, c.parent_topic, COUNT(cd.id)::int AS card_count
        FROM concepts c
        LEFT JOIN cards cd ON cd.concept_id = c.id AND cd.is_disabled = false
        GROUP BY c.id, c.name, c.parent_topic
        ORDER BY c.parent_topic, c.name`,
  );
  const arr = rows as unknown as Array<{ id: string; name: string; parent_topic: string; card_count: number }>;
  const mastery = await masteryByConcept(db);
  const concepts = arr.map((r) => ({
    id: r.id,
    name: r.name,
    parentTopic: r.parent_topic,
    cardCount: r.card_count,
    mastery: mastery.get(r.id) ?? 0,
  }));
  return NextResponse.json({ ok: true, concepts });
}

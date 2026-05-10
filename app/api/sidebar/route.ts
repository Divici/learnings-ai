import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export async function GET() {
  const focus = await db.execute<{
    id: string;
    name: string;
    parent_topic: string;
    due_count: number;
  }>(
    sql`SELECT c.id::text AS id, c.name, c.parent_topic, COUNT(cd.id)::int AS due_count
        FROM concepts c
        LEFT JOIN cards cd ON cd.concept_id = c.id AND cd.is_disabled = false
        LEFT JOIN review_state rs ON rs.card_id = cd.id
        WHERE rs.due_at IS NULL OR rs.due_at <= NOW()
        GROUP BY c.id, c.name, c.parent_topic
        HAVING COUNT(cd.id) > 0
        ORDER BY due_count DESC
        LIMIT 5`,
  );

  const heatmapRows = await db.execute<{ day_offset: number; count: number }>(
    sql`SELECT EXTRACT(DAY FROM (DATE_TRUNC('day', NOW()) - DATE_TRUNC('day', a.created_at)))::int AS day_offset,
               COUNT(*)::int AS count
        FROM attempts a
        WHERE a.created_at >= NOW() - INTERVAL '21 days'
        GROUP BY day_offset`,
  );

  const heatArr = heatmapRows as unknown as Array<{ day_offset: number; count: number }>;
  const counts = new Array(21).fill(0);
  for (const row of heatArr) {
    if (row.day_offset >= 0 && row.day_offset < 21) counts[row.day_offset] = row.count;
  }

  return NextResponse.json({
    focus: focus as unknown,
    heatmap: counts,
  });
}

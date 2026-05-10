import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db";

export type ConceptStats = {
  cardCount: number;
  avgEase: number;
  totalLapses: number;
};

export function computeMastery(stats: ConceptStats): number {
  if (stats.cardCount === 0 || stats.avgEase <= 0) return 0;
  const easeNorm = (stats.avgEase - 1.3) / (3.0 - 1.3);
  const easeClamped = Math.max(0, Math.min(1, easeNorm));
  const lapsesFactor = Math.max(0, Math.min(0.5, stats.totalLapses / stats.cardCount));
  return easeClamped * (1 - lapsesFactor);
}

export async function masteryByConcept(db: Database): Promise<Map<string, number>> {
  const rows = await db.execute<{ concept_id: string; card_count: number; avg_ease: number; total_lapses: number }>(
    sql`SELECT
          c.concept_id::text AS concept_id,
          COUNT(rs.card_id)::int AS card_count,
          COALESCE(AVG(rs.ease), 0)::float AS avg_ease,
          COALESCE(SUM(rs.lapses), 0)::int AS total_lapses
        FROM cards c
        LEFT JOIN review_state rs ON rs.card_id = c.id
        WHERE c.is_disabled = false
        GROUP BY c.concept_id`,
  );
  const arr = rows as unknown as Array<{ concept_id: string; card_count: number; avg_ease: number; total_lapses: number }>;
  const map = new Map<string, number>();
  for (const r of arr) {
    map.set(r.concept_id, computeMastery({
      cardCount: r.card_count,
      avgEase: r.avg_ease,
      totalLapses: r.total_lapses,
    }));
  }
  return map;
}

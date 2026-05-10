import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { SidebarView, type FocusItem } from "./SidebarView";

async function loadSidebarData(): Promise<{ focus: FocusItem[]; heatmap: number[] }> {
  // Top 5 concepts by due-count (cards with due_at <= now OR no review_state).
  const focusRows = await db.execute<{
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
  const focusArr = focusRows as unknown as Array<{
    id: string;
    name: string;
    parent_topic: string;
    due_count: number;
  }>;
  const focus = focusArr.map((r) => ({
    id: r.id,
    name: r.name,
    parentTopic: r.parent_topic,
    dueCount: r.due_count,
  }));

  // 21-day attempts heatmap (index 0 = today, 20 = 21 days ago).
  const heatmapRows = await db.execute<{ day_offset: number; count: number }>(
    sql`SELECT EXTRACT(DAY FROM (DATE_TRUNC('day', NOW()) - DATE_TRUNC('day', a.created_at)))::int AS day_offset,
               COUNT(*)::int AS count
        FROM attempts a
        WHERE a.created_at >= NOW() - INTERVAL '21 days'
        GROUP BY day_offset`,
  );
  const heatmapArr = heatmapRows as unknown as Array<{ day_offset: number; count: number }>;
  const heatmap = new Array(21).fill(0);
  for (const row of heatmapArr) {
    if (row.day_offset >= 0 && row.day_offset < 21) heatmap[row.day_offset] = row.count;
  }

  return { focus, heatmap };
}

export type SidebarProps = {
  userInitials: string;
  userName: string;
  level: number;
  activePath: "learning" | "planning";
};

export async function Sidebar(props: SidebarProps) {
  let focus: FocusItem[] = [];
  let heatmap = new Array(21).fill(0);
  try {
    const data = await loadSidebarData();
    focus = data.focus;
    heatmap = data.heatmap;
  } catch {
    // DB not available (e.g. during build's static analysis) — fall through with empty defaults.
  }
  return <SidebarView {...props} focus={focus} heatmap={heatmap} />;
}

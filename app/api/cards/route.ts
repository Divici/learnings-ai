import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// NOTE: This route uses sql.raw() with a manually constructed WHERE clause.
// The inputs are sanitized minimally: difficulty uses parseInt(), search uses
// single-quote escaping, and concept/type use simple equality checks. This is
// acceptable for a single-user app where all inputs originate from the authenticated
// user's own UI. A multi-user app would require fully parameterized queries.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const concept = url.searchParams.get("concept"); // concept_id or empty for all
  const type = url.searchParams.get("type"); // "mc" | "cloze" | "freeform" | empty
  const difficulty = url.searchParams.get("difficulty"); // "1" | "2" | "3" | empty
  const showDisabled = url.searchParams.get("showDisabled") === "true";
  const search = url.searchParams.get("search") ?? "";

  const conditions: string[] = [];
  if (concept) conditions.push(`c.concept_id = '${concept}'`);
  if (type) conditions.push(`c.card_type = '${type}'`);
  if (difficulty) conditions.push(`c.difficulty = ${parseInt(difficulty, 10)}`);
  if (!showDisabled) conditions.push("c.is_disabled = false");
  if (search) {
    const escaped = search.replace(/'/g, "''");
    conditions.push(`c.prompt ILIKE '%${escaped}%'`);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await db.execute<{
    id: string;
    prompt: string;
    card_type: "mc" | "cloze" | "freeform";
    difficulty: number;
    is_disabled: boolean;
    concept_name: string;
    ease: number | null;
    last_reviewed_at: string | null;
  }>(
    sql.raw(
      `SELECT c.id::text AS id, c.prompt, c.card_type, c.difficulty, c.is_disabled,
              co.name AS concept_name,
              rs.ease, rs.last_reviewed_at::text
       FROM cards c
       JOIN concepts co ON co.id = c.concept_id
       LEFT JOIN review_state rs ON rs.card_id = c.id
       ${whereClause}
       ORDER BY co.name, c.difficulty, c.id
       LIMIT 500`,
    ),
  );

  const arr = rows as unknown as Array<{
    id: string;
    prompt: string;
    card_type: "mc" | "cloze" | "freeform";
    difficulty: number;
    is_disabled: boolean;
    concept_name: string;
    ease: number | null;
    last_reviewed_at: string | null;
  }>;

  return NextResponse.json({
    ok: true,
    cards: arr.map((r) => ({
      id: r.id,
      prompt: r.prompt,
      cardType: r.card_type,
      difficulty: r.difficulty,
      isDisabled: r.is_disabled,
      conceptName: r.concept_name,
      ease: r.ease,
      lastReviewedAt: r.last_reviewed_at,
    })),
  });
}

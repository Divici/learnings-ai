import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { query: { cards: { findFirst: vi.fn() }, reviewState: { findFirst: vi.fn() } }, insert: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/env", () => ({ env: { LEARNINGS_AI_TOKEN: "test-token" } }));
vi.mock("@/lib/log", () => ({
  log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { POST } from "@/app/api/review/grade/route";
import { db } from "@/lib/db";

beforeEach(() => vi.clearAllMocks());

function chainable() {
  const c: any = {};
  c.values = vi.fn(() => c);
  c.set = vi.fn(() => c);
  c.where = vi.fn(async () => undefined);
  c.onConflictDoUpdate = vi.fn(async () => undefined);
  c.returning = vi.fn(async () => [{}]);
  return c;
}

describe("POST /api/review/grade", () => {
  it("400 when grade out of range", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ cardId: "550e8400-e29b-41d4-a716-446655440000", grade: 99, durationMs: 100 }) }),
    );
    expect(res.status).toBe(400);
  });

  it("404 when card not found", async () => {
    vi.mocked(db.query.cards.findFirst).mockResolvedValueOnce(undefined as never);
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ cardId: "550e8400-e29b-41d4-a716-446655440000", grade: 3, durationMs: 100 }) }),
    );
    expect(res.status).toBe(404);
  });

  it("resolves parent_card_id for variant SRS lookup", async () => {
    vi.mocked(db.query.cards.findFirst).mockResolvedValueOnce({
      id: "550e8400-e29b-41d4-a716-446655440000",
      parentCardId: "550e8400-e29b-41d4-a716-446655440001",
    } as never);
    vi.mocked(db.query.reviewState.findFirst).mockResolvedValueOnce({
      cardId: "550e8400-e29b-41d4-a716-446655440001",
      ease: 2.5, intervalDays: 0, repetitions: 0, lapses: 0,
    } as never);
    vi.mocked(db.insert).mockReturnValue(chainable());
    vi.mocked(db.update).mockReturnValue(chainable());
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ cardId: "550e8400-e29b-41d4-a716-446655440000", grade: 3, durationMs: 100 }) }),
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(db.query.reviewState.findFirst)).toHaveBeenCalled();
  });

  it("inserts attempts row referencing the actual cardId (not parent)", async () => {
    vi.mocked(db.query.cards.findFirst).mockResolvedValueOnce({
      id: "550e8400-e29b-41d4-a716-446655440000",
      parentCardId: null,
    } as never);
    vi.mocked(db.query.reviewState.findFirst).mockResolvedValueOnce(undefined as never);
    const insertChain = chainable();
    vi.mocked(db.insert).mockReturnValue(insertChain);
    vi.mocked(db.update).mockReturnValue(chainable());

    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ cardId: "550e8400-e29b-41d4-a716-446655440000", grade: 4, durationMs: 200 }) }),
    );
    expect(res.status).toBe(200);
    expect(db.insert).toHaveBeenCalled();
  });
});

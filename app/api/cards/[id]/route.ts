import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { cards } from "@/lib/db/schema";

const PatchSchema = z.object({
  isDisabled: z.boolean(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }
  await db.update(cards).set({ isDisabled: body.isDisabled }).where(eq(cards.id, id));
  return NextResponse.json({ ok: true });
}

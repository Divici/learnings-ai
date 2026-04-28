import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { settings } from "@/lib/db/schema";

export type Settings = typeof settings.$inferSelect;
export type SettingsUpdate = Partial<typeof settings.$inferInsert>;

export async function getSettings(db: Database): Promise<Settings> {
  const rows = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  const row = rows[0];
  if (!row) throw new Error("Settings row missing — run pnpm db:seed");
  return row;
}

export async function updateSettings(
  db: Database,
  patch: SettingsUpdate
): Promise<Settings> {
  const rows = await db
    .update(settings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(settings.id, 1))
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Failed to update settings");
  return row;
}

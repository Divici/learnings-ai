import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { resolveOneShotDatabaseUrl } from "@/lib/db/oneshot-url";
import { settings } from "@/lib/db/schema";
import { log } from "@/lib/log";

async function main() {
  const url = resolveOneShotDatabaseUrl(process.env);
  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema: { settings } });

  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  log.info("seeded settings singleton");

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  log.error({ err }, "seed failed");
  process.exit(1);
});

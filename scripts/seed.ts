import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { log } from "@/lib/log";

async function main() {
  await db
    .insert(settings)
    .values({ id: 1 })
    .onConflictDoNothing();
  log.info("seeded settings singleton");
  process.exit(0);
}

main().catch((err) => {
  log.error({ err }, "seed failed");
  process.exit(1);
});

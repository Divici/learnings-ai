import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "@/lib/db/schema";

const queryClient = postgres(env.DATABASE_URL, {
  max: env.NODE_ENV === "production" ? 10 : 1,
});

export const db = drizzle(queryClient, { schema });
export type Database = typeof db;

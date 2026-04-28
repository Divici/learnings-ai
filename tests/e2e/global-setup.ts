import type { FullConfig } from "@playwright/test";

async function globalSetup(_config: FullConfig) {
  if (!process.env.LEARNINGS_AI_TOKEN || process.env.LEARNINGS_AI_TOKEN.length < 32) {
    throw new Error(
      "LEARNINGS_AI_TOKEN must be set (>=32 chars) for Playwright tests."
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set for Playwright tests.");
  }
}

export default globalSetup;

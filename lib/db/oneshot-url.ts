export function resolveOneShotDatabaseUrl(
  env: Record<string, string | undefined>,
): string {
  const url = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL or DATABASE_URL_UNPOOLED is required for one-shot DB operations",
    );
  }
  return url;
}

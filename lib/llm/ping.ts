import { env } from "@/lib/env";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** Lightweight reachability check used by /api/health. Does NOT call the
 *  chat or embed endpoints — those would cost real money on every health
 *  check. The /models endpoint is free and returns 200 if the key is valid. */
export async function pingLlm(opts?: { fetchImpl?: typeof fetch }): Promise<boolean> {
  if (!env.OPENROUTER_API_KEY) return false;
  const fetchImpl = opts?.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(`${OPENROUTER_BASE_URL}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Constant-time string comparison that works in both the Node.js runtime
 * (server actions, route handlers) and the Edge runtime (middleware).
 *
 * `node:crypto`'s `timingSafeEqual` is unavailable on the Edge runtime, so we
 * implement an XOR-based constant-time compare manually. The length check
 * before the loop is intentional: differing lengths are not constant-time,
 * but we never compare unequal-length tokens — both must be equal length to
 * even reach the loop.
 */
export function isValidToken(received: string, expected: string): boolean {
  if (!received || !expected) return false;
  if (received.length !== expected.length) return false;

  let mismatch = 0;
  for (let i = 0; i < received.length; i++) {
    mismatch |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

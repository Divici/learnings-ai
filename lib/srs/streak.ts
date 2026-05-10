/** Counts consecutive days ending TODAY where at least one attempt exists.
 *  Returns 0 if the most-recent attempt was yesterday or older. */
export function computeStreak(attemptDates: Date[], now: Date = new Date()): number {
  if (attemptDates.length === 0) return 0;

  // Normalize to YYYY-MM-DD strings (UTC) for de-dup + comparison.
  const dayString = (d: Date) => d.toISOString().slice(0, 10);
  const days = new Set(attemptDates.map(dayString));

  let streak = 0;
  let cursor = new Date(now);
  // Allow today not yet having an attempt? No — spec says "consecutive days ending today",
  // so if today is missing the streak is 0.
  while (true) {
    if (!days.has(dayString(cursor))) break;
    streak++;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  return streak;
}

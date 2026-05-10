import type { Grade } from "@/lib/srs/sm2";

const LEVENSHTEIN_TOLERANCE = 2;

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev: number[] = new Array(n + 1).fill(0);
  const curr: number[] = new Array(n + 1).fill(0);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]!;
  }
  return prev[n]!;
}

export type ClozeCardAnswers = { clozeAnswers: string[] | null };

export type ClozeBlankResult = {
  user: string;
  canonical: string;
  correct: boolean;
  distance: number;
};

export type ClozeGradeResult = {
  grade: Grade;
  correct: boolean;
  perBlank: ClozeBlankResult[];
};

export function gradeCloze(card: ClozeCardAnswers, userInputs: string[]): ClozeGradeResult {
  if (!card.clozeAnswers) throw new Error("gradeCloze: cloze_answers is required");
  if (userInputs.length !== card.clozeAnswers.length) {
    throw new Error(
      `gradeCloze: blank count mismatch — got ${userInputs.length} inputs, expected ${card.clozeAnswers.length}`,
    );
  }
  const perBlank: ClozeBlankResult[] = userInputs.map((rawUser, i) => {
    const canonical = card.clozeAnswers![i]!;
    const user = rawUser.trim().toLowerCase();
    const expected = canonical.trim().toLowerCase();
    const distance = levenshtein(user, expected);
    return { user, canonical, correct: distance <= LEVENSHTEIN_TOLERANCE, distance };
  });
  const allCorrect = perBlank.every((b) => b.correct);
  return { grade: allCorrect ? 3 : 1, correct: allCorrect, perBlank };
}

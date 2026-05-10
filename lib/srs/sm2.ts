export type Grade = 1 | 2 | 3 | 4;
export type ReviewState = {
  ease: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
};

const EASE_FLOOR = 1.3;
const INTERVAL_CAP_DAYS = 365;

export function nextReview(state: ReviewState, grade: Grade): ReviewState {
  switch (grade) {
    case 1: {
      return {
        ease: Math.max(EASE_FLOOR, state.ease - 0.20),
        intervalDays: 0,
        repetitions: 0,
        lapses: state.lapses + 1,
      };
    }
    case 2: {
      return {
        ease: Math.max(EASE_FLOOR, state.ease - 0.15),
        intervalDays: Math.min(INTERVAL_CAP_DAYS, state.intervalDays * 1.2),
        repetitions: state.repetitions + 1,
        lapses: state.lapses,
      };
    }
    case 3: {
      let interval: number;
      if (state.repetitions === 0) interval = 1;
      else if (state.repetitions === 1) interval = 6;
      else interval = state.intervalDays * state.ease;
      return {
        ease: state.ease,
        intervalDays: Math.min(INTERVAL_CAP_DAYS, interval),
        repetitions: state.repetitions + 1,
        lapses: state.lapses,
      };
    }
    case 4: {
      const newEase = Math.max(EASE_FLOOR, state.ease + 0.15);
      return {
        ease: newEase,
        intervalDays: Math.min(INTERVAL_CAP_DAYS, state.intervalDays * newEase * 1.3),
        repetitions: state.repetitions + 1,
        lapses: state.lapses,
      };
    }
  }
}

/** Adds ±10% uniform jitter so reviews don't all land at the same minute.
 *  `random` is injectable for tests (default Math.random). */
export function computeDueAt(
  intervalDays: number,
  nowMs: number = Date.now(),
  random: () => number = Math.random,
): Date {
  const baseMs = intervalDays * 86_400_000;
  const jitterFactor = 0.9 + random() * 0.2;
  return new Date(nowMs + baseMs * jitterFactor);
}

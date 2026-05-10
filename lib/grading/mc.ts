import type { Grade } from "@/lib/srs/sm2";

export type McCardOptions = {
  mcOptions: { options: string[]; correctIndex: number } | null;
};

export type McGradeResult = { grade: Grade; correct: boolean };

export function gradeMc(card: McCardOptions, selectedIndex: number): McGradeResult {
  if (!card.mcOptions) throw new Error("gradeMc: mc_options is required");
  const { options, correctIndex } = card.mcOptions;
  if (selectedIndex < 0 || selectedIndex >= options.length) {
    throw new Error(`gradeMc: selectedIndex ${selectedIndex} out of range [0, ${options.length})`);
  }
  const correct = selectedIndex === correctIndex;
  return { grade: correct ? 3 : 1, correct };
}

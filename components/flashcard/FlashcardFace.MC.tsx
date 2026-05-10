import { SpeakerHigh } from "@phosphor-icons/react/dist/ssr";

const LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

export type FlashcardFaceMcFrontProps = {
  cardId: string;
  prompt: string;
  options: string[];
  onSelect: (index: number) => void;
};

export function FlashcardFaceMcFront({ cardId, prompt, options, onSelect }: FlashcardFaceMcFrontProps) {
  return (
    <>
      <div className="flex justify-between items-start mb-6">
        <span className="text-xs font-mono text-white/40 uppercase tracking-widest border border-white/10 px-2 py-1 rounded">
          Card ID: {cardId}
        </span>
        <button type="button" aria-label="Read prompt aloud" className="text-white/40 hover:text-white">
          <SpeakerHigh size={20} />
        </button>
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <h2 className="text-xl font-medium leading-relaxed text-white/90 text-center max-w-lg mx-auto mb-6">
          {prompt}
        </h2>
        <ul className="flex flex-col gap-2 max-w-lg w-full mx-auto">
          {options.map((opt, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSelect(i); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-colors text-left"
              >
                <span className="font-mono text-xs text-white/50 w-6">{LETTERS[i]}</span>
                <span className="text-sm text-white/90">{opt}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export type FlashcardFaceMcBackProps = {
  options: string[];
  correctIndex: number;
  selectedIndex: number | null;
  explanation: string;
};

export function FlashcardFaceMcBack({ options, correctIndex, selectedIndex, explanation }: FlashcardFaceMcBackProps) {
  return (
    <>
      <div className="flex justify-between items-start mb-4">
        <span className="text-xs font-mono text-purple-400 uppercase tracking-widest border border-purple-500/20 px-2 py-1 rounded bg-purple-500/10">
          Answer
        </span>
      </div>
      <ul className="flex flex-col gap-2 mb-4">
        {options.map((opt, i) => {
          const correct = i === correctIndex;
          const wrong = selectedIndex === i && i !== correctIndex;
          return (
            <li
              key={i}
              data-correct={correct ? "true" : "false"}
              className={
                correct
                  ? "px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 text-sm"
                  : wrong
                    ? "px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300/80 text-sm"
                    : "px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 text-sm"
              }
            >
              {opt}
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-white/70 leading-relaxed">{explanation}</p>
    </>
  );
}

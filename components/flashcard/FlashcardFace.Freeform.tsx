"use client";

import { useState, type KeyboardEvent } from "react";

export type FlashcardFaceFreeformFrontProps = {
  cardId: string;
  prompt: string;
  onSubmit: (answer: string) => void;
  loading: boolean;
};

export function FlashcardFaceFreeformFront({ cardId, prompt, onSubmit, loading }: FlashcardFaceFreeformFrontProps) {
  const [value, setValue] = useState("");

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.code === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      onSubmit(value);
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-start mb-6">
        <span className="text-xs font-mono text-white/40 uppercase tracking-widest border border-white/10 px-2 py-1 rounded">
          Card ID: {cardId}
        </span>
      </div>
      <h2 className="text-lg font-medium text-white/90 max-w-xl mb-4">{prompt}</h2>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        disabled={loading}
        placeholder="Write your answer…"
        className="w-full min-h-[120px] max-h-[200px] px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-blue-400 focus:outline-none text-white/95 text-sm resize-y"
      />
      <div className="flex justify-between items-center mt-2">
        <span className="text-[10px] text-white/40 font-mono">Cmd+Enter to submit</span>
        {loading && (
          <span data-testid="freeform-shimmer" className="text-xs text-blue-400 animate-pulse">
            Grading…
          </span>
        )}
      </div>
    </div>
  );
}

export type FreeformCriterion = { criterion: string; met: "yes" | "partial" | "no"; evidence: string };

export type FlashcardFaceFreeformBackProps = {
  perCriterion: FreeformCriterion[];
  summaryFeedback: string;
  whatToRevisit: string | null;
};

export function FlashcardFaceFreeformBack({ perCriterion, summaryFeedback, whatToRevisit }: FlashcardFaceFreeformBackProps) {
  return (
    <>
      <div className="flex justify-between items-start mb-4">
        <span className="text-xs font-mono text-purple-400 uppercase tracking-widest border border-purple-500/20 px-2 py-1 rounded bg-purple-500/10">
          Answer
        </span>
      </div>
      <ul className="flex flex-col gap-1.5 mb-4">
        {perCriterion.map((c, i) => {
          const icon = c.met === "yes" ? "✓" : c.met === "partial" ? "•" : "✗";
          const tone =
            c.met === "yes"
              ? "text-green-400"
              : c.met === "partial"
                ? "text-orange-400"
                : "text-red-400";
          return (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className={`${tone} font-mono w-4 text-center`}>{icon}</span>
              <div>
                <div className="text-white/90">{c.criterion}</div>
                <div className="text-xs text-white/50 italic">{c.evidence}</div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-white/80 leading-relaxed mb-3">{summaryFeedback}</p>
      {whatToRevisit && (
        <span className="inline-block px-3 py-1 rounded-full text-xs bg-blue-500/10 border border-blue-500/30 text-blue-300">
          Revisit: {whatToRevisit}
        </span>
      )}
    </>
  );
}

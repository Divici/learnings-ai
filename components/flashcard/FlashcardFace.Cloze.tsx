"use client";

import { useState, type FormEvent } from "react";

export type ClozeSegment =
  | { type: "text"; value: string }
  | { type: "blank"; index: number; hint: string };

export function parseClozeBlanks(prompt: string): ClozeSegment[] {
  const re = /\{\{c(\d+)::([^}]+)\}\}/g;
  const out: ClozeSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let blankCounter = 0;
  while ((match = re.exec(prompt)) !== null) {
    if (match.index > lastIndex) {
      out.push({ type: "text", value: prompt.slice(lastIndex, match.index) });
    }
    out.push({ type: "blank", index: blankCounter++, hint: match[2]! });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < prompt.length) out.push({ type: "text", value: prompt.slice(lastIndex) });
  return out;
}

export type FlashcardFaceClozeFrontProps = {
  cardId: string;
  prompt: string;
  onSubmit: (inputs: string[]) => void;
};

export function FlashcardFaceClozeFront({ cardId, prompt, onSubmit }: FlashcardFaceClozeFrontProps) {
  const segments = parseClozeBlanks(prompt);
  const blankCount = segments.filter((s) => s.type === "blank").length;
  const [values, setValues] = useState<string[]>(() => Array(blankCount).fill(""));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-start mb-6">
        <span className="text-xs font-mono text-white/40 uppercase tracking-widest border border-white/10 px-2 py-1 rounded">
          Card ID: {cardId}
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center text-center mb-6">
        <p className="text-lg leading-loose text-white/90 max-w-xl">
          {segments.map((seg, i) =>
            seg.type === "text" ? (
              <span key={i}>{seg.value}</span>
            ) : (
              <input
                key={i}
                type="text"
                value={values[seg.index] ?? ""}
                onChange={(e) => {
                  const copy = [...values];
                  copy[seg.index] = e.target.value;
                  setValues(copy);
                }}
                className="inline-block mx-1 px-2 py-1 bg-white/5 border-b border-white/30 focus:border-blue-400 focus:outline-none text-white/95 font-mono text-sm w-32"
                aria-label={`Cloze blank ${seg.index + 1}`}
              />
            ),
          )}
        </p>
      </div>
      <div className="flex justify-center">
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 hover:bg-blue-500/30"
        >
          Submit
        </button>
      </div>
    </form>
  );
}

export type FlashcardFaceClozeBackProps = {
  perBlank: Array<{ user: string; canonical: string; correct: boolean; distance: number }>;
  explanation: string;
};

export function FlashcardFaceClozeBack({ perBlank, explanation }: FlashcardFaceClozeBackProps) {
  return (
    <>
      <div className="flex justify-between items-start mb-4">
        <span className="text-xs font-mono text-purple-400 uppercase tracking-widest border border-purple-500/20 px-2 py-1 rounded bg-purple-500/10">
          Answer
        </span>
      </div>
      <ul className="flex flex-col gap-2 mb-4">
        {perBlank.map((b, i) => (
          <li
            key={i}
            className={
              b.correct
                ? "flex items-center gap-3 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30"
                : "flex items-center gap-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30"
            }
          >
            <span className="text-lg">{b.correct ? "✓" : "✗"}</span>
            <span className="font-mono text-xs text-white/60">your: {b.user || "(blank)"}</span>
            {!b.correct && <span className="font-mono text-xs text-white/80 ml-auto">expected: {b.canonical}</span>}
          </li>
        ))}
      </ul>
      <p className="text-sm text-white/70 leading-relaxed">{explanation}</p>
    </>
  );
}

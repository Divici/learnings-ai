"use client";

import { useState, useCallback, useEffect } from "react";
import { Flashcard } from "@/components/flashcard/Flashcard";
import { FlashcardFaceMcFront, FlashcardFaceMcBack } from "@/components/flashcard/FlashcardFace.MC";
import { FlashcardFaceClozeFront, FlashcardFaceClozeBack } from "@/components/flashcard/FlashcardFace.Cloze";
import { FlashcardFaceFreeformFront, FlashcardFaceFreeformBack, type FreeformCriterion } from "@/components/flashcard/FlashcardFace.Freeform";
import { GradeButtons } from "@/components/learning/GradeButtons";
import { gradeMc } from "@/lib/grading/mc";
import { gradeCloze, type ClozeBlankResult } from "@/lib/grading/cloze";
import type { Grade, ReviewState } from "@/lib/srs/sm2";

export type SessionCard = {
  id: string;
  conceptName: string;
  cardType: "mc" | "cloze" | "freeform";
  prompt: string;
  canonicalAnswer: string;
  explanation: string;
  difficulty: 1 | 2 | 3;
  mcOptions: { options: string[]; correctIndex: number } | null;
  clozeAnswers: string[] | null;
  rubric: Array<{ criterion: string; weight: number }> | null;
  reviewState: ReviewState;
};

export type SessionClientProps = {
  cards: SessionCard[];
  conceptName: string;
};

type LocalGrade = {
  defaultGrade: Grade;
  selectedIndex?: number;
  clozePerBlank?: ClozeBlankResult[];
  freeformPerCriterion?: FreeformCriterion[];
  freeformSummary?: string;
  freeformWhatToRevisit?: string | null;
};

const STORAGE_KEY = "learnings-ai:active-session";

export function SessionClient({ cards, conceptName }: SessionClientProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [start, setStart] = useState(Date.now());
  const [gradeState, setGradeState] = useState<LocalGrade | null>(null);
  const [freeformLoading, setFreeformLoading] = useState(false);

  // Write initial session state on mount.
  useEffect(() => {
    const cardIds = cards.map((c) => c.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      cardIds, currentIndex: index, startedAt: Date.now(),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep session state in sync as the user progresses.
  useEffect(() => {
    const cardIds = cards.map((c) => c.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      cardIds, currentIndex: index, startedAt: Date.now(),
    }));
    // Clear when finished.
    if (index >= cards.length) localStorage.removeItem(STORAGE_KEY);
  }, [index, cards]);

  const card = cards[index];
  if (!card) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/70 text-sm">
        Session complete — {cards.length} cards reviewed.
      </div>
    );
  }

  const handleMcSelect = (i: number) => {
    if (!card.mcOptions) return;
    const result = gradeMc(card, i);
    setGradeState({ defaultGrade: result.grade, selectedIndex: i });
    setFlipped(true);
  };

  const handleClozeSubmit = (inputs: string[]) => {
    if (!card.clozeAnswers) return;
    const result = gradeCloze(card, inputs);
    setGradeState({ defaultGrade: result.grade, clozePerBlank: result.perBlank });
    setFlipped(true);
  };

  const handleFreeformSubmit = async (answer: string) => {
    setFreeformLoading(true);
    setFlipped(true);
    try {
      const res = await fetch("/api/review/freeform-grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, userAnswer: answer }),
      });
      const data = await res.json() as { ok: boolean; error?: string; grade?: Grade; perCriterion?: FreeformCriterion[]; summaryFeedback?: string; whatToRevisit?: string | null };
      if (!data.ok) throw new Error(data.error);
      const gradeUpdate: LocalGrade = { defaultGrade: data.grade! };
      if (data.perCriterion !== undefined) gradeUpdate.freeformPerCriterion = data.perCriterion;
      if (data.summaryFeedback !== undefined) gradeUpdate.freeformSummary = data.summaryFeedback;
      gradeUpdate.freeformWhatToRevisit = data.whatToRevisit ?? null;
      setGradeState(gradeUpdate);
    } finally {
      setFreeformLoading(false);
    }
  };

  const advance = () => {
    setIndex(index + 1);
    setFlipped(false);
    setGradeState(null);
    setStart(Date.now());
  };

  const handleGrade = useCallback(
    async (grade: Grade) => {
      const durationMs = Date.now() - start;
      await fetch("/api/review/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: card.id,
          grade,
          durationMs,
          selectedIndex: gradeState?.selectedIndex,
        }),
      });
      advance();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card.id, start, gradeState?.selectedIndex],
  );

  let front: React.ReactNode;
  let back: React.ReactNode;
  if (card.cardType === "mc" && card.mcOptions) {
    front = <FlashcardFaceMcFront cardId={card.id.slice(0, 4)} prompt={card.prompt} options={card.mcOptions.options} onSelect={handleMcSelect} />;
    back = <FlashcardFaceMcBack options={card.mcOptions.options} correctIndex={card.mcOptions.correctIndex} selectedIndex={gradeState?.selectedIndex ?? null} explanation={card.explanation} />;
  } else if (card.cardType === "cloze") {
    front = <FlashcardFaceClozeFront cardId={card.id.slice(0, 4)} prompt={card.prompt} onSubmit={handleClozeSubmit} />;
    back = <FlashcardFaceClozeBack perBlank={gradeState?.clozePerBlank ?? []} explanation={card.explanation} />;
  } else {
    front = <FlashcardFaceFreeformFront cardId={card.id.slice(0, 4)} prompt={card.prompt} onSubmit={handleFreeformSubmit} loading={freeformLoading} />;
    back = (
      <FlashcardFaceFreeformBack
        perCriterion={gradeState?.freeformPerCriterion ?? []}
        summaryFeedback={gradeState?.freeformSummary ?? ""}
        whatToRevisit={gradeState?.freeformWhatToRevisit ?? null}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="mb-6 text-center">
        <div className="text-[10px] uppercase tracking-widest text-blue-400 font-semibold mb-1">
          {conceptName}
        </div>
        <div className="text-xs text-white/50 font-mono">
          {index + 1} / {cards.length} cards
        </div>
      </div>
      <Flashcard front={front} back={back} flipped={flipped} onFlip={setFlipped} />
      {flipped && gradeState && (
        <GradeButtons currentState={card.reviewState} onGrade={handleGrade} />
      )}
    </div>
  );
}

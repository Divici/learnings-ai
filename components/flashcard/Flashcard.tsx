"use client";

import { useState, type ReactNode, type KeyboardEvent } from "react";

export type FlashcardProps = {
  front: ReactNode;
  back: ReactNode;
  flipped?: boolean;
  onFlip?: (flipped: boolean) => void;
  className?: string;
};

export function Flashcard({ front, back, flipped, onFlip, className }: FlashcardProps) {
  const [internalFlipped, setInternalFlipped] = useState(false);
  const isControlled = flipped !== undefined;
  const isFlipped = isControlled ? flipped : internalFlipped;

  const toggle = () => {
    const next = !isFlipped;
    if (!isControlled) setInternalFlipped(next);
    onFlip?.(next);
  };

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <div className="perspective-wrapper w-full max-w-2xl h-[400px]">
      <div
        data-testid="flashcard"
        role="button"
        tabIndex={0}
        aria-pressed={isFlipped}
        onClick={toggle}
        onKeyDown={handleKey}
        className={`flashcard w-full h-full ${isFlipped ? "flipped" : ""} ${className ?? ""}`}
      >
        <div className="flashcard-inner">
          <div data-face="front" aria-hidden={isFlipped ? "true" : "false"} className="flashcard-front z-20">
            {front}
          </div>
          <div data-face="back" aria-hidden={isFlipped ? "false" : "true"} className="flashcard-back z-10">
            {back}
          </div>
        </div>
      </div>
    </div>
  );
}

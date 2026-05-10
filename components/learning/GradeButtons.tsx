"use client";

import { useEffect } from "react";
import { nextReview, type Grade, type ReviewState } from "@/lib/srs/sm2";

export function formatInterval(days: number): string {
  if (days < 1 / 1440) return "< 1 min";
  if (days < 1) return `${Math.round(days * 24)} hr`;
  if (days < 30) return `${Math.round(days)} day${Math.round(days) === 1 ? "" : "s"}`;
  return `${Math.round(days / 30)} mo`;
}

const BUTTONS: Array<{ grade: Grade; label: string; tone: string }> = [
  { grade: 1, label: "Again", tone: "border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400" },
  { grade: 2, label: "Hard",  tone: "border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10 text-orange-400" },
  { grade: 3, label: "Good",  tone: "border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400" },
  { grade: 4, label: "Easy",  tone: "border-teal-500/20 bg-teal-500/5 hover:bg-teal-500/10 text-teal-400" },
];

export type GradeButtonsProps = {
  currentState: ReviewState;
  onGrade: (grade: Grade) => void;
  disabled?: boolean;
};

export function GradeButtons({ currentState, onGrade, disabled }: GradeButtonsProps) {
  useEffect(() => {
    if (disabled) return;
    const handler = (e: KeyboardEvent) => {
      if (["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        onGrade(Number(e.key) as Grade);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onGrade, disabled]);

  return (
    <div className="mt-10 flex gap-4 w-full max-w-2xl mx-auto justify-center">
      {BUTTONS.map(({ grade, label, tone }) => {
        const next = nextReview(currentState, grade);
        return (
          <button
            key={grade}
            type="button"
            disabled={disabled}
            onClick={() => onGrade(grade)}
            className={`flex-1 flex flex-col items-center justify-center py-3 px-4 rounded-xl border transition-all ${tone} disabled:opacity-50`}
            aria-label={`${label} grade ${grade}`}
          >
            <span className="font-medium text-sm">{label}</span>
            <span className="text-[10px] font-mono mt-1 opacity-70">{formatInterval(next.intervalDays)}</span>
          </button>
        );
      })}
    </div>
  );
}

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GradeButtons, formatInterval } from "@/components/learning/GradeButtons";

describe("formatInterval", () => {
  it("0 days → < 1 min", () => expect(formatInterval(0)).toBe("< 1 min"));
  it("0.5 days → 12 hr", () => expect(formatInterval(0.5)).toBe("12 hr"));
  it("1 day → 1 day", () => expect(formatInterval(1)).toBe("1 day"));
  it("4 days → 4 days", () => expect(formatInterval(4)).toBe("4 days"));
  it("60 days → 2 mo", () => expect(formatInterval(60)).toBe("2 mo"));
});

describe("GradeButtons", () => {
  const state = { ease: 2.5, intervalDays: 6, repetitions: 2, lapses: 0 };

  it("renders 4 buttons with derived interval labels", () => {
    render(<GradeButtons currentState={state} onGrade={() => {}} />);
    expect(screen.getByRole("button", { name: /Again/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Easy/ })).toBeInTheDocument();
  });

  it("calls onGrade with the right grade on click", () => {
    const onGrade = vi.fn();
    render(<GradeButtons currentState={state} onGrade={onGrade} />);
    fireEvent.click(screen.getByRole("button", { name: /Again/ }));
    expect(onGrade).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: /Good/ }));
    expect(onGrade).toHaveBeenCalledWith(3);
  });

  it("triggers grade on 1-4 keypress", () => {
    const onGrade = vi.fn();
    render(<GradeButtons currentState={state} onGrade={onGrade} />);
    fireEvent.keyDown(window, { key: "3" });
    expect(onGrade).toHaveBeenCalledWith(3);
  });
});

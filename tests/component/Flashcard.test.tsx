import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Flashcard } from "@/components/flashcard/Flashcard";

describe("Flashcard", () => {
  it("renders front face initially with aria-hidden=false", () => {
    render(<Flashcard front={<span>front</span>} back={<span>back</span>} />);
    const front = screen.getByText("front").closest("[data-face]");
    const back = screen.getByText("back").closest("[data-face]");
    expect(front).toHaveAttribute("aria-hidden", "false");
    expect(back).toHaveAttribute("aria-hidden", "true");
  });

  it("toggles flipped class on click", () => {
    render(<Flashcard front={<span>f</span>} back={<span>b</span>} />);
    const card = screen.getByTestId("flashcard");
    expect(card.className).not.toMatch(/flipped/);
    fireEvent.click(card);
    expect(card.className).toMatch(/flipped/);
  });

  it("flips via Space keypress", () => {
    render(<Flashcard front={<span>f</span>} back={<span>b</span>} />);
    const card = screen.getByTestId("flashcard");
    fireEvent.keyDown(card, { code: "Space" });
    expect(card.className).toMatch(/flipped/);
  });

  it("controlled mode respects flipped prop", () => {
    const { rerender } = render(<Flashcard front={<span>f</span>} back={<span>b</span>} flipped={false} />);
    expect(screen.getByTestId("flashcard").className).not.toMatch(/flipped/);
    rerender(<Flashcard front={<span>f</span>} back={<span>b</span>} flipped={true} />);
    expect(screen.getByTestId("flashcard").className).toMatch(/flipped/);
  });
});

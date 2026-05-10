import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FlashcardFaceMcFront, FlashcardFaceMcBack } from "@/components/flashcard/FlashcardFace.MC";

describe("FlashcardFaceMcFront", () => {
  it("renders prompt and 4 options with letter labels", () => {
    render(
      <FlashcardFaceMcFront
        cardId="0001" prompt="Why?" options={["a","b","c","d"]} onSelect={() => {}}
      />,
    );
    expect(screen.getByText("Why?")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("D")).toBeInTheDocument();
  });

  it("calls onSelect with the clicked index", () => {
    const onSelect = vi.fn();
    render(
      <FlashcardFaceMcFront
        cardId="0001" prompt="Why?" options={["a","b","c","d"]} onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText("c"));
    expect(onSelect).toHaveBeenCalledWith(2);
  });
});

describe("FlashcardFaceMcBack", () => {
  it("highlights correct option and shows explanation", () => {
    render(
      <FlashcardFaceMcBack
        options={["a","b","c","d"]} correctIndex={2} selectedIndex={0}
        explanation="because c"
      />,
    );
    expect(screen.getByText("because c")).toBeInTheDocument();
    const correct = screen.getByText("c");
    expect(correct.closest("[data-correct]")).toHaveAttribute("data-correct", "true");
  });
});

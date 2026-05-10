import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FlashcardFaceClozeFront, FlashcardFaceClozeBack, parseClozeBlanks } from "@/components/flashcard/FlashcardFace.Cloze";

describe("parseClozeBlanks", () => {
  it("splits prompt into text and blank segments preserving order", () => {
    expect(parseClozeBlanks("the {{c1::cat}} sat on the {{c2::mat}}")).toEqual([
      { type: "text", value: "the " },
      { type: "blank", index: 0, hint: "cat" },
      { type: "text", value: " sat on the " },
      { type: "blank", index: 1, hint: "mat" },
    ]);
  });
});

describe("FlashcardFaceClozeFront", () => {
  it("renders inputs for each {{cN::}} blank", () => {
    render(<FlashcardFaceClozeFront cardId="0042" prompt="the {{c1::cat}} sat" onSubmit={() => {}} />);
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(1);
  });

  it("calls onSubmit with collected values on Submit click", () => {
    const onSubmit = vi.fn();
    render(<FlashcardFaceClozeFront cardId="0042" prompt="the {{c1::cat}} {{c2::sat}}" onSubmit={onSubmit} />);
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0]!, { target: { value: "dog" } });
    fireEvent.change(inputs[1]!, { target: { value: "ran" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledWith(["dog", "ran"]);
  });
});

describe("FlashcardFaceClozeBack", () => {
  it("shows ✓ for correct and ✗ for incorrect blanks", () => {
    render(
      <FlashcardFaceClozeBack
        perBlank={[
          { user: "cat", canonical: "cat", correct: true, distance: 0 },
          { user: "lap", canonical: "mat", correct: false, distance: 2 },
        ]}
        explanation="cats sit on mats"
      />,
    );
    expect(screen.getByText("cats sit on mats")).toBeInTheDocument();
  });
});

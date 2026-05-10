import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FlashcardFaceFreeformFront, FlashcardFaceFreeformBack } from "@/components/flashcard/FlashcardFace.Freeform";

describe("FlashcardFaceFreeformFront", () => {
  it("submits textarea content on Cmd+Enter", () => {
    const onSubmit = vi.fn();
    render(<FlashcardFaceFreeformFront cardId="x" prompt="explain" onSubmit={onSubmit} loading={false} />);
    const ta = screen.getByRole("textbox");
    fireEvent.change(ta, { target: { value: "my answer" } });
    fireEvent.keyDown(ta, { code: "Enter", metaKey: true });
    expect(onSubmit).toHaveBeenCalledWith("my answer");
  });

  it("shows shimmer when loading=true", () => {
    render(<FlashcardFaceFreeformFront cardId="x" prompt="explain" onSubmit={() => {}} loading={true} />);
    expect(screen.getByTestId("freeform-shimmer")).toBeInTheDocument();
  });
});

describe("FlashcardFaceFreeformBack", () => {
  it("renders per-criterion verdicts and summary", () => {
    render(
      <FlashcardFaceFreeformBack
        perCriterion={[
          { criterion: "names retrieval", met: "yes", evidence: "user said 'retrieve'" },
          { criterion: "names generation", met: "partial", evidence: "implied" },
          { criterion: "names tradeoffs", met: "no", evidence: "absent" },
        ]}
        summaryFeedback="Solid grasp; expand on generation."
        whatToRevisit="generation step"
      />,
    );
    expect(screen.getByText(/Solid grasp/)).toBeInTheDocument();
    expect(screen.getByText(/generation step/)).toBeInTheDocument();
  });
});

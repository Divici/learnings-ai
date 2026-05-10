import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueueHero } from "@/components/learning/QueueHero";

describe("QueueHero", () => {
  it("displays due count as headline", () => {
    render(<QueueHero dueCount={12} topicBreakdown={[]} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("12");
  });

  it("renders 'cards due' label", () => {
    render(<QueueHero dueCount={5} topicBreakdown={[]} />);
    expect(screen.getByText("cards due")).toBeInTheDocument();
  });

  it("renders Begin Session link pointing to /learning?session=new", () => {
    render(<QueueHero dueCount={3} topicBreakdown={[]} />);
    const link = screen.getByRole("link", { name: /Begin Session/i });
    expect(link).toHaveAttribute("href", "/learning?session=new");
  });

  it("renders topic breakdown badges with correct text", () => {
    render(
      <QueueHero
        dueCount={10}
        topicBreakdown={[
          { name: "LLMs", count: 4, tone: "blue" },
          { name: "SRS", count: 6, tone: "purple" },
        ]}
      />,
    );
    expect(screen.getByText(/4 LLMs/)).toBeInTheDocument();
    expect(screen.getByText(/6 SRS/)).toBeInTheDocument();
  });

  it("applies correct tone classes for each badge color", () => {
    const { container } = render(
      <QueueHero
        dueCount={1}
        topicBreakdown={[
          { name: "Blue", count: 1, tone: "blue" },
          { name: "Purple", count: 2, tone: "purple" },
          { name: "Teal", count: 3, tone: "teal" },
        ]}
      />,
    );
    const badges = container.querySelectorAll("span.font-mono");
    expect(badges[0]?.className).toMatch(/blue/);
    expect(badges[1]?.className).toMatch(/purple/);
    expect(badges[2]?.className).toMatch(/teal/);
  });

  it("renders keyboard hint", () => {
    render(<QueueHero dueCount={1} topicBreakdown={[]} />);
    expect(screen.getByText(/Press Enter/i)).toBeInTheDocument();
  });
});

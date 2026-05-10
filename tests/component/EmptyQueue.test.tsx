import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyQueue } from "@/components/learning/EmptyQueue";

describe("EmptyQueue", () => {
  it("shows 'Nothing due today' heading", () => {
    render(<EmptyQueue tomorrowCount={5} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Nothing due today.");
  });

  it("shows tomorrow count", () => {
    render(<EmptyQueue tomorrowCount={7} />);
    expect(screen.getByText(/Tomorrow: 7 cards/)).toBeInTheDocument();
  });

  it("shows zero tomorrow count", () => {
    render(<EmptyQueue tomorrowCount={0} />);
    expect(screen.getByText(/Tomorrow: 0 cards/)).toBeInTheDocument();
  });

  it("renders a link to /learning/topics", () => {
    render(<EmptyQueue tomorrowCount={3} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/learning/topics");
    expect(link).toHaveTextContent(/focus area/i);
  });

  it("renders checkmark icon container", () => {
    const { container } = render(<EmptyQueue tomorrowCount={0} />);
    expect(container.querySelector(".rounded-2xl")).toBeInTheDocument();
    expect(container.querySelector(".rounded-2xl")?.textContent).toBe("✓");
  });
});

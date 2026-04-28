import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FloatingHeader } from "@/components/FloatingHeader";

describe("FloatingHeader", () => {
  it("renders brand, workspace label, and version", () => {
    render(<FloatingHeader workspace="Gauntlet AI" version="0.1.0" />);
    expect(screen.getByText("Learnings AI")).toBeInTheDocument();
    expect(screen.getByText("Gauntlet AI")).toBeInTheDocument();
    expect(screen.getByText(/0\.1\.0/)).toBeInTheDocument();
  });

  it("uses semantic header element with banner role", () => {
    render(<FloatingHeader workspace="X" version="1" />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("applies glass-panel and floating positioning classes", () => {
    const { container } = render(<FloatingHeader workspace="X" version="1" />);
    const header = container.querySelector("header");
    expect(header).toHaveClass("glass-panel", "fixed", "rounded-full");
  });
});

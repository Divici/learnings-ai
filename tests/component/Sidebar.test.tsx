import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "@/components/Sidebar";

const renderSidebar = (active: "learning" | "planning" = "learning") =>
  render(
    <Sidebar
      userInitials="DA"
      userName="David"
      level={1}
      activePath={active}
    />
  );

describe("Sidebar", () => {
  it("shows the user initials avatar and name", () => {
    renderSidebar();
    expect(screen.getByText("DA")).toBeInTheDocument();
    expect(screen.getByText("David")).toBeInTheDocument();
    expect(screen.getByText(/Level 1 Scholar/)).toBeInTheDocument();
  });

  it("renders Learning and Planning nav links", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: /Learning/ })).toHaveAttribute("href", "/learning");
    expect(screen.getByRole("link", { name: /Planning/ })).toHaveAttribute("href", "/planning");
  });

  it("highlights the active route", () => {
    renderSidebar("planning");
    const planning = screen.getByRole("link", { name: /Planning/ });
    expect(planning).toHaveAttribute("aria-current", "page");
  });

  it("shows Current Focus heading and empty placeholder", () => {
    renderSidebar();
    expect(screen.getByText(/Current Focus/i)).toBeInTheDocument();
    expect(screen.getByText(/No focus areas yet/i)).toBeInTheDocument();
  });

  it("renders 21 activity heatmap cells", () => {
    const { container } = renderSidebar();
    const cells = container.querySelectorAll('[data-testid="heatmap-cell"]');
    expect(cells).toHaveLength(21);
  });
});

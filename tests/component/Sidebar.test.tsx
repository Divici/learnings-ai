import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SidebarView } from "@/components/SidebarView";

const renderSidebar = (active: "learning" | "planning" = "learning") =>
  render(
    <SidebarView
      userInitials="DA"
      userName="David"
      level={1}
      activePath={active}
      focus={[]}
      heatmap={new Array(21).fill(0)}
    />,
  );

describe("SidebarView", () => {
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

  it("shows Current Focus heading and empty placeholder when focus is empty", () => {
    renderSidebar();
    expect(screen.getByText(/Current Focus/i)).toBeInTheDocument();
    expect(screen.getByText(/No focus areas yet/i)).toBeInTheDocument();
  });

  it("renders focus items when provided", () => {
    render(
      <SidebarView
        userInitials="DA"
        userName="David"
        level={1}
        activePath="learning"
        focus={[
          { id: "1", name: "RAG Basics", parentTopic: "retrieval", dueCount: 3 },
          { id: "2", name: "ReAct Agents", parentTopic: "agents", dueCount: 0 },
        ]}
        heatmap={new Array(21).fill(0)}
      />,
    );
    expect(screen.getByText("RAG Basics")).toBeInTheDocument();
    expect(screen.getByText("ReAct Agents")).toBeInTheDocument();
    expect(screen.queryByText(/No focus areas yet/i)).not.toBeInTheDocument();
  });

  it("renders 21 activity heatmap cells", () => {
    const { container } = renderSidebar();
    const cells = container.querySelectorAll('[data-testid="heatmap-cell"]');
    expect(cells).toHaveLength(21);
  });

  it("applies correct heatmap intensity classes based on attempt count", () => {
    const heatmap = new Array(21).fill(0);
    heatmap[0] = 1; // low
    heatmap[1] = 10; // medium
    heatmap[2] = 20; // high
    heatmap[3] = 35; // max
    const { container } = render(
      <SidebarView
        userInitials="DA"
        userName="David"
        level={1}
        activePath="learning"
        focus={[]}
        heatmap={heatmap}
      />,
    );
    const cells = container.querySelectorAll('[data-testid="heatmap-cell"]');
    expect(cells[0]).toHaveClass("bg-blue-500/20");
    expect(cells[1]).toHaveClass("bg-blue-500/40");
    expect(cells[2]).toHaveClass("bg-blue-500/60");
    expect(cells[3]).toHaveClass("bg-blue-500/80");
    // cells beyond index 3 should be empty
    expect(cells[4]).toHaveClass("bg-white/5");
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { GlassCard } from "@/components/glass/GlassCard";

describe("GlassPanel", () => {
  it("applies glass-panel class and forwards children", () => {
    render(<GlassPanel data-testid="p">hello</GlassPanel>);
    const el = screen.getByTestId("p");
    expect(el).toHaveClass("glass-panel");
    expect(el).toHaveTextContent("hello");
  });

  it("merges custom className", () => {
    render(<GlassPanel className="rounded-2xl" data-testid="p" />);
    expect(screen.getByTestId("p")).toHaveClass("glass-panel", "rounded-2xl");
  });

  it("forwards ref", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(<GlassPanel ref={ref} data-testid="p" />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe("GlassCard", () => {
  it("applies glass-card class", () => {
    render(<GlassCard data-testid="c">x</GlassCard>);
    expect(screen.getByTestId("c")).toHaveClass("glass-card");
  });
});

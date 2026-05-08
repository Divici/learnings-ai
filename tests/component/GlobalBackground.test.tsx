import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { GlobalBackground } from "@/components/GlobalBackground";

describe("GlobalBackground", () => {
  it("renders three watercolor blobs and noise overlay", () => {
    const { container } = render(<GlobalBackground />);
    expect(container.querySelectorAll(".watercolor-blob")).toHaveLength(3);
    expect(container.querySelector(".noise-overlay")).toBeInTheDocument();
  });

  it("each blob has its own positional class", () => {
    const { container } = render(<GlobalBackground />);
    expect(container.querySelector(".blob-1")).toBeInTheDocument();
    expect(container.querySelector(".blob-2")).toBeInTheDocument();
    expect(container.querySelector(".blob-3")).toBeInTheDocument();
  });

  it("marks every decorative layer aria-hidden", () => {
    const { container } = render(<GlobalBackground />);
    const layers = container.querySelectorAll(".watercolor-blob, .noise-overlay");
    expect(layers).toHaveLength(4);
    layers.forEach((el) => {
      expect(el).toHaveAttribute("aria-hidden", "true");
    });
  });
});

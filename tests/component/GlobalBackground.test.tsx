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

  it("has aria-hidden on the wrapper (decorative)", () => {
    const { container } = render(<GlobalBackground />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});

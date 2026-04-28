# 0002 — Glass visual system

**Status:** Accepted (2026-04-27)

## Context

User provided a complete visual mockup in `docs/design/lumina-style-reference.html`: glassmorphism with backdrop-blur, animated watercolor blobs, noise overlay, floating pill header, glass sidebar with avatar/nav/heatmap, 3D flip flashcard, vertical timeline with status nodes for the planning wizard.

## Decision

Adopt the mockup as binding visual spec. Implement the visual primitives (`glass-panel`, `glass-card`, blob keyframes, scrollbar styling) in `app/globals.css` as Tailwind v4 utility classes + custom CSS. Use `@phosphor-icons/react` for icons. Inter (sans) + JetBrains Mono (code/labels) via `next/font/google`.

shadcn/ui primitives are wrapped, not used raw, so all surfaces inherit the glass aesthetic.

## Alternatives considered

- **shadcn defaults**: faster to ship but inconsistent with the mockup; would feel generic.
- **CSS-in-JS (Emotion / Stitches)**: more flexible but adds runtime cost; vanilla CSS + Tailwind is enough.
- **Drop the watercolor blobs / noise overlay**: would lose the mockup's distinctive feel.

## Consequences

- Visual fidelity is testable via Playwright screenshot diff (≤ 0.1% threshold).
- Light theme requires a parallel palette — built later (Plan 5).
- Reduced-motion users get a static version automatically (handled in `globals.css`).
- Cross-browser glass requires `-webkit-backdrop-filter` prefix — already in mockup CSS.

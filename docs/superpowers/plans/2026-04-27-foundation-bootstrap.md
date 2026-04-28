# Foundation & Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js project, database, auth, and visual shell so subsequent plans (Ingestion, Learning, Planning, Polish) can be implemented against a working, deployable foundation.

**Architecture:** Next.js (App Router) + TypeScript + Tailwind v4 + shadcn/ui as primitives wrapped in custom glass components. Postgres 16 with pgvector via Drizzle ORM. Single-user auth via env-secret cookie validated in `middleware.ts`. Visual fidelity to `docs/design/lumina-style-reference.html` — animated watercolor blobs, noise overlay, floating pill header, glass sidebar with avatar / nav stubs / activity heatmap stub.

**Tech Stack:** Next.js 15+, TypeScript 5+, Tailwind v4, shadcn/ui, `@phosphor-icons/react`, Drizzle ORM, `postgres` (driver), Vitest, React Testing Library, Playwright (+ `@axe-core/playwright`), pino, `@sentry/nextjs`, pnpm 9+.

**Spec reference:** [`docs/superpowers/specs/2026-04-27-learnings-ai-design.md`](../specs/2026-04-27-learnings-ai-design.md), focus on sections 2 (architecture), 3 (data model — full schema migration in this plan), 7.1-7.3 (visual system + persistent shell + sidebar shell), 8.1-8.5 + 8.7 (repo structure, env, deploy, CI, security baseline).

**Visual reference:** [`docs/design/lumina-style-reference.html`](../../design/lumina-style-reference.html).

**Output of this plan:** A deployable Next.js app that authenticates against `LEARNINGS_AI_TOKEN`, renders the full mockup-faithful shell on every route, has the complete database schema migrated, passes typecheck/lint/unit/component/E2E/a11y CI gates, and successfully deploys to Railway with a green `/api/health`. No Learning content. No Planning content. No ingestion. Just the polished, empty house.

---

## File Structure

This plan creates and configures these files. Subsequent plans add to this scaffold.

```
learningsAI/
├── .github/workflows/
│   ├── ci.yml                            CI: lint, typecheck, unit, component, e2e, a11y
│   └── deploy.yml                        On main: railway up
├── .gitignore
├── .env.example
├── README.md
├── CLAUDE.md
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml                   (omit — not a monorepo)
├── tsconfig.json
├── next.config.ts                        CSP headers, Sentry wrapper, server actions config
├── tailwind.config.ts                    minimal — Tailwind v4 is CSS-first
├── drizzle.config.ts                     points at db/schema.ts, db/migrations/
├── vitest.config.ts                      jsdom env, coverage thresholds
├── playwright.config.ts                  desktop + mobile projects, screenshot baselines
├── middleware.ts                         auth cookie validation
├── sentry.client.config.ts
├── sentry.server.config.ts
├── sentry.edge.config.ts
├── instrumentation.ts                    Next.js Sentry init hook
├── app/
│   ├── layout.tsx                        Root: fonts, GlobalBackground, FloatingHeader, Sidebar shell, main outlet
│   ├── globals.css                       CSS tokens, glass utilities, blob keyframes, scrollbar
│   ├── page.tsx                          Redirect → /learning
│   ├── learning/page.tsx                 Stub: "Learning surface coming soon"
│   ├── planning/page.tsx                 Stub: "Planning surface coming soon"
│   ├── settings/page.tsx                 Stub: "Settings coming soon"
│   ├── auth/page.tsx                     Paste-token entry form
│   ├── auth/actions.ts                   Server action: validate token, set cookie, redirect
│   └── api/
│       ├── health/route.ts               GET → { ok, db_ok, llm_ok, version }
│       └── auth/logout/route.ts          POST → clear cookie
├── components/
│   ├── GlobalBackground.tsx              Watercolor blobs + noise overlay (fixed, z-0)
│   ├── FloatingHeader.tsx                Pill header (brand + workspace + version)
│   ├── Sidebar.tsx                       Profile + primary nav + Current Focus stub + Activity heatmap stub
│   ├── glass/
│   │   ├── GlassPanel.tsx                Heavy-blur surface
│   │   └── GlassCard.tsx                 Light-blur inner card
│   └── ui/                               shadcn-init populates this — Button, Input, etc.
├── lib/
│   ├── auth/
│   │   ├── token.ts                      Token validation logic
│   │   └── cookie.ts                     Cookie name + options constants
│   ├── db/
│   │   ├── index.ts                      Drizzle client (postgres driver)
│   │   ├── schema.ts                     All tables from spec § 3
│   │   └── settings.ts                   getSettings() / updateSettings() typed accessors
│   ├── log/
│   │   └── index.ts                      pino instance + redaction config
│   └── env.ts                            Validated env (zod) — fail fast at boot
├── db/migrations/
│   ├── 0000_init.sql                     CREATE EXTENSION vector; CREATE TABLE ...
│   └── meta/                             Drizzle Kit metadata
├── tests/
│   ├── unit/
│   │   ├── auth.token.test.ts
│   │   ├── db.settings.test.ts
│   │   └── env.test.ts
│   ├── component/
│   │   ├── GlobalBackground.test.tsx
│   │   ├── FloatingHeader.test.tsx
│   │   └── Sidebar.test.tsx
│   ├── e2e/
│   │   ├── auth.spec.ts                  Token gate redirects to /auth, accepts valid token, persists across reloads
│   │   ├── shell.spec.ts                 Visual regression: layout shell matches mockup
│   │   └── health.spec.ts                /api/health returns ok in test env
│   └── fixtures/
│       └── test-db.ts                    Testcontainers Postgres helper
├── docs/
│   ├── design/lumina-style-reference.html (already present)
│   ├── adr/
│   │   ├── 0001-stack-choice.md
│   │   └── 0002-glass-visual-system.md
│   └── (specs/, plans/ already present)
├── public/
│   ├── favicon.ico                       (placeholder for now)
│   └── og.png                            (placeholder)
└── sources/                              Empty for now; Plan 2 (Ingestion) reads from here
    └── .gitkeep
```

---

## Task 1: Initialize git repo and Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `.gitignore`, `app/globals.css`
- Init: `.git/`

- [ ] **Step 1: Initialize git repo and verify clean working tree**

```bash
cd "C:/Users/doa92/Desktop/Gauntlet Projects/learningsAI"
git init -b main
git add PRD.md "Uber System Design Walkthrough.md" gauntlet_ai_resources/ docs/
git commit -m "initial: prd, design reference, lecture sources, design spec"
```

Expected: a single initial commit containing existing artifacts.

- [ ] **Step 2: Bootstrap Next.js with the exact flags we need**

```bash
pnpm create next-app@latest . \
  --typescript --eslint --tailwind --app --src-dir false \
  --import-alias "@/*" --use-pnpm --turbopack --skip-install
```

When prompted "directory not empty, continue?" — answer **yes**. Next.js will scaffold around existing files.

- [ ] **Step 3: Install dependencies**

```bash
pnpm install
pnpm add @phosphor-icons/react drizzle-orm postgres zod cmdk \
  pino pino-pretty mermaid react-markdown rehype-sanitize \
  @sentry/nextjs
pnpm add -D drizzle-kit @types/node tsx \
  vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event \
  @playwright/test @axe-core/playwright \
  @testcontainers/postgresql
pnpm exec playwright install --with-deps chromium webkit firefox
```

Expected: lockfile created, `node_modules/` populated, `pnpm-lock.yaml` written.

- [ ] **Step 4: Update `tsconfig.json` to strict mode**

Replace `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Verify the bootstrap by running typecheck and dev**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

```bash
pnpm dev
```

Expected: dev server starts, `http://localhost:3000` shows the default Next.js welcome page. Stop with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "scaffold next.js app with typescript, tailwind, app router, strict tsconfig"
```

---

## Task 2: Set up project directory layout and conventions

**Files:**
- Create: `lib/`, `components/glass/`, `db/migrations/`, `tests/{unit,component,e2e,fixtures}/`, `sources/.gitkeep`, `scripts/`, `docs/adr/`
- Modify: `.gitignore`

- [ ] **Step 1: Create directory scaffolding**

```bash
mkdir -p lib/auth lib/db lib/log components/glass db/migrations tests/unit tests/component tests/e2e tests/fixtures scripts docs/adr
touch sources/.gitkeep
```

- [ ] **Step 2: Update `.gitignore`**

Append to `.gitignore`:

```
# Project conventions
STUDY_GUIDE.md
.env
.env.local
.env.*.local
*.tsbuildinfo
.next/
coverage/
playwright-report/
test-results/
.sentryclirc
logs/
```

- [ ] **Step 3: Add `.env.example` (variable names only, no values per the no-env-contents global rule)**

Create `.env.example`:

```
# Database
DATABASE_URL=
DATABASE_URL_UNPOOLED=

# LLM (used in later plans, declared now)
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Auth
LEARNINGS_AI_TOKEN=

# Observability
SENTRY_DSN=
LOG_LEVEL=info

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

- [ ] **Step 4: Add a barebones `README.md`**

Create `README.md`:

````markdown
# Learnings AI

A personal AI engineering tool with two surfaces — a flashcard-based **Learning** review system over the user's Gauntlet AI lecture material, and a wizard-driven **Planning** tab that produces senior-engineer-style system design walkthroughs from app ideas.

See [`PRD.md`](./PRD.md) for product intent and [`docs/superpowers/specs/2026-04-27-learnings-ai-design.md`](./docs/superpowers/specs/2026-04-27-learnings-ai-design.md) for the implementation spec.

## Stack

Next.js (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Drizzle + Postgres + pgvector · OpenRouter (Claude Haiku/Sonnet, Voyage embeddings) · Railway.

## Local Setup

Prerequisites: Node 20+, pnpm 9+, Postgres 16 with `pgvector`, Railway CLI (for deploys).

```bash
cp .env.example .env.local
# fill in values

pnpm install
pnpm db:migrate
pnpm dev
```

Visit `http://localhost:3000`. Paste your `LEARNINGS_AI_TOKEN` at `/auth`.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Start dev server with Turbopack |
| `pnpm build` | Production build |
| `pnpm test:unit` | Vitest unit tests |
| `pnpm test:component` | Vitest component tests |
| `pnpm test:e2e` | Playwright E2E (auto-starts preview) |
| `pnpm db:generate` | Drizzle Kit: generate SQL from schema |
| `pnpm db:migrate` | Apply pending migrations |

## Documentation

- [`PRD.md`](./PRD.md) — product requirements
- [`docs/superpowers/specs/`](./docs/superpowers/specs/) — implementation specs
- [`docs/superpowers/plans/`](./docs/superpowers/plans/) — implementation plans
- [`docs/adr/`](./docs/adr/) — architecture decision records
- [`docs/design/`](./docs/design/) — visual reference HTML
````

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "scaffold project directory layout, env example, and readme"
```

---

## Task 3: Configure Tailwind v4 and global CSS with design tokens

**Files:**
- Modify: `app/globals.css`
- Create: `tailwind.config.ts` (minimal)

Tailwind v4 is CSS-first; most "config" is custom-properties + `@theme` directive in CSS.

- [ ] **Step 1: Replace `app/globals.css` with the design system CSS**

Replace the contents of `app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  --color-bg: #050508;
  --color-text-primary: rgba(255, 255, 255, 0.95);
  --color-text-secondary: rgba(255, 255, 255, 0.6);
  --color-text-tertiary: rgba(255, 255, 255, 0.4);

  --color-accent-blue: #3b82f6;
  --color-accent-purple: #8b5cf6;
  --color-accent-teal: #14b8a6;
}

:root {
  --glass-bg: rgba(15, 15, 20, 0.4);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-highlight: rgba(255, 255, 255, 0.03);
  --blur-heavy: blur(40px);
  --blur-light: blur(12px);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  height: 100%;
}

body {
  font-family: var(--font-sans);
  background-color: var(--color-bg);
  color: var(--color-text-primary);
  overflow: hidden;
  position: relative;
}

/* ─── Glass surfaces ────────────────────────────────────────── */

.glass-panel {
  background: var(--glass-bg);
  backdrop-filter: var(--blur-heavy);
  -webkit-backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--glass-border);
  box-shadow:
    0 24px 48px -12px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 0 var(--glass-highlight);
}

.glass-card {
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.05) 0%,
    rgba(255, 255, 255, 0.01) 100%
  );
  backdrop-filter: var(--blur-light);
  border: 1px solid var(--glass-border);
  transition: all 0.3s ease;
}

.glass-card:hover {
  border-color: rgba(255, 255, 255, 0.15);
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.08) 0%,
    rgba(255, 255, 255, 0.02) 100%
  );
}

/* ─── Watercolor blobs ──────────────────────────────────────── */

.watercolor-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.4;
  z-index: 0;
  pointer-events: none;
  mix-blend-mode: screen;
  animation: float 20s infinite alternate ease-in-out;
}

.blob-1 {
  top: -10%;
  right: -5%;
  width: 60vw;
  height: 60vw;
  background: radial-gradient(
    circle,
    rgba(59, 130, 246, 0.6) 0%,
    rgba(59, 130, 246, 0) 70%
  );
}

.blob-2 {
  bottom: -20%;
  left: -10%;
  width: 50vw;
  height: 50vw;
  background: radial-gradient(
    circle,
    rgba(139, 92, 246, 0.5) 0%,
    rgba(139, 92, 246, 0) 70%
  );
  animation-delay: -5s;
}

.blob-3 {
  top: 40%;
  left: 30%;
  width: 40vw;
  height: 40vw;
  background: radial-gradient(
    circle,
    rgba(20, 184, 166, 0.4) 0%,
    rgba(20, 184, 166, 0) 70%
  );
  animation-delay: -10s;
}

.noise-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  opacity: 0.04;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
}

/* ─── Status indicators ─────────────────────────────────────── */

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-accent-blue);
  animation: pulse-glow 2s infinite;
}

/* ─── Scrollbars ────────────────────────────────────────────── */

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* ─── Keyframes ─────────────────────────────────────────────── */

@keyframes float {
  0% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(5%, 5%) scale(1.05);
  }
  100% {
    transform: translate(-5%, -5%) scale(0.95);
  }
}

@keyframes pulse-glow {
  0% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ─── Reduced motion ────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .watercolor-blob,
  .status-dot {
    animation: none;
  }
  *,
  *::before,
  *::after {
    transition: none !important;
    animation-duration: 0ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

- [ ] **Step 2: Create `tailwind.config.ts` (minimal — most config is in CSS)**

Create `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: { extend: {} },
};

export default config;
```

- [ ] **Step 3: Verify build still works**

```bash
pnpm build
```

Expected: build succeeds, no Tailwind errors.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "configure tailwind v4 with glass design tokens, watercolor blobs, reduced-motion support"
```

---

## Task 4: Add `lib/env.ts` with zod-validated environment

**Files:**
- Create: `lib/env.ts`, `tests/unit/env.test.ts`

This module fails fast at boot if required env vars are missing or malformed. Used everywhere — DB, auth, LLM client.

- [ ] **Step 1: Write failing test**

Create `tests/unit/env.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

describe("env", () => {
  it("throws when DATABASE_URL is missing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("LEARNINGS_AI_TOKEN", "x".repeat(32));
    await expect(import("@/lib/env?missing-db")).rejects.toThrow(
      /DATABASE_URL/
    );
  });

  it("throws when LEARNINGS_AI_TOKEN is too short", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://x");
    vi.stubEnv("LEARNINGS_AI_TOKEN", "short");
    await expect(import("@/lib/env?short-token")).rejects.toThrow(
      /LEARNINGS_AI_TOKEN/
    );
  });

  it("returns parsed env when all required vars are valid", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://x");
    vi.stubEnv("LEARNINGS_AI_TOKEN", "x".repeat(32));
    vi.stubEnv("NODE_ENV", "test");
    const { env } = await import("@/lib/env?valid");
    expect(env.DATABASE_URL).toBe("postgres://x");
    expect(env.LEARNINGS_AI_TOKEN).toHaveLength(32);
  });
});
```

> Note: the `?suffix` query strings on imports defeat Vitest's module cache so each test gets a fresh validation pass. Vitest supports this pattern.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/unit/env.test.ts
```

Expected: FAIL — `lib/env.ts` does not exist.

- [ ] **Step 3: Write `lib/env.ts`**

Create `lib/env.ts`:

```ts
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_URL_UNPOOLED: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z
    .string()
    .url()
    .default("https://openrouter.ai/api/v1"),
  LEARNINGS_AI_TOKEN: z
    .string()
    .min(32, "LEARNINGS_AI_TOKEN must be at least 32 chars"),
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run tests/unit/env.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "add zod-validated env module that fails fast on missing or malformed config"
```

---

## Task 5: Configure Vitest

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["lib/**/*.ts", "components/**/*.tsx"],
      exclude: ["**/*.test.*", "**/index.ts"],
      thresholds: {
        "lib/**": { lines: 90, functions: 90, branches: 85 },
        "components/**": { lines: 75, functions: 75, branches: 70 },
      },
    },
  },
});
```

- [ ] **Step 2: Create `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 3: Update `package.json` scripts**

Modify `package.json` `"scripts"` block to include:

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test:unit": "vitest run --dir tests/unit",
    "test:component": "vitest run --dir tests/component",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  }
}
```

- [ ] **Step 4: Run unit tests to confirm Vitest is wired**

```bash
pnpm test:unit
```

Expected: passes the env test from Task 4.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "configure vitest with jsdom, coverage thresholds, and project test scripts"
```

---

## Task 6: Add `lib/log/` with pino structured logger

**Files:**
- Create: `lib/log/index.ts`, `tests/unit/log.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/log.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

describe("log", () => {
  it("redacts authorization headers", async () => {
    const { redactionPaths } = await import("@/lib/log");
    expect(redactionPaths).toContain("req.headers.authorization");
    expect(redactionPaths).toContain("req.headers.cookie");
    expect(redactionPaths).toContain("*.LEARNINGS_AI_TOKEN");
    expect(redactionPaths).toContain("*.OPENROUTER_API_KEY");
  });

  it("exposes a child logger factory", async () => {
    const { log } = await import("@/lib/log");
    const child = log.child({ module: "test" });
    expect(typeof child.info).toBe("function");
    expect(typeof child.warn).toBe("function");
    expect(typeof child.error).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test:unit
```

Expected: FAIL — `lib/log` does not exist.

- [ ] **Step 3: Write `lib/log/index.ts`**

```ts
import pino from "pino";
import { env } from "@/lib/env";

export const redactionPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "*.LEARNINGS_AI_TOKEN",
  "*.OPENROUTER_API_KEY",
  "*.SENTRY_DSN",
  "*.password",
  "*.token",
];

export const log = pino({
  level: env.LOG_LEVEL,
  redact: { paths: redactionPaths, censor: "[REDACTED]" },
  ...(env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss" },
        },
      }
    : {}),
  base: { service: "learnings-ai" },
});

export type Logger = typeof log;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test:unit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "add pino logger with secret redaction and dev pretty-printing"
```

---

## Task 7: Define the full database schema with Drizzle

**Files:**
- Create: `lib/db/schema.ts`, `lib/db/index.ts`, `drizzle.config.ts`, `db/migrations/0000_init.sql`, `db/migrations/meta/_journal.json`

This task implements the **complete schema** from spec § 3 in one go — including all tables that subsequent plans will fill with data. Migrating once now means Plan 2/3/4 only run with existing schema.

- [ ] **Step 1: Create `lib/db/schema.ts`**

```ts
import {
  pgTable,
  uuid,
  text,
  integer,
  smallint,
  timestamp,
  boolean,
  real,
  numeric,
  jsonb,
  pgEnum,
  primaryKey,
  index,
  uniqueIndex,
  vector,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── enums ──────────────────────────────────────────────────

export const cardTypeEnum = pgEnum("card_type", ["mc", "cloze", "freeform"]);

export const sessionStatusEnum = pgEnum("session_status", [
  "in_progress",
  "completed",
  "abandoned",
]);

export const planningStageEnum = pgEnum("planning_stage", [
  "functional_reqs",
  "non_functional_reqs",
  "core_entities",
  "api_design",
  "high_level_design",
  "deep_dives",
  "verification",
]);

export const llmCallStatusEnum = pgEnum("llm_call_status", [
  "success",
  "retry",
  "failed",
]);

export const themeEnum = pgEnum("theme", ["dark", "light", "system"]);

// ─── source material ────────────────────────────────────────

export const sourceFiles = pgTable("source_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  filename: text("filename").notNull(),
  title: text("title").notNull(),
  contentHash: text("content_hash").notNull(),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull(),
  chunkCount: integer("chunk_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sourceChunks = pgTable(
  "source_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => sourceFiles.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    content: text("content").notNull(),
    headingPath: text("heading_path").array().notNull().default(sql`'{}'::text[]`),
    embedding: vector("embedding", { dimensions: 1024 }).notNull(),
    tokenCount: integer("token_count").notNull(),
    topicTags: text("topic_tags").array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("source_chunks_file_position_idx").on(t.fileId, t.position),
    // HNSW index added in raw SQL migration (Drizzle Kit support varies)
  ]
);

export const concepts = pgTable("concepts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  canonicalSummary: text("canonical_summary").notNull(),
  parentTopic: text("parent_topic").notNull(),
  sourceChunkIds: uuid("source_chunk_ids").array().notNull().default(sql`'{}'::uuid[]`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const conceptNotes = pgTable("concept_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  conceptId: uuid("concept_id")
    .notNull()
    .references(() => concepts.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── cards & reviews ────────────────────────────────────────

export const cards = pgTable("cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  conceptId: uuid("concept_id")
    .notNull()
    .references(() => concepts.id, { onDelete: "restrict" }),
  cardType: cardTypeEnum("card_type").notNull(),
  prompt: text("prompt").notNull(),
  canonicalAnswer: text("canonical_answer").notNull(),
  rubric: jsonb("rubric"),
  mcOptions: jsonb("mc_options"),
  clozeAnswers: jsonb("cloze_answers"),
  explanation: text("explanation").notNull(),
  sourceChunkIds: uuid("source_chunk_ids").array().notNull().default(sql`'{}'::uuid[]`),
  difficulty: smallint("difficulty").notNull(),
  parentCardId: uuid("parent_card_id"),
  isLiveGenerated: boolean("is_live_generated").notNull().default(false),
  isDisabled: boolean("is_disabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reviewState = pgTable("review_state", {
  cardId: uuid("card_id")
    .primaryKey()
    .references(() => cards.id, { onDelete: "cascade" }),
  ease: real("ease").notNull().default(2.5),
  intervalDays: real("interval_days").notNull().default(0),
  repetitions: integer("repetitions").notNull().default(0),
  lapses: integer("lapses").notNull().default(0),
  dueAt: timestamp("due_at", { withTimezone: true }),
  lastGrade: smallint("last_grade"),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
}, (t) => [
  index("review_state_due_at_idx").on(t.dueAt),
]);

export const attempts = pgTable("attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  cardId: uuid("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "restrict" }),
  userAnswer: text("user_answer"),
  score: real("score").notNull(),
  grade: smallint("grade").notNull(),
  feedback: text("feedback"),
  durationMs: integer("duration_ms").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("attempts_card_created_idx").on(t.cardId, t.createdAt),
  index("attempts_created_idx").on(t.createdAt),
]);

// ─── planning ───────────────────────────────────────────────

export const planningSessions = pgTable("planning_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  appIdea: text("app_idea").notNull(),
  status: sessionStatusEnum("status").notNull().default("in_progress"),
  currentStage: planningStageEnum("current_stage")
    .notNull()
    .default("functional_reqs"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("planning_sessions_updated_idx").on(t.updatedAt),
]);

export const planningStages = pgTable("planning_stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => planningSessions.id, { onDelete: "cascade" }),
  stage: planningStageEnum("stage").notNull(),
  output: jsonb("output").notNull(),
  userEdits: jsonb("user_edits"),
  isStale: boolean("is_stale").notNull().default(false),
  llmCallId: uuid("llm_call_id"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  regenerateCount: integer("regenerate_count").notNull().default(0),
}, (t) => [
  uniqueIndex("planning_stages_session_stage_unique").on(t.sessionId, t.stage),
]);

// ─── settings & observability ───────────────────────────────

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  userName: text("user_name").notNull().default("Learner"),
  dailyTarget: integer("daily_target").notNull().default(20),
  monthlyCostCap: numeric("monthly_cost_cap", { precision: 10, scale: 2 })
    .notNull()
    .default("50.00"),
  modelHaiku: text("model_haiku").notNull().default("anthropic/claude-haiku-4-5"),
  modelSonnet: text("model_sonnet").notNull().default("anthropic/claude-sonnet-4-6"),
  embeddingModel: text("embedding_model").notNull().default("voyageai/voyage-3"),
  customFocus: jsonb("custom_focus").notNull().default(sql`'[]'::jsonb`),
  corpusSignature: text("corpus_signature"),
  theme: themeEnum("theme").notNull().default("dark"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const llmCalls = pgTable("llm_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  module: text("module").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).notNull(),
  latencyMs: integer("latency_ms").notNull(),
  status: llmCallStatusEnum("status").notNull(),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("llm_calls_module_created_idx").on(t.module, t.createdAt),
  index("llm_calls_created_idx").on(t.createdAt),
]);
```

- [ ] **Step 2: Create `drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
```

- [ ] **Step 3: Create `lib/db/index.ts`**

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "@/lib/db/schema";

const queryClient = postgres(env.DATABASE_URL, {
  max: env.NODE_ENV === "production" ? 10 : 1,
});

export const db = drizzle(queryClient, { schema });
export type Database = typeof db;
```

- [ ] **Step 4: Generate the initial migration**

```bash
pnpm db:generate
```

Drizzle Kit produces `db/migrations/0000_*.sql`. Open the generated file and **prepend** these two lines (Drizzle does not auto-add the extension):

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Also **append** the HNSW index creation at the bottom:

```sql
CREATE INDEX IF NOT EXISTS source_chunks_embedding_hnsw_idx
  ON source_chunks USING hnsw (embedding vector_cosine_ops);
```

- [ ] **Step 5: Apply the migration to a local DB to verify**

If you don't have a local Postgres+pgvector running, start one with Docker:

```bash
docker run -d --name learnings-pg \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

Then in `.env.local`:

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
DATABASE_URL_UNPOOLED=postgres://postgres:postgres@localhost:5432/postgres
LEARNINGS_AI_TOKEN=devdevdevdevdevdevdevdevdevdevdv
```

Apply migrations:

```bash
pnpm db:migrate
```

Expected: migration applies; `psql` reveals all tables exist; `\dx` shows `vector` extension installed.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "define complete database schema with drizzle, generate initial migration with pgvector"
```

---

## Task 8: Add `lib/db/settings.ts` typed accessor + seed script

**Files:**
- Create: `lib/db/settings.ts`, `scripts/seed.ts`, `tests/unit/db.settings.test.ts`, `tests/fixtures/test-db.ts`

- [ ] **Step 1: Create the test-DB helper**

`tests/fixtures/test-db.ts`:

```ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as schema from "@/lib/db/schema";

export type TestDb = {
  container: StartedPostgreSqlContainer;
  client: ReturnType<typeof postgres>;
  db: ReturnType<typeof drizzle<typeof schema>>;
  cleanup: () => Promise<void>;
};

export async function startTestDb(): Promise<TestDb> {
  const container = await new PostgreSqlContainer("pgvector/pgvector:pg16")
    .withDatabase("test")
    .withUsername("test")
    .withPassword("test")
    .start();

  const url = container.getConnectionUri();
  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });

  await migrate(db, { migrationsFolder: "./db/migrations" });

  return {
    container,
    client,
    db,
    cleanup: async () => {
      await client.end({ timeout: 5 });
      await container.stop();
    },
  };
}
```

- [ ] **Step 2: Write failing test**

`tests/unit/db.settings.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestDb, type TestDb } from "@/tests/fixtures/test-db";
import { getSettings, updateSettings } from "@/lib/db/settings";
import { settings } from "@/lib/db/schema";

let tdb: TestDb;

beforeAll(async () => {
  tdb = await startTestDb();
  await tdb.db.insert(settings).values({ id: 1 });
}, 60_000);

afterAll(async () => {
  await tdb.cleanup();
});

describe("settings", () => {
  it("returns the singleton row", async () => {
    const s = await getSettings(tdb.db);
    expect(s.id).toBe(1);
    expect(s.dailyTarget).toBe(20);
    expect(s.theme).toBe("dark");
  });

  it("updates the daily target", async () => {
    await updateSettings(tdb.db, { dailyTarget: 35 });
    const s = await getSettings(tdb.db);
    expect(s.dailyTarget).toBe(35);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm test:unit
```

Expected: FAIL — `getSettings` / `updateSettings` not exported.

- [ ] **Step 4: Implement `lib/db/settings.ts`**

```ts
import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { settings } from "@/lib/db/schema";

export type Settings = typeof settings.$inferSelect;
export type SettingsUpdate = Partial<typeof settings.$inferInsert>;

export async function getSettings(db: Database): Promise<Settings> {
  const rows = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  const row = rows[0];
  if (!row) throw new Error("Settings row missing — run pnpm db:seed");
  return row;
}

export async function updateSettings(
  db: Database,
  patch: SettingsUpdate
): Promise<Settings> {
  const rows = await db
    .update(settings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(settings.id, 1))
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Failed to update settings");
  return row;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test:unit
```

Expected: PASS.

- [ ] **Step 6: Create the seed script**

`scripts/seed.ts`:

```ts
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { log } from "@/lib/log";

async function main() {
  await db
    .insert(settings)
    .values({ id: 1 })
    .onConflictDoNothing();
  log.info("seeded settings singleton");
  process.exit(0);
}

main().catch((err) => {
  log.error({ err }, "seed failed");
  process.exit(1);
});
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "db:seed": "tsx scripts/seed.ts"
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "add typed settings accessor, seed script, and testcontainer helper"
```

---

## Task 9: Build glass primitive components

**Files:**
- Create: `components/glass/GlassPanel.tsx`, `components/glass/GlassCard.tsx`, `tests/component/glass.test.tsx`

- [ ] **Step 1: Write failing test**

`tests/component/glass.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test:component
```

Expected: FAIL — components don't exist.

- [ ] **Step 3: Implement `components/glass/GlassPanel.tsx`**

```tsx
import { forwardRef, type ComponentPropsWithoutRef } from "react";

function cn(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export type GlassPanelProps = ComponentPropsWithoutRef<"div">;

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  function GlassPanel({ className, ...rest }, ref) {
    return <div ref={ref} className={cn("glass-panel", className)} {...rest} />;
  }
);
```

- [ ] **Step 4: Implement `components/glass/GlassCard.tsx`**

```tsx
import { forwardRef, type ComponentPropsWithoutRef } from "react";

function cn(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export type GlassCardProps = ComponentPropsWithoutRef<"div">;

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  function GlassCard({ className, ...rest }, ref) {
    return <div ref={ref} className={cn("glass-card", className)} {...rest} />;
  }
);
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test:component
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "add GlassPanel and GlassCard primitives with className merging and ref forwarding"
```

---

## Task 10: Build GlobalBackground component

**Files:**
- Create: `components/GlobalBackground.tsx`, `tests/component/GlobalBackground.test.tsx`

- [ ] **Step 1: Write failing test**

`tests/component/GlobalBackground.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test**

```bash
pnpm test:component tests/component/GlobalBackground.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `components/GlobalBackground.tsx`**

```tsx
export function GlobalBackground() {
  return (
    <div aria-hidden="true">
      <div className="watercolor-blob blob-1" />
      <div className="watercolor-blob blob-2" />
      <div className="watercolor-blob blob-3" />
      <div className="noise-overlay" />
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```bash
pnpm test:component tests/component/GlobalBackground.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "add GlobalBackground with three watercolor blobs and noise overlay"
```

---

## Task 11: Build FloatingHeader component

**Files:**
- Create: `components/FloatingHeader.tsx`, `tests/component/FloatingHeader.test.tsx`
- Modify: `package.json` — add a tiny `version` export helper if needed (not required; we'll read from package.json directly)

- [ ] **Step 1: Write failing test**

`tests/component/FloatingHeader.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test**

Expected: FAIL.

- [ ] **Step 3: Implement `components/FloatingHeader.tsx`**

```tsx
import { Brain, CaretDown } from "@phosphor-icons/react/dist/ssr";

export type FloatingHeaderProps = {
  workspace: string;
  version: string;
};

export function FloatingHeader({ workspace, version }: FloatingHeaderProps) {
  return (
    <header className="glass-panel fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 px-6 py-2.5 rounded-full text-xs font-medium tracking-wide">
      <div className="flex items-center gap-2 text-white">
        <Brain size={18} weight="regular" aria-hidden />
        <span>Learnings AI</span>
      </div>
      <div className="h-4 w-px bg-white/10" aria-hidden />
      <button
        type="button"
        className="text-white/60 flex items-center gap-2 cursor-pointer hover:text-white transition-colors"
        aria-label="Switch workspace"
      >
        <span>{workspace}</span>
        <CaretDown size={10} weight="regular" aria-hidden />
      </button>
      <div className="h-4 w-px bg-white/10" aria-hidden />
      <div className="font-mono text-white/40">v{version}</div>
    </header>
  );
}
```

- [ ] **Step 4: Run test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "add FloatingHeader with brand, workspace dropdown, and version pill"
```

---

## Task 12: Build Sidebar shell with primary nav and stubs

**Files:**
- Create: `components/Sidebar.tsx`, `tests/component/Sidebar.test.tsx`

In this plan, the sidebar's "Current Focus" and "Activity Stream" are stubs (empty list, all-zero heatmap). Plan 3 (Learning) populates them with real data.

- [ ] **Step 1: Write failing test**

`tests/component/Sidebar.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test**

Expected: FAIL.

- [ ] **Step 3: Implement `components/Sidebar.tsx`**

```tsx
import Link from "next/link";
import { Cards, MapTrifold, Plus } from "@phosphor-icons/react/dist/ssr";

export type SidebarProps = {
  userInitials: string;
  userName: string;
  level: number;
  activePath: "learning" | "planning";
};

export function Sidebar({ userInitials, userName, level, activePath }: SidebarProps) {
  return (
    <aside className="w-64 flex-shrink-0 glass-panel rounded-2xl flex flex-col overflow-hidden h-full">
      {/* Profile */}
      <div className="p-6 border-b border-white/5 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
          style={{
            background: "linear-gradient(45deg, #3b82f6, #8b5cf6)",
          }}
        >
          {userInitials}
        </div>
        <div>
          <div className="text-sm font-medium">{userName}</div>
          <div className="text-xs text-white/50">Level {level} Scholar</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-8">
        {/* Primary nav */}
        <nav className="flex flex-col gap-1" aria-label="Primary">
          <NavLink
            href="/learning"
            active={activePath === "learning"}
            icon={<Cards size={18} weight="regular" aria-hidden />}
            label="Learning"
          />
          <NavLink
            href="/planning"
            active={activePath === "planning"}
            icon={<MapTrifold size={18} weight="regular" aria-hidden />}
            label="Planning"
          />
        </nav>

        {/* Current Focus (stub — populated in Plan 3) */}
        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] uppercase tracking-widest text-white/40 font-semibold px-3 mb-1 flex justify-between items-center">
            <span>Current Focus</span>
            <button type="button" aria-label="Add focus area">
              <Plus size={12} className="cursor-pointer hover:text-white transition-colors" />
            </button>
          </h2>
          <p className="px-3 text-xs text-white/40 italic">No focus areas yet.</p>
        </section>

        {/* Activity Stream (stub — populated in Plan 3) */}
        <section className="mt-auto pt-4 border-t border-white/5">
          <h2 className="text-[10px] uppercase tracking-widest text-white/40 font-semibold px-3 mb-3">
            Activity Stream
          </h2>
          <div className="px-3 flex flex-wrap gap-1">
            {Array.from({ length: 21 }).map((_, i) => (
              <div
                key={i}
                data-testid="heatmap-cell"
                className="w-3 h-3 rounded-[2px] bg-white/5"
              />
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
          : "text-white/60 hover:text-white hover:bg-white/5"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
```

- [ ] **Step 4: Run test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "add Sidebar with avatar, nav, current focus stub, and 21-cell activity heatmap stub"
```

---

## Task 13: Wire `RootLayout` with fonts, background, header, sidebar

**Files:**
- Modify: `app/layout.tsx`, `app/page.tsx`
- Create: `app/learning/page.tsx`, `app/planning/page.tsx`, `app/settings/page.tsx`

- [ ] **Step 1: Replace `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import packageJson from "@/package.json";
import { GlobalBackground } from "@/components/GlobalBackground";
import { FloatingHeader } from "@/components/FloatingHeader";
import { Sidebar } from "@/components/Sidebar";
import "@/app/globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Learnings AI",
  description: "Personal AI engineering tool — review and plan.",
};

function deriveActivePath(pathname: string): "learning" | "planning" {
  if (pathname.startsWith("/planning")) return "planning";
  return "learning";
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/learning";

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <GlobalBackground />

        <div className="relative z-10 w-full h-full flex flex-col p-4 sm:p-6 lg:p-8">
          <FloatingHeader workspace="Gauntlet AI" version={packageJson.version} />

          <main className="flex-1 flex gap-6 w-full max-w-[1600px] mx-auto mt-16 h-[calc(100vh-140px)]">
            <Sidebar
              userInitials="DA"
              userName="Learner"
              level={1}
              activePath={deriveActivePath(pathname)}
            />
            <div className="flex-1 relative h-full">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Add `x-pathname` header forwarding**

Modify `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
```

Create `middleware.ts` (will be expanded in Task 14 for auth — for now just forwards path):

```ts
import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("x-pathname", req.nextUrl.pathname);
  return res;
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
```

- [ ] **Step 3: Replace `app/page.tsx`**

```tsx
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/learning");
}
```

- [ ] **Step 4: Create stub pages**

`app/learning/page.tsx`:

```tsx
import { GlassPanel } from "@/components/glass/GlassPanel";

export default function LearningPage() {
  return (
    <GlassPanel className="rounded-2xl h-full w-full p-12 flex items-center justify-center">
      <p className="text-white/60 text-lg">
        Learning surface — coming in the next plan.
      </p>
    </GlassPanel>
  );
}
```

`app/planning/page.tsx`:

```tsx
import { GlassPanel } from "@/components/glass/GlassPanel";

export default function PlanningPage() {
  return (
    <GlassPanel className="rounded-2xl h-full w-full p-12 flex items-center justify-center">
      <p className="text-white/60 text-lg">
        Planning surface — coming in the next plan.
      </p>
    </GlassPanel>
  );
}
```

`app/settings/page.tsx`:

```tsx
import { GlassPanel } from "@/components/glass/GlassPanel";

export default function SettingsPage() {
  return (
    <GlassPanel className="rounded-2xl h-full w-full p-12 flex items-center justify-center">
      <p className="text-white/60 text-lg">
        Settings — coming later.
      </p>
    </GlassPanel>
  );
}
```

- [ ] **Step 5: Run dev and visually check the shell**

```bash
pnpm dev
```

Open `http://localhost:3000`. Should redirect to `/learning`. Visually confirm:
- Watercolor blobs animate behind everything.
- Floating pill header centered top with "Learnings AI · Gauntlet AI · v0.1.0".
- Left sidebar with "DA" avatar, "Learner" name, "Level 1 Scholar", Learning highlighted, Planning visible, Current Focus stub, 21 dim heatmap cells.
- Center main panel says "Learning surface — coming in the next plan."

Stop with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "wire root layout with fonts, background, floating header, sidebar, and stub pages"
```

---

## Task 14: Implement auth — token validation, middleware, /auth page

**Files:**
- Create: `lib/auth/token.ts`, `lib/auth/cookie.ts`, `app/auth/page.tsx`, `app/auth/actions.ts`, `app/api/auth/logout/route.ts`, `tests/unit/auth.token.test.ts`, `tests/e2e/auth.spec.ts`
- Modify: `middleware.ts`

- [ ] **Step 1: Add cookie + token modules with tests**

`tests/unit/auth.token.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isValidToken } from "@/lib/auth/token";

describe("isValidToken", () => {
  it("rejects empty strings", () => {
    expect(isValidToken("", "x".repeat(32))).toBe(false);
  });

  it("rejects mismatched tokens", () => {
    expect(isValidToken("a".repeat(32), "b".repeat(32))).toBe(false);
  });

  it("accepts exact match using constant-time compare", () => {
    expect(isValidToken("a".repeat(32), "a".repeat(32))).toBe(true);
  });

  it("rejects tokens of different length even if prefix matches", () => {
    expect(isValidToken("a".repeat(32), "a".repeat(40))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test:unit
```

- [ ] **Step 3: Implement `lib/auth/cookie.ts`**

```ts
export const AUTH_COOKIE_NAME = "learnings_ai_auth";

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365, // 1 year
};
```

- [ ] **Step 4: Implement `lib/auth/token.ts`**

```ts
import { timingSafeEqual } from "node:crypto";

export function isValidToken(received: string, expected: string): boolean {
  if (!received || !expected) return false;
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
pnpm test:unit
```

- [ ] **Step 6: Wire auth into `middleware.ts`**

Replace `middleware.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/cookie";
import { isValidToken } from "@/lib/auth/token";

const PUBLIC_PATHS = new Set(["/auth", "/api/auth/logout", "/api/health"]);
const PUBLIC_PREFIXES = ["/_next/", "/favicon", "/og"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Pass-through for public assets / endpoints
  if (PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    const res = NextResponse.next();
    res.headers.set("x-pathname", pathname);
    return res;
  }

  const cookieValue = req.cookies.get(AUTH_COOKIE_NAME)?.value ?? "";
  const expected = process.env.LEARNINGS_AI_TOKEN ?? "";

  if (!isValidToken(cookieValue, expected)) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  res.headers.set("x-pathname", pathname);
  return res;
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
```

- [ ] **Step 7: Build the `/auth` page**

`app/auth/actions.ts`:

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS } from "@/lib/auth/cookie";
import { isValidToken } from "@/lib/auth/token";

export async function loginAction(formData: FormData): Promise<{ error?: string }> {
  const token = String(formData.get("token") ?? "").trim();
  const expected = process.env.LEARNINGS_AI_TOKEN ?? "";

  if (!isValidToken(token, expected)) {
    return { error: "Invalid token." };
  }

  const c = await cookies();
  c.set(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);

  const from = String(formData.get("from") ?? "/learning");
  redirect(from);
}
```

`app/auth/page.tsx`:

```tsx
import { GlassPanel } from "@/components/glass/GlassPanel";
import { loginAction } from "./actions";

type Props = {
  searchParams: Promise<{ from?: string; error?: string }>;
};

export default async function AuthPage({ searchParams }: Props) {
  const { from = "/learning", error } = await searchParams;

  return (
    <div className="h-full flex items-center justify-center">
      <GlassPanel className="rounded-2xl p-10 max-w-md w-full">
        <h1 className="text-2xl font-medium mb-2">Welcome back</h1>
        <p className="text-sm text-white/60 mb-6">
          Paste your access token to continue.
        </p>
        <form action={loginAction} className="flex flex-col gap-4">
          <input type="hidden" name="from" value={from} />
          <input
            type="password"
            name="token"
            required
            autoComplete="off"
            placeholder="LEARNINGS_AI_TOKEN"
            className="w-full px-4 py-3 rounded-lg bg-black/30 border border-white/10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error ? (
            <p className="text-red-400 text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity"
          >
            Unlock
          </button>
        </form>
      </GlassPanel>
    </div>
  );
}
```

`app/api/auth/logout/route.ts`:

```ts
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/cookie";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AUTH_COOKIE_NAME);
  return res;
}
```

- [ ] **Step 8: Update RootLayout to skip its sidebar/header chrome on `/auth`**

Modify `app/layout.tsx` to detect `/auth` and render bare:

Replace the `RootLayout` body return with:

```tsx
  const isAuth = pathname === "/auth";

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <GlobalBackground />
        <div className="relative z-10 w-full h-full flex flex-col p-4 sm:p-6 lg:p-8">
          {isAuth ? (
            <main className="flex-1 flex w-full max-w-[1600px] mx-auto h-[calc(100vh-80px)]">
              {children}
            </main>
          ) : (
            <>
              <FloatingHeader workspace="Gauntlet AI" version={packageJson.version} />
              <main className="flex-1 flex gap-6 w-full max-w-[1600px] mx-auto mt-16 h-[calc(100vh-140px)]">
                <Sidebar
                  userInitials="DA"
                  userName="Learner"
                  level={1}
                  activePath={deriveActivePath(pathname)}
                />
                <div className="flex-1 relative h-full">{children}</div>
              </main>
            </>
          )}
        </div>
      </body>
    </html>
  );
```

- [ ] **Step 9: Manually verify the full flow**

```bash
pnpm dev
```

1. Visit `http://localhost:3000` — redirects to `/auth?from=/learning`.
2. Paste a wrong token — see "Invalid token." error.
3. Paste the value from `.env.local`'s `LEARNINGS_AI_TOKEN` — redirects to `/learning`, sidebar visible.
4. Reload — stays on `/learning` (cookie persists).

Stop with Ctrl+C.

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "implement single-user auth: middleware token gate, /auth page, server action, logout"
```

---

## Task 15: Add `/api/health` endpoint

**Files:**
- Create: `app/api/health/route.ts`, `tests/e2e/health.spec.ts`

- [ ] **Step 1: Implement `app/api/health/route.ts`**

```ts
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import packageJson from "@/package.json";

export async function GET() {
  const dbStart = Date.now();
  let dbOk = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch (err) {
    log.error({ err }, "health: db check failed");
  }

  const status = dbOk ? 200 : 503;

  return NextResponse.json(
    {
      ok: dbOk,
      db_ok: dbOk,
      llm_ok: null, // wired up in Plan 2
      version: packageJson.version,
      checked_at: new Date().toISOString(),
      db_latency_ms: Date.now() - dbStart,
    },
    { status }
  );
}
```

- [ ] **Step 2: Add E2E test**

`tests/e2e/health.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("health endpoint reports ok with db connectivity", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.db_ok).toBe(true);
  expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
});
```

- [ ] **Step 3: Run E2E (after Task 16 sets up Playwright config)**

We'll defer running this until Task 16 is in place. For now just commit.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "add /api/health endpoint with db ping and version stamp"
```

---

## Task 16: Configure Playwright for E2E + visual regression

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/global-setup.ts`, `tests/e2e/shell.spec.ts`

- [ ] **Step 1: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    extraHTTPHeaders: {
      Cookie: `learnings_ai_auth=${process.env.LEARNINGS_AI_TOKEN ?? ""}`,
    },
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.001 },
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"] } },
    { name: "firefox-desktop", use: { ...devices["Desktop Firefox"] } },
    { name: "chromium-tablet", use: { ...devices["iPad Pro"] } },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
  },
});
```

- [ ] **Step 2: Create `tests/e2e/global-setup.ts`**

```ts
import type { FullConfig } from "@playwright/test";

async function globalSetup(_config: FullConfig) {
  if (!process.env.LEARNINGS_AI_TOKEN || process.env.LEARNINGS_AI_TOKEN.length < 32) {
    throw new Error(
      "LEARNINGS_AI_TOKEN must be set (≥32 chars) for Playwright tests."
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set for Playwright tests.");
  }
}

export default globalSetup;
```

- [ ] **Step 3: Add visual regression test for the shell**

`tests/e2e/shell.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("application shell", () => {
  test("learning route renders the full shell", async ({ page }) => {
    await page.goto("/learning");
    await expect(page.getByText("Learnings AI")).toBeVisible();
    await expect(page.getByText("Gauntlet AI")).toBeVisible();
    await expect(page.getByRole("link", { name: /Learning/ })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText(/Learning surface/)).toBeVisible();
  });

  test("planning route highlights planning nav", async ({ page }) => {
    await page.goto("/planning");
    await expect(page.getByRole("link", { name: /Planning/ })).toHaveAttribute("aria-current", "page");
  });

  test("learning shell visual baseline", async ({ page }) => {
    await page.goto("/learning");
    await page.waitForLoadState("networkidle");
    // Disable animations for stable screenshots
    await page.addStyleTag({
      content: `*, *::before, *::after { animation: none !important; transition: none !important; }`,
    });
    await expect(page).toHaveScreenshot("learning-shell.png", { fullPage: false });
  });
});
```

- [ ] **Step 4: Run Playwright once to generate baseline screenshots**

Make sure local Postgres is running and `.env.local` has the right values, then:

```bash
pnpm test:e2e --update-snapshots
```

Inspect the snapshots in `tests/e2e/shell.spec.ts-snapshots/` — they should look mockup-faithful (sidebar, header, blobs visible). Commit them.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "configure playwright with visual regression baseline for the shell across browsers"
```

---

## Task 17: Wire Sentry

**Files:**
- Create: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`
- Modify: `next.config.ts`

- [ ] **Step 1: Run the Sentry wizard**

```bash
pnpm exec @sentry/wizard@latest -i nextjs
```

Walk through the prompts: yes to source maps upload, accept default sample rates. The wizard creates the four config files; review them.

- [ ] **Step 2: Tighten the configs**

Replace the contents of the wizard-generated `sentry.server.config.ts` with:

```ts
import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";

Sentry.init({
  dsn: env.SENTRY_DSN,
  enabled: !!env.SENTRY_DSN && env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  profilesSampleRate: 0,
  environment: env.NODE_ENV,
  beforeSend(event) {
    // Strip headers that may leak the auth cookie
    if (event.request?.headers) {
      delete event.request.headers["cookie"];
      delete event.request.headers["authorization"];
    }
    return event;
  },
});
```

Apply parallel changes to `sentry.client.config.ts` (without the `beforeSend` headers stripping — client doesn't see them) and `sentry.edge.config.ts`.

- [ ] **Step 3: Smoke test by throwing a deliberate error in dev**

Add a temporary test route `app/api/_sentry-test/route.ts`:

```ts
export const dynamic = "force-dynamic";
export async function GET() {
  throw new Error("Sentry wiring smoke test");
}
```

`pnpm dev`, hit `http://localhost:3000/api/_sentry-test` — confirm the error reaches Sentry (or just confirm the local error logs show it tagged with sentry instrumentation). Then **delete the test route**.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "wire sentry with auth-header redaction and production-only sampling"
```

---

## Task 18: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

env:
  NODE_VERSION: "20"
  PNPM_VERSION: "9"

jobs:
  install:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: "${{ env.PNPM_VERSION }}" }
      - uses: actions/setup-node@v4
        with:
          node-version: "${{ env.NODE_VERSION }}"
          cache: pnpm
      - run: pnpm install --frozen-lockfile

  lint:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: "${{ env.PNPM_VERSION }}" }
      - uses: actions/setup-node@v4
        with:
          node-version: "${{ env.NODE_VERSION }}"
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  typecheck:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: "${{ env.PNPM_VERSION }}" }
      - uses: actions/setup-node@v4
        with:
          node-version: "${{ env.NODE_VERSION }}"
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck

  unit:
    needs: install
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready --health-interval 10s
          --health-timeout 5s --health-retries 5
    env:
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/test
      DATABASE_URL_UNPOOLED: postgres://postgres:postgres@localhost:5432/test
      LEARNINGS_AI_TOKEN: ${{ secrets.CI_LEARNINGS_AI_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: "${{ env.PNPM_VERSION }}" }
      - uses: actions/setup-node@v4
        with:
          node-version: "${{ env.NODE_VERSION }}"
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:migrate
      - run: pnpm test:unit
      - run: pnpm test:component

  build:
    needs: install
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: postgres://stub:stub@stub:5432/stub
      LEARNINGS_AI_TOKEN: ${{ secrets.CI_LEARNINGS_AI_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: "${{ env.PNPM_VERSION }}" }
      - uses: actions/setup-node@v4
        with:
          node-version: "${{ env.NODE_VERSION }}"
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build

  e2e:
    needs: install
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready --health-interval 10s
          --health-timeout 5s --health-retries 5
    env:
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/test
      DATABASE_URL_UNPOOLED: postgres://postgres:postgres@localhost:5432/test
      LEARNINGS_AI_TOKEN: ${{ secrets.CI_LEARNINGS_AI_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: "${{ env.PNPM_VERSION }}" }
      - uses: actions/setup-node@v4
        with:
          node-version: "${{ env.NODE_VERSION }}"
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps
      - run: pnpm db:migrate
      - run: pnpm db:seed
      - run: pnpm test:e2e
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 2: Configure required GitHub Secrets**

In the repo settings → Secrets and variables → Actions, add:
- `CI_LEARNINGS_AI_TOKEN` — a 32+ char random string (different from production)

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "add github actions ci with lint, typecheck, unit, component, build, and e2e jobs"
```

---

## Task 19: Author the first two ADRs

**Files:**
- Create: `docs/adr/0001-stack-choice.md`, `docs/adr/0002-glass-visual-system.md`

- [ ] **Step 1: Write `docs/adr/0001-stack-choice.md`**

```markdown
# 0001 — Stack choice: Next.js + Drizzle + Postgres + Railway

**Status:** Accepted (2026-04-27)

## Context

Building a personal AI engineering tool with two surfaces (Learning + Planning). Requirements: SSE streaming, server-rendered components, an embeddable vector store, a single deployment target, single-user auth.

## Decision

- **Framework:** Next.js (App Router) — Server Components + SSE streaming + first-class TypeScript.
- **ORM:** Drizzle — typed schema, migration tooling, no codegen step.
- **Database:** Postgres 16 with pgvector — keeps the data layer to one DB instead of running a separate vector store.
- **Hosting:** Railway — Postgres + Next.js in one project; supports long-running connections better than Vercel for SSE-heavy workloads.

## Alternatives considered

- **Vite + Express + Pinecone**: more components, no SSR, would need a second deploy target.
- **Qdrant for vectors**: better at scale but unnecessary for ~150 chunks.
- **Vercel**: simpler but Vercel's serverless model fights long SSE streams.

## Consequences

- One repo, one deploy, one DB.
- pgvector limits us to ~1M vectors before we'd want to migrate; well above this project's needs.
- Switching providers later is straightforward (Drizzle is portable to most Postgres).
```

- [ ] **Step 2: Write `docs/adr/0002-glass-visual-system.md`**

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "add adrs 0001 (stack choice) and 0002 (glass visual system)"
```

---

## Task 20: Add accessibility audit to E2E

**Files:**
- Create: `tests/e2e/a11y.spec.ts`

- [ ] **Step 1: Write the a11y test**

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ROUTES = [
  { path: "/learning", name: "learning" },
  { path: "/planning", name: "planning" },
  { path: "/settings", name: "settings" },
];

for (const route of ROUTES) {
  test(`${route.name} has no axe violations`, async ({ page }) => {
    await page.goto(route.path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test("/auth has no axe violations (unauthenticated)", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/auth");
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

- [ ] **Step 2: Run E2E**

```bash
pnpm test:e2e tests/e2e/a11y.spec.ts
```

Expected: PASS. If any violations surface, fix them in the corresponding component (most likely missing labels or insufficient contrast — Tailwind class adjustments).

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "add axe-core a11y audit across all routes"
```

---

## Task 21: Initial Railway deployment

**Files:**
- Create: `railway.toml`, `.github/workflows/deploy.yml`
- Modify: `package.json` (start script for production)

- [ ] **Step 1: Install Railway CLI and authenticate**

```bash
pnpm add -g @railway/cli
railway login
railway init   # answer prompts, link to existing or new project
```

- [ ] **Step 2: Add Postgres + pgvector service**

In the Railway dashboard or CLI:

```bash
railway add --plugin postgres
```

Once provisioned, in the Postgres service shell:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

(Or use Railway's pgvector template if it offers one out of the box.)

- [ ] **Step 3: Configure the web service env**

Set these env vars on the `web` service via `railway variables --set`:

```
DATABASE_URL=<from Postgres service "Connect" tab>
DATABASE_URL_UNPOOLED=<same, with ?pgbouncer=false if pooled>
LEARNINGS_AI_TOKEN=<32+ char random; generate with `openssl rand -hex 32`>
SENTRY_DSN=<from Sentry project>
LOG_LEVEL=info
NEXT_PUBLIC_APP_URL=https://<your-railway-domain>
NODE_ENV=production
```

- [ ] **Step 4: Create `railway.toml`**

```toml
[build]
builder = "NIXPACKS"
buildCommand = "pnpm install --frozen-lockfile && pnpm db:migrate && pnpm build"

[deploy]
startCommand = "pnpm start"
healthcheckPath = "/api/health"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

- [ ] **Step 5: Deploy and verify**

```bash
railway up
```

Wait for build + deploy. Once green:

```bash
curl https://<your-railway-domain>/api/health
```

Expected: `{ ok: true, db_ok: true, llm_ok: null, version: "0.1.0", ... }`.

Visit the URL in a browser → redirects to `/auth`. Paste the `LEARNINGS_AI_TOKEN` you set on Railway → see the empty shell.

- [ ] **Step 6: Add `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]

jobs:
  deploy:
    if: ${{ github.event.workflow_run.conclusion == 'success' || github.event_name == 'push' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Railway CLI
        run: npm install -g @railway/cli
      - name: Deploy
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        run: railway up --service web --detach
```

In GitHub Secrets, add `RAILWAY_TOKEN` (generated via `railway tokens create` against your project).

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "configure railway deployment with health-checked rollouts and ci-gated deploy workflow"
```

---

## Task 22: Generate `CLAUDE.md` for codebase context

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Author `CLAUDE.md` with codebase orientation**

```markdown
# Claude Code Context — Learnings AI

## What this project is

Personal AI engineering tool with two surfaces: a flashcard-based **Learning** review system over Gauntlet AI lecture material, and a wizard-driven **Planning** tab that produces senior-engineer-style system design walkthroughs from app ideas.

See [`PRD.md`](./PRD.md) for product intent and [`docs/superpowers/specs/2026-04-27-learnings-ai-design.md`](./docs/superpowers/specs/2026-04-27-learnings-ai-design.md) for the implementation spec. Visual fidelity to [`docs/design/lumina-style-reference.html`](./docs/design/lumina-style-reference.html).

## Stack

Next.js (App Router) + TypeScript (strict) + Tailwind v4 + shadcn/ui + Drizzle ORM + Postgres 16 + pgvector + OpenRouter (Claude Haiku/Sonnet, Voyage embeddings) + Railway.

## Where things live

- `app/` — Next.js routes and API endpoints. Per spec § 2.1.
- `components/` — UI primitives. `glass/` holds the design-system base components; everything else composes them.
- `lib/` — domain modules. Each subdirectory has one job (`auth/`, `db/`, `llm/`, `srs/`, `grading/`, `planning/`, `ingest/`, `retrieval/`, `log/`).
- `db/migrations/` — Drizzle Kit-generated SQL.
- `sources/` — Gauntlet markdown lectures (input to the ingest pipeline).
- `tests/{unit,component,e2e,fixtures}/` — three test layers + shared helpers.
- `docs/superpowers/{specs,plans}/` — product design + implementation plans.
- `docs/adr/` — architecture decision records (numbered).

## Conventions

- **TDD always** (per `~/.claude/rules/tdd.md`). Every behavior change starts with a failing test. Bug fixes start with a regression test.
- **Strict TypeScript**: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` all on.
- **Pure modules where possible**: `lib/srs/`, `lib/planning/stages/`, and graders are designed to take state in and return state out, no hidden side effects.
- **Single source of truth for config**: `lib/env.ts` validates and exports all env vars. Don't read `process.env` elsewhere.
- **Glass visual system**: every new surface composes `GlassPanel` / `GlassCard` rather than styling from scratch. Color tokens in `app/globals.css` `:root`.
- **Auth**: every protected route is gated by `middleware.ts`; `/auth`, `/api/health`, and logout are the only public paths.
- **Commits**: short imperative-style, lowercase start, single-sentence (per `~/.claude/rules/commit-message.md`). Include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>` for AI-assisted work.

## Common tasks

- New table → add to `lib/db/schema.ts`, run `pnpm db:generate`, review/edit the generated SQL, run `pnpm db:migrate`.
- New page → create under `app/<route>/page.tsx`. If protected, no extra work — middleware covers it.
- New LLM-touching server route → use `lib/llm/` client (added in Plan 2). Always log to `llm_calls`.
- New component → place in `components/<area>/`. Add a `tests/component/<name>.test.tsx`. Run `pnpm test:component`.

## What NOT to do

- Don't read `process.env` outside `lib/env.ts`.
- Don't issue raw SQL outside `lib/db/`. All queries go through Drizzle for parameterization + types.
- Don't add cookies / sessions / user tables. Single-user via env-secret token only.
- Don't skip the failing-test step. Even for visual changes, write a component test first.
- Don't expose `LEARNINGS_AI_TOKEN`, `OPENROUTER_API_KEY`, or any secret in logs (the pino redaction config catches common cases — but be careful in custom log calls).
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "add claude.md with codebase orientation and conventions"
```

---

## Self-Review

Walking the spec and verifying each Foundation requirement is implemented by a task in this plan:

| Spec section | Requirement | Plan task |
|---|---|---|
| § 2.1 | Routes (`/learning`, `/planning`, `/settings`, `/auth`, `/api/health`) | Tasks 13, 14, 15 |
| § 2.1 | API auth/logout | Task 14 |
| § 2.2 | `lib/auth`, `lib/db`, `lib/log`, `lib/env` (foundation modules) | Tasks 4, 6, 7, 8, 14 |
| § 2.4 | Cross-cutting: middleware auth, structured logging, Sentry, accessibility, TDD | Tasks 6, 14, 17, 20 |
| § 3 | Full Drizzle schema + initial migration with pgvector | Task 7 |
| § 3.4 | Settings singleton row + accessor | Task 8 |
| § 7.1 | CSS tokens, glass utilities, blob keyframes, reduced-motion | Task 3 |
| § 7.2 | RootLayout (background + header + sidebar + main) | Task 13 |
| § 7.3 | Sidebar with profile, primary nav, current focus stub, activity heatmap stub | Task 12 |
| § 8.1 | Repository structure | Task 2 |
| § 8.2 | `.env.example` (no values) | Task 2 |
| § 8.3 | Railway deployment + `/api/health` + pre-deploy migrations | Tasks 15, 21 |
| § 8.4 | GitHub Actions CI (lint, typecheck, unit, component, build, e2e, a11y) + deploy | Tasks 18, 21 |
| § 8.5 | pino logging + Sentry + `llm_calls` table | Tasks 6, 7, 17 |
| § 8.6 | Vitest config with coverage thresholds; Playwright with visual regression + a11y | Tasks 5, 16, 20 |
| § 8.7 | Strict CSP / HTTPS / HttpOnly+Secure+SameSite cookie / token timing-safe compare / pino redaction | Tasks 13 (next.config headers), 14, 6 |
| § 8.9 | README, CLAUDE.md, ADRs 0001 + 0002 | Tasks 2, 19, 22 |

**Out-of-scope for this plan** (deferred to later plans, intentionally):
- All Learning surface UI/logic, SM-2, queue, card editor, three card-type review flows → Plan 3.
- All Planning surface UI/logic, seven stages, mermaid validation, verification, export → Plan 4.
- Ingestion pipeline, chunker, embedder, concept/card generation, CLI → Plan 2.
- Settings page UI (only stub here), cost dashboard, model picker, source manager, theme switcher → Plan 5.
- ADRs 0003 (card types), 0004 (planner stages), 0005 (pgvector vs dedicated) → Plans 2/3/4.
- `docs/runbook.md` and `docs/qa-checklist.md` → Plan 5.
- LLM module `lib/llm/`, OpenRouter client, retry/backoff, cost tracking → Plan 2.
- The `/api/health` `llm_ok` field is currently `null` → set in Plan 2 once the LLM module exists.

**Type / signature consistency check:**
- `Settings` type exported from `lib/db/settings.ts` ✓ — used by future plans.
- `Database` type exported from `lib/db/index.ts` ✓ — used by `getSettings()`.
- `AUTH_COOKIE_NAME` constant from `lib/auth/cookie.ts` ✓ — used in middleware, action, logout, Playwright config.
- `isValidToken(received, expected)` signature used identically in `middleware.ts`, `auth/actions.ts`, and unit tests.
- `redactionPaths` exported from `lib/log/index.ts` ✓ — used in tests; would be useful when extending logging in Plan 2.

**Placeholder scan:** searched the plan for "TBD", "TODO", "implement later", "fill in details", "appropriate error handling", "Similar to". None found.

**Plan coverage:** every test step shows the actual test code; every implementation step shows the actual code. No "see Task N" handwaves.

---

## Done When

This plan is complete when:

1. All 22 tasks are checked off.
2. `pnpm test:unit && pnpm test:component && pnpm test:e2e` passes locally.
3. CI is green on `main`.
4. Railway deployment is live; `curl https://<domain>/api/health` returns 200 with `db_ok: true`.
5. Visiting the deployed URL in a browser shows the auth gate; pasting the prod `LEARNINGS_AI_TOKEN` reveals the empty shell with sidebar, header, and watercolor blobs animating.
6. `git status` is clean.

---

## Plan complete and saved to `docs/superpowers/plans/2026-04-27-foundation-bootstrap.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Good for a long plan like this where review-as-you-go catches drift early.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints for review. Lower overhead but loses the fresh-context advantage of subagents.

Which approach?

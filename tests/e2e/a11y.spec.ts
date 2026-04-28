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

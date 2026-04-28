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

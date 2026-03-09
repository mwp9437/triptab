import { test, expect } from "@playwright/test";
import { signUpGenerateAndSave } from "./helpers";

test.describe("Flow 6: Dashboard tab switching and sidebar", () => {
  test("switches between Plan Details and Expenses on desktop", async ({ page }) => {
    await signUpGenerateAndSave(page);

    // On desktop (1280px), sidebar should show "Plan Details" and "Expenses" toggle
    const planDetailsBtn = page.getByRole("button", { name: /Plan Details/ });
    const expensesBtn = page.getByRole("button", { name: /Expenses/ });

    // Plan Details should be active by default
    await expect(planDetailsBtn).toBeVisible({ timeout: 5_000 });
    await expect(expensesBtn).toBeVisible({ timeout: 5_000 });

    // Budget section should be visible in Plan Details
    await expect(page.getByText("Budget", { exact: true }).first()).toBeVisible();

    // Switch to Expenses
    await expensesBtn.click();

    // Should now show expenses panel (either "Add travelers first" or expense content)
    const expensesContent = page.getByText(/Add travelers first|No expenses|Spending Summary/).first();
    await expect(expensesContent).toBeVisible({ timeout: 5_000 });

    // Switch back to Plan Details
    await planDetailsBtn.click();
    await expect(page.getByText("Budget", { exact: true }).first()).toBeVisible({ timeout: 5_000 });
  });

  test("switches between Schedule, Details, and Expenses tabs on mobile", async ({ page }) => {
    // Sign up and generate at desktop size first (Save button needs text label)
    await signUpGenerateAndSave(page);

    // Now switch to mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);

    // Mobile tabs should appear
    const scheduleTab = page.getByRole("button", { name: /Schedule/ });
    const detailsTab = page.getByRole("button", { name: /Details/ });
    const expensesTab = page.getByRole("button", { name: /Expenses/ });

    await expect(scheduleTab).toBeVisible({ timeout: 5_000 });

    // Itinerary should be visible on Schedule tab
    await expect(page.getByRole("heading", { name: "Your Itinerary" })).toBeVisible();

    // Switch to Details
    await detailsTab.click();
    await page.waitForTimeout(300);

    // Budget or Action Items should appear
    await expect(page.getByText(/Budget|Action Items/).first()).toBeVisible({ timeout: 5_000 });

    // Switch to Expenses
    await expensesTab.click();
    await page.waitForTimeout(300);
    await expect(page.getByText(/Add travelers first|No expenses|Save your trip/).first()).toBeVisible({ timeout: 5_000 });

    // Switch back to Schedule
    await scheduleTab.click();
    await expect(page.getByRole("heading", { name: "Your Itinerary" })).toBeVisible({ timeout: 5_000 });
  });
});

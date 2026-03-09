import { test, expect } from "@playwright/test";
import { signUpGenerateAndSave } from "./helpers";

test.describe("Flow 8: Delete an expense", () => {
  test("adds an expense then deletes it", async ({ page }) => {
    await signUpGenerateAndSave(page);

    // Open Expenses tab
    await page.getByRole("button", { name: /Expenses/ }).first().click();

    // Open travelers manager and add self + another
    const manageTravelers = page.getByRole("button", { name: /Manage Travelers/ }).first();
    if (await manageTravelers.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await manageTravelers.click();
    } else {
      // Try header travelers button
      await page.locator("button:has(svg.lucide-users)").first().click();
    }
    await expect(page.getByRole("heading", { name: "Travelers" })).toBeVisible({ timeout: 5_000 });

    // Wait for auto-add of current user
    await page.waitForTimeout(2_000);

    // Add another traveler
    await page.getByPlaceholder("Name").fill("Bob");
    await page.locator("button:has(svg.lucide-plus)").last().click();
    await expect(page.getByText("Bob", { exact: true }).first()).toBeVisible({ timeout: 5_000 });

    // Close dialog
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // Add an expense
    const addExpenseBtn = page.getByRole("button", { name: /Add Expense/ }).first();
    await expect(addExpenseBtn).toBeVisible({ timeout: 10_000 });
    await addExpenseBtn.click();

    await page.waitForTimeout(500);
    await page.locator("input[type='number'][inputmode='decimal']").first().fill("25.00");
    await page.getByPlaceholder("What was this for?").fill("Coffee run");

    await page.getByRole("button", { name: /Add Expense/ }).last().click();
    await expect(page.getByText("Expense added", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1_000);

    // Verify expense appears in the list
    await expect(page.getByText("Coffee run", { exact: true }).first()).toBeVisible({ timeout: 5_000 });

    // Expand the expense
    await page.getByText("Coffee run", { exact: true }).first().click();

    // Click delete
    const deleteBtn = page.getByRole("button", { name: /Delete/ }).first();
    await expect(deleteBtn).toBeVisible({ timeout: 3_000 });
    await deleteBtn.click();

    // Confirm delete
    const confirmBtn = page.getByRole("button", { name: /Confirm Delete/ });
    await expect(confirmBtn).toBeVisible({ timeout: 3_000 });
    await confirmBtn.click();

    // Expense should be removed — toast confirms
    await expect(page.getByText("Expense deleted", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

    // "Coffee run" should no longer be in the list
    await page.waitForTimeout(1_000);
    await expect(page.getByText("Coffee run", { exact: true }).first()).not.toBeVisible({ timeout: 5_000 });
  });
});

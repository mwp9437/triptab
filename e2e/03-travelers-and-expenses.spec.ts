import { test, expect } from "@playwright/test";
import { signUp, fillWizardAndGenerate } from "./helpers";

test.describe("Flow 3: Add travelers and add an expense", () => {
  test("saves trip, adds a traveler, then logs an expense", async ({ page }) => {
    // Sign up and generate
    const email = await signUp(page);
    const url = page.url();
    if (!url.endsWith("/") && !url.includes("localhost:8080")) {
      test.skip(true, "Email confirmation required");
    }

    await fillWizardAndGenerate(page);

    // Save trip first (expenses require a saved trip)
    await page.getByRole("button", { name: /Save/ }).first().click();
    await expect(page.getByText("Saved!", { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    // Switch to Expenses tab
    const expensesTab = page.getByRole("button", { name: /Expenses/i });
    // On desktop it may be in the sidebar, on mobile it's a tab
    if (await expensesTab.isVisible()) {
      await expensesTab.click();
    } else {
      // Try the wallet icon tab on mobile
      await page.locator("button:has(svg)").filter({ hasText: /Expenses/ }).first().click();
    }

    // Should see "Save your trip first" or "Add travelers first" or "No expenses"
    // If travelers auto-added, we may see expense-ready state
    // Wait for traveler prompt or expense prompt
    await page.waitForTimeout(2_000);

    // Open Travelers dialog
    const manageTravelers = page.getByRole("button", { name: /Manage Travelers|Travelers/ }).first();
    if (await manageTravelers.isVisible()) {
      await manageTravelers.click();
    } else {
      // Use the travelers button in the header (Users icon)
      const travelersBtn = page.locator("button").filter({ has: page.locator("svg") }).getByText(/\d+/).first();
      if (await travelersBtn.isVisible()) {
        await travelersBtn.click();
      }
    }

    // Wait for Travelers dialog
    await expect(page.getByText("Travelers").first()).toBeVisible({ timeout: 5_000 });

    // The current user should have been auto-added. Add another traveler.
    await page.getByPlaceholder("Name").fill("Alice");
    await page.getByPlaceholder("Email (optional)").fill("alice@test.local");
    await page.getByRole("button").filter({ has: page.locator("svg.lucide-plus") }).last().click();

    // Wait for Alice to appear in the list
    await expect(page.getByText("Alice", { exact: true })).toBeVisible({ timeout: 5_000 });

    // Close travelers dialog
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // Now we should see the expenses view with "No expenses logged yet"
    // Click "Add Expense"
    const addExpenseBtn = page.getByRole("button", { name: /Add Expense/ }).first();
    await expect(addExpenseBtn).toBeVisible({ timeout: 10_000 });
    await addExpenseBtn.click();

    // Fill expense form
    await page.waitForTimeout(500);
    await page.locator("input[type='number'][inputmode='decimal']").first().fill("45.00");
    await page.getByPlaceholder("What was this for?").fill("Dinner at Shibuya");

    // Submit
    const submitBtn = page.getByRole("button", { name: /Add Expense/ }).last();
    await expect(submitBtn).toBeEnabled({ timeout: 3_000 });
    await submitBtn.click();

    // Should see success toast
    await expect(page.getByText("Expense added", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  });
});

import { test, expect } from "@playwright/test";
import { signUpGenerateAndSave } from "./helpers";

test.describe("Flow 7: Floating chat open/close/minimize", () => {
  test("opens chat, shows prompts, minimizes, restores, closes", async ({ page }) => {
    await signUpGenerateAndSave(page);

    // FAB button should be visible (MessageCircle icon)
    const fab = page.locator("button.rounded-full").filter({ has: page.locator("svg") }).last();
    await expect(fab).toBeVisible({ timeout: 5_000 });

    // Click FAB to open chat
    await fab.click();

    // Chat window should appear with "Edit Your Plan" header
    await expect(page.getByText("Edit Your Plan")).toBeVisible({ timeout: 5_000 });

    // Should show prompt suggestions
    await expect(page.getByText("Add ski après on Wednesday afternoon")).toBeVisible();
    await expect(page.getByText("Swap Day 2 lunch for ramen")).toBeVisible();

    // Should have input placeholder
    await expect(page.getByPlaceholder("Adjust your plan...")).toBeVisible();

    // Minimize chat
    const minimizeBtn = page.getByRole("button", { name: "Minimize" });
    await minimizeBtn.click();

    // Chat window should collapse, minimized bar should appear
    await expect(page.getByText("Chat minimized")).toBeVisible({ timeout: 3_000 });

    // Click minimized bar to restore
    await page.getByText("Chat minimized").click();
    await expect(page.getByText("Edit Your Plan")).toBeVisible({ timeout: 3_000 });

    // Close chat with X button
    const closeBtn = page.locator("button:has(svg.lucide-x)").first();
    await closeBtn.click();

    // Chat should be gone
    await expect(page.getByText("Edit Your Plan")).not.toBeVisible({ timeout: 3_000 });
  });

  test("sends a message via preset prompt", async ({ page }) => {
    await signUpGenerateAndSave(page);

    // Open chat
    const fab = page.locator("button.rounded-full").filter({ has: page.locator("svg") }).last();
    await fab.click();
    await expect(page.getByText("Edit Your Plan")).toBeVisible({ timeout: 5_000 });

    // Click a preset prompt
    await page.getByText("Find a cheaper hotel option").click();

    // User message should appear in the chat
    await expect(page.locator(".bg-primary\\/90").getByText("Find a cheaper hotel option")).toBeVisible({ timeout: 5_000 });

    // AI should start responding (spinner or assistant bubble appears)
    // Wait for either a response or a connection error (API may not be available)
    const response = page.locator(".bg-white\\/60").first();
    await expect(response).toBeVisible({ timeout: 30_000 });
  });
});

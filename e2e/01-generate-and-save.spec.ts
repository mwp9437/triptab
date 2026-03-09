import { test, expect } from "@playwright/test";
import { fillWizardAndGenerate, testEmail, TEST_PASSWORD } from "./helpers";

test.describe("Flow 1: Generate trip → sign up → save", () => {
  test("generates an itinerary, prompts auth on save, then saves", async ({ page }) => {
    // Generate a trip while logged out
    await fillWizardAndGenerate(page);

    // The dashboard should be visible with the plan
    await expect(page.getByRole("heading", { name: "Your Itinerary" })).toBeVisible();

    // Click Save — should trigger auth prompt since we're logged out
    const saveBtn = page.getByRole("button", { name: /Save/ }).first();
    await saveBtn.click();

    // Auth dialog should appear
    await expect(page.getByRole("heading", { name: "Sign in to save" })).toBeVisible({ timeout: 5_000 });

    // Switch to sign-up in the dialog
    await page.getByRole("button", { name: "Sign up" }).click();

    // Fill in sign-up form in the dialog
    const email = testEmail();
    await page.getByPlaceholder("Your name").fill("E2E Tester");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("••••••••").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /Create Account/ }).click();

    // After auth, the trip should auto-save (via pendingSaveRef)
    const savedToast = page.getByText("Saved!", { exact: true }).first();
    const confirmEmail = page.getByText(/Check your email/).first();

    // Either we get saved (auto-confirm off) or email confirmation needed
    const result = await Promise.race([
      savedToast.waitFor({ timeout: 15_000 }).then(() => "saved"),
      confirmEmail.waitFor({ timeout: 15_000 }).then(() => "needs-confirm"),
    ]);

    if (result === "saved") {
      await expect(savedToast).toBeVisible();
    } else {
      await expect(confirmEmail).toBeVisible();
    }
  });
});

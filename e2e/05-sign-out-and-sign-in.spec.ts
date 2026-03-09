import { test, expect } from "@playwright/test";
import { signUp, signIn, TEST_PASSWORD } from "./helpers";

test.describe("Flow 5: Sign out and sign back in", () => {
  test("signs out from dashboard, then signs back in to see trips", async ({ page }) => {
    const email = await signUp(page);

    // Verify we're on the home page (signed in)
    await expect(page.getByText("Where are you headed?")).toBeVisible({ timeout: 10_000 });

    // Navigate to auth page — should redirect since already logged in
    await page.goto("/auth");
    await page.waitForURL("/", { timeout: 10_000 });

    // Go back to home, navigate to my-trips
    await page.goto("/my-trips");
    await expect(page.getByText("My Trips", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

    // Sign out
    const signOutBtn = page.getByRole("button", { name: /Sign Out/ }).first();
    await signOutBtn.click();

    // Should redirect to home/auth
    await page.waitForTimeout(1_000);

    // Sign back in
    await signIn(page, email);

    // Should be on home after sign in
    await expect(page.getByText("Where are you headed?")).toBeVisible({ timeout: 10_000 });
  });
});

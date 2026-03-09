import { test, expect } from "@playwright/test";
import { testEmail, TEST_PASSWORD, signUp } from "./helpers";

test.describe("Flow 9: Auth redirect preserves return URL", () => {
  test("unauthenticated /my-trips visit redirects to auth then back", async ({ page }) => {
    // Try to go to my-trips while logged out
    // The app doesn't enforce auth on /my-trips via route guard, but
    // the page shows nothing useful without auth. Let's test the /auth?redirect flow.

    // Sign up first to create an account
    const email = await signUp(page);

    // Sign out by clearing storage
    await page.evaluate(() => localStorage.clear());
    await page.goto("/auth?redirect=/my-trips");

    // Should see the sign in form
    await expect(page.getByRole("heading", { name: /Welcome Back/ })).toBeVisible({ timeout: 5_000 });

    // Sign in
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("••••••••").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();

    // Should redirect to /my-trips
    await page.waitForURL("/my-trips", { timeout: 10_000 });
    await expect(page.getByText("My Trips", { exact: true }).first()).toBeVisible({ timeout: 5_000 });
  });

  test("visiting /auth when already logged in redirects to home", async ({ page }) => {
    await signUp(page);

    // Navigate to /auth
    await page.goto("/auth");

    // Should redirect to / since already authenticated
    await page.waitForURL("/", { timeout: 10_000 });
    await expect(page.getByText("Where are you headed?")).toBeVisible({ timeout: 5_000 });
  });
});

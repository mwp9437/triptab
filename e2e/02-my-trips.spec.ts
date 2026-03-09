import { test, expect } from "@playwright/test";
import { signUp, signIn, fillWizardAndGenerate, testEmail, TEST_PASSWORD } from "./helpers";

test.describe("Flow 2: Load a saved trip from My Trips", () => {
  let email: string;

  test("creates a trip, saves it, then loads it from My Trips", async ({ page }) => {
    // Sign up first
    email = await signUp(page);

    // Check if we landed on home or need email confirmation
    const url = page.url();
    if (!url.endsWith("/") && !url.includes("localhost:8080")) {
      test.skip(true, "Email confirmation required — cannot proceed without verified account");
    }

    // Fill wizard and generate trip
    await fillWizardAndGenerate(page);

    // Save the trip
    const saveBtn = page.getByRole("button", { name: /Save/ }).first();
    await saveBtn.click();
    await expect(page.getByText("Saved!", { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    // Navigate to My Trips
    await page.getByRole("button", { name: /My Trips/ }).click();
    await expect(page.getByText("My Trips")).toBeVisible({ timeout: 10_000 });
    await page.waitForURL("/my-trips", { timeout: 10_000 });

    // Should see at least one trip card with "Tokyo" in the title
    const tripCard = page.getByText("Tokyo, Japan").first();
    await expect(tripCard).toBeVisible({ timeout: 10_000 });

    // Click the trip card to load it
    await tripCard.click();

    // Should navigate back to "/" and show the loaded plan
    await page.waitForURL("/", { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Your Itinerary" })).toBeVisible({ timeout: 15_000 });
  });
});

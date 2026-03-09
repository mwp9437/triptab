import { Page, Locator, expect } from "@playwright/test";

/** Generate a unique test email */
export function testEmail(): string {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@test.local`;
}

export const TEST_PASSWORD = "TestPass123!";

/** Sign up via the auth page. Returns the email used. */
export async function signUp(page: Page, email?: string): Promise<string> {
  const e = email ?? testEmail();
  await page.goto("/auth");
  // Switch to sign-up mode
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.getByPlaceholder("Your name").fill("E2E Tester");
  await page.getByPlaceholder("you@example.com").fill(e);
  await page.getByPlaceholder("••••••••").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create Account" }).click();
  // Wait for either redirect (auto-confirmed) or confirmation message
  await Promise.race([
    page.waitForURL("/", { timeout: 10_000 }),
    page.getByText("Check your email").waitFor({ timeout: 10_000 }),
  ]);
  return e;
}

/** Sign in via the auth page */
export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/auth");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("/", { timeout: 10_000 });
}

/** Wait for a toast message (handles strict mode with aria-live region) */
export async function expectToast(page: Page, text: string | RegExp, timeout = 15_000): Promise<void> {
  const locator = typeof text === "string"
    ? page.getByText(text, { exact: true }).first()
    : page.getByText(text).first();
  await expect(locator).toBeVisible({ timeout });
}

/** Fill out the wizard and generate a trip plan */
export async function fillWizardAndGenerate(page: Page): Promise<void> {
  // Step 0 — Destination & Dates
  await page.goto("/");
  await expect(page.getByText("Where are you headed?")).toBeVisible({ timeout: 10_000 });

  // Fill destination
  const destInput = page.getByPlaceholder(/Hokkaido/);
  await destInput.fill("Tokyo");
  // Pick the autocomplete suggestion
  await page.getByText("Tokyo, Japan").first().click();

  // Fill departing from
  const homeInput = page.getByPlaceholder("Your home city");
  await homeInput.fill("New York");
  await page.getByText("New York, USA").first().click();

  // Open date picker and select dates
  await page.getByRole("button", { name: /Select trip dates/ }).click();
  // Navigate to a future month if needed, then pick two dates
  // Click the "next month" button to ensure we're on a future month
  await page.locator("button[name='next-month']").first().click();
  // Pick day 10 and day 14 from the visible calendar
  const day10 = page.getByRole("gridcell", { name: "10" }).first();
  const day14 = page.getByRole("gridcell", { name: "14" }).first();
  await day10.click();
  await day14.click();
  // Calendar should auto-close after range selected; wait briefly
  await page.waitForTimeout(500);

  // Set traveler type to "friends" and increase count
  await page.locator("text=Traveling as").locator("..").getByRole("combobox").click();
  await page.getByRole("option", { name: "Friend Group" }).click();
  // Increase group size to 3
  await page.getByRole("button", { name: "+" }).click();
  await page.getByRole("button", { name: "+" }).click();

  // Next → Step 1 (Preferences)
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page.getByText("Preferences & Budget")).toBeVisible({ timeout: 5_000 });

  // Select a vibe
  await page.getByRole("button", { name: "Foodie" }).click();

  // Submit — Build My Trip
  await page.getByRole("button", { name: /Build My Trip/ }).click();

  // Wait for dashboard to appear (spinner may be too brief to catch if generation fails fast)
  await expect(page.getByRole("heading", { name: "Your Itinerary" })).toBeVisible({ timeout: 90_000 });
}

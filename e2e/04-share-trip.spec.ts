import { test, expect } from "@playwright/test";
import { signUp, fillWizardAndGenerate } from "./helpers";

test.describe("Flow 4: Share a trip link", () => {
  test("saves trip, opens share modal, copies link", async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    // Sign up and generate
    await signUp(page);
    const url = page.url();
    if (!url.endsWith("/") && !url.includes("localhost:8080")) {
      test.skip(true, "Email confirmation required");
    }

    await fillWizardAndGenerate(page);

    // Save trip
    await page.getByRole("button", { name: /Save/ }).first().click();
    await expect(page.getByText("Saved!", { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    // Click Share button (should appear after trip has an ID)
    const shareBtn = page.getByRole("button", { name: /Share/ });
    await expect(shareBtn).toBeVisible({ timeout: 10_000 });
    await shareBtn.click();

    // Share modal should open
    await expect(page.getByText("Share Trip")).toBeVisible({ timeout: 5_000 });

    // Verify share URL is shown in the input
    const shareInput = page.locator("input[readonly]");
    await expect(shareInput).toBeVisible();
    const shareUrl = await shareInput.inputValue();
    expect(shareUrl).toContain("/trip/");
    expect(shareUrl).toContain("?role=viewer");

    // Copy link
    const copyBtn = page.locator("button:has(svg.lucide-copy)");
    await copyBtn.click();

    // Toast should confirm copy
    await expect(page.getByText("Link copied!", { exact: true }).first()).toBeVisible({ timeout: 5_000 });

    // Verify the share link contains a valid UUID pattern
    const tripIdMatch = shareUrl.match(/\/trip\/([a-f0-9-]+)/);
    expect(tripIdMatch).toBeTruthy();

    // Switch role to editor and verify URL updates
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Edit" }).click();
    const updatedUrl = await shareInput.inputValue();
    expect(updatedUrl).toContain("?role=editor");

    // Verify collaborators section exists
    await expect(page.getByText("Collaborators", { exact: true })).toBeVisible();
  });
});

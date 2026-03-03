import { test, expect } from "@playwright/test";

test.describe("GHCP UI", () => {
  test("loads the homepage with header and branding", async ({ page }) => {
    await page.goto("/");
    // Header should show GHCP UI branding
    await expect(page.locator("h1")).toContainText("GHCP");
    await expect(page.locator("h1")).toContainText("UI");
  });

  test("shows disconnected state initially", async ({ page }) => {
    await page.goto("/");
    // Should show disconnected indicator or no active session
    await expect(page.getByText("Disconnected")).toBeVisible();
  });

  test("has a sidebar toggle (hamburger menu)", async ({ page }) => {
    await page.goto("/");
    const menuButton = page.getByLabel("Toggle sidebar");
    await expect(menuButton).toBeVisible();
  });

  test("can open sidebar and see new chat button", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Toggle sidebar").click();
    await expect(page.getByRole("button", { name: "New Chat", exact: true })).toBeVisible();
  });

  test("can open new chat dialog", async ({ page }) => {
    await page.goto("/");
    // Open sidebar first
    await page.getByLabel("Toggle sidebar").click();
    await page.getByRole("button", { name: "New Chat", exact: true }).click();
    // Dialog should show model selector
    await expect(page.getByRole("heading", { name: "New Chat" })).toBeVisible();
  });

  test("has settings button that opens settings drawer", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Settings").click();
    await expect(page.getByText("Settings")).toBeVisible();
  });

  test("has workspace button that opens workspace panel", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Workspace files").click();
    await expect(page.getByText("Workspace Files")).toBeVisible();
  });

  test("input bar is disabled when no session is active", async ({ page }) => {
    await page.goto("/");
    const textarea = page.locator("textarea");
    await expect(textarea).toBeDisabled();
  });

  test("health API is accessible", async ({ request }) => {
    const res = await request.get("/api/healthz");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("healthy");
  });

  test("sessions API returns valid response", async ({ request }) => {
    const res = await request.get("/api/sessions");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("sessions");
    expect(Array.isArray(body.sessions)).toBeTruthy();
  });
});

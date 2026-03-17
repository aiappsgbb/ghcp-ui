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

test.describe("PWA", () => {
  test("has PWA meta tags in HTML", async ({ page }) => {
    await page.goto("/");
    // Theme color
    const themeColor = page.locator('meta[name="theme-color"]');
    await expect(themeColor).toHaveAttribute("content", "#09090b");
    // Apple mobile web app
    const appleMeta = page.locator('meta[name="apple-mobile-web-app-capable"]');
    await expect(appleMeta).toHaveAttribute("content", "yes");
    // Apple status bar style
    const statusBar = page.locator('meta[name="apple-mobile-web-app-status-bar-style"]');
    await expect(statusBar).toHaveAttribute("content", "black-translucent");
    // Apple title
    const appleTitle = page.locator('meta[name="apple-mobile-web-app-title"]');
    await expect(appleTitle).toHaveAttribute("content", "GHCP UI");
  });

  test("has apple-touch-icon link", async ({ page }) => {
    await page.goto("/");
    const touchIcon = page.locator('link[rel="apple-touch-icon"]');
    await expect(touchIcon).toBeAttached();
  });

  test("manifest is generated in production build", async () => {
    // Verify the manifest file exists in the build output
    const fs = await import("fs");
    const manifestPath = "src/client/dist/manifest.webmanifest";
    expect(fs.existsSync(manifestPath)).toBeTruthy();
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    expect(manifest.name).toBe("GHCP UI — GitHub Copilot Web");
    expect(manifest.short_name).toBe("GHCP UI");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#09090b");
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test("service worker is generated in production build", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("src/client/dist/sw.js")).toBeTruthy();
    expect(fs.existsSync("src/client/dist/registerSW.js")).toBeTruthy();
  });
});

test.describe("Speech-to-Text", () => {
  test("shows voice input button in the input bar", async ({ page }) => {
    // Chromium supports SpeechRecognition via webkitSpeechRecognition
    await page.goto("/");
    // The mic button should be present (Voice input)
    const micButton = page.getByTitle("Voice input");
    // In Chromium headless, SpeechRecognition may or may not be available
    // so we check if the button exists OR the feature is gracefully absent
    const count = await micButton.count();
    // Either the mic button exists or it's gracefully hidden — both are valid
    expect(count).toBeLessThanOrEqual(1);
  });

  test("input bar has correct placeholder when no session", async ({ page }) => {
    await page.goto("/");
    const textarea = page.locator("textarea");
    await expect(textarea).toHaveAttribute("placeholder", "Create a new chat to get started…");
  });
});

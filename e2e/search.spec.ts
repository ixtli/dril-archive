import { test, expect } from "@playwright/test";

test.describe("dril archive search", () => {
	test("page loads and search box appears", async ({ page }) => {
		await page.goto("/");

		// Wait for search container to appear (DB loaded, WASM initialized)
		const searchInput = page.locator("#search-input");
		await expect(searchInput).toBeVisible({ timeout: 15_000 });

		// Loading should be hidden once search is ready
		const loading = page.locator("#loading");
		await expect(loading).toBeHidden();
	});

	test("search returns results", async ({ page }) => {
		await page.goto("/");
		const searchInput = page.locator("#search-input");
		await expect(searchInput).toBeVisible({ timeout: 15_000 });

		await searchInput.fill("corn");

		// Wait for debounce + query
		const results = page.locator("#results");
		await expect(results.locator(".post")).toHaveCount(1, { timeout: 5_000 });

		// Verify it's the corn cob post
		await expect(results).toContainText("corn cob");
		// Verify the link to X is present
		await expect(
			results.locator('a[href="https://x.com/dril/status/5"]'),
		).toBeVisible();
	});

	test("reply metadata renders", async ({ page }) => {
		await page.goto("/");
		const searchInput = page.locator("#search-input");
		await expect(searchInput).toBeVisible({ timeout: 15_000 });

		await searchInput.fill("baby");

		const results = page.locator("#results");
		await expect(results.locator(".post")).toHaveCount(1, { timeout: 5_000 });

		// Verify reply-to metadata is shown
		await expect(results.locator(".post-reply-to")).toContainText(
			"replying to @someone",
		);
	});

	test("clear search clears results", async ({ page }) => {
		await page.goto("/");
		const searchInput = page.locator("#search-input");
		await expect(searchInput).toBeVisible({ timeout: 15_000 });

		// Type a query and wait for results
		await searchInput.fill("corn");
		const results = page.locator("#results");
		await expect(results.locator(".post")).toHaveCount(1, { timeout: 5_000 });

		// Clear the input
		await searchInput.fill("");

		// Results should be empty (no .post elements, no "no results" message)
		await expect(results).toBeEmpty();
	});

	test("no results state", async ({ page }) => {
		await page.goto("/");
		const searchInput = page.locator("#search-input");
		await expect(searchInput).toBeVisible({ timeout: 15_000 });

		await searchInput.fill("xyzgarbage123");

		const results = page.locator("#results");
		await expect(results).toContainText("no results", { timeout: 5_000 });
	});
});

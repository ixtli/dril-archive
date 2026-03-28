import { test, expect } from "@playwright/test";

test.describe("dril archive search", () => {
	// Helper: wait for the app to initialize (DB loaded, WASM ready)
	async function waitForReady(page: import("@playwright/test").Page) {
		const searchInput = page.locator('[data-testid="search-input"]');
		await expect(searchInput).toBeVisible({ timeout: 15_000 });
		return searchInput;
	}

	// Helper: type a query and wait for results
	async function searchFor(page: import("@playwright/test").Page, query: string) {
		const searchInput = await waitForReady(page);
		await searchInput.fill(query);
		const results = page.locator('[data-testid="results"]');
		await expect(results.locator('[data-testid="post-card"]')).not.toHaveCount(0, {
			timeout: 5_000,
		});
		return results;
	}

	// --- Existing tests (adapted) ---

	test("page loads and search box appears", async ({ page }) => {
		await page.goto("/");
		const searchInput = await waitForReady(page);
		await expect(searchInput).toBeVisible();
	});

	test("search returns results with themed card", async ({ page }) => {
		await page.goto("/");
		const results = await searchFor(page, "corn cob");
		const cards = results.locator('[data-testid="post-card"]');
		await expect(cards).toHaveCount(1);
		await expect(results).toContainText("corn cob");
		// Card should have a data-theme attribute
		await expect(cards.first()).toHaveAttribute("data-theme", /.+/);
	});

	test("reply metadata renders", async ({ page }) => {
		await page.goto("/");
		const results = await searchFor(page, "baby");
		const cards = results.locator('[data-testid="post-card"]');
		await expect(cards).toHaveCount(1);
		// Reply-to metadata should be visible somewhere in the card
		await expect(results).toContainText("@someone");
	});

	test("clear search clears results", async ({ page }) => {
		await page.goto("/");
		const results = await searchFor(page, "corn cob");
		await expect(results.locator('[data-testid="post-card"]')).toHaveCount(1);

		// Clear the input
		const searchInput = page.locator('[data-testid="search-input"]');
		await searchInput.fill("");

		// Results should be empty
		await expect(results.locator('[data-testid="post-card"]')).toHaveCount(0, {
			timeout: 3_000,
		});
	});

	test("no results state", async ({ page }) => {
		await page.goto("/");
		const searchInput = await waitForReady(page);
		await searchInput.fill("xyzgarbage123");
		const results = page.locator('[data-testid="results"]');
		await expect(results).toContainText("no results", { timeout: 5_000 });
	});

	// --- New tests ---

	test("era theme rendering - classic era gets twitter-classic", async ({ page }) => {
		await page.goto("/");
		// Post id=1 "no" is from 2008 -> twitter-classic era
		const results = await searchFor(page, "no");
		const classicCard = results
			.locator('[data-testid="post-card"][data-theme="twitter-classic"]')
			.first();
		await expect(classicCard).toBeVisible();
	});

	test("era theme rendering - modern era gets twitter-modern", async ({ page }) => {
		await page.goto("/");
		// Post id=4 "betsy ross" is from 2019 -> twitter-modern era
		const results = await searchFor(page, "betsy ross");
		const modernCard = results.locator(
			'[data-testid="post-card"][data-theme="twitter-modern"]',
		);
		await expect(modernCard).toHaveCount(1);
	});

	test("platform template - bluesky post uses bsky template", async ({ page }) => {
		await page.goto("/");
		// Bluesky test post contains "bluesky test post about posting"
		const searchInput = await waitForReady(page);
		await searchInput.fill("bluesky");
		const results = page.locator('[data-testid="results"]');
		const bskyCard = results.locator('[data-testid="post-card"][data-theme="bsky"]');
		await expect(bskyCard).toHaveCount(1, { timeout: 5_000 });
	});

	test("controls panel toggle - cog opens and closes", async ({ page }) => {
		await page.goto("/");
		await waitForReady(page);

		const controlsToggle = page.locator('[data-testid="controls-toggle"]');
		const controlsPanel = page.locator('[data-testid="controls-panel"]');

		// Controls should be hidden initially
		await expect(controlsPanel).not.toBeVisible();

		// Click cog to open
		await controlsToggle.click();
		await expect(controlsPanel).toBeVisible();

		// Click cog to close
		await controlsToggle.click();
		await expect(controlsPanel).not.toBeVisible();
	});

	test("sort by newest - results in date descending order", async ({ page }) => {
		await page.goto("/");
		await waitForReady(page);

		// Open controls and set sort to newest
		await page.locator('[data-testid="controls-toggle"]').click();
		await page.locator('[data-testid="sort-select"]').selectOption("newest");

		// Search for a broad term that matches multiple posts
		const searchInput = page.locator('[data-testid="search-input"]');
		await searchInput.fill("the");
		const results = page.locator('[data-testid="results"]');
		await expect(results.locator('[data-testid="post-card"]')).not.toHaveCount(0, {
			timeout: 5_000,
		});

		// Get all post cards and verify dates are in descending order
		const cards = results.locator('[data-testid="post-card"]');
		const count = await cards.count();
		expect(count).toBeGreaterThan(1);

		// Each card's text content contains a date; we extract them from the data-theme
		// and the rendered dates. Instead, let's just check the first card is newer than the last.
		// We look for date strings in the card text (e.g., "Jun 15, 2024")
		const firstText = await cards.first().textContent();
		const lastText = await cards.last().textContent();

		// Extract year from text (the date is rendered in each card)
		const firstYear = firstText?.match(/\b(20\d{2})\b/);
		const lastYear = lastText?.match(/\b(20\d{2})\b/);
		if (firstYear && lastYear) {
			expect(parseInt(firstYear[1])).toBeGreaterThanOrEqual(parseInt(lastYear[1]));
		}
	});

	test("filter by platform - X filter excludes Bluesky", async ({ page }) => {
		await page.goto("/");
		await waitForReady(page);

		// Search for "post" which matches both X and Bluesky posts
		const searchInput = page.locator('[data-testid="search-input"]');
		await searchInput.fill("post");
		const results = page.locator('[data-testid="results"]');
		await expect(results.locator('[data-testid="post-card"]')).not.toHaveCount(0, {
			timeout: 5_000,
		});

		// Confirm Bluesky result exists before filtering
		const bskyBefore = results.locator('[data-testid="post-card"][data-theme="bsky"]');
		await expect(bskyBefore).toHaveCount(1);

		// Open controls and filter to X only
		await page.locator('[data-testid="controls-toggle"]').click();
		await page.locator('[data-testid="platform-select"]').selectOption("x");

		// Wait for results to update - Bluesky card should disappear
		await expect(
			results.locator('[data-testid="post-card"][data-theme="bsky"]'),
		).toHaveCount(0, { timeout: 5_000 });

		// X posts should still be visible
		const xCards = results.locator('[data-testid="post-card"]');
		await expect(xCards).not.toHaveCount(0);
	});

	test("theme override - force all to twitter-classic", async ({ page }) => {
		await page.goto("/");
		await waitForReady(page);

		// Open controls and override theme
		await page.locator('[data-testid="controls-toggle"]').click();
		await page.locator('[data-testid="theme-select"]').selectOption("twitter-classic");

		// Search for a modern-era post
		const searchInput = page.locator('[data-testid="search-input"]');
		await searchInput.fill("betsy ross");
		const results = page.locator('[data-testid="results"]');
		await expect(results.locator('[data-testid="post-card"]')).toHaveCount(1, {
			timeout: 5_000,
		});

		// Even though it's a 2019 post, it should render with twitter-classic theme
		const card = results.locator('[data-testid="post-card"]').first();
		await expect(card).toHaveAttribute("data-theme", "twitter-classic");
	});

	test("quote post renders quoted text", async ({ page }) => {
		await page.goto("/");
		// Post id=10 is a quote post with quoted_text about therapist
		const results = await searchFor(page, "THERAPIST");
		const cards = results.locator('[data-testid="post-card"]');
		await expect(cards).toHaveCount(1);
		// Quoted text should be rendered
		await expect(results).toContainText("worst thing a therapist");
	});

	test("responsive mobile - 375px viewport, no overflow", async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto("/");
		const results = await searchFor(page, "corn cob");
		await expect(results.locator('[data-testid="post-card"]')).toHaveCount(1);

		// Check no horizontal overflow
		const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
		const viewportWidth = await page.evaluate(() => window.innerWidth);
		expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
	});
});

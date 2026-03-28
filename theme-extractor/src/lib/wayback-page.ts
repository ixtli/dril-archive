import { chromium, type Browser, type Page } from "playwright";
import type { RateLimiter } from "./rate-limiter.ts";
import type { WaybackSnapshot } from "./types.ts";

export interface LoadPageOptions {
	/** CSS selector to wait for before considering the page loaded. */
	waitForSelector?: string;
	/** Multiple selectors to try — first one found wins. */
	waitForSelectors?: string[];
	/** Timeout for waiting for selectors, in ms. Default: 30000. */
	waitForSelectorTimeout?: number;
	/** Whether to remove the Wayback Machine toolbar overlay. Default: true. */
	removeWaybackToolbar?: boolean;
	/** Number of retries on failure. Default: 2. */
	maxRetries?: number;
}

export interface LoadPageResult {
	page: Page;
	success: boolean;
	/** The selector that matched, if waitForSelectors was used. */
	matchedSelector?: string;
	error?: string;
}

/**
 * Playwright-based page loader for Wayback Machine snapshots.
 * Handles toolbar removal, retries, and rate limiting.
 */
export class WaybackPageLoader {
	private browser: Browser | null = null;

	constructor(private readonly rateLimiter: RateLimiter) {}

	/** Launch the browser. Must be called before loadPage. */
	async init(): Promise<void> {
		if (this.browser) return;
		this.browser = await chromium.launch({ headless: true });
	}

	/**
	 * Load a Wayback Machine page, wait for content, return the Page.
	 * The caller is responsible for closing the page when done.
	 */
	async loadPage(
		snapshot: WaybackSnapshot,
		options?: LoadPageOptions,
	): Promise<LoadPageResult> {
		if (!this.browser) {
			throw new Error("Browser not initialized. Call init() first.");
		}

		const maxRetries = options?.maxRetries ?? 2;
		const timeout = options?.waitForSelectorTimeout ?? 30_000;
		const removeToolbar = options?.removeWaybackToolbar ?? true;

		let lastError = "";

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			if (attempt > 0) {
				await this.rateLimiter.backoff(attempt);
			} else {
				await this.rateLimiter.wait();
			}

			const page = await this.browser.newPage();

			try {
				const response = await page.goto(snapshot.waybackUrl, {
					waitUntil: "domcontentloaded",
					timeout: 60_000,
				});

				if (!response || response.status() >= 400) {
					lastError = `HTTP ${response?.status() ?? "no response"}`;
					await page.close();
					continue;
				}

				// Remove Wayback Machine toolbar if present
				if (removeToolbar) {
					await page
						.evaluate(() => {
							for (const id of [
								"wm-ipp-base",
								"wm-ipp-print",
								"wm-ipp",
								"donato",
							]) {
								document.getElementById(id)?.remove();
							}
						})
						.catch(() => {
							/* toolbar may not exist */
						});
				}

				// Wait for content
				let matchedSelector: string | undefined;

				if (options?.waitForSelectors?.length) {
					// Try each selector, use the first one that resolves
					matchedSelector = await raceSelectors(
						page,
						options.waitForSelectors,
						timeout,
					);
					if (!matchedSelector) {
						lastError = `No selector matched: ${options.waitForSelectors.join(", ")}`;
						await page.close();
						continue;
					}
				} else if (options?.waitForSelector) {
					try {
						await page.waitForSelector(options.waitForSelector, {
							timeout,
						});
						matchedSelector = options.waitForSelector;
					} catch {
						lastError = `Selector not found: ${options.waitForSelector}`;
						await page.close();
						continue;
					}
				}

				return { page, success: true, matchedSelector };
			} catch (e) {
				lastError =
					e instanceof Error ? e.message : String(e);
				await page.close().catch(() => {});
			}
		}

		// All retries exhausted — return a dummy page with error
		const page = await this.browser.newPage();
		return { page, success: false, error: lastError };
	}

	/** Take a screenshot of a specific element. */
	async screenshotElement(
		page: Page,
		selector: string,
		outputPath: string,
	): Promise<void> {
		const element = await page.$(selector);
		if (element) {
			await element.screenshot({ path: outputPath });
		}
	}

	/** Close the browser and clean up. */
	async close(): Promise<void> {
		if (this.browser) {
			await this.browser.close();
			this.browser = null;
		}
	}
}

/**
 * Try multiple selectors concurrently, return the first one that matches.
 */
async function raceSelectors(
	page: Page,
	selectors: string[],
	timeout: number,
): Promise<string | undefined> {
	const result = await Promise.race([
		...selectors.map(async (sel) => {
			try {
				await page.waitForSelector(sel, { timeout });
				return sel;
			} catch {
				return undefined;
			}
		}),
		// Overall timeout fallback
		new Promise<undefined>((resolve) => setTimeout(resolve, timeout)),
	]);
	return result;
}

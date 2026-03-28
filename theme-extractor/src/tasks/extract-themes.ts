/**
 * extract-themes: Load Wayback Machine snapshots from the sample manifest
 * and extract DOM structure, computed CSS styles, and screenshots.
 *
 * Usage: bun run extract:themes
 *
 * Reads:  data/sample-manifest.json
 * Outputs: data/wayback/{theme}/{content_type}/
 *            dom.html, styles.json, screenshot.png, metadata.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "playwright";
import { ProgressTracker } from "../lib/progress.ts";
import { RateLimiter } from "../lib/rate-limiter.ts";
import { getTweetContainerSelectors } from "../lib/tweet-selectors.ts";
import type {
	ContentType,
	ExtractedStyles,
	SampleManifest,
	TwitterEra,
} from "../lib/types.ts";
import { waybackUrl } from "../lib/types.ts";
import { WaybackPageLoader } from "../lib/wayback-page.ts";

const DATA_DIR = resolve(import.meta.dirname, "../../data");

/** CSS properties we care about for theme reproduction. */
const STYLE_PROPERTIES = [
	"backgroundColor",
	"color",
	"fontFamily",
	"fontSize",
	"fontWeight",
	"lineHeight",
	"letterSpacing",
	"textDecoration",
	"padding",
	"paddingTop",
	"paddingRight",
	"paddingBottom",
	"paddingLeft",
	"margin",
	"marginTop",
	"marginRight",
	"marginBottom",
	"marginLeft",
	"border",
	"borderTop",
	"borderRight",
	"borderBottom",
	"borderLeft",
	"borderRadius",
	"boxShadow",
	"width",
	"maxWidth",
	"height",
	"display",
	"flexDirection",
	"alignItems",
	"gap",
	"position",
];

/**
 * Extract computed styles from all significant descendant elements.
 * Walks the DOM tree and captures styles for each element with content or styling.
 */
async function extractStyles(
	page: Page,
	containerSelector: string,
): Promise<ExtractedStyles> {
	return page.evaluate(
		({ selector, properties }) => {
			const container = document.querySelector(selector);
			if (!container) return {};

			const styles: Record<string, Record<string, string>> = {};

			const walkElement = (el: Element, path: string) => {
				const computed = getComputedStyle(el);
				const styleMap: Record<string, string> = {};

				for (const prop of properties) {
					const value = computed.getPropertyValue(
						// Convert camelCase to kebab-case
						prop.replace(/([A-Z])/g, "-$1").toLowerCase(),
					);
					if (value) {
						styleMap[prop] = value;
					}
				}

				styles[path] = styleMap;

				// Walk children
				for (let i = 0; i < el.children.length; i++) {
					const child = el.children[i];
					const tag = child.tagName.toLowerCase();
					const cls = child.className
						? `.${String(child.className).split(/\s+/).join(".")}`
						: "";
					walkElement(child, `${path} > ${tag}${cls}:nth-child(${i + 1})`);
				}
			};

			walkElement(container, selector);
			return styles;
		},
		{ selector: containerSelector, properties: STYLE_PROPERTIES },
	);
}

async function main() {
	const manifestPath = resolve(DATA_DIR, "sample-manifest.json");
	if (!existsSync(manifestPath)) {
		console.error(
			"sample-manifest.json not found. Run `bun run discover` first.",
		);
		process.exit(1);
	}

	const manifest: SampleManifest = JSON.parse(
		readFileSync(manifestPath, "utf-8"),
	);

	const rateLimiter = new RateLimiter(10_000, 5_000);
	const pageLoader = new WaybackPageLoader(rateLimiter);
	const progress = new ProgressTracker(
		resolve(DATA_DIR, "wayback/progress.json"),
	);

	await pageLoader.init();

	const eras = Object.keys(manifest).filter(
		(k) => k !== "profiles",
	) as TwitterEra[];
	const contentTypes: ContentType[] = [
		"plain",
		"reply",
		"quote",
		"photo",
		"video",
		"retweet",
	];

	try {
		for (const era of eras) {
			const eraData = manifest[era] ?? {};

			for (const ct of contentTypes) {
				const entry = eraData[ct];
				if (!entry) continue;

				const key = `${era}/${ct}`;
				if (progress.isProcessed(key)) {
					console.log(`  ${key}: already processed, skipping`);
					continue;
				}

				console.log(
					`\nExtracting ${key} — post ${entry.postId} @ ${entry.waybackTimestamp}`,
				);

				const url = waybackUrl(
					entry.waybackTimestamp,
					`https://twitter.com/dril/status/${entry.postId}`,
				);

				const containerSelectors = getTweetContainerSelectors(era);
				const { page, success, matchedSelector, error } =
					await pageLoader.loadPage(
						{
							waybackTimestamp: entry.waybackTimestamp,
							waybackUrl: url,
							originalUrl: `twitter.com/dril/status/${entry.postId}`,
							postId: entry.postId,
						},
						{ waitForSelectors: containerSelectors },
					);

				if (!success) {
					console.error(`  Failed: ${error}`);
					progress.markFailed(key, error ?? "unknown error");
					await page.close();
					continue;
				}

				// Prepare output directory
				const outDir = resolve(DATA_DIR, "wayback", era, ct);
				mkdirSync(outDir, { recursive: true });

				// Extract DOM
				const domHtml = await page.evaluate((sel) => {
					const el = document.querySelector(sel);
					return el?.innerHTML ?? "";
				}, matchedSelector!);
				writeFileSync(resolve(outDir, "dom.html"), domHtml);

				// Extract styles
				const styles = await extractStyles(page, matchedSelector!);
				writeFileSync(
					resolve(outDir, "styles.json"),
					JSON.stringify(styles, null, "\t") + "\n",
				);

				// Screenshot
				await pageLoader.screenshotElement(
					page,
					matchedSelector!,
					resolve(outDir, "screenshot.png"),
				);

				// Metadata
				const metadata = {
					postId: entry.postId,
					era,
					contentType: ct,
					waybackTimestamp: entry.waybackTimestamp,
					waybackUrl: url,
					matchedSelector,
					extractedAt: new Date().toISOString(),
				};
				writeFileSync(
					resolve(outDir, "metadata.json"),
					JSON.stringify(metadata, null, "\t") + "\n",
				);

				progress.markProcessed(key, metadata);
				console.log(`  Done: ${outDir}`);

				await page.close();
			}
		}
	} finally {
		await pageLoader.close();
	}

	const stats = progress.getStats();
	console.log(
		`\nComplete: ${stats.processed} processed, ${stats.failed} failed`,
	);
}

main();

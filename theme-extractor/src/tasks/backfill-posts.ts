/**
 * backfill-posts: Crawl Wayback Machine snapshots to recover missing posts
 * from the 2023-01-01 to 2024-06-01 gap period.
 *
 * Usage: bun run backfill [-- --batch-size 50] [-- --from 20230101] [-- --to 20240601]
 *
 * Outputs: data/backfill/recovered-posts.ndjson
 *          data/backfill/recovered-media.ndjson
 *
 * Designed for incremental runs — safe to interrupt and resume.
 */

import Database from "better-sqlite3";
import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import type { Page } from "playwright";
import { CdxClient } from "../lib/cdx.ts";
import { ProgressTracker } from "../lib/progress.ts";
import { RateLimiter } from "../lib/rate-limiter.ts";
import {
	getEngagementSelectors,
	getQuotedTweetSelectors,
	getReplyContextSelectors,
	getTweetContainerSelectors,
	getTweetTextSelectors,
	getTimestampSelectors,
} from "../lib/tweet-selectors.ts";
import type { ExtractedPost, WaybackSnapshot } from "../lib/types.ts";
import { extractPostId, waybackUrl } from "../lib/types.ts";
import { WaybackPageLoader } from "../lib/wayback-page.ts";

const DATA_DIR = resolve(import.meta.dirname, "../../data");
const BACKFILL_DIR = resolve(DATA_DIR, "backfill");

const DEFAULT_FROM = "20230101";
const DEFAULT_TO = "20240601";
const DEFAULT_BATCH_SIZE = 100;

function parseArgs(): { from: string; to: string; batchSize: number; dbPath: string } {
	const args = process.argv.slice(2);
	let from = DEFAULT_FROM;
	let to = DEFAULT_TO;
	let batchSize = DEFAULT_BATCH_SIZE;
	let dbPath = resolve(import.meta.dirname, "../../..", "site/dril.db");

	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case "--from":
				from = args[++i];
				break;
			case "--to":
				to = args[++i];
				break;
			case "--batch-size":
				batchSize = parseInt(args[++i], 10);
				break;
			case "--db":
				dbPath = resolve(args[++i]);
				break;
		}
	}

	return { from, to, batchSize, dbPath };
}

/**
 * Try to extract text from the first matching selector.
 */
async function extractText(
	page: Page,
	selectors: string[],
): Promise<string | null> {
	for (const sel of selectors) {
		const text = await page
			.evaluate((s) => {
				const el = document.querySelector(s);
				return el?.textContent?.trim() ?? null;
			}, sel)
			.catch(() => null);
		if (text) return text;
	}
	return null;
}

/**
 * Try to extract a datetime attribute from the first matching selector.
 */
async function extractDatetime(
	page: Page,
	selectors: string[],
): Promise<string | null> {
	for (const sel of selectors) {
		const dt = await page
			.evaluate((s) => {
				const el = document.querySelector(s);
				if (el instanceof HTMLTimeElement) return el.dateTime;
				return el?.getAttribute("datetime") ?? null;
			}, sel)
			.catch(() => null);
		if (dt) return dt;
	}
	return null;
}

/**
 * Parse an engagement count string like "42K" or "1,234" into a number.
 */
function parseEngagement(text: string | null): number {
	if (!text) return 0;
	const cleaned = text.replace(/[,\s]/g, "").trim();
	if (cleaned.endsWith("K") || cleaned.endsWith("k")) {
		return Math.round(parseFloat(cleaned) * 1000);
	}
	if (cleaned.endsWith("M") || cleaned.endsWith("m")) {
		return Math.round(parseFloat(cleaned) * 1_000_000);
	}
	const n = parseInt(cleaned, 10);
	return isNaN(n) ? 0 : n;
}

/**
 * Extract post content from a rendered Wayback Machine tweet page.
 */
async function extractPostFromPage(
	page: Page,
	postId: string,
): Promise<ExtractedPost | null> {
	// This period is entirely in the "twitter-modern" era
	const era = "twitter-modern" as const;

	// Extract tweet text
	const text = await extractText(page, getTweetTextSelectors(era));
	if (!text) return null;

	// Extract timestamp
	const createdAt = await extractDatetime(page, getTimestampSelectors(era));

	// Check if reply
	const replyText = await extractText(page, getReplyContextSelectors(era));
	const isReply = !!replyText;
	let replyToUser: string | null = null;
	if (replyText) {
		const match = replyText.match(/@(\w+)/);
		replyToUser = match?.[1] ?? null;
	}

	// Check if quote tweet
	const quotedText = await extractText(page, getQuotedTweetSelectors(era));
	const isQuote = !!quotedText;

	// Engagement counts
	const engSelectors = getEngagementSelectors(era);
	const likesText = await extractText(page, engSelectors.likes);
	const sharesText = await extractText(page, engSelectors.retweets);

	return {
		id: postId,
		platform: "x",
		text,
		createdAt: createdAt ?? "",
		isReply,
		replyToUser,
		isQuote,
		quotedText,
		likes: parseEngagement(likesText),
		shares: parseEngagement(sharesText),
	};
}

/**
 * Convert an ExtractedPost to the normalizer's NDJSON format.
 */
function toNdjsonLine(post: ExtractedPost): string {
	return JSON.stringify({
		id: post.id,
		text: post.text,
		created_at: post.createdAt,
		is_reply: post.isReply,
		reply_to_user: post.replyToUser,
		is_quote: post.isQuote,
		quoted_text: post.quotedText,
		likes: post.likes,
		shares: post.shares,
	});
}

async function main() {
	const { from, to, batchSize, dbPath } = parseArgs();

	mkdirSync(BACKFILL_DIR, { recursive: true });

	console.log(`Backfill: ${from} to ${to}, batch size ${batchSize}`);

	// Step 1: Discover available snapshots
	console.log("\nStep 1: Discovering available Wayback snapshots...");
	const cdxRateLimiter = new RateLimiter(5_000, 2_000);
	const cdx = new CdxClient(cdxRateLimiter, resolve(DATA_DIR, ".cdx-cache"));

	const snapshots = await cdx.query("twitter.com/dril/status/*", {
		from,
		to,
		statusFilter: 200,
		collapseField: "urlkey", // one snapshot per unique URL
		fields: ["timestamp", "original", "statuscode"],
	});

	console.log(`  Found ${snapshots.length} snapshots in Wayback Machine`);

	// Extract unique post IDs
	const snapshotsByPostId = new Map<string, WaybackSnapshot>();
	for (const r of snapshots) {
		const postId = extractPostId(r.originalUrl);
		if (!postId) continue;
		// Keep the most recent snapshot per post
		const existing = snapshotsByPostId.get(postId);
		if (!existing || r.timestamp > existing.waybackTimestamp) {
			snapshotsByPostId.set(postId, {
				waybackTimestamp: r.timestamp,
				waybackUrl: waybackUrl(r.timestamp, r.originalUrl),
				originalUrl: r.originalUrl,
				postId,
			});
		}
	}

	console.log(`  ${snapshotsByPostId.size} unique post IDs`);

	// Step 2: Filter against existing archive
	let existingIds = new Set<string>();
	if (existsSync(dbPath)) {
		console.log("\nStep 2: Filtering against existing archive...");
		const db = new Database(dbPath, { readonly: true });
		const rows = db
			.prepare("SELECT id FROM posts WHERE platform = 'x'")
			.all() as Array<{ id: string }>;
		existingIds = new Set(rows.map((r) => r.id));
		db.close();
		console.log(`  ${existingIds.size} existing posts in archive`);
	} else {
		console.log("\nStep 2: No database found, skipping dedup filter");
	}

	const missingPostIds = [...snapshotsByPostId.keys()].filter(
		(id) => !existingIds.has(id),
	);
	console.log(`  ${missingPostIds.length} posts missing from archive`);

	// Step 3: Extract posts with progress tracking
	const progress = new ProgressTracker(
		resolve(BACKFILL_DIR, "progress.json"),
	);
	const pending = progress.getPending(missingPostIds);
	const batch = pending.slice(0, batchSize);

	console.log(
		`\nStep 3: Extracting ${batch.length} posts (${pending.length} total pending)`,
	);

	if (batch.length === 0) {
		console.log("Nothing to do!");
		const stats = progress.getStats(missingPostIds.length);
		console.log(
			`  Processed: ${stats.processed}, Failed: ${stats.failed}, Pending: ${stats.pending}`,
		);
		return;
	}

	const postsPath = resolve(BACKFILL_DIR, "recovered-posts.ndjson");
	const pageRateLimiter = new RateLimiter(10_000, 5_000);
	const pageLoader = new WaybackPageLoader(pageRateLimiter);

	await pageLoader.init();

	let extracted = 0;
	let failed = 0;

	try {
		for (const postId of batch) {
			const snapshot = snapshotsByPostId.get(postId)!;
			console.log(
				`\n  [${extracted + failed + 1}/${batch.length}] Post ${postId} @ ${snapshot.waybackTimestamp}`,
			);

			const containerSelectors = getTweetContainerSelectors("twitter-modern");
			const { page, success, error } = await pageLoader.loadPage(snapshot, {
				waitForSelectors: containerSelectors,
			});

			if (!success) {
				console.error(`    Failed to load: ${error}`);
				progress.markFailed(postId, error ?? "unknown error");
				failed++;
				await page.close();
				continue;
			}

			const post = await extractPostFromPage(page, postId);
			await page.close();

			if (!post || !post.text) {
				console.error("    Failed to extract post content");
				progress.markFailed(postId, "no text extracted");
				failed++;
				continue;
			}

			appendFileSync(postsPath, toNdjsonLine(post) + "\n");
			progress.markProcessed(postId, {
				createdAt: post.createdAt,
				textLength: post.text.length,
			});
			extracted++;
			console.log(
				`    OK: "${post.text.slice(0, 60)}${post.text.length > 60 ? "..." : ""}"`,
			);
		}
	} finally {
		await pageLoader.close();
	}

	console.log(`\nBatch complete: ${extracted} extracted, ${failed} failed`);
	const stats = progress.getStats(missingPostIds.length);
	console.log(
		`Overall: ${stats.processed} processed, ${stats.failed} failed, ${stats.pending} pending`,
	);
	if (stats.pending > 0) {
		console.log("Run again to continue processing remaining posts.");
	}
}

main();

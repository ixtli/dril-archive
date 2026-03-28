/**
 * extract-profiles: Load Wayback Machine profile page snapshots
 * and extract display name, bio, and avatar images.
 *
 * Usage: bun run extract:profiles
 *
 * Reads:  data/sample-manifest.json
 * Outputs: data/profile/snapshots.ndjson, data/profile/avatars/*.jpg
 */

import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { ProgressTracker } from "../lib/progress.ts";
import { RateLimiter } from "../lib/rate-limiter.ts";
import { getProfileSelectors } from "../lib/tweet-selectors.ts";
import type { SampleManifest, TwitterEra } from "../lib/types.ts";
import { getAutoTheme, waybackUrl } from "../lib/types.ts";
import { WaybackPageLoader } from "../lib/wayback-page.ts";

const DATA_DIR = resolve(import.meta.dirname, "../../data");
const PROFILE_DIR = resolve(DATA_DIR, "profile");
const AVATAR_DIR = resolve(PROFILE_DIR, "avatars");

/** Determine which Twitter era a Wayback timestamp falls into. */
function eraFromTimestamp(ts: string): TwitterEra {
	// Wayback timestamps are YYYYMMDDHHMMSS — convert to ISO-ish
	const isoish = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
	return getAutoTheme("x", isoish) as TwitterEra;
}

/**
 * Try each selector in order, return the text content of the first match.
 */
async function extractText(
	page: import("playwright").Page,
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
 * Try each selector in order, return the src attribute of the first match.
 */
async function extractImageSrc(
	page: import("playwright").Page,
	selectors: string[],
): Promise<string | null> {
	for (const sel of selectors) {
		const src = await page
			.evaluate((s) => {
				const el = document.querySelector(s);
				if (el instanceof HTMLImageElement) return el.src;
				// Try finding an img inside the matched element
				const img = el?.querySelector("img");
				return img?.src ?? null;
			}, sel)
			.catch(() => null);

		if (src) return src;
	}
	return null;
}

async function downloadAvatar(
	imageUrl: string,
	outputPath: string,
): Promise<boolean> {
	try {
		const response = await fetch(imageUrl);
		if (!response.ok) return false;
		const buffer = Buffer.from(await response.arrayBuffer());
		writeFileSync(outputPath, buffer);
		return true;
	} catch {
		return false;
	}
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

	if (!manifest.profiles || manifest.profiles.length === 0) {
		console.error("No profile snapshots in manifest.");
		process.exit(1);
	}

	mkdirSync(AVATAR_DIR, { recursive: true });

	const rateLimiter = new RateLimiter(10_000, 5_000);
	const pageLoader = new WaybackPageLoader(rateLimiter);
	const progress = new ProgressTracker(
		resolve(PROFILE_DIR, "progress.json"),
	);

	const snapshotsPath = resolve(PROFILE_DIR, "snapshots.ndjson");

	await pageLoader.init();

	try {
		for (const profile of manifest.profiles) {
			const key = `profile/${profile.waybackTimestamp}`;
			if (progress.isProcessed(key)) {
				console.log(`  ${key}: already processed, skipping`);
				continue;
			}

			const era = eraFromTimestamp(profile.waybackTimestamp);
			const selectors = getProfileSelectors(era);
			const url = waybackUrl(profile.waybackTimestamp, profile.url);

			console.log(`\nExtracting profile @ ${profile.waybackTimestamp} (${era})`);

			const { page, success, error } = await pageLoader.loadPage(
				{
					waybackTimestamp: profile.waybackTimestamp,
					waybackUrl: url,
					originalUrl: profile.url,
				},
				{
					waitForSelectors: [
						...selectors.name,
						...selectors.bio,
						...selectors.avatar,
					],
					waitForSelectorTimeout: 20_000,
				},
			);

			if (!success) {
				console.error(`  Failed to load: ${error}`);
				progress.markFailed(key, error ?? "unknown error");
				await page.close();
				continue;
			}

			// Extract profile data
			const displayName = await extractText(page, selectors.name);
			const description = await extractText(page, selectors.bio);
			const avatarUrl = await extractImageSrc(page, selectors.avatar);

			console.log(`  Name: ${displayName ?? "(not found)"}`);
			console.log(`  Bio: ${description ?? "(not found)"}`);
			console.log(`  Avatar: ${avatarUrl ? "found" : "not found"}`);

			// Download avatar
			const ts = profile.waybackTimestamp;
			const dateStr = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
			let avatarFilename: string | null = null;

			if (avatarUrl) {
				avatarFilename = `${dateStr}.jpg`;
				const avatarPath = resolve(AVATAR_DIR, avatarFilename);
				const downloaded = await downloadAvatar(avatarUrl, avatarPath);
				if (!downloaded) {
					console.warn(`  Failed to download avatar from ${avatarUrl}`);
					avatarFilename = null;
				}
			}

			// Append to NDJSON
			const snapshot = {
				captured_at: `${dateStr}T00:00:00Z`,
				display_name: displayName,
				description,
				avatar_filename: avatarFilename,
				avatar_url: avatarUrl,
				source_url: url,
			};

			appendFileSync(snapshotsPath, JSON.stringify(snapshot) + "\n");

			progress.markProcessed(key, snapshot);
			await page.close();
		}
	} finally {
		await pageLoader.close();
	}

	const stats = progress.getStats();
	console.log(
		`\nComplete: ${stats.processed} processed, ${stats.failed} failed`,
	);
	console.log(`Profile data: ${snapshotsPath}`);
}

main();

/**
 * discover-samples: Check CDX availability for sample candidates
 * and build a manifest of snapshots to extract.
 *
 * Usage: bun run discover
 *
 * Reads:  data/candidates.json
 * Outputs: data/sample-manifest.json
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CdxClient } from "../lib/cdx.ts";
import { RateLimiter } from "../lib/rate-limiter.ts";
import type {
	ContentType,
	SampleEntry,
	SampleManifest,
	TwitterEra,
} from "../lib/types.ts";

const DATA_DIR = resolve(import.meta.dirname, "../../data");
const CDX_CACHE_DIR = resolve(DATA_DIR, ".cdx-cache");

interface Candidate {
	postId: string;
	createdAt: string;
}

type CandidatesFile = {
	[era in TwitterEra]?: {
		[type in ContentType]?: Candidate[];
	};
};

async function discoverProfileSnapshots(
	cdx: CdxClient,
): Promise<SampleManifest["profiles"]> {
	console.log("\nDiscovering profile page snapshots...");

	const results = await cdx.query("twitter.com/dril", {
		statusFilter: 200,
		collapseField: "timestamp:6", // one per month
		fields: ["timestamp", "original", "statuscode"],
	});

	// Pick ~2 per year by sampling every 6th result
	const sampled: SampleManifest["profiles"] = [];
	for (let i = 0; i < results.length; i += 6) {
		sampled.push({
			waybackTimestamp: results[i].timestamp,
			url: results[i].originalUrl,
		});
	}

	console.log(
		`  Found ${results.length} profile snapshots, selected ${sampled.length}`,
	);
	return sampled;
}

async function main() {
	const candidatesPath = resolve(DATA_DIR, "candidates.json");
	if (!existsSync(candidatesPath)) {
		console.error("candidates.json not found. Run `bun run select` first.");
		process.exit(1);
	}

	const candidates: CandidatesFile = JSON.parse(
		readFileSync(candidatesPath, "utf-8"),
	);

	// CDX queries are lighter weight — 5s delay
	const rateLimiter = new RateLimiter(5_000, 2_000);
	const cdx = new CdxClient(rateLimiter, CDX_CACHE_DIR);

	const manifest: SampleManifest = {};
	const eras = Object.keys(candidates) as TwitterEra[];
	const contentTypes: ContentType[] = [
		"plain",
		"reply",
		"quote",
		"photo",
		"video",
		"retweet",
	];

	for (const era of eras) {
		manifest[era] = {};
		const eraCandidates = candidates[era] ?? {};

		for (const ct of contentTypes) {
			const slots = eraCandidates[ct];
			if (!slots || slots.length === 0) {
				manifest[era]![ct] = null;
				console.log(`  ${era} / ${ct}: no candidates`);
				continue;
			}

			let found: SampleEntry | null = null;
			for (const candidate of slots) {
				const snapshot = await cdx.findBestSnapshot(
					`twitter.com/dril/status/${candidate.postId}`,
					candidate.createdAt,
				);

				if (snapshot) {
					found = {
						postId: candidate.postId,
						waybackTimestamp: snapshot.waybackTimestamp,
						createdAt: candidate.createdAt,
					};
					console.log(
						`  ${era} / ${ct}: found snapshot for post ${candidate.postId} @ ${snapshot.waybackTimestamp}`,
					);
					break;
				}
			}

			if (!found) {
				console.log(
					`  ${era} / ${ct}: no Wayback snapshots found for any candidate`,
				);
			}
			manifest[era]![ct] = found;
		}
	}

	// Discover profile snapshots
	manifest.profiles = await discoverProfileSnapshots(cdx);

	// Write manifest
	const outPath = resolve(DATA_DIR, "sample-manifest.json");
	writeFileSync(outPath, JSON.stringify(manifest, null, "\t") + "\n");
	console.log(`\nWrote ${outPath}`);
	console.log(
		"Review the manifest and optionally hand-edit before running extract:themes.",
	);
}

main();

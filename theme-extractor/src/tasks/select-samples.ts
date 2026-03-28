/**
 * select-samples: Query the archive database for candidate post IDs
 * covering every content type in every Twitter era.
 *
 * Usage: bun run select -- [--db path/to/dril.db]
 *
 * Outputs: data/candidates.json
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ERA_BOUNDARIES, type ContentType, type TwitterEra } from "../lib/types.ts";

const CANDIDATES_PER_SLOT = 10;

interface Candidate {
	postId: string;
	createdAt: string;
}

type CandidatesFile = {
	[era in TwitterEra]?: {
		[type in ContentType]?: Candidate[];
	};
};

function getDbPath(): string {
	const args = process.argv.slice(2);
	const dbIdx = args.indexOf("--db");
	if (dbIdx !== -1 && args[dbIdx + 1]) {
		return resolve(args[dbIdx + 1]);
	}
	// Default: look for the built database
	return resolve(import.meta.dirname, "../../..", "site/dril.db");
}

function getEraDateRange(era: TwitterEra): { start: string; end: string } {
	const idx = ERA_BOUNDARIES.findIndex((b) => b.era === era);
	const start = ERA_BOUNDARIES[idx].start;
	const end =
		idx + 1 < ERA_BOUNDARIES.length
			? ERA_BOUNDARIES[idx + 1].start
			: "2099-12-31";
	return { start, end };
}

function queryCandidates(
	db: Database.Database,
	era: TwitterEra,
	contentType: ContentType,
): Candidate[] {
	const { start, end } = getEraDateRange(era);
	const limit = CANDIDATES_PER_SLOT;

	let sql: string;
	switch (contentType) {
		case "plain":
			sql = `
				SELECT id, created_at FROM posts
				WHERE platform = 'x'
				  AND is_reply = 0 AND is_quote = 0
				  AND id NOT IN (SELECT post_id FROM media)
				  AND created_at >= ? AND created_at < ?
				ORDER BY likes DESC
				LIMIT ?
			`;
			break;
		case "reply":
			sql = `
				SELECT id, created_at FROM posts
				WHERE platform = 'x'
				  AND is_reply = 1
				  AND created_at >= ? AND created_at < ?
				ORDER BY likes DESC
				LIMIT ?
			`;
			break;
		case "quote":
			sql = `
				SELECT id, created_at FROM posts
				WHERE platform = 'x'
				  AND is_quote = 1
				  AND created_at >= ? AND created_at < ?
				ORDER BY likes DESC
				LIMIT ?
			`;
			break;
		case "photo":
			sql = `
				SELECT p.id, p.created_at FROM posts p
				JOIN media m ON p.id = m.post_id
				WHERE p.platform = 'x'
				  AND m.type = 'photo'
				  AND p.created_at >= ? AND p.created_at < ?
				ORDER BY p.likes DESC
				LIMIT ?
			`;
			break;
		case "video":
			sql = `
				SELECT p.id, p.created_at FROM posts p
				JOIN media m ON p.id = m.post_id
				WHERE p.platform = 'x'
				  AND m.type = 'video'
				  AND p.created_at >= ? AND p.created_at < ?
				ORDER BY p.likes DESC
				LIMIT ?
			`;
			break;
		case "retweet":
			sql = `
				SELECT id, created_at FROM reposts
				WHERE platform = 'x'
				  AND created_at >= ? AND created_at < ?
				  AND created_at IS NOT NULL
				ORDER BY likes DESC
				LIMIT ?
			`;
			break;
	}

	const rows = db
		.prepare(sql)
		.all(start, end, limit) as Array<{ id: string; created_at: string }>;

	return rows.map((r) => ({ postId: r.id, createdAt: r.created_at }));
}

function main() {
	const dbPath = getDbPath();
	if (!existsSync(dbPath)) {
		console.error(`Database not found: ${dbPath}`);
		console.error("Build it first: cargo run -p dril-builder -- ...");
		process.exit(1);
	}

	const db = new Database(dbPath, { readonly: true });
	const contentTypes: ContentType[] = [
		"plain",
		"reply",
		"quote",
		"photo",
		"video",
		"retweet",
	];
	const eras: TwitterEra[] = [
		"twitter-classic",
		"twitter-new",
		"twitter-material",
		"twitter-modern",
	];

	const candidates: CandidatesFile = {};

	for (const era of eras) {
		candidates[era] = {};
		for (const ct of contentTypes) {
			const results = queryCandidates(db, era, ct);
			if (results.length > 0) {
				candidates[era]![ct] = results;
			}
			console.log(
				`  ${era} / ${ct}: ${results.length} candidates`,
			);
		}
	}

	db.close();

	// Write output
	const outDir = resolve(import.meta.dirname, "../../data");
	if (!existsSync(outDir)) {
		mkdirSync(outDir, { recursive: true });
	}
	const outPath = resolve(outDir, "candidates.json");
	writeFileSync(outPath, JSON.stringify(candidates, null, "\t") + "\n");
	console.log(`\nWrote ${outPath}`);
}

main();

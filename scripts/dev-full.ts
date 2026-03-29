import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { ROOT_DIR, DATA_DIR, DB_PATH, setupVendor, startVite } from "./common";

setupVendor();

// Build full archive DB
console.log("Building full archive database...");

// Step 1: Normalize codemasher archive
const CODEMASHER_JSON = "/tmp/dril-archive/.build/dril.json";
if (!existsSync(CODEMASHER_JSON)) {
	console.log("Cloning codemasher/dril-archive...");
	execSync("git clone --depth 1 https://github.com/codemasher/dril-archive.git /tmp/dril-archive", {
		stdio: "inherit",
	});
}

console.log("Normalizing codemasher archive...");
execSync(
	`cargo run --release -p dril-normalizer -- --source codemasher --input ${CODEMASHER_JSON} --output-dir ${DATA_DIR}/`,
	{ stdio: "inherit", cwd: ROOT_DIR },
);

// Step 2: Append scraped data
const scrapedDir = join(DATA_DIR, "scraped");
if (existsSync(scrapedDir)) {
	console.log("Appending scraped data...");
	const glob = new Bun.Glob("*.jsonl");
	for (const file of glob.scanSync(scrapedDir)) {
		const fullPath = join(scrapedDir, file);
		console.log(`  ${file}`);
		execSync(`python3 scripts/split_manual_scrape.py "${fullPath}" "${DATA_DIR}/"`, {
			stdio: "inherit",
			cwd: ROOT_DIR,
		});
	}
}

// Step 3: Sync Bluesky
console.log("Syncing Bluesky posts...");
try {
	execSync(`cargo run --release -p dril-bsky-sync -- --output "${scrapedDir}/bsky-dril-live.jsonl"`, {
		stdio: "inherit",
		cwd: ROOT_DIR,
	});
	execSync(`python3 scripts/split_manual_scrape.py "${scrapedDir}/bsky-dril-live.jsonl" "${DATA_DIR}/"`, {
		stdio: "inherit",
		cwd: ROOT_DIR,
	});
} catch {
	console.log("  Bluesky sync failed (non-fatal), continuing...");
}

// Step 4: Build the database
console.log("Building database...");
execSync(`cargo run --release -p dril-builder -- "${DATA_DIR}/" "${DB_PATH}"`, {
	stdio: "inherit",
	cwd: ROOT_DIR,
});

await startVite();

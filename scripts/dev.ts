import { execSync } from "child_process";
import { mkdirSync, copyFileSync, statSync } from "fs";
import { join } from "path";

const ROOT_DIR = join(import.meta.dir, "..");
const SITE_DIR = join(ROOT_DIR, "site");
const DB_PATH = join(SITE_DIR, "dril.db");
const SQLITE3_DIR = join(SITE_DIR, "sqlite3");
const PORT = 3000;

// Copy SQLite WASM files from node_modules
const SQLITE_SRC = join(ROOT_DIR, "node_modules/@sqlite.org/sqlite-wasm/dist");
mkdirSync(SQLITE3_DIR, { recursive: true });
copyFileSync(join(SQLITE_SRC, "index.mjs"), join(SQLITE3_DIR, "index.mjs"));
copyFileSync(join(SQLITE_SRC, "sqlite3.wasm"), join(SQLITE3_DIR, "sqlite3.wasm"));

// Build the test DB if it doesn't exist
try {
	statSync(DB_PATH);
	console.log("dril.db exists, skipping build");
} catch {
	console.log("Building test database...");
	execSync("cargo run -p dril-builder -- testdata/sample.ndjson site/dril.db", {
		stdio: "inherit",
		cwd: ROOT_DIR,
	});
}

// Serve the site directory
const server = Bun.serve({
	port: PORT,
	async fetch(req) {
		const url = new URL(req.url);
		let path = url.pathname;
		if (path === "/") path = "/index.html";

		const filePath = join(SITE_DIR, path);
		const file = Bun.file(filePath);

		if (await file.exists()) {
			return new Response(file);
		}
		return new Response("Not Found", { status: 404 });
	},
});

console.log(`Serving site at http://localhost:${server.port}`);

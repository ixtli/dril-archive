import { execSync } from "child_process";
import { statSync } from "fs";
import { join } from "path";

const SITE_DIR = join(import.meta.dir, "..", "site");
const DB_PATH = join(SITE_DIR, "dril.db");
const PORT = 3000;

// Build the test DB if it doesn't exist
try {
	statSync(DB_PATH);
	console.log("dril.db exists, skipping build");
} catch {
	console.log("Building test database...");
	execSync("cargo run -p dril-builder -- testdata/sample.ndjson site/dril.db", {
		stdio: "inherit",
		cwd: join(import.meta.dir, ".."),
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

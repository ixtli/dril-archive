import { execSync } from "child_process";
import { mkdirSync, copyFileSync } from "fs";
import { join } from "path";

const ROOT_DIR = join(import.meta.dir, "..");
const SITE_DIR = join(ROOT_DIR, "site");
const VENDOR_DIR = join(SITE_DIR, "vendor");
const DB_PATH = join(VENDOR_DIR, "dril.db");
const SQLITE3_DIR = join(VENDOR_DIR, "sqlite3");

// Ensure vendor directories exist
mkdirSync(VENDOR_DIR, { recursive: true });
mkdirSync(SQLITE3_DIR, { recursive: true });

// Copy SQLite WASM files from node_modules
const SQLITE_SRC = join(SITE_DIR, "node_modules/@sqlite.org/sqlite-wasm/dist");
copyFileSync(join(SQLITE_SRC, "index.mjs"), join(SQLITE3_DIR, "index.mjs"));
copyFileSync(join(SQLITE_SRC, "sqlite3.wasm"), join(SQLITE3_DIR, "sqlite3.wasm"));

// Always rebuild the test DB from sample data to ensure tests use the correct fixture.
// A stale full-archive DB here causes E2E test failures.
console.log("Building test database from sample data...");
execSync("cargo run -p dril-builder -- testdata/sample.ndjson site/vendor/dril.db", {
	stdio: "inherit",
	cwd: ROOT_DIR,
});

// Start Vite dev server using Bun.spawn for proper subprocess lifecycle
const vite = Bun.spawn(["bunx", "vite", "--port", "3000"], {
	cwd: SITE_DIR,
	stdio: ["inherit", "inherit", "inherit"],
});

// Wait for the subprocess to exit
await vite.exited;
process.exit(vite.exitCode ?? 0);

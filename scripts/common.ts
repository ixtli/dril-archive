import { mkdirSync, copyFileSync } from "fs";
import { join } from "path";

export const ROOT_DIR = join(import.meta.dir, "..");
export const SITE_DIR = join(ROOT_DIR, "site");
export const VENDOR_DIR = join(SITE_DIR, "vendor");
export const DB_PATH = join(VENDOR_DIR, "dril.db");
export const SQLITE3_DIR = join(VENDOR_DIR, "sqlite3");
export const DATA_DIR = join(ROOT_DIR, "data");

const SQLITE_SRC = join(SITE_DIR, "node_modules/@sqlite.org/sqlite-wasm/dist");

const SQLITE_FILES = ["index.mjs", "sqlite3.wasm", "sqlite3-opfs-async-proxy.js"];

/** Create vendor dirs and copy SQLite WASM files from node_modules. */
export function setupVendor() {
	mkdirSync(VENDOR_DIR, { recursive: true });
	mkdirSync(SQLITE3_DIR, { recursive: true });

	for (const file of SQLITE_FILES) {
		copyFileSync(join(SQLITE_SRC, file), join(SQLITE3_DIR, file));
	}
}

/** Start Vite dev server and wait for exit. */
export async function startVite() {
	const vite = Bun.spawn(["bunx", "vite", "--port", "3000"], {
		cwd: SITE_DIR,
		stdio: ["inherit", "inherit", "inherit"],
	});

	await vite.exited;
	process.exit(vite.exitCode ?? 0);
}

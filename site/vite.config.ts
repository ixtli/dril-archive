import { defineConfig, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Handle SQLite WASM imports that bypass Vite's module pipeline.
 *
 * The dynamic `import("/sqlite3/index.mjs")` in db.ts loads the SQLite
 * WASM init module at runtime. Vite's import-analysis plugin would
 * otherwise reject this as a disallowed import from /public. We mark it
 * as external in the resolver so Vite leaves the import untouched, and
 * serve the actual files from site/vendor/ via middleware.
 */
function sqliteWasmPlugin(): Plugin {
	const MIME: Record<string, string> = {
		".mjs": "application/javascript",
		".wasm": "application/wasm",
		".db": "application/octet-stream",
	};

	return {
		name: "sqlite-wasm-plugin",
		enforce: "pre",
		resolveId(source) {
			// Mark the runtime import as external so Vite skips transform
			if (source === "/dril-archive/sqlite3/index.mjs" || source === "/sqlite3/index.mjs") {
				return { id: source, external: true };
			}
			return null;
		},
		configureServer(server) {
			// Register BEFORE Vite's internal middleware (no return wrapper)
			server.middlewares.use((req, res, next) => {
				const url = req.url ?? "";
				if (!url.startsWith("/sqlite3/") && url !== "/dril.db") {
					return next();
				}
				const filePath = join(__dirname, "vendor", url);
				if (!existsSync(filePath)) {
					return next();
				}
				const ext = url.slice(url.lastIndexOf("."));
				const mime = MIME[ext] ?? "application/octet-stream";
				res.setHeader("Content-Type", mime);
				res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
				res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
				res.end(readFileSync(filePath));
			});
		},
	};
}

export default defineConfig({
	base: "/dril-archive/",
	plugins: [svelte(), sqliteWasmPlugin()],
	optimizeDeps: {
		exclude: ["@sqlite.org/sqlite-wasm"],
	},
	build: {
		rollupOptions: {
			external: ["/sqlite3/index.mjs", "/dril-archive/sqlite3/index.mjs"],
		},
	},
	server: {
		port: 3000,
		headers: {
			"Cross-Origin-Opener-Policy": "same-origin",
			"Cross-Origin-Embedder-Policy": "require-corp",
		},
	},
	preview: {
		port: 4173,
		headers: {
			"Cross-Origin-Opener-Policy": "same-origin",
			"Cross-Origin-Embedder-Policy": "require-corp",
		},
	},
});

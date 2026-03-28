import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
	plugins: [svelte()],
	optimizeDeps: {
		exclude: ["@sqlite.org/sqlite-wasm"],
	},
	build: {
		rollupOptions: {
			external: ["/sqlite3/index.mjs"],
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

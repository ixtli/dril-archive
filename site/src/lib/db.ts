import type { Post, SortOption, FilterState } from "./types";

type ProgressCallback = (
	received: number,
	total: number,
	phase: string,
) => void;

let worker: Worker | null = null;
let searchId = 0;
let pendingSearchResolve: ((results: Post[]) => void) | null = null;
let pendingSearchId = 0;
let ready = false;

export async function initDb(onProgress: ProgressCallback): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		worker = new Worker(new URL("./search-worker.ts", import.meta.url), {
			type: "module",
		});

		worker.onmessage = (e) => {
			const msg = e.data;
			if (msg.type === "progress") {
				onProgress(msg.received, msg.total, msg.phase);
			} else if (msg.type === "ready") {
				ready = true;
				// Switch to search handler after init
				worker!.onmessage = handleSearchMessage;
				resolve();
			} else if (msg.type === "error") {
				reject(new Error(msg.message));
			}
		};

		const baseUrl = import.meta.env.BASE_URL;
		const sqliteUrl = new URL(
			`${baseUrl}sqlite3/index.mjs`,
			window.location.origin,
		).href;
		const dbUrl = new URL(`${baseUrl}dril.db`, window.location.origin).href;
		worker.postMessage({ type: "init", sqliteUrl, dbUrl });
	});
}

function handleSearchMessage(e: MessageEvent) {
	const msg = e.data;
	if (
		msg.type === "results" &&
		msg.id === pendingSearchId &&
		pendingSearchResolve
	) {
		pendingSearchResolve(msg.results);
		pendingSearchResolve = null;
	}
}

export function isDbReady(): boolean {
	return ready;
}

export function search(
	query: string,
	sort: SortOption,
	filters: FilterState,
	includeRetweets: boolean,
): Promise<Post[]> {
	if (!worker || !ready) return Promise.resolve([]);
	if (!query.trim()) return Promise.resolve([]);

	const id = ++searchId;
	pendingSearchId = id;

	// Unwrap Svelte 5 $state proxies — Proxy objects can't be structured-cloned
	const plainFilters = { platform: filters.platform, type: filters.type };

	return new Promise<Post[]>((resolve) => {
		pendingSearchResolve = resolve;
		worker!.postMessage({
			type: "search",
			id,
			query,
			sort,
			filters: plainFilters,
			includeRetweets,
		});
	});
}

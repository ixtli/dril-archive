type ProgressCallback = (received: number, total: number, phase: string) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;

const DB_URL = "dril.db";

async function fetchWithProgress(url: string, onProgress: ProgressCallback): Promise<Uint8Array> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status}`);
	}

	const contentLength = response.headers.get("Content-Length");
	if (!contentLength || !response.body) {
		onProgress(0, 0, "Downloading archive...");
		const buf = await response.arrayBuffer();
		return new Uint8Array(buf);
	}

	const total = parseInt(contentLength, 10);
	let received = 0;
	const chunks: Uint8Array[] = [];
	const reader = response.body.getReader();

	let done = false;
	while (!done) {
		let value: Uint8Array | undefined;
		({ done, value } = await reader.read());
		if (done || !value) break;
		chunks.push(value);
		received += value.length;
		onProgress(received, total, "Downloading archive...");
	}

	const result = new Uint8Array(received);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}
	return result;
}

export async function initDb(onProgress: ProgressCallback): Promise<void> {
	const dbData = await fetchWithProgress(DB_URL, onProgress);

	onProgress(dbData.length, dbData.length, "Preparing search...");

	// @ts-expect-error - Vite serves this from public/sqlite3/ at runtime
	const sqlite3InitModule = (await import("/sqlite3/index.mjs")).default;
	const sqlite3 = await sqlite3InitModule();

	sqlite3.capi.sqlite3_js_posix_create_file("/dril.db", dbData);
	db = new sqlite3.oo1.DB("/dril.db", "r");
}

export function getDb() {
	return db;
}

export function isDbReady(): boolean {
	return db !== null;
}

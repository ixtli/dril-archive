import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import type {
	CdxQueryOptions,
	CdxResult,
	WaybackSnapshot,
} from "./types.ts";
import { extractPostId, waybackUrl } from "./types.ts";
import type { RateLimiter } from "./rate-limiter.ts";

const CDX_API_BASE = "https://web.archive.org/cdx/search/cdx";
const USER_AGENT = "dril-archive-theme-extractor/1.0 (research; polite)";

/**
 * Client for the Wayback Machine CDX API.
 * Caches responses to disk so repeated runs don't re-query.
 */
export class CdxClient {
	private readonly cacheDir: string;

	constructor(
		private readonly rateLimiter: RateLimiter,
		cacheDir: string,
	) {
		this.cacheDir = cacheDir;
		if (!existsSync(this.cacheDir)) {
			mkdirSync(this.cacheDir, { recursive: true });
		}
	}

	/**
	 * Query the CDX API with full filter support.
	 * Results are cached by the full query URL.
	 */
	async query(url: string, options?: CdxQueryOptions): Promise<CdxResult[]> {
		const params = new URLSearchParams();
		params.set("url", url);
		params.set("output", "json");

		const fields = options?.fields ?? [
			"timestamp",
			"original",
			"statuscode",
		];
		params.set("fl", fields.join(","));

		if (options?.from) params.set("from", options.from);
		if (options?.to) params.set("to", options.to);
		if (options?.matchType) params.set("matchType", options.matchType);
		if (options?.statusFilter)
			params.set("filter", `statuscode:${options.statusFilter}`);
		if (options?.collapseField)
			params.set("collapse", options.collapseField);
		if (options?.limit) params.set("limit", options.limit.toString());

		const queryUrl = `${CDX_API_BASE}?${params.toString()}`;

		// Check cache
		const cached = this.readCache(queryUrl);
		if (cached !== null) return cached;

		// Rate limit, then fetch with retries on transient errors
		const maxRetries = 3;
		let response: Response | null = null;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			await this.rateLimiter.wait();

			response = await fetch(queryUrl, {
				headers: { "User-Agent": USER_AGENT },
			});

			if (response.ok) break;

			const retryable = [429, 500, 502, 503, 504].includes(
				response.status,
			);
			if (!retryable || attempt === maxRetries) {
				throw new Error(
					`CDX API returned ${response.status}: ${await response.text()}`,
				);
			}

			const delay = Math.pow(2, attempt + 1) * 5000; // 10s, 20s, 40s
			console.warn(
				`  CDX API returned ${response.status}, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})`,
			);
			await new Promise((r) => setTimeout(r, delay));
		}

		const text = await response!.text();
		if (!text.trim()) {
			this.writeCache(queryUrl, []);
			return [];
		}

		const rows: string[][] = JSON.parse(text);
		// First row is the header
		if (rows.length <= 1) {
			this.writeCache(queryUrl, []);
			return [];
		}

		const header = rows[0];
		const results: CdxResult[] = rows.slice(1).map((row) => {
			const obj: Record<string, string> = {};
			for (let i = 0; i < header.length; i++) {
				obj[header[i]] = row[i];
			}
			return {
				timestamp: obj.timestamp ?? "",
				originalUrl: obj.original ?? "",
				statusCode: parseInt(obj.statuscode ?? "0", 10),
				mimeType: obj.mimetype,
			};
		});

		this.writeCache(queryUrl, results);
		return results;
	}

	/**
	 * Find the single best snapshot for a URL, closest to a target date.
	 * Returns null if no snapshot exists.
	 */
	async findBestSnapshot(
		url: string,
		targetDate: string,
	): Promise<WaybackSnapshot | null> {
		// Normalize target date to Wayback timestamp format (YYYYMMDDHHMMSS)
		const target = targetDate.replace(/[-T:Z]/g, "").slice(0, 14);

		const results = await this.query(url, {
			statusFilter: 200,
			limit: 20,
		});

		if (results.length === 0) return null;

		// Find the snapshot closest to the target date
		let best = results[0];
		let bestDist = Math.abs(parseInt(best.timestamp) - parseInt(target));

		for (const r of results) {
			const dist = Math.abs(parseInt(r.timestamp) - parseInt(target));
			if (dist < bestDist) {
				best = r;
				bestDist = dist;
			}
		}

		return {
			waybackTimestamp: best.timestamp,
			waybackUrl: waybackUrl(best.timestamp, best.originalUrl),
			originalUrl: best.originalUrl,
			postId: extractPostId(best.originalUrl),
		};
	}

	/**
	 * Quick check: does any 200 snapshot exist for this URL?
	 */
	async checkAvailability(url: string): Promise<boolean> {
		const results = await this.query(url, {
			statusFilter: 200,
			limit: 1,
		});
		return results.length > 0;
	}

	private cacheKey(queryUrl: string): string {
		const hash = createHash("sha256").update(queryUrl).digest("hex");
		return join(this.cacheDir, `${hash.slice(0, 16)}.json`);
	}

	private readCache(queryUrl: string): CdxResult[] | null {
		const path = this.cacheKey(queryUrl);
		if (!existsSync(path)) return null;
		const raw = readFileSync(path, "utf-8");
		return JSON.parse(raw) as CdxResult[];
	}

	private writeCache(queryUrl: string, results: CdxResult[]): void {
		const path = this.cacheKey(queryUrl);
		writeFileSync(path, JSON.stringify(results) + "\n");
	}
}

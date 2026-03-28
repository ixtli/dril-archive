/** Supported platforms in the dril archive. */
export type Platform = "x" | "bsky" | "threads";

/** Twitter design eras, used as theme identifiers. */
export type TwitterEra =
	| "twitter-classic"
	| "twitter-new"
	| "twitter-material"
	| "twitter-modern";

/** All available theme IDs (extensible for future platforms). */
export type ThemeId = TwitterEra | "bsky-default" | "threads-default";

/** Content types that Twitter rendered differently. */
export type ContentType =
	| "plain"
	| "reply"
	| "quote"
	| "photo"
	| "video"
	| "retweet";

/** A single result row from the Wayback Machine CDX API. */
export interface CdxResult {
	/** Wayback timestamp, e.g. "20140315123456" */
	timestamp: string;
	/** Original URL that was captured, e.g. "twitter.com/dril/status/12345" */
	originalUrl: string;
	/** HTTP status code of the capture */
	statusCode: number;
	/** MIME type of the capture, if requested */
	mimeType?: string;
}

/** A resolved Wayback Machine snapshot ready to load. */
export interface WaybackSnapshot {
	/** Wayback timestamp, e.g. "20140315123456" */
	waybackTimestamp: string;
	/** Full Wayback Machine URL */
	waybackUrl: string;
	/** Original URL that was captured */
	originalUrl: string;
	/** Post ID extracted from the URL, if it's a status page */
	postId?: string;
}

/** Options for querying the CDX API. */
export interface CdxQueryOptions {
	/** Start date filter, e.g. "20230101" */
	from?: string;
	/** End date filter, e.g. "20240601" */
	to?: string;
	/** URL match type */
	matchType?: "exact" | "prefix" | "host" | "domain";
	/** Filter to only this HTTP status code (e.g. 200) */
	statusFilter?: number;
	/** Collapse field to deduplicate, e.g. "timestamp:8" (by day) or "urlkey" */
	collapseField?: string;
	/** CDX fields to return */
	fields?: string[];
	/** Maximum number of results */
	limit?: number;
}

/** Persistent state for resumable long-running tasks. */
export interface ProgressState {
	processed: Record<string, { result: unknown; timestamp: string }>;
	failed: Record<
		string,
		{ error: string; attempts: number; timestamp: string }
	>;
}

/** A sample entry in the manifest — one specific snapshot to extract. */
export interface SampleEntry {
	postId: string;
	waybackTimestamp: string;
	createdAt: string;
}

/** The full sample manifest output by discover-samples. */
export type SampleManifest = {
	[theme in TwitterEra]?: {
		[type in ContentType]?: SampleEntry | null;
	};
} & {
	profiles?: Array<{
		waybackTimestamp: string;
		url: string;
	}>;
};

/** A post recovered from a Wayback Machine snapshot. */
export interface ExtractedPost {
	id: string;
	platform: Platform;
	text: string;
	createdAt: string;
	isReply: boolean;
	replyToUser: string | null;
	isQuote: boolean;
	quotedText: string | null;
	likes: number;
	shares: number;
}

/** Computed styles extracted from a rendered tweet. */
export interface ExtractedStyles {
	[selector: string]: Record<string, string>;
}

/** Twitter era date boundaries. */
export const ERA_BOUNDARIES: Array<{ era: TwitterEra; start: string }> = [
	{ era: "twitter-classic", start: "2008-06-01" },
	{ era: "twitter-new", start: "2010-09-01" },
	{ era: "twitter-material", start: "2014-06-01" },
	{ era: "twitter-modern", start: "2019-07-15" },
];

/** Get the auto-resolved theme for a platform and date. */
export function getAutoTheme(platform: Platform, createdAt: string): ThemeId {
	if (platform === "bsky") return "bsky-default";
	if (platform === "threads") return "threads-default";

	const d = new Date(createdAt);
	if (d < new Date("2010-09-01")) return "twitter-classic";
	if (d < new Date("2014-06-01")) return "twitter-new";
	if (d < new Date("2019-07-15")) return "twitter-material";
	return "twitter-modern";
}

/** Extract a post ID from a twitter.com/user/status/ID URL. */
export function extractPostId(url: string): string | undefined {
	const match = url.match(/\/status\/(\d+)/);
	return match?.[1];
}

/** Build a full Wayback Machine URL from a timestamp and original URL. */
export function waybackUrl(timestamp: string, originalUrl: string): string {
	const normalized = originalUrl.startsWith("http")
		? originalUrl
		: `https://${originalUrl}`;
	return `https://web.archive.org/web/${timestamp}/${normalized}`;
}

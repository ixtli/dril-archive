export type ThemeId =
	| "twitter-classic"
	| "twitter-new"
	| "twitter-material"
	| "twitter-modern"
	| "bsky"
	| "threads";

export type SortOption = "relevance" | "newest" | "oldest" | "most-liked" | "most-shared";

export type Platform = "x" | "bsky" | "threads";
export type PlatformFilter = "all" | Platform;

export type TypeFilter = "all" | "original" | "replies" | "quotes";

export interface FilterState {
	platform: PlatformFilter;
	type: TypeFilter;
}

export interface MediaItem {
	type: string;
	url: string;
	width: number | null;
	height: number | null;
	alt_text: string | null;
}

export interface Post {
	id: string;
	text: string;
	created_at: string;
	is_reply: boolean;
	reply_to_user: string | null;
	is_quote: boolean;
	quoted_text: string | null;
	likes: number;
	shares: number;
	platform: Platform;
	media: MediaItem[];
	is_repost: boolean;
	original_user_id: string | null;
	original_user_screen_name: string | null;
	original_user_name: string | null;
}

export interface SearchState {
	query: string;
	sort: SortOption;
	filters: FilterState;
	themeOverride: ThemeId | "auto";
}

export type WorkerResponse =
	| { type: "progress"; received: number; total: number; phase: string }
	| { type: "ready" }
	| { type: "error"; message: string }
	| { type: "results"; id: number; results: Post[]; totalCount: number };

export type ThemeId =
	| "twitter-classic"
	| "twitter-new"
	| "twitter-material"
	| "twitter-modern"
	| "bsky"
	| "threads";

export type SortOption = "relevance" | "newest" | "oldest" | "most-liked" | "most-shared";

export type PlatformFilter = "all" | "x" | "bsky" | "threads";

export type TypeFilter = "all" | "original" | "replies" | "quotes";

export interface FilterState {
	platform: PlatformFilter;
	type: TypeFilter;
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
	platform: string;
}

export interface SearchState {
	query: string;
	sort: SortOption;
	filters: FilterState;
	themeOverride: ThemeId | "auto";
}

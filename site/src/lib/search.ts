import type { Post, SortOption, FilterState } from "./types";
import { getDb } from "./db";

export function buildFtsQuery(input: string): string {
	const terms = input
		.trim()
		.split(/\s+/)
		.filter((t) => t.length > 0)
		.map((t) => t.replace(/["*^()]/g, ""))
		.filter((t) => t.length > 0)
		.map((t) => `"${t}"*`);
	return terms.join(" ");
}

export function postUrl(platform: string, id: string): string {
	switch (platform) {
		case "threads":
			return `https://www.threads.com/@dril/post/${id}`;
		case "bsky":
			return `https://bsky.app/profile/dril.bsky.social/post/${id}`;
		default:
			return `https://x.com/dril/status/${id}`;
	}
}

function buildSortClause(sort: SortOption): string {
	switch (sort) {
		case "relevance":
			return "ORDER BY rank";
		case "newest":
			return "ORDER BY t.created_at DESC";
		case "oldest":
			return "ORDER BY t.created_at ASC";
		case "most-liked":
			return "ORDER BY t.likes DESC";
		case "most-shared":
			return "ORDER BY t.shares DESC";
	}
}

function buildFilterClauses(filters: FilterState): { clauses: string[]; params: unknown[] } {
	const clauses: string[] = [];
	const params: unknown[] = [];

	if (filters.platform !== "all") {
		const platformMap: Record<string, string> = {
			x: "x",
			bsky: "bsky",
			threads: "threads",
		};
		clauses.push("AND t.platform = ?");
		params.push(platformMap[filters.platform]);
	}

	if (filters.type === "original") {
		clauses.push("AND t.is_reply = 0 AND t.is_quote = 0");
	} else if (filters.type === "replies") {
		clauses.push("AND t.is_reply = 1");
	} else if (filters.type === "quotes") {
		clauses.push("AND t.is_quote = 1");
	}

	return { clauses, params };
}

export function executeSearch(input: string, sort: SortOption, filters: FilterState): Post[] {
	const db = getDb();
	if (!db) return [];

	const ftsQuery = buildFtsQuery(input);
	if (!ftsQuery) return [];

	const { clauses, params } = buildFilterClauses(filters);
	const sortClause = buildSortClause(sort);
	const filterSql = clauses.join("\n    ");

	const sql = `
    SELECT t.id, t.text, t.created_at, t.is_reply, t.reply_to_user,
           t.is_quote, t.quoted_text, t.likes, t.shares, t.platform
    FROM posts_fts f
    JOIN posts t ON t.rowid = f.rowid
    WHERE posts_fts MATCH ?
    ${filterSql}
    ${sortClause}
    LIMIT 50
  `;

	const allParams = [ftsQuery, ...params];

	try {
		const stmt = db.prepare(sql);
		try {
			stmt.bind(allParams);
			const results: Post[] = [];
			while (stmt.step()) {
				const row = stmt.get([]);
				results.push({
					id: row[0] as string,
					text: row[1] as string,
					created_at: row[2] as string,
					is_reply: Boolean(row[3]),
					reply_to_user: row[4] as string | null,
					is_quote: Boolean(row[5]),
					quoted_text: row[6] as string | null,
					likes: row[7] as number,
					shares: row[8] as number,
					platform: row[9] as string,
				});
			}
			return results;
		} finally {
			stmt.finalize();
		}
	} catch (err) {
		console.error("Search error:", err);
		return [];
	}
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function debouncedSearch(
	input: string,
	sort: SortOption,
	filters: FilterState,
	callback: (results: Post[]) => void,
	delay: number = 120,
): void {
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => {
		callback(executeSearch(input, sort, filters));
	}, delay);
}

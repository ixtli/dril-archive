import type { SortOption, FilterState, Post, MediaItem } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;

type WorkerMessage =
	| { type: "init"; sqliteUrl: string; dbUrl: string }
	| {
			type: "search";
			id: number;
			query: string;
			sort: SortOption;
			filters: FilterState;
			includeRetweets: boolean;
		};

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
	const msg = e.data;
	if (msg.type === "init") {
		await handleInit(msg.sqliteUrl, msg.dbUrl);
	} else if (msg.type === "search") {
		handleSearch(msg.id, msg.query, msg.sort, msg.filters, msg.includeRetweets);
	}
};

async function handleInit(sqliteUrl: string, dbUrl: string) {
	try {
		const response = await fetch(dbUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch ${dbUrl}: ${response.status}`);
		}

		const contentLength = response.headers.get("Content-Length");
		if (!contentLength || !response.body) {
			self.postMessage({
				type: "progress",
				received: 0,
				total: 0,
				phase: "Downloading archive...",
			});
			const buf = await response.arrayBuffer();
			await initSqlite(new Uint8Array(buf), sqliteUrl);
			return;
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
			self.postMessage({
				type: "progress",
				received,
				total,
				phase: "Downloading archive...",
			});
		}

		const result = new Uint8Array(received);
		let offset = 0;
		for (const chunk of chunks) {
			result.set(chunk, offset);
			offset += chunk.length;
		}

		await initSqlite(result, sqliteUrl);
	} catch (err) {
		self.postMessage({
			type: "error",
			message: err instanceof Error ? err.message : String(err),
		});
	}
}

async function initSqlite(dbData: Uint8Array, sqliteUrl: string) {
	self.postMessage({
		type: "progress",
		received: dbData.length,
		total: dbData.length,
		phase: "Preparing search...",
	});

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const sqlite3InitModule = ((await import(/* @vite-ignore */ sqliteUrl)) as any).default;
	const sqlite3 = await sqlite3InitModule();

	sqlite3.capi.sqlite3_js_posix_create_file("/dril.db", dbData);
	db = new sqlite3.oo1.DB("/dril.db", "r");

	self.postMessage({ type: "ready" });
}

function buildFtsQuery(input: string): string {
	const terms = input
		.trim()
		.split(/\s+/)
		.filter((t) => t.length > 0)
		.map((t) => t.replace(/["*^()]/g, ""))
		.filter((t) => t.length > 0)
		.map((t) => `"${t}"*`);
	return terms.join(" ");
}

function buildSortClause(sort: SortOption, hasUnion: boolean): string {
	switch (sort) {
		case "relevance":
			return hasUnion ? "ORDER BY created_at DESC" : "ORDER BY rank";
		case "newest":
			return hasUnion
				? "ORDER BY created_at DESC"
				: "ORDER BY t.created_at DESC";
		case "oldest":
			return hasUnion ? "ORDER BY created_at ASC" : "ORDER BY t.created_at ASC";
		case "most-liked":
			return hasUnion ? "ORDER BY likes DESC" : "ORDER BY t.likes DESC";
		case "most-shared":
			return hasUnion ? "ORDER BY shares DESC" : "ORDER BY t.shares DESC";
	}
}

function buildFilterClauses(filters: FilterState): {
	clauses: string[];
	params: unknown[];
} {
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

function parseMediaJson(raw: string | null): MediaItem[] {
	if (!raw) return [];
	try {
		const arr = JSON.parse(raw);
		if (!Array.isArray(arr)) return [];
		return arr.filter((item: unknown) => item !== null) as MediaItem[];
	} catch {
		return [];
	}
}

function handleSearch(
	id: number,
	input: string,
	sort: SortOption,
	filters: FilterState,
	includeRetweets: boolean,
) {
	if (!db) {
		self.postMessage({ type: "results", id, results: [] });
		return;
	}

	const ftsQuery = buildFtsQuery(input);
	if (!ftsQuery) {
		self.postMessage({ type: "results", id, results: [] });
		return;
	}

	const { clauses, params } = buildFilterClauses(filters);
	const filterSql = clauses.join("\n    ");

	const postsArm = `
    SELECT t.id, t.text, t.created_at, t.is_reply, t.reply_to_user,
           t.is_quote, t.quoted_text, t.likes, t.shares, t.platform,
           (SELECT json_group_array(json_object(
             'type', m.type, 'url', m.url,
             'width', m.width, 'height', m.height,
             'alt_text', m.alt_text
           )) FROM media m WHERE m.post_id = t.id) AS media_json,
           0 AS is_repost, NULL AS original_user_id,
           NULL AS original_user_screen_name, NULL AS original_user_name
    FROM posts_fts f
    JOIN posts t ON t.rowid = f.rowid
    WHERE posts_fts MATCH ?
    ${filterSql}`;

	let sql: string;
	let allParams: unknown[];

	if (includeRetweets) {
		const sortClause = buildSortClause(sort, true);
		const likePattern = `%${input.trim().replace(/%/g, "\\%")}%`;
		sql = `
      SELECT * FROM (
        ${postsArm}
        UNION ALL
        SELECT r.id, r.original_text AS text,
               COALESCE(r.original_created_at, r.created_at) AS created_at,
               0 AS is_reply, NULL AS reply_to_user,
               0 AS is_quote, NULL AS quoted_text,
               r.likes, r.shares, r.platform,
               '[]' AS media_json,
               1 AS is_repost, r.original_user_id,
               u.screen_name AS original_user_screen_name,
               u.name AS original_user_name
        FROM reposts r
        LEFT JOIN users u ON u.id = r.original_user_id
        WHERE r.original_text LIKE ? ESCAPE '\\'
      )
      ${sortClause}
      LIMIT 50
    `;
		allParams = [ftsQuery, ...params, likePattern];
	} else {
		const sortClause = buildSortClause(sort, false);
		sql = `${postsArm} ${sortClause} LIMIT 50`;
		allParams = [ftsQuery, ...params];
	}

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
					media: parseMediaJson(row[10] as string | null),
					is_repost: Boolean(row[11]),
					original_user_id: row[12] as string | null,
					original_user_screen_name: row[13] as string | null,
					original_user_name: row[14] as string | null,
				});
			}
			self.postMessage({ type: "results", id, results });
		} finally {
			stmt.finalize();
		}
	} catch (err) {
		console.error("Search error:", err);
		self.postMessage({ type: "results", id, results: [] });
	}
}

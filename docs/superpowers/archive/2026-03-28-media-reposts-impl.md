# Media & Repost Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface media attachments and reposts in the frontend — media as click-to-load placeholders, reposts as searchable cards with a "dril retweeted" banner and a toggle to include/exclude them.

**Architecture:** Extend the existing `Post` type with `media` and `is_repost` fields. Modify the SQL in `search.ts` to left-join media and UNION reposts. Add a shared `MediaPlaceholder.svelte` component and per-template repost banners. Add "Include retweets" checkbox to Controls.

**Tech Stack:** Svelte 5, SQLite WASM (json_group_array), Playwright E2E tests

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `site/src/lib/types.ts` | Modify | Add `MediaItem` interface, extend `Post` |
| `site/src/lib/search.ts` | Modify | Media subselect, repost UNION, toggle param |
| `site/src/components/Controls.svelte` | Modify | Add "Include retweets" checkbox |
| `site/src/components/MediaPlaceholder.svelte` | Create | Click-to-load media component |
| `site/src/templates/TwitterClassic.svelte` | Modify | Add repost banner + media slot |
| `site/src/templates/TwitterNew.svelte` | Modify | Add repost banner + media slot |
| `site/src/templates/TwitterMaterial.svelte` | Modify | Add repost banner + media slot |
| `site/src/templates/TwitterModern.svelte` | Modify | Add repost banner + media slot |
| `site/src/templates/Bluesky.svelte` | Modify | Add repost banner + media slot |
| `site/src/templates/Threads.svelte` | Modify | Add repost banner + media slot |
| `site/src/App.svelte` | Modify | Wire `includeRetweets` state |
| `testdata/dir-test/posts.ndjson` | Modify | Add more posts to match sample.ndjson fixture set |
| `testdata/dir-test/media.ndjson` | Modify | Add media for searchable posts |
| `testdata/dir-test/reposts.ndjson` | Modify | Add repost with searchable text |
| `scripts/dev.ts` | Modify | Use dir-test/ fixtures instead of sample.ndjson |
| `e2e/search.spec.ts` | Modify | Add media + repost E2E tests |

---

### Task 1: Upgrade Test Fixtures to Dir Mode

The dev script currently uses `testdata/sample.ndjson` (single-file mode) which has no media or reposts. Switch to `testdata/dir-test/` (directory mode) which has all 4 NDJSON files. First, make dir-test contain the same posts as sample.ndjson so existing E2E tests don't break.

**Files:**
- Modify: `testdata/dir-test/posts.ndjson`
- Modify: `testdata/dir-test/reposts.ndjson`
- Modify: `testdata/dir-test/media.ndjson`
- Modify: `scripts/dev.ts:23`

- [ ] **Step 1: Update dir-test/posts.ndjson to match sample.ndjson**

Replace `testdata/dir-test/posts.ndjson` with the full 11-post set from `testdata/sample.ndjson`:

```jsonl
{"id":"1","text":"no","created_at":"2008-09-15T12:00:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":4200,"shares":850}
{"id":"2","text":"the wise man bowed his head solemnly and spoke: theres actually zero difference between good and bad things. you imbecile. you fucking moron","created_at":"2014-11-12T18:30:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":178000,"shares":89000}
{"id":"3","text":"IF THE ZOO BANS ME FOR HOLLERING AT THE ANIMALS I WILL FACE GOD AND WALK BACKWARDS INTO HELL","created_at":"2012-07-22T03:15:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":312000,"shares":142000}
{"id":"4","text":"another day volunteering at the betsy ross museum. everyone keeps asking me if they can fuck the flag. buddy, they wont even let me fuck it","created_at":"2019-08-14T14:00:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":245000,"shares":67000}
{"id":"5","text":"\"im not owned! im not owned!!\", i continue to insist as i slowly shrink and transform into a corn cob","created_at":"2011-11-09T20:45:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":198000,"shares":73000}
{"id":"6","text":"@someone you are like a little baby. watch this","created_at":"2015-03-08T09:00:00Z","is_reply":true,"reply_to_user":"someone","is_quote":false,"quoted_text":null,"likes":45,"shares":8}
{"id":"7","text":"awfully bold of you to fly the american flag on your house every day. this is my neighborhood and i wont stand for it","created_at":"2018-07-04T16:20:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":89000,"shares":23000}
{"id":"8","text":"blocked. blocked. blocked. youre all blocked. none of you are free of sin","created_at":"2014-08-20T22:10:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":267000,"shares":105000}
{"id":"9","text":"drunk driving may kill a lot of people, but it also helps a lot of people get to work on time, so, it;s impossible to say if its bad or not,","created_at":"2012-12-01T11:30:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":156000,"shares":58000}
{"id":"10","text":"THERAPIST: your problem is, that youre perfect, and everyone is jealous of your good posts, and status. ME: I agree","created_at":"2016-05-19T07:45:00Z","is_reply":false,"reply_to_user":null,"is_quote":true,"quoted_text":"whats the worst thing a therapist has ever said to you","likes":54321,"shares":12345}
{"id":"bsky-test-1","platform":"bsky","text":"bluesky test post about posting","created_at":"2024-06-15T12:00:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":100,"shares":20}
```

- [ ] **Step 2: Update dir-test/reposts.ndjson with searchable repost**

Replace `testdata/dir-test/reposts.ndjson` — make the repost text something uniquely searchable:

```jsonl
{"id":"rt-1","platform":"x","created_at":"2023-01-15T10:00:00Z","original_post_id":"ext-200","original_user_id":"999","original_text":"the moon is fake and i have proof","original_created_at":"2023-01-14T08:00:00Z","likes":5000,"shares":1200}
```

- [ ] **Step 3: Update dir-test/media.ndjson with media for a searchable post**

Replace `testdata/dir-test/media.ndjson` — attach media to post id="3" (the zoo post, easily searchable):

```jsonl
{"post_id":"3","type":"photo","url":"https://pbs.twimg.com/media/example.jpg","width":1200,"height":800,"alt_text":"funny image"}
```

- [ ] **Step 4: Update dir-test/users.ndjson**

Keep existing content, it already has user 999:

```jsonl
{"id":"16298441","screen_name":"dril","name":"wint"}
{"id":"999","screen_name":"someguy","name":"Some Guy"}
```

- [ ] **Step 5: Update scripts/dev.ts to use dir-test/ directory mode**

In `scripts/dev.ts`, change line 23 from:

```typescript
execSync("cargo run -p dril-builder -- testdata/sample.ndjson site/vendor/dril.db", {
```

to:

```typescript
execSync("cargo run -p dril-builder -- testdata/dir-test site/vendor/dril.db", {
```

- [ ] **Step 6: Run the dev server and verify it starts**

Run: `bun run dev`

Expected: "Built site/vendor/dril.db with 11 posts" (plus repost and media counts), Vite starts on port 3000.

- [ ] **Step 7: Run existing E2E tests to confirm no regressions**

Run: `bun run test:e2e`

Expected: All 14 tests pass. The same 11 posts are in the DB, same text, same IDs — existing tests should be unaffected.

- [ ] **Step 8: Commit**

```bash
git add testdata/dir-test/ scripts/dev.ts
git commit -m "chore: switch dev/test to dir-test fixtures with media and reposts"
```

---

### Task 2: Extend Types and Search for Media

Add the `MediaItem` interface and media field to `Post`. Update the SQL query to fetch media as a JSON array via subselect.

**Files:**
- Modify: `site/src/lib/types.ts`
- Modify: `site/src/lib/search.ts`

- [ ] **Step 1: Add MediaItem interface and extend Post type**

In `site/src/lib/types.ts`, add the `MediaItem` interface before `Post` and extend `Post`:

```typescript
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
	platform: string;
	media: MediaItem[];
	is_repost: boolean;
	original_user_id: string | null;
}
```

- [ ] **Step 2: Update executeSearch to fetch media**

In `site/src/lib/search.ts`, update the SQL in `executeSearch` to add a media subselect. The `json_group_array` returns `[null]` when there are no matches, so parse carefully.

Replace the SQL string and result mapping in `executeSearch`:

```typescript
const sql = `
    SELECT t.id, t.text, t.created_at, t.is_reply, t.reply_to_user,
           t.is_quote, t.quoted_text, t.likes, t.shares, t.platform,
           (SELECT json_group_array(json_object(
             'type', m.type, 'url', m.url,
             'width', m.width, 'height', m.height,
             'alt_text', m.alt_text
           )) FROM media m WHERE m.post_id = t.id) AS media_json
    FROM posts_fts f
    JOIN posts t ON t.rowid = f.rowid
    WHERE posts_fts MATCH ?
    ${filterSql}
    ${sortClause}
    LIMIT 50
  `;
```

Add a helper function above `executeSearch` to parse the media JSON:

```typescript
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
```

Update the result mapping to include the new fields:

```typescript
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
	is_repost: false,
	original_user_id: null,
});
```

Update the import at the top of search.ts:

```typescript
import type { Post, SortOption, FilterState, MediaItem } from "./types";
```

- [ ] **Step 3: Verify the dev server loads and search still works**

Restart the dev server (`bun run dev`), open http://localhost:3000, search for "zoo". Should still return results. Check browser console for errors.

- [ ] **Step 4: Commit**

```bash
git add site/src/lib/types.ts site/src/lib/search.ts
git commit -m "feat(site): add media field to Post type and fetch via SQL subselect"
```

---

### Task 3: Add Repost Support to Search

Add the repost UNION arm to the search query, controlled by a new `includeRetweets` parameter.

**Files:**
- Modify: `site/src/lib/search.ts`

- [ ] **Step 1: Update executeSearch signature and add repost UNION**

Change the `executeSearch` function signature to accept an `includeRetweets` boolean:

```typescript
export function executeSearch(
	input: string,
	sort: SortOption,
	filters: FilterState,
	includeRetweets: boolean = true,
): Post[] {
```

After the existing posts query SQL, add a conditional UNION for reposts. The full SQL becomes:

```typescript
const { clauses, params } = buildFilterClauses(filters);
const sortClause = buildSortClause(sort);
const filterSql = clauses.join("\n    ");

let sql: string;
let allParams: unknown[];

const postsArm = `
    SELECT t.id, t.text, t.created_at, t.is_reply, t.reply_to_user,
           t.is_quote, t.quoted_text, t.likes, t.shares, t.platform,
           (SELECT json_group_array(json_object(
             'type', m.type, 'url', m.url,
             'width', m.width, 'height', m.height,
             'alt_text', m.alt_text
           )) FROM media m WHERE m.post_id = t.id) AS media_json,
           0 AS is_repost, NULL AS original_user_id
    FROM posts_fts f
    JOIN posts t ON t.rowid = f.rowid
    WHERE posts_fts MATCH ?
    ${filterSql}`;

if (includeRetweets) {
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
               1 AS is_repost, r.original_user_id
        FROM reposts r
        WHERE r.original_text LIKE ? ESCAPE '\\'
      )
      ${sortClause}
      LIMIT 50
    `;
    allParams = [ftsQuery, ...params, likePattern];
} else {
    sql = `${postsArm} ${sortClause} LIMIT 50`;
    allParams = [ftsQuery, ...params];
}
```

Update the result row mapping to read the new columns:

```typescript
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
});
```

- [ ] **Step 2: Update debouncedSearch to pass includeRetweets**

```typescript
export function debouncedSearch(
	input: string,
	sort: SortOption,
	filters: FilterState,
	includeRetweets: boolean,
	callback: (results: Post[]) => void,
	delay: number = 120,
): void {
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => {
		callback(executeSearch(input, sort, filters, includeRetweets));
	}, delay);
}
```

- [ ] **Step 3: Update sort clause for UNION queries**

The `buildSortClause` function uses `t.created_at` etc., but in the UNION query there's no `t` alias. The outer SELECT uses plain column names. Update `buildSortClause` to not use table aliases (since the posts-only path will also work without them — the column names are unambiguous in a single-table select):

```typescript
function buildSortClause(sort: SortOption): string {
	switch (sort) {
		case "relevance":
			return "ORDER BY created_at DESC";
		case "newest":
			return "ORDER BY created_at DESC";
		case "oldest":
			return "ORDER BY created_at ASC";
		case "most-liked":
			return "ORDER BY likes DESC";
		case "most-shared":
			return "ORDER BY shares DESC";
	}
}
```

Note: `relevance` used to sort by FTS `rank`, but rank isn't available in the UNION'd result. Falling back to `newest` for relevance sort when reposts are included is acceptable — the FTS match already filters to relevant results. In the non-union path, we can keep rank-based sorting. Refine this:

```typescript
function buildSortClause(sort: SortOption, hasUnion: boolean): string {
	switch (sort) {
		case "relevance":
			return hasUnion ? "ORDER BY created_at DESC" : "ORDER BY rank";
		case "newest":
			return "ORDER BY created_at DESC";
		case "oldest":
			return "ORDER BY created_at ASC";
		case "most-liked":
			return "ORDER BY likes DESC";
		case "most-shared":
			return "ORDER BY shares DESC";
	}
}
```

Update the two call sites:
- Union path: `buildSortClause(sort, true)`
- Non-union path: `buildSortClause(sort, false)`

- [ ] **Step 4: Verify by searching for "moon" in the dev server**

Restart dev server. Search for "moon" — should return the repost "the moon is fake and i have proof". Search for "zoo" — should return the original post only.

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/search.ts
git commit -m "feat(site): add repost UNION to search with includeRetweets param"
```

---

### Task 4: Wire Controls Toggle and App State

Add the "Include retweets" checkbox to Controls and wire it through App.svelte.

**Files:**
- Modify: `site/src/components/Controls.svelte`
- Modify: `site/src/App.svelte`

- [ ] **Step 1: Add includeRetweets prop and checkbox to Controls.svelte**

In the `<script>` block, add to the `Props` interface:

```typescript
interface Props {
	sort: SortOption;
	platformFilter: PlatformFilter;
	typeFilter: TypeFilter;
	themeOverride: ThemeId | "auto";
	includeRetweets: boolean;
	onSortChange: (sort: SortOption) => void;
	onPlatformChange: (platform: PlatformFilter) => void;
	onTypeChange: (type: TypeFilter) => void;
	onThemeChange: (theme: ThemeId | "auto") => void;
	onRetweetsChange: (include: boolean) => void;
}
```

Add to the destructuring:

```typescript
let {
	sort,
	platformFilter,
	typeFilter,
	themeOverride,
	includeRetweets,
	onSortChange,
	onPlatformChange,
	onTypeChange,
	onThemeChange,
	onRetweetsChange,
}: Props = $props();
```

In the template, add a checkbox control group after the Theme select (before the closing `</div>` of `.controls`):

```svelte
<div class="control-group checkbox-group">
	<label class="checkbox-label">
		<input
			type="checkbox"
			data-testid="retweets-toggle"
			checked={includeRetweets}
			onchange={(e) => onRetweetsChange((e.target as HTMLInputElement).checked)}
		/>
		Include retweets
	</label>
</div>
```

Add styles for the checkbox group in the `<style>` block:

```css
.checkbox-group {
	justify-content: center;
}

.checkbox-label {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 0.85rem;
	color: #e0e0e0;
	cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
	accent-color: #4a9eff;
	cursor: pointer;
}
```

- [ ] **Step 2: Wire includeRetweets in App.svelte**

Add state variable:

```typescript
let includeRetweets = $state(true);
```

Add handler:

```typescript
function handleRetweetsChange(include: boolean) {
	includeRetweets = include;
	rerunSearch();
}
```

Update `handleInput` and `rerunSearch` to pass `includeRetweets`:

```typescript
function handleInput(value: string) {
	query = value;
	if (!value.trim()) {
		results = [];
		return;
	}
	debouncedSearch(value, sort, filters, includeRetweets, (r) => {
		results = r;
	});
}

function rerunSearch() {
	if (!query.trim()) return;
	debouncedSearch(query, sort, filters, includeRetweets, (r) => {
		results = r;
	});
}
```

Update the `<Controls>` component in the template:

```svelte
<Controls
	{sort}
	platformFilter={filters.platform}
	typeFilter={filters.type}
	{themeOverride}
	{includeRetweets}
	onSortChange={handleSortChange}
	onPlatformChange={handlePlatformChange}
	onTypeChange={handleTypeChange}
	onThemeChange={handleThemeChange}
	onRetweetsChange={handleRetweetsChange}
/>
```

- [ ] **Step 3: Verify toggle works in dev server**

Restart dev server. Search for "moon". Should see the repost. Open controls, uncheck "Include retweets", results should update — the repost should disappear. Re-check to bring it back.

- [ ] **Step 4: Commit**

```bash
git add site/src/components/Controls.svelte site/src/App.svelte
git commit -m "feat(site): add Include retweets toggle to controls"
```

---

### Task 5: Create MediaPlaceholder Component

A shared Svelte component for click-to-load media placeholders.

**Files:**
- Create: `site/src/components/MediaPlaceholder.svelte`

- [ ] **Step 1: Create the MediaPlaceholder component**

Create `site/src/components/MediaPlaceholder.svelte`:

```svelte
<script lang="ts">
	import type { MediaItem } from "../lib/types";

	interface Props {
		media: MediaItem[];
	}

	let { media }: Props = $props();

	type LoadState = "idle" | "loading" | "loaded" | "error";

	let loadStates = $state<LoadState[]>(media.map(() => "idle"));

	function loadImage(index: number) {
		loadStates[index] = "loading";
		const img = new Image();
		img.onload = () => {
			loadStates[index] = "loaded";
		};
		img.onerror = () => {
			loadStates[index] = "error";
		};
		img.src = media[index].url;
	}

	function loadAll() {
		for (let i = 0; i < media.length; i++) {
			if (loadStates[i] === "idle") {
				loadImage(i);
			}
		}
	}
</script>

{#if media.length > 0}
	<div class="media-container" data-testid="media-placeholder">
		{#if loadStates.every((s) => s === "idle")}
			<button class="media-prompt" onclick={loadAll}>
				<span class="media-icon">&#128247;</span>
				{media.length} image{media.length > 1 ? "s" : ""} attached — click to load
			</button>
		{:else}
			<div class="media-grid" class:single={media.length === 1}>
				{#each media as item, i}
					<div class="media-item">
						{#if loadStates[i] === "loading"}
							<div class="media-loading">Loading...</div>
						{:else if loadStates[i] === "loaded"}
							<img
								src={item.url}
								alt={item.alt_text ?? ""}
								width={item.width ?? undefined}
								height={item.height ?? undefined}
							/>
						{:else if loadStates[i] === "error"}
							<div class="media-error">Image unavailable</div>
						{:else}
							<button class="media-item-prompt" onclick={() => loadImage(i)}>
								Click to load
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.media-container {
		margin-top: 8px;
	}

	.media-prompt {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 12px;
		background: #f0f0f0;
		border: 1px dashed #ccc;
		border-radius: 8px;
		color: #666;
		font-size: 13px;
		cursor: pointer;
		font-family: inherit;
	}

	.media-prompt:hover {
		background: #e8e8e8;
		border-color: #aaa;
	}

	.media-icon {
		font-size: 16px;
	}

	.media-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 4px;
		border-radius: 8px;
		overflow: hidden;
	}

	.media-grid.single {
		grid-template-columns: 1fr;
	}

	.media-item {
		background: #f0f0f0;
		min-height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.media-item img {
		width: 100%;
		height: auto;
		display: block;
	}

	.media-loading,
	.media-error {
		padding: 16px;
		font-size: 13px;
		color: #888;
	}

	.media-error {
		color: #999;
	}

	.media-item-prompt {
		padding: 16px;
		background: none;
		border: none;
		color: #666;
		font-size: 13px;
		cursor: pointer;
		font-family: inherit;
	}

	.media-item-prompt:hover {
		color: #333;
	}
</style>
```

- [ ] **Step 2: Verify it renders in isolation (optional manual check)**

No automated test yet — this will be tested via E2E in Task 7.

- [ ] **Step 3: Commit**

```bash
git add site/src/components/MediaPlaceholder.svelte
git commit -m "feat(site): add MediaPlaceholder click-to-load component"
```

---

### Task 6: Add Repost Banner and Media to All Templates

Add the repost banner and media placeholder to all 6 templates. Each template gets:
1. A repost banner above the card when `post.is_repost` is true
2. A `<MediaPlaceholder>` below the text when `post.media.length > 0`

**Files:**
- Modify: `site/src/templates/TwitterClassic.svelte`
- Modify: `site/src/templates/TwitterNew.svelte`
- Modify: `site/src/templates/TwitterMaterial.svelte`
- Modify: `site/src/templates/TwitterModern.svelte`
- Modify: `site/src/templates/Bluesky.svelte`
- Modify: `site/src/templates/Threads.svelte`

All templates follow the same structure. The repost banner goes before the `card-layout` div. The media placeholder goes after the text div (and after the quoted block if present), inside `content-col`.

- [ ] **Step 1: Update TwitterModern.svelte**

Add import:

```typescript
import MediaPlaceholder from "../components/MediaPlaceholder.svelte";
```

Add repost banner before `<div class="card-layout">`:

```svelte
{#if post.is_repost}
	<div class="repost-banner" data-testid="repost-banner">
		<span class="repost-icon">&#8635;</span> @dril retweeted
	</div>
{/if}
```

Add media placeholder after the quoted block, before the engagement div (inside `content-col`):

```svelte
			{#if post.media.length > 0}
				<MediaPlaceholder media={post.media} />
			{/if}
```

Add repost banner styles:

```css
.repost-banner {
	font-size: 13px;
	color: #536471;
	padding: 0 0 4px 52px;
}

.repost-icon {
	font-size: 12px;
}
```

- [ ] **Step 2: Update TwitterClassic.svelte**

Same pattern. Add import for `MediaPlaceholder`. Add repost banner before `<div class="card-layout">`. Add `<MediaPlaceholder>` after quoted block. The `TwitterClassic` template has padding-left of `83px` for reply-context, use the same for the repost banner.

Add import:

```typescript
import MediaPlaceholder from "../components/MediaPlaceholder.svelte";
```

Add before `<div class="card-layout">`:

```svelte
{#if post.is_repost}
	<div class="repost-banner" data-testid="repost-banner">
		<span class="repost-icon">&#8635;</span> @dril retweeted
	</div>
{/if}
```

Add after the quoted text block, before engagement:

```svelte
			{#if post.media.length > 0}
				<MediaPlaceholder media={post.media} />
			{/if}
```

Add styles:

```css
.repost-banner {
	font-size: 11px;
	color: #999;
	padding: 0 0 4px 83px;
}

.repost-icon {
	font-size: 10px;
}
```

- [ ] **Step 3: Update TwitterNew.svelte**

Add import:

```typescript
import MediaPlaceholder from "../components/MediaPlaceholder.svelte";
```

Add repost banner before `<div class="card-layout">`:

```svelte
{#if post.is_repost}
	<div class="repost-banner" data-testid="repost-banner">
		<span class="repost-icon">&#8635;</span> @dril retweeted
	</div>
{/if}
```

Add `<MediaPlaceholder>` after quoted block, before engagement:

```svelte
			{#if post.media.length > 0}
				<MediaPlaceholder media={post.media} />
			{/if}
```

Add styles (padding-left 60px matches reply-context):

```css
.repost-banner {
	font-size: 12px;
	color: #66757f;
	padding: 0 0 4px 60px;
}

.repost-icon {
	font-size: 11px;
}
```

- [ ] **Step 4: Update TwitterMaterial.svelte**

Add import:

```typescript
import MediaPlaceholder from "../components/MediaPlaceholder.svelte";
```

Add repost banner before `<div class="card-layout">`:

```svelte
{#if post.is_repost}
	<div class="repost-banner" data-testid="repost-banner">
		<span class="repost-icon">&#8635;</span> @dril retweeted
	</div>
{/if}
```

Add `<MediaPlaceholder>` after quoted block, before engagement:

```svelte
			{#if post.media.length > 0}
				<MediaPlaceholder media={post.media} />
			{/if}
```

Add styles (padding-left 60px matches reply-context):

```css
.repost-banner {
	font-size: 13px;
	color: #657786;
	padding: 0 0 4px 60px;
}

.repost-icon {
	font-size: 12px;
}
```

- [ ] **Step 5: Update Bluesky.svelte**

Add import:

```typescript
import MediaPlaceholder from "../components/MediaPlaceholder.svelte";
```

Add repost banner before `<div class="card-layout">`:

```svelte
{#if post.is_repost}
	<div class="repost-banner" data-testid="repost-banner">
		<span class="repost-icon">&#8635;</span> @dril retweeted
	</div>
{/if}
```

Add `<MediaPlaceholder>` after quoted block, before engagement:

```svelte
			{#if post.media.length > 0}
				<MediaPlaceholder media={post.media} />
			{/if}
```

Add styles (padding-left 52px matches reply-context):

```css
.repost-banner {
	font-size: 13px;
	color: #8a8a8a;
	padding: 0 0 4px 52px;
}

.repost-icon {
	font-size: 12px;
}
```

- [ ] **Step 6: Update Threads.svelte**

Add import:

```typescript
import MediaPlaceholder from "../components/MediaPlaceholder.svelte";
```

Add repost banner before `<div class="card-layout">`:

```svelte
{#if post.is_repost}
	<div class="repost-banner" data-testid="repost-banner">
		<span class="repost-icon">&#8635;</span> @dril retweeted
	</div>
{/if}
```

Add `<MediaPlaceholder>` after quoted block, before engagement:

```svelte
			{#if post.media.length > 0}
				<MediaPlaceholder media={post.media} />
			{/if}
```

Add styles (padding-left 52px matches reply-context):

```css
.repost-banner {
	font-size: 13px;
	color: #999;
	padding: 0 0 4px 52px;
}

.repost-icon {
	font-size: 12px;
}
```

- [ ] **Step 7: Verify visually in dev server**

Restart dev server. Search for "moon" — should see the repost with a "dril retweeted" banner. Search for "zoo" — should see the post with a media placeholder below the text.

- [ ] **Step 8: Commit**

```bash
git add site/src/templates/
git commit -m "feat(site): add repost banner and media placeholder to all templates"
```

---

### Task 7: Add E2E Tests

Add Playwright tests for media placeholders, repost rendering, and the retweets toggle.

**Files:**
- Modify: `e2e/search.spec.ts`

- [ ] **Step 1: Add repost search test**

Add after the existing tests in the `describe` block:

```typescript
test("repost renders with retweet banner", async ({ page }) => {
	await page.goto("/");
	const results = await searchFor(page, "moon");
	const cards = results.locator('[data-testid="post-card"]');
	await expect(cards).toHaveCount(1);
	const banner = results.locator('[data-testid="repost-banner"]');
	await expect(banner).toBeVisible();
	await expect(banner).toContainText("@dril retweeted");
});

test("retweets toggle excludes reposts", async ({ page }) => {
	await page.goto("/");
	await waitForReady(page);

	// Search for "moon" - should find the repost
	const searchInput = page.locator('[data-testid="search-input"]');
	await searchInput.fill("moon");
	const results = page.locator('[data-testid="results"]');
	await expect(results.locator('[data-testid="post-card"]')).toHaveCount(1, {
		timeout: 5_000,
	});

	// Open controls and uncheck retweets
	await page.locator('[data-testid="controls-toggle"]').click();
	await page.locator('[data-testid="retweets-toggle"]').uncheck();

	// Repost should disappear
	await expect(results.locator('[data-testid="post-card"]')).toHaveCount(0, {
		timeout: 5_000,
	});
	await expect(results).toContainText("no results");
});

test("media placeholder appears on post with media", async ({ page }) => {
	await page.goto("/");
	// Post id=3 (zoo) has an attached image
	const results = await searchFor(page, "zoo");
	const cards = results.locator('[data-testid="post-card"]');
	await expect(cards).toHaveCount(1);
	const media = results.locator('[data-testid="media-placeholder"]');
	await expect(media).toBeVisible();
	await expect(media).toContainText("1 image attached");
});

test("media placeholder click-to-load shows image or error", async ({ page }) => {
	await page.goto("/");
	const results = await searchFor(page, "zoo");
	const media = results.locator('[data-testid="media-placeholder"]');

	// Click to load
	await media.locator("button").click();

	// Should transition to either loaded (img) or error state
	// Since the URL is fake, expect error
	const errorOrImg = media.locator(".media-error, img");
	await expect(errorOrImg).toBeVisible({ timeout: 10_000 });
});
```

- [ ] **Step 2: Run E2E tests**

Run: `bun run test:e2e`

Expected: All existing 14 tests pass + 4 new tests pass (18 total).

- [ ] **Step 3: Commit**

```bash
git add e2e/search.spec.ts
git commit -m "test(e2e): add media placeholder and repost toggle tests"
```

---

### Task 8: Update Post Count and Final Verification

The dev script log says "Built ... with N posts" but now also includes reposts and media. Verify the counts are correct and run the full test suite.

**Files:** None to modify — verification only.

- [ ] **Step 1: Run Rust tests**

Run: `cargo test`

Expected: All 28 tests pass (the Rust tests use their own fixtures and are unaffected).

- [ ] **Step 2: Run E2E tests**

Run: `bun run test:e2e`

Expected: All 18 tests pass.

- [ ] **Step 3: Run formatters and linters**

Run:
```bash
cargo fmt
bunx prettier --write 'site/src/**/*.svelte'
bunx @biomejs/biome format --write --html-formatter-enabled=true --css-formatter-enabled=true site/
bunx @biomejs/biome lint site/
```

Fix any issues.

- [ ] **Step 4: Final commit with any formatting fixes**

```bash
git add -A
git commit -m "chore: format and lint fixes"
```

(Skip this commit if no changes were needed.)

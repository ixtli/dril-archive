# Development Guide — Lessons Learned

Hard-won knowledge from building this project. Read this before making changes.

## SQLite WASM in the Browser

### Use `@sqlite.org/sqlite-wasm`, never sql.js

sql.js (the community WASM build) has **never compiled with FTS5 support**. PRs to add it have been open for years. The official SQLite team build (`@sqlite.org/sqlite-wasm`) includes all extensions including FTS5.

### The API is different from sql.js

| Operation | sql.js | @sqlite.org/sqlite-wasm |
|-----------|--------|------------------------|
| Load DB from bytes | `new SQL.Database(uint8array)` | `sqlite3.capi.sqlite3_js_posix_create_file('/path', bytes)` then `new sqlite3.oo1.DB('/path', 'r')` |
| Get row values | `stmt.get()` | `stmt.get([])` — **must pass empty array**, or you only get column 0 |
| Cleanup | `stmt.free()` | `stmt.finalize()` |
| Bind params | `stmt.bind([val1, val2])` | Same, but positional bind is 1-based |

### Vite can't serve it from `public/`

Vite blocks JS imports from its `public/` directory at transform time (`"Cannot import non-asset file which is inside /public"`). This applies even with `/* @vite-ignore */` on the dynamic import, because Vite's import analysis plugin catches it before the module reaches the browser.

**Solution:** Store WASM files in `site/vendor/` (not `public/`) and serve them via a custom Vite middleware plugin that intercepts requests to `/sqlite3/*` and `/dril.db`, bypassing Vite's module transform entirely. See `site/vite.config.ts` for the implementation.

The `import()` in `site/src/lib/db.ts` uses:
```typescript
const moduleUrl = new URL("/sqlite3/index.mjs", window.location.origin).href;
const sqlite3InitModule = ((await import(/* @vite-ignore */ moduleUrl)) as any).default;
```
The runtime-constructed URL prevents Vite from analyzing it statically.

## Formatting and Linting

### Two formatters, one boundary

Biome doesn't support `.svelte` files. The project uses:
- **Prettier** + `prettier-plugin-svelte` + **eslint** + `eslint-plugin-svelte` for `site/src/`
- **Biome** for everything else (scripts, e2e tests, config files)

The pre-commit hooks enforce this boundary with `files:` and `exclude:` patterns. No file is touched by both formatters. This is documented because mixing formatters on the same file causes conflicts.

### Biome quirks

- **HTML/CSS need explicit flags:** `--html-formatter-enabled=true --css-formatter-enabled=true`
- **CSS comments with `*/` patterns break the parser:** A comment like `/* path/to/*/screenshot.png */` is parsed as ending at the first `*/`. Avoid glob-like patterns in CSS comments.
- **Pre-commit hooks can't use `types: [svelte]`:** The pre-commit framework doesn't recognize the `svelte` type. Use `files: \.svelte$` regex patterns instead.

### ESLint v8 vs v9

This project pins ESLint to v8 (`eslint@^8`) because `.eslintrc.cjs` is the v8 config format. ESLint v9 uses a flat config (`eslint.config.js`). If you upgrade ESLint, you'll need to migrate the config.

## E2E Testing with Playwright

### Don't assert transient loading states

The test DB is tiny (~11 posts, 28KB) and loads in milliseconds. Assertions like "loading indicator should be visible" will fail because the load completes before Playwright's first DOM check. Only assert the final state.

### Always rebuild the test DB

`scripts/dev.ts` must rebuild `site/vendor/dril.db` from `testdata/sample.ndjson` on every run, not skip when the file exists. A stale full-archive DB (from `bun run dev:full`) has 12,000+ posts and causes test count mismatches.

This was the root cause of 8/14 E2E test failures — searches returned more results than expected because the test was running against production data.

### Test data design

The `testdata/sample.ndjson` fixture is carefully designed for test assertions:
- Each test query should match a known, small number of posts
- Avoid words that appear in multiple test posts (e.g., don't put "corn" in the Bluesky test post if a "search for corn" test expects exactly 1 result)
- Post dates must align with theme era boundaries (e.g., a "modern era" test post must have `created_at` after `2019-07-15`)

### Playwright + TypeScript runners

**Never use `tsx` for scripts that call `page.evaluate()`.** The `tsx` transpiler (esbuild-based) injects `__name` helper decorators on function declarations. These don't exist in the browser context, causing `ReferenceError: __name is not defined`. Use `bun` as the script runner instead — it handles TypeScript natively without these injections.

Also convert named function declarations inside `page.evaluate` callbacks to arrow functions as a secondary defense.

## Data Pipeline

### Multi-source dedup

The builder uses `INSERT OR IGNORE` on all tables. When multiple data sources contain the same post (e.g., the committed `bsky-dril.jsonl` + a live Bluesky sync), duplicates are silently ignored. The FTS index is only populated for newly inserted rows — the `execute()` return value is checked to skip FTS insertion for ignored duplicates.

### Repost IDs can be null

Modern X/Twitter no longer gives reposts their own identity. The `Repost` type has `id: Option<String>`. The builder generates a synthetic ID (`repost-{original_post_id}`) when the ID is null.

### Platform field defaults

All types have `#[serde(default = "default_platform")]` which returns `"x"`. This means:
- Old NDJSON files without a `platform` field deserialize correctly
- The single-file builder mode (used by tests) works without changes
- The DB schema has `DEFAULT 'x'` on the `platform` column

### The scrape pipeline

```
codemasher/dril-archive JSON (2008-2023)
  → dril-normalizer --source codemasher → data/*.ndjson

Manual X scrapes (JSONL in data/scraped/)
  → python3 scripts/split_manual_scrape.py → appended to data/*.ndjson

Bluesky API sync
  → dril-bsky-sync → data/scraped/bsky-dril-live.jsonl → split_manual_scrape.py

All combined → dril-builder data/ site/vendor/dril.db
```

### Media items with null URLs

Some scraped media items have `url: null`. The `split_manual_scrape.py` script filters these out — a media item without a URL is useless.

## Theme Extraction (Wayback Machine)

### Be respectful

The Internet Archive is a public good. All tooling rate-limits aggressively:
- 10s between page loads
- 5s between CDX API calls
- Disk-cached CDX responses so repeated runs don't re-query
- Resumable crawls (safe to Ctrl+C)
- Never runs in CI — extraction is manual only

### CDX API is flaky

The Wayback Machine CDX API returns 504s under load. The client retries 3 times with exponential backoff (10s, 20s, 40s). This was added after the discover step crashed mid-run.

### Retweet snapshots don't work

Wayback Machine snapshots of Twitter retweet pages don't render with the expected CSS selectors. All retweet extractions fail across all 4 eras. This is a known limitation — we only extract themes from original posts, replies, quotes, and media posts.

### Wayback snapshots can be localized

Some archived pages render with Chinese or other non-English UI chrome. This doesn't affect theme extraction — we capture CSS computed styles and DOM structure, not UI strings.

## Frontend (Svelte + Vite)

### Post card overlay for screenshots

The "View original" link was moved from inside each template card to a hover/long-press overlay on the PostCard wrapper. This keeps cards clean for screenshots:
- **Desktop:** Hover → `...` button fades in → click → popover with "View original"
- **Mobile:** Long-press (500ms) → same popover

The overlay is absolutely positioned and doesn't affect card layout.

### Theme resolution

Each post gets its theme from `getAutoTheme(platform, created_at)`:
- `platform === "bsky"` → `bsky` template
- `platform === "threads"` → `threads` template
- X posts: date-based era detection with boundaries at 2010-09-01, 2014-06-01, 2019-07-15

Users can override theme via the controls panel. Override is display-only — doesn't affect data or search.

### Two dev modes

- `bun run dev` — quick start, 11 test posts, rebuilds every time
- `bun run dev:full` — clones codemasher archive, normalizes, appends scraped data, syncs Bluesky, builds full DB (~12,800 posts)

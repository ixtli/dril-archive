# dril-archive: Design Spec

## Overview

A static, CDN-distributable web application that provides instant fuzzy search over the complete archive of @dril tweets. The entire application — including the search index — ships as a handful of static files with no backend server.

## Goals

- Capture the full corpus of @dril tweets and replies from account inception (~2008) through present
- Sub-500ms fuzzy search over the entire dataset in-browser
- Distribute as static files deployable to any CDN or static host
- Minimal UI: search box, results list, links to live tweets

## Non-Goals

- Live engagement metrics (likes, retweets)
- Real-time sync with Twitter/X
- Rich UI features (filtering, browsing, analytics) — these may come later but are out of scope

## Architecture

### Data Acquisition

**Strategy:** Two-phase approach acknowledging that Twitter scraping is a moving target.

1. **Phase 1 — Historical bootstrap:** Find an existing community-maintained archive of @dril tweets covering inception through ~2023. Multiple such datasets exist in research and archival communities.
2. **Phase 2 — Gap fill:** Use Twitter/X API v2 Basic tier ($100/month, one month only) to pull tweets from 2023 through present. Cancel after the initial pull.

**Tooling:** Use existing Python tools/libraries for the Twitter-specific work (archive parsing, API interaction). Do not rewrite esoteric Twitter scraping logic.

### Intermediate Format

All data sources normalize into a single canonical JSON format before entering the build pipeline:

```json
{
  "id": "123456789",
  "text": "the wise man bowed his head solemnly and spoke...",
  "created_at": "2014-03-12T15:30:00Z",
  "is_reply": false,
  "reply_to_user": null,
  "is_quote": false,
  "quoted_text": null
}
```

Fields:
- `id` — Tweet ID (string). Used to derive the canonical URL: `https://x.com/dril/status/{id}`
- `text` — Full tweet text
- `created_at` — ISO 8601 timestamp
- `is_reply` — Whether this tweet is a reply
- `reply_to_user` — Username of the account being replied to, if applicable
- `is_quote` — Whether this tweet quotes another tweet
- `quoted_text` — Text of the quoted tweet, if applicable

Tweet URLs are not stored — they are deterministic from the ID.

### Normalizer (Rust)

A Rust CLI that converts raw output from whatever acquisition tool is used into the canonical JSON format above. This is the adapter layer between messy real-world data sources and the clean build pipeline.

- Accepts raw data on stdin or as a file path argument
- Outputs normalized JSON (one object per line, NDJSON)
- Validates and deduplicates by tweet ID

### Builder (Rust)

A Rust CLI that reads normalized JSON and produces a single SQLite database file with a full-text search index.

**Dependencies:**
- `rusqlite` with `bundled` feature (bundles SQLite with FTS5 support)
- `serde` / `serde_json` for JSON parsing

**Schema:**

```sql
CREATE TABLE tweets (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    is_reply INTEGER NOT NULL DEFAULT 0,
    reply_to_user TEXT,
    is_quote INTEGER NOT NULL DEFAULT 0,
    quoted_text TEXT
);

CREATE VIRTUAL TABLE tweets_fts USING fts5(
    text,
    quoted_text,
    content='tweets',
    content_rowid='rowid'
);
```

**Build steps:**
1. Read NDJSON from the normalizer output
2. Insert all rows into `tweets`
3. Populate `tweets_fts` from `tweets`
4. Run `PRAGMA optimize` and `VACUUM`
5. Output `dril.db`

The script is idempotent — re-run with updated JSON to produce a fresh database.

### Frontend (Vanilla HTML/JS/CSS)

A single-page static application with no build step, no framework, no dependencies beyond sql.js.

**Startup sequence:**

1. Page loads with a progress bar
2. Fetch `dril.db` — track `Content-Length` and bytes received to show real download progress
3. Fetch sql.js WASM binary (from public CDN, ~1MB, browser-cached)
4. Initialize SQLite in-browser — show spinner with "Preparing search..." text
5. Once ready, transition to the search interface

**Search interaction:**

1. Single text input, focused on load
2. On keystroke, debounce 100-150ms, then execute FTS5 query:
   ```sql
   SELECT id, text, created_at, is_reply, reply_to_user
   FROM tweets_fts
   JOIN tweets ON tweets.rowid = tweets_fts.rowid
   WHERE tweets_fts MATCH ?
   ORDER BY rank
   LIMIT 50
   ```
   (Query term uses FTS5 prefix syntax, e.g. `"corn"*` for as-you-type matching)
3. Results render as a list: tweet text, formatted date, link to `https://x.com/dril/status/{id}`

**No further network requests after initial load.** Everything is local once the DB is in memory.

### Distribution

The deployable artifact is the `site/` directory:

```
site/
├── index.html
├── app.js
├── style.css
└── dril.db
```

Drop this on any static host: GitHub Pages, Netlify, S3 + CloudFront, Cloudflare Pages, etc. The sql.js WASM binary is loaded from a public CDN and cached by the browser.

## Project Structure

```
dril-archive/
├── scraper/              # Data acquisition (Python, existing tools)
│   └── ...               # TBD based on available tools/archives
├── normalizer/           # Rust CLI: raw data → canonical NDJSON
│   ├── Cargo.toml
│   └── src/
│       └── main.rs
├── builder/              # Rust CLI: NDJSON → SQLite with FTS5
│   ├── Cargo.toml
│   └── src/
│       └── main.rs
├── site/                 # Static frontend (the deployable)
│   ├── index.html
│   ├── app.js
│   └── style.css
├── data/                 # Raw + intermediate data (gitignored)
│   ├── raw/
│   └── tweets.ndjson
└── docs/
```

`data/` and `site/dril.db` are gitignored. The database is a build artifact.

## Build Flow

```
[Twitter archive / API data]
        │
        ▼
   scraper/ (Python, existing tools)
        │  raw data
        ▼
   normalizer (Rust CLI)
        │  tweets.ndjson
        ▼
   builder (Rust CLI)
        │  dril.db
        ▼
   site/ (deploy)
```

## Technology Choices

| Component | Language | Rationale |
|-----------|----------|-----------|
| Scraper | Python (existing tools) | Don't rewrite esoteric Twitter scraping logic |
| Normalizer | Rust | Developer preference, straightforward data transform |
| Builder | Rust | Developer preference, `rusqlite` with bundled FTS5 |
| Frontend | Vanilla HTML/JS/CSS | No build step, no framework, maximum portability |
| Search engine | SQLite FTS5 via sql.js | Battle-tested, fast, single-file distribution |

## Size Estimates

- ~50K tweets at ~280 chars average = ~14MB raw text
- SQLite DB with FTS5 index: ~20-25MB
- sql.js WASM: ~1MB (CDN-cached)
- Frontend assets: <50KB
- **Total transfer on first visit: ~25MB** (subsequent visits: only DB if WASM is cached)

## Performance Target

- FTS5 prefix query over 50K rows: <50ms typical (well under 500ms target)
- Debounce interval: 100-150ms
- Perceived latency from keystroke to results: <250ms

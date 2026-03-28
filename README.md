# dril-archive

A searchable archive of [@dril](https://x.com/dril) posts that runs entirely in your browser. No server required — just static files you can host anywhere.

Type a word, get results instantly. The entire post corpus lives in a single SQLite database that loads into your browser via WebAssembly.

## How it works

1. A Rust CLI ingests posts as NDJSON and builds a SQLite database with a full-text search index (FTS5)
2. A static web page downloads that database and opens it in-browser using the [official SQLite WASM build](https://sqlite.org/wasm)
3. Every keystroke fires a prefix-matched FTS5 query — results appear in under 50ms

The deployable is the `site/` directory: `index.html`, `app.js`, `style.css`, `dril.db`, and `sqlite3/` (WASM runtime). Drop it on any static host.

## Data pipeline

To ingest the [codemasher/dril-archive](https://github.com/codemasher/dril-archive):

```sh
# Clone the archive
git clone https://github.com/codemasher/dril-archive.git /tmp/dril-archive

# Normalize to NDJSON (posts, reposts, media, users)
cargo run --release -p dril-normalizer -- \
  --source codemasher \
  --input /tmp/dril-archive/.build/dril.json \
  --output-dir data/

# Build the database
cargo run --release -p dril-builder -- data/ site/dril.db
```

The builder also accepts a single NDJSON file for simple use: `dril-builder posts.ndjson output.db`

## Development

Requires [Bun](https://bun.sh/) for the dev server and E2E tests.

```sh
# Install JS dependencies (one-time)
bun install && bunx playwright install chromium

# Start dev server (builds test DB + serves site)
bun run dev

# Run Rust tests
cargo test

# Run E2E browser tests
bun run test:e2e

# Check formatting and lints (requires pre-commit)
pre-commit run --all-files
```

## Data sources

| Source | Platform | Period | Posts | Notes |
|--------|----------|--------|-------|-------|
| [codemasher/dril-archive](https://github.com/codemasher/dril-archive) | X | 2008-09 to 2023-04 | ~11,075 | Complete archive including reposts, media, quote tweets |
| Manual scrape (search) | X | 2023-01 to 2024-04 | ~552 | See caveats below |
| Manual scrape (profile) | X | 2024-04 to 2026-03 | ~676 | Includes reposts |
| Bluesky API sync | Bluesky | 2023-04 to present | ~507 | Auto-synced daily |

### Caveats for the 2023-2024 search data

- **No reposts** — `from:dril` search only returns dril's own posts, not retweets
- **Nov-Dec 2023 gap** — search returned 0 results for this window; may be a gap in posting or a search limitation
- **No quote tweets detected** — quote tweets may not appear in search results the same way as regular posts
- **~20 results per page cap** — dense posting periods may have missed posts despite 2-week search windows

## Historical theme extraction

The `theme-extractor/` directory contains tooling to scrape the [Wayback Machine](https://web.archive.org/) and archive how dril's tweets looked at different points in time across Twitter's four design eras (Classic, New, Material, Modern).

It captures the actual DOM structure and computed CSS from archived tweet pages, plus dril's profile metadata (display name, bio, avatar) over time. The same infrastructure also supports backfilling missing posts from the 2023-2024 gap period when Twitter's API became unreliable.

```sh
cd theme-extractor
bun install && npx playwright install chromium

bun run select          # Find candidate posts from the archive DB
bun run discover        # Check Wayback Machine for snapshots
bun run extract:themes  # Extract DOM/CSS/screenshots
bun run build:themes    # Generate theme CSS

bun run backfill        # Recover missing 2023-2024 posts (incremental)
```

All extraction is manual, rate-limited (10s between page loads), and resumable. See [CLAUDE.md](CLAUDE.md) for full details.

## Status

The archive covers 2008 through present across X and Bluesky (~12,800 posts). Bluesky syncs daily. The X data has a known thin spot in late 2023. Theme extraction tooling is built; frontend integration of era-accurate post styling is in progress.

## License

TBD

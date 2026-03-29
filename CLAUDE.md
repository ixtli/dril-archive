# dril-archive

A static web app for fuzzy-searching @dril's post archive, distributable via CDN.

## Architecture

- **Normalizer** (`normalizer/`): Rust CLI that reads source archives (e.g., codemasher/dril-archive JSON) and outputs NDJSON files via a pluggable `DataSource` trait
- **Builder** (`builder/`): Rust CLI that reads NDJSON (single file or directory of 4 files) and produces a SQLite database with FTS5 full-text search index
- **Frontend** (`site/`): Svelte 5 + Vite single-page app that loads the SQLite DB in-browser via `@sqlite.org/sqlite-wasm` and provides instant as-you-type search with era-themed post cards
- **No backend server** — the entire app is static files (Vite builds to `site/dist/`)

## Project Layout

```
normalizer/        Rust CLI (Cargo workspace member)
  src/main.rs      CLI entry point: --source, --input, --output-dir
  src/source.rs    DataSource trait
  src/codemasher.rs  CodmasherSource implementation
  src/post.rs      Post type (Serialize + Deserialize)
builder/           Rust CLI (Cargo workspace member)
  src/main.rs      CLI entry point: file or directory input
  src/post.rs      Post struct, NDJSON parser with dedup
  src/db.rs        SQLite schema creation, FTS5 indexing
types/             Shared types crate
  src/lib.rs       Repost, MediaItem, User structs
site/              Svelte + Vite frontend (the deployable artifact)
  index.html       Vite entry point
  vite.config.ts   Vite config with SQLite WASM middleware
  src/             Svelte application source
    main.ts        App bootstrap
    App.svelte     Root component (loading, search, results)
    app.css        Global styles
    components/    UI components (SearchBar, Controls, PostCard, LoadingBar)
    templates/     Era-themed post templates (TwitterClassic, TwitterModern, Bluesky, etc.)
    lib/           Core logic (db.ts, search.ts, themes.ts, types.ts)
    styles/        Per-era CSS (twitter-classic.css, twitter-modern.css, bluesky.css, etc.)
  vendor/          SQLite WASM + DB files (served via Vite middleware, gitignored)
theme-extractor/   Wayback Machine extraction tooling (standalone)
  src/lib/         Reusable core: CDX client, page loader, rate limiter, progress tracker
  src/tasks/       Task scripts: sample selection, theme/profile extraction, backfill
  data/            Raw extraction output (gitignored)
  output/          Generated themes + avatars (checked in)
testdata/          Test fixtures
  sample.ndjson    10 sample posts (single-file mode)
  dir-test/        Directory mode test fixtures (4 NDJSON files)
  codemasher/      Minimal codemasher archive fixture
data/              Raw + intermediate data (gitignored)
docs/superpowers/  Design specs and implementation plans
```

## Build & Run

```sh
bun run dev          # Quick start: test DB (11 posts) + Vite dev server
bun run dev:full     # Full archive: normalize + scrape + bsky sync + Vite (~12,800 posts)
bun run build        # Production build to site/dist/
```

For manual pipeline control:

```sh
cargo build --release -p dril-normalizer -p dril-builder -p dril-bsky-sync
./target/release/dril-normalizer --source codemasher --input <dril.json> --output-dir data/
./target/release/dril-bsky-sync --output data/scraped/bsky-dril.jsonl
./target/release/dril-builder data/ site/vendor/dril.db
```

## Testing

```sh
cargo test                     # 28 Rust tests (19 builder + 9 normalizer)
bun run test:e2e               # 14 Playwright E2E tests
```

## Dev Server

```sh
bun run dev                   # Start Vite dev server on localhost:5173
```

The dev script (`scripts/dev.ts`) copies SQLite WASM files to `site/vendor/sqlite3/`, builds the test DB if needed, then starts Vite.

## Code Quality

Pre-commit hooks enforce formatting and linting. They run automatically on `git commit`.

- **Rust**: `cargo fmt --check`, `cargo clippy -- -D warnings`
- **Svelte**: `prettier --check` for `.svelte` files in `site/src/` (Biome does not support `.svelte`)
- **JS/TS/HTML/CSS**: `biome format` and `biome lint` (via `bunx @biomejs/biome`) for everything outside `.svelte`

**Dual formatter boundary:** Prettier handles `site/src/**/*.svelte` because Biome has no Svelte parser. Everything else uses Biome. The pre-commit hooks enforce both.

To manually run all hooks: `pre-commit run --all-files`

To format before committing:

```sh
cargo fmt
bunx prettier --write 'site/src/**/*.svelte'
bunx @biomejs/biome format --write --html-formatter-enabled=true --css-formatter-enabled=true site/
```

## Tech Stack

| Component          | Technology                                                            |
| ------------------ | --------------------------------------------------------------------- |
| Normalizer         | Rust, `serde`/`serde_json`, `chrono`, `DataSource` trait              |
| Builder            | Rust, `rusqlite` 0.39 (bundled FTS5), `serde`/`serde_json`            |
| Search index       | SQLite FTS5 (prefix matching, sub-50ms queries)                       |
| Frontend           | Svelte 5, Vite, `@sqlite.org/sqlite-wasm` (official SQLite WASM)      |
| E2E Testing        | Playwright (headless Chromium, 14 tests)                              |
| Theme Extractor    | TypeScript, Playwright, better-sqlite3, Wayback Machine CDX API       |
| Formatting/Linting | Prettier (`.svelte` only), Biome (everything else), cargo fmt, clippy |
| Git hooks          | pre-commit framework                                                  |

## Conventions

- Rust edition 2024
- Commit messages: `type(scope): description` (e.g., `feat(builder):`, `fix:`, `chore:`)
- Frontend uses tabs (biome default), Rust uses spaces (rustfmt default)
- `.svelte` files use Prettier (Biome has no Svelte support); all other JS/TS/HTML/CSS uses Biome
- `data/`, `site/dril.db`, `site/vendor/`, `site/dist/`, `site/themes/`, and `site/avatars/` are gitignored (build artifacts)
- `theme-extractor/data/` is gitignored; `theme-extractor/output/` is checked in
- `Cargo.lock` is committed (binary crate, reproducible builds)

## Data Pipeline

```
source archive (e.g. codemasher .build/dril.json)
  → dril-normalizer --source codemasher --input dril.json --output-dir data/
  → data/{posts,reposts,media,users}.ndjson
  → dril-builder data/ site/dril.db
  → deploy site/
```

The builder also accepts a single NDJSON file for simple use: `dril-builder posts.ndjson output.db`

## Intermediate Data Format (NDJSON)

The normalizer outputs 4 files:

**posts.ndjson** — one JSON object per line:

```json
{
  "id": "123",
  "text": "...",
  "created_at": "2014-03-12T15:30:00Z",
  "is_reply": false,
  "reply_to_user": null,
  "is_quote": false,
  "quoted_text": null,
  "likes": 42000,
  "shares": 12000
}
```

**reposts.ndjson** — retweets with original content:

```json
{
  "id": "100",
  "created_at": "...",
  "original_post_id": "200",
  "original_user_id": "300",
  "original_text": "...",
  "original_created_at": "...",
  "likes": 5000,
  "shares": 1200
}
```

**media.ndjson** — media attachments:

```json
{
  "post_id": "123",
  "type": "photo",
  "url": "https://...",
  "width": 1200,
  "height": 800,
  "alt_text": "..."
}
```

**users.ndjson** — user lookup:

```json
{ "id": "16298441", "screen_name": "dril", "name": "wint" }
```

Post URLs are derived from ID: `https://x.com/dril/status/{id}`

## Gotchas

See [docs/DEVELOPMENT-GUIDE.md](docs/DEVELOPMENT-GUIDE.md) for comprehensive lessons learned. Key ones:

- **Do not use sql.js** — it has never shipped FTS5. Use `@sqlite.org/sqlite-wasm` (official SQLite build).
- **SQLite WASM API differs from sql.js** — `posix_create_file` + `DB()`, `stmt.get([])`, `stmt.finalize()`. See the guide for full API mapping.
- **Vite can't import from `public/`** — WASM files live in `site/vendor/` served via a custom Vite middleware plugin. This is the single trickiest part of the frontend build.
- **Two formatters, one boundary** — Prettier for `site/src/*.svelte`, Biome for everything else. Biome has no Svelte support.
- **E2E test DB must always rebuild** — `scripts/dev.ts` rebuilds from `testdata/sample.ndjson` every run. A stale full-archive DB causes count mismatches.
- **Never use `tsx` with Playwright `page.evaluate`** — use `bun` instead (`tsx` injects `__name` helpers that break browser context).
- **Respect the Internet Archive** — all Wayback Machine access is rate-limited (10s+ between loads). Never run in CI.

## Theme Extractor

The `theme-extractor/` directory is a self-contained TypeScript project that scrapes the Wayback Machine to archive how tweets looked at different points in time. It has its own `package.json` and dependencies (Playwright, better-sqlite3).

### Architecture

The tooling is split into a **reusable core library** (`src/lib/`) and **task scripts** (`src/tasks/`):

**Core library:**

- `cdx.ts` — Wayback Machine CDX API client with disk-based response caching
- `wayback-page.ts` — Playwright page loader with Wayback toolbar removal and retries
- `rate-limiter.ts` — Configurable delay with jitter and exponential backoff (default 10s between page loads)
- `progress.ts` — Resumable JSON state tracker for long-running crawls
- `tweet-selectors.ts` — Era-aware CSS selector chains for all 4 Twitter design eras
- `types.ts` — Platform-prefixed theme IDs (`twitter-classic`, `twitter-new`, `twitter-material`, `twitter-modern`)

**Task scripts:**
| Script | Purpose | Command |
|--------|---------|---------|
| `select-samples.ts` | Query archive DB for candidate post IDs per content type and era | `bun run select` |
| `discover-samples.ts` | Check CDX availability for candidates, build sample manifest | `bun run discover` |
| `extract-themes.ts` | Extract DOM structure, computed CSS, and screenshots from Wayback snapshots | `bun run extract:themes` |
| `extract-profiles.ts` | Extract dril's display name, bio, and avatar from profile page snapshots | `bun run extract:profiles` |
| `build-themes.ts` | Generate theme CSS files from extracted data and researched defaults | `bun run build:themes` |
| `backfill-posts.ts` | Recover missing posts from the 2023–2024 gap via Wayback Machine | `bun run backfill` |

### Usage

```sh
cd theme-extractor
bun install
npx playwright install chromium

# Theme extraction pipeline (run in order)
bun run select                      # Find candidate posts from the archive DB
bun run discover                    # Check Wayback Machine for available snapshots
bun run extract:themes              # Extract DOM/CSS/screenshots
bun run extract:profiles            # Extract profile metadata + avatars
bun run build:themes                # Generate theme CSS files

# Post backfill (incremental, safe to interrupt)
bun run backfill                    # Recover missing 2023-2024 posts
bun run backfill -- --batch-size 50 # Limit to 50 posts per session
```

All extraction is manual and offline — never runs in CI. Results in `data/` are gitignored; generated output in `output/` is checked in.

### Gotchas

- **All Wayback Machine access is rate-limited** — 10s between page loads, 5s between CDX API calls. Be respectful.
- **The progress tracker enables resumable crawls** — safe to Ctrl+C and re-run. State is saved in `data/*/progress.json`.
- **Selector chains are best-effort** — Wayback Machine snapshots vary in fidelity. Some pages may not render correctly. Failed extractions are logged and skipped.
- **theme-extractor/ has its own node_modules** — it's independent from the root project's dependencies. Run `bun install` inside the directory.

## Not Yet Implemented

- **Media rendering** in the frontend (data is captured in the DB)
- **Threads scraping** — Threads API requires OAuth; manual scraping or a future public API needed
- **Profile snapshots** in the builder and frontend (extraction tooling is built, builder support is pending)
- **Post backfill** for the 2023-2024 gap via Wayback Machine (tooling is built, crawl not yet run)
- **Nov-Dec 2023 gap** on X — search returned 0 results for this window, needs investigation

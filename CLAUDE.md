# dril-archive

A static web app for fuzzy-searching @dril's post archive, distributable via CDN.

## Architecture

- **Normalizer** (`normalizer/`): Rust CLI that reads source archives (e.g., codemasher/dril-archive JSON) and outputs NDJSON files via a pluggable `DataSource` trait
- **Builder** (`builder/`): Rust CLI that reads NDJSON (single file or directory of 4 files) and produces a SQLite database with FTS5 full-text search index
- **Frontend** (`site/`): Vanilla HTML/JS/CSS single-page app that loads the SQLite DB in-browser via `@sqlite.org/sqlite-wasm` and provides instant as-you-type search
- **No backend server** — the entire app is static files

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
site/              Static frontend (the deployable artifact)
  index.html       App shell with loading/search UI
  app.js           DB loading with progress, search, rendering
  style.css        Dark theme, minimal styling
testdata/          Test fixtures
  sample.ndjson    10 sample posts (single-file mode)
  dir-test/        Directory mode test fixtures (4 NDJSON files)
  codemasher/      Minimal codemasher archive fixture
data/              Raw + intermediate data (gitignored)
docs/superpowers/  Design specs and implementation plans
```

## Build & Run

```sh
# Build the builder
cargo build --release -p dril-builder

# Generate the database from NDJSON
./target/release/dril-builder <input.ndjson> [output.db]
# or from stdin:
cat posts.ndjson | ./target/release/dril-builder - site/dril.db

# Serve the site locally
python3 -m http.server 8080 --directory site
```

## Testing

```sh
cargo test -p dril-builder     # 18 Rust tests (7 post parser + 11 db)
cargo test -p dril-normalizer  # 9 normalizer tests
bun run test:e2e               # 5 E2E browser tests (Playwright)
```

## Dev Server

```sh
bun run dev                   # Build test DB + serve site on localhost:3000
```

The dev script (`scripts/dev.ts`) copies SQLite WASM files from `node_modules` to `site/sqlite3/`, builds the test DB if needed, and serves the site.

## Code Quality

Pre-commit hooks enforce formatting and linting. They run automatically on `git commit`.

- **Rust**: `cargo fmt --check`, `cargo clippy -- -D warnings`
- **JS/HTML/CSS**: `biome format` and `biome lint` (via `bunx @biomejs/biome`)

To manually run all hooks: `pre-commit run --all-files`

To format before committing:
```sh
cargo fmt
bunx @biomejs/biome format --write --html-formatter-enabled=true --css-formatter-enabled=true site/
bunx @biomejs/biome check --write site/app.js
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Normalizer | Rust, `serde`/`serde_json`, `chrono`, `DataSource` trait |
| Builder | Rust, `rusqlite` 0.39 (bundled FTS5), `serde`/`serde_json` |
| Search index | SQLite FTS5 (prefix matching, sub-50ms queries) |
| Frontend | Vanilla HTML/JS/CSS, `@sqlite.org/sqlite-wasm` (official SQLite WASM) |
| E2E Testing | Playwright (headless Chromium) |
| Formatting/Linting | Biome via bun, cargo fmt, clippy |
| Git hooks | pre-commit framework |

## Conventions

- Rust edition 2024
- Commit messages: `type(scope): description` (e.g., `feat(builder):`, `fix:`, `chore:`)
- Frontend uses tabs (biome default), Rust uses spaces (rustfmt default)
- No frameworks, no build step for frontend — just static files
- `data/`, `site/dril.db`, and `site/sqlite3/` are gitignored (build artifacts)
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
{"id":"123","text":"...","created_at":"2014-03-12T15:30:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":42000,"shares":12000}
```

**reposts.ndjson** — retweets with original content:
```json
{"id":"100","created_at":"...","original_post_id":"200","original_user_id":"300","original_text":"...","original_created_at":"...","likes":5000,"shares":1200}
```

**media.ndjson** — media attachments:
```json
{"post_id":"123","type":"photo","url":"https://...","width":1200,"height":800,"alt_text":"..."}
```

**users.ndjson** — user lookup:
```json
{"id":"16298441","screen_name":"dril","name":"wint"}
```

Post URLs are derived from ID: `https://x.com/dril/status/{id}`

## Gotchas

- **Do not use sql.js** — it has never shipped FTS5 support. We use `@sqlite.org/sqlite-wasm` (the official SQLite team build) which includes all extensions. This was discovered when E2E tests revealed "no such module: fts5" in-browser.
- **SQLite WASM API is not sql.js** — loading a DB requires `sqlite3.capi.sqlite3_js_posix_create_file(path, bytes)` then `new sqlite3.oo1.DB(path, 'r')`. Row access uses `stmt.get([])` (must pass empty array). Cleanup is `stmt.finalize()` not `stmt.free()`.
- **`site/sqlite3/` is a build artifact** — the WASM files are copied from `node_modules` by `scripts/dev.ts`. Don't edit them or commit them. Run `bun run dev` to regenerate.
- **Biome ignores HTML/CSS by default** — format commands need `--html-formatter-enabled=true --css-formatter-enabled=true`. The pre-commit hooks already have this configured.
- **E2E tests must not assert transient loading states** — the test DB is tiny and loads before Playwright can observe the progress bar. Only assert the final state (search input visible).

## Not Yet Implemented

- **Media rendering** in the frontend (data is captured in the DB)
- **Repost display** in the frontend (data is captured in the DB)
- **Twitter API gap-fill** normalizer source (2023-present, ~$100 one-time)
- **Production deployment**: Static hosting setup

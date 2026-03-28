# dril-archive

A static web app for fuzzy-searching @dril's post archive, distributable via CDN.

## Architecture

- **Builder** (`builder/`): Rust CLI that reads NDJSON post data and produces a SQLite database with FTS5 full-text search index
- **Frontend** (`site/`): Vanilla HTML/JS/CSS single-page app that loads the SQLite DB in-browser via sql.js (WASM) and provides instant as-you-type search
- **No backend server** — the entire app is static files

## Project Layout

```
builder/           Rust CLI (Cargo workspace member)
  src/main.rs      CLI entry point: reads NDJSON, writes .db
  src/post.rs      Post struct, NDJSON parser with dedup
  src/db.rs        SQLite schema creation, FTS5 indexing
site/              Static frontend (the deployable artifact)
  index.html       App shell with loading/search UI
  app.js           DB loading with progress, search, rendering
  style.css        Dark theme, minimal styling
testdata/          Synthetic test fixtures
  sample.ndjson    10 sample posts for development/testing
data/              Raw + intermediate data (gitignored)
docs/superpowers/  Design spec and implementation plan
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
cargo test -p dril-builder    # 14 tests (7 post parser + 7 db)
```

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
| Builder | Rust, `rusqlite` 0.39 (bundled FTS5), `serde`/`serde_json` |
| Search index | SQLite FTS5 (prefix matching, sub-50ms queries) |
| Frontend | Vanilla HTML/JS/CSS, sql.js 1.13.0 (WASM) |
| Formatting/Linting | Biome via bun, cargo fmt, clippy |
| Git hooks | pre-commit framework |

## Conventions

- Rust edition 2024
- Commit messages: `type(scope): description` (e.g., `feat(builder):`, `fix:`, `chore:`)
- Frontend uses tabs (biome default), Rust uses spaces (rustfmt default)
- No frameworks, no build step for frontend — just static files
- `data/` and `site/dril.db` are gitignored (build artifacts)
- `Cargo.lock` is committed (binary crate, reproducible builds)

## Intermediate Data Format (NDJSON)

One JSON object per line:
```json
{"id":"123","text":"...","created_at":"2014-03-12T15:30:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":42000,"shares":12000}
```

Post URLs are derived from ID: `https://x.com/dril/status/{id}`

## Not Yet Implemented

- **Normalizer**: Rust CLI to convert raw archive/API data to NDJSON (blocked on choosing data source)
- **Data acquisition**: Finding a community dril post archive + Twitter API gap-fill
- **Production deployment**: Static hosting setup

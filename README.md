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

## Status

The normalizer, builder, and search frontend are functional. The [codemasher/dril-archive](https://github.com/codemasher/dril-archive) covers ~11,000 posts from 2008-2023. A gap-fill for 2023-present is planned.

## License

TBD

# dril-archive

A searchable archive of [@dril](https://x.com/dril) posts that runs entirely in your browser. No server required — just static files you can host anywhere.

Type a word, get results instantly. The entire post corpus lives in a single SQLite database that loads into your browser via WebAssembly.

## How it works

1. A Rust CLI ingests posts as NDJSON and builds a SQLite database with a full-text search index (FTS5)
2. A static web page downloads that database and opens it in-browser using [sql.js](https://github.com/sql-js/sql.js)
3. Every keystroke fires a prefix-matched FTS5 query — results appear in under 50ms

The whole thing ships as four files: `index.html`, `app.js`, `style.css`, and `dril.db`. Drop them on any static host.

## Building

Requires [Rust](https://rustup.rs/).

```sh
cargo build --release -p dril-builder
```

Given a file of posts in NDJSON format (one JSON object per line):

```sh
./target/release/dril-builder posts.ndjson site/dril.db
```

Then serve `site/` with any HTTP server:

```sh
python3 -m http.server 8080 --directory site
```

## Post format

Each line of the input NDJSON file should look like:

```json
{"id":"12345","text":"the post text","created_at":"2014-03-12T15:30:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":42000,"shares":12000}
```

The builder also accepts `-` to read from stdin.

## Development

```sh
# Run tests
cargo test

# Build a test database from sample data
cargo run -p dril-builder -- testdata/sample.ndjson site/dril.db

# Check formatting and lints (requires pre-commit, bun)
pre-commit run --all-files
```

## Status

The builder and search frontend are functional. Data acquisition (sourcing the actual post archive) is in progress.

## License

TBD

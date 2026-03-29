# Normalizer + Schema Extensions Design Spec

## Overview

Add a Rust normalizer CLI that reads the codemasher/dril-archive JSON format and outputs NDJSON files for posts, reposts, media, and users. Extend the DB schema with new tables for reposts, media, and users. Update the builder to handle the multi-file input.

## Goals

- Ingest the codemasher/dril-archive dataset (~11,991 tweets covering 2008-2023)
- Separate dril's original posts from retweets (reposts)
- Capture media metadata (URLs, types, dimensions, alt text)
- Store user data for resolving IDs to screen names
- Preserve the existing single-file builder mode for tests and dev

## Non-Goals

- Rendering media in the frontend (future work)
- Searching reposts via FTS (future work)
- Twitter API gap-fill normalizer (future work — will implement the same DataSource trait)
- Modifying the frontend

## Data Source

**Repository:** https://github.com/codemasher/dril-archive
**Format:** Single JSON file at `.build/dril.json` (14MB)
**Structure:**
```json
{
  "tweets": [ ... ],  // 11,991 tweet objects
  "users": [ ... ]    // 1,477 user objects
}
```

**Date range:** 2008-09-15 to 2023-04-23

### Tweet Object Fields (relevant subset)

| Field | Type | Notes |
|-------|------|-------|
| `id` | int | Tweet ID (snowflake) |
| `user_id` | int | Always 16298441 for dril's own posts |
| `created_at` | int | Unix timestamp (seconds) |
| `text` | string | Full text, URLs expanded |
| `like_count` | int | |
| `retweet_count` | int | |
| `in_reply_to_status_id` | int/null | |
| `in_reply_to_screen_name` | string/null | |
| `is_quote_status` | bool | |
| `quoted_status` | object/null | Full embedded tweet, present on ~28 of 36 quote tweets |
| `retweeted_status_id` | int/null | Presence indicates a retweet |
| `retweeted_status` | object/null | Full embedded original tweet |
| `media` | array | Media objects (empty array if none) |

### User Object Fields

| Field | Type |
|-------|------|
| `id` | int |
| `screen_name` | string |
| `name` | string |

### Content Breakdown

- ~11,075 original posts (including replies and quote tweets)
- 916 retweets (routed to reposts table)
- 1,740 replies (156 self-replies/threads)
- 36 quote tweets
- 908 posts with media

## DB Schema

### Existing: `posts` table (unchanged)

```sql
CREATE TABLE posts (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    is_reply INTEGER NOT NULL DEFAULT 0,
    reply_to_user TEXT,
    is_quote INTEGER NOT NULL DEFAULT 0,
    quoted_text TEXT,
    likes INTEGER NOT NULL DEFAULT 0,
    shares INTEGER NOT NULL DEFAULT 0
);
```

### Existing: `posts_fts` (unchanged)

```sql
CREATE VIRTUAL TABLE posts_fts USING fts5(
    text, quoted_text,
    content='posts', content_rowid='rowid'
);
```

### New: `reposts` table

```sql
CREATE TABLE reposts (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    original_post_id TEXT NOT NULL,
    original_user_id TEXT NOT NULL,
    original_text TEXT NOT NULL,
    original_created_at TEXT NOT NULL,
    likes INTEGER NOT NULL DEFAULT 0,
    shares INTEGER NOT NULL DEFAULT 0
);
```

### New: `media` table

```sql
CREATE TABLE media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT NOT NULL REFERENCES posts(id),
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    alt_text TEXT
);
```

### New: `users` table

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    screen_name TEXT NOT NULL,
    name TEXT
);
```

No FTS index on reposts, media, or users. Search only covers dril's original posts.

## Normalizer Architecture

### DataSource Trait

```rust
trait DataSource {
    fn posts(&self) -> Vec<Post>;
    fn reposts(&self) -> Vec<Repost>;
    fn media(&self) -> Vec<MediaItem>;
    fn users(&self) -> Vec<User>;
}
```

### CodmasherSource

Implements `DataSource` by parsing `.build/dril.json`:

1. Parse the JSON file into `tweets` and `users` arrays
2. Build a `user_id → screen_name` lookup map from `users`
3. Split `tweets` into posts vs reposts based on presence of `retweeted_status_id`
4. For each post: extract media objects into flat `MediaItem` records
5. For each repost: pull engagement metrics from `retweeted_status`, resolve user via lookup map

### Key Transforms

- `created_at`: Unix epoch integer → ISO 8601 string (`"2014-03-12T15:30:00Z"`)
- `id`: integer → string (avoid JS precision loss on snowflake IDs)
- `reply_to_user`: resolved from `in_reply_to_screen_name` field directly (already a string in the archive)
- `quoted_text`: extracted from `quoted_status.text` if present, null otherwise
- Repost engagement: use `retweeted_status.like_count` and `retweeted_status.retweet_count` (outer is always 0)
- 1 repost has `retweeted_status_id` but no `retweeted_status` object — store with empty `original_text`

### Output Format

The normalizer writes to a directory, one NDJSON file per table:

```
output/
  posts.ndjson      # Post objects (same schema as before + media extracted separately)
  reposts.ndjson    # Repost objects
  media.ndjson      # Media objects with post_id foreign key
  users.ndjson      # User objects
```

### CLI

```
dril-normalizer --source codemasher --input .build/dril.json --output-dir data/
```

The `--source` flag selects the `DataSource` implementation. Currently only `codemasher` exists; future sources (e.g., `twitter-api`) will add new implementations.

## Builder Updates

### Directory Input Mode

The builder gains a second input mode:

```
dril-builder data/                    # directory mode: reads all 4 NDJSON files
dril-builder posts.ndjson output.db   # file mode: existing behavior (posts only)
```

Detection: if the first argument is a directory, use directory mode. If it's a file, use file mode.

### Directory Mode Behavior

1. Read `posts.ndjson`, `reposts.ndjson`, `media.ndjson`, `users.ndjson` from the directory
2. Create all tables (posts, posts_fts, reposts, media, users)
3. Insert all data within a transaction
4. Populate FTS index for posts only
5. Run optimize + vacuum

### File Mode Behavior (unchanged)

1. Read single NDJSON file as posts
2. Create all tables (empty reposts/media/users tables are fine)
3. Insert posts, populate FTS
4. Optimize + vacuum

### Output

```
dril-builder data/ site/dril.db
```

Default output remains `dril.db` if not specified.

## Project Structure Changes

```
dril-archive/
├── Cargo.toml                    # MODIFY: add normalizer to workspace
├── normalizer/                   # NEW: normalizer crate
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs               # CLI entry point
│       ├── source.rs             # DataSource trait
│       ├── codemasher.rs         # CodmasherSource implementation
│       └── types.rs              # Repost, MediaItem, User structs
├── builder/                      # MODIFY: new tables + directory mode
│   └── src/
│       ├── main.rs               # Updated CLI (detect file vs dir)
│       ├── post.rs               # Unchanged
│       └── db.rs                 # New tables + insert functions
├── testdata/
│   ├── sample.ndjson             # Unchanged (single-file test fixture)
│   └── codemasher/               # NEW: minimal dril.json fixture
│       └── dril.json
└── ...
```

## Data Pipeline

```
.build/dril.json (from codemasher/dril-archive)
        │
        ▼
dril-normalizer --source codemasher --input dril.json --output-dir data/
        │
        ▼
data/
  posts.ndjson      (~11,075 records)
  reposts.ndjson    (~916 records)
  media.ndjson      (~908+ records)
  users.ndjson      (~1,477 records)
        │
        ▼
dril-builder data/ site/dril.db
        │
        ▼
site/dril.db (deploy)
```

## Test Strategy

- **Normalizer unit tests:** Parse a minimal `testdata/codemasher/dril.json` fixture containing ~5 posts, 2 reposts, some media, and a few users. Verify correct splitting, field transforms, and deduplication.
- **Builder tests:** Existing 14 tests continue to pass (file mode). Add tests for directory mode with all 4 NDJSON files.
- **E2E tests:** Existing 5 Playwright tests continue to pass (use single-file dev server mode).

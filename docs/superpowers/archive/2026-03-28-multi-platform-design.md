# Multi-Platform Post Model Design Spec

## Overview

Extend the data model to support posts from X (Twitter), Threads, and Bluesky. Add a `platform` column to posts, reposts, and users. Add a `manual` normalizer source for hand-scraped data. Update the frontend to derive platform-specific URLs.

## Goals

- Unified search across all platforms — one search box, results from everywhere
- Capture dril's posts + reposts from Threads and Bluesky alongside the existing X archive
- Backwards-compatible — existing data and test fixtures work without modification

## Non-Goals

- Cross-platform user deduplication (dril is the only user that spans platforms)
- Platform-specific filtering in the UI (future work)
- Automated scrapers for Threads or Bluesky (data will be manually scraped for now)

## Platforms

| Platform | Handle | URL Pattern |
|----------|--------|-------------|
| X | @dril | `https://x.com/dril/status/{id}` |
| Threads | @dril | `https://www.threads.com/@dril/post/{id}` |
| Bluesky | @dril.bsky.social | `https://bsky.app/profile/dril.bsky.social/post/{id}` |

## Schema Changes

### `posts` table — add column

```sql
platform TEXT NOT NULL DEFAULT 'x'
```

### `reposts` table — add column

```sql
platform TEXT NOT NULL DEFAULT 'x'
```

### `users` table — add column

```sql
platform TEXT NOT NULL DEFAULT 'x'
```

### `posts_fts` — unchanged

The FTS index only covers `text` and `quoted_text`. Platform is metadata on results, not a search dimension.

### `media` table — unchanged

Media items reference a post by `post_id`. The platform is inherited from the parent post.

### Backwards compatibility

The `DEFAULT 'x'` on all three columns means:
- Existing NDJSON without a `platform` field inserts as `'x'`
- The single-file builder mode (used by tests and dev server) works without changes
- The codemasher normalizer outputs `platform: "x"` explicitly

## NDJSON Format Changes

All four NDJSON files gain an optional `platform` field. If omitted, defaults to `"x"`.

**posts.ndjson:**
```json
{"id":"123","platform":"x","text":"...","created_at":"...","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":42000,"shares":12000}
{"id":"abc","platform":"threads","text":"...","created_at":"...","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":5000,"shares":200}
```

**reposts.ndjson:**
```json
{"id":"100","platform":"x","created_at":"...","original_post_id":"200","original_user_id":"300","original_text":"...","original_created_at":"...","likes":5000,"shares":1200}
```

**users.ndjson:**
```json
{"id":"16298441","platform":"x","screen_name":"dril","name":"wint"}
{"id":"12345","platform":"threads","screen_name":"dril","name":"dril"}
```

## Normalizer Changes

### Types

Add `platform: String` to `Post`, `Repost`, and `User` structs in the types crate. Use `#[serde(default = "default_platform")]` where `default_platform` returns `"x".to_string()` for backwards compatibility.

### CodmasherSource

Sets `platform: "x"` on all output records. No other changes.

### New: ManualSource

A new `DataSource` implementation that reads a single mixed-type NDJSON file where each line has a `type` field:

```json
{"type":"post","platform":"threads","id":"abc","text":"...","created_at":"...","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":5000,"shares":200,"media":[]}
{"type":"repost","platform":"bsky","id":"xyz","created_at":"...","original_post_id":"999","original_user_id":"888","original_user":"someone","original_text":"...","original_created_at":"...","likes":300,"shares":50}
```

The `media` field is inline on each post (array of media objects). The normalizer splits it out into the separate `media.ndjson` file.

Users are extracted from the data: dril's user record is synthesized per platform, and `reply_to_user` / `original_user` references are captured.

**CLI usage:**
```
dril-normalizer --source manual --input scraped.ndjson --output-dir data/
```

This can be run multiple times with `--append` or the output can be concatenated — the builder deduplicates by `(id, platform)`.

## Builder Changes

### Schema creation

Add `platform TEXT NOT NULL DEFAULT 'x'` to `posts`, `reposts`, and `users` CREATE TABLE statements.

### Insert statements

Add `platform` to all INSERT statements. For the `Post` struct, if `platform` is missing (old format), default to `"x"`.

### Deduplication

When running in directory mode with data from multiple sources, posts with the same `(id, platform)` pair should be deduplicated. Use `INSERT OR IGNORE` instead of `INSERT` to handle this gracefully.

## Frontend Changes

### Search query

Add `t.platform` to the SELECT:

```sql
SELECT t.id, t.text, t.created_at, t.is_reply, t.reply_to_user, t.platform
FROM posts_fts f
JOIN posts t ON t.rowid = f.rowid
WHERE posts_fts MATCH ?
ORDER BY rank
LIMIT 50
```

### URL construction

Replace the hardcoded X URL with a platform-aware function:

```javascript
function postUrl(platform, id) {
    switch (platform) {
        case "threads": return `https://www.threads.com/@dril/post/${id}`;
        case "bsky": return `https://bsky.app/profile/dril.bsky.social/post/${id}`;
        default: return `https://x.com/dril/status/${id}`;
    }
}
```

### Result rendering

Show the platform name next to the date in each result:

```
Mar 12, 2024 · threads · view original
```

The "view on X" link text becomes "view original" since it could be any platform.

## Test Strategy

- Existing tests continue to pass — `DEFAULT 'x'` and serde defaults handle backwards compatibility
- Add a test fixture for the manual source with mixed platforms
- Add a builder test verifying posts from different platforms coexist and are all searchable via FTS
- Update one E2E test to verify the platform indicator renders (can use the existing test DB with platform defaulting to "x")

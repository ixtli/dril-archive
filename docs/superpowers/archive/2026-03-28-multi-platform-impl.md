# Multi-Platform Post Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `platform` field to posts, reposts, and users so the archive can hold content from X, Threads, and Bluesky with correct "view original" links.

**Architecture:** Add `platform: String` with `#[serde(default)]` defaulting to `"x"` across all types. Update DB schema with `DEFAULT 'x'`. Update builder INSERT statements. Update frontend to read platform and derive URLs. All existing data and tests work without modification.

**Tech Stack:** Rust (types, builder, normalizer crates), vanilla JS (frontend)

---

## File Map

**Modify:**
- `types/src/lib.rs` — add `platform` to Repost, User
- `builder/src/post.rs` — add `platform` to Post
- `builder/src/db.rs` — add `platform` column to schema and INSERT statements
- `builder/src/main.rs` — no changes needed (platform flows through existing data path)
- `normalizer/src/post.rs` — add `platform` to Post
- `normalizer/src/codemasher.rs` — set `platform: "x"` in output
- `site/app.js` — add `postUrl()` function, read platform from query results

---

### Task 1: Add platform to all Rust types

**Files:**
- Modify: `types/src/lib.rs`
- Modify: `builder/src/post.rs`
- Modify: `normalizer/src/post.rs`

- [ ] **Step 1: Add platform to types crate**

In `types/src/lib.rs`, add a default function and `platform` field to `Repost` and `User`:

Add this function at the top of the file, after the imports:

```rust
fn default_platform() -> String {
    "x".to_string()
}
```

Add this field to `Repost` (after `id`):

```rust
    #[serde(default = "default_platform")]
    pub platform: String,
```

Add this field to `User` (after `id`):

```rust
    #[serde(default = "default_platform")]
    pub platform: String,
```

- [ ] **Step 2: Add platform to builder Post**

In `builder/src/post.rs`, add the same default function and field to `Post`:

Add at the top after imports:

```rust
fn default_platform() -> String {
    "x".to_string()
}
```

Add after the `id` field:

```rust
    #[serde(default = "default_platform")]
    pub platform: String,
```

- [ ] **Step 3: Add platform to normalizer Post**

In `normalizer/src/post.rs`, add the same default function and field to `Post`:

Add at the top after imports:

```rust
fn default_platform() -> String {
    "x".to_string()
}
```

Add after the `id` field:

```rust
    #[serde(default = "default_platform")]
    pub platform: String,
```

- [ ] **Step 4: Fix all compilation errors**

The `Post`, `Repost`, and `User` structs now have a new field. Every place that constructs one of these must be updated.

In `normalizer/src/codemasher.rs`, add `platform: "x".to_string(),` to every `Post { ... }`, `Repost { ... }`, and `User { ... }` construction.

In `builder/src/db.rs` test module, add `platform: "x".to_string(),` to every `Post { ... }` in `sample_posts()`, every `Repost { ... }` in `sample_reposts()`, and every `User { ... }` in `sample_users()`.

- [ ] **Step 5: Verify everything compiles and tests pass**

Run: `cargo test`
Expected: All 27 tests pass (18 builder + 9 normalizer). The `#[serde(default)]` means existing NDJSON fixtures without `platform` still deserialize correctly.

- [ ] **Step 6: Commit**

```bash
git add types/src/lib.rs builder/src/post.rs normalizer/src/post.rs normalizer/src/codemasher.rs builder/src/db.rs
git commit -m "feat: add platform field to Post, Repost, and User types"
```

---

### Task 2: Update DB schema and INSERT statements

**Files:**
- Modify: `builder/src/db.rs`

- [ ] **Step 1: Write a test for platform storage**

Add to the test module in `builder/src/db.rs`:

```rust
    #[test]
    fn test_posts_store_platform() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = create_db(&db_path).unwrap();

        let posts = vec![
            Post {
                id: "1".to_string(),
                platform: "x".to_string(),
                text: "twitter post".to_string(),
                created_at: "2024-01-01T00:00:00Z".to_string(),
                is_reply: false,
                reply_to_user: None,
                is_quote: false,
                quoted_text: None,
                likes: 100,
                shares: 10,
            },
            Post {
                id: "2".to_string(),
                platform: "threads".to_string(),
                text: "threads post".to_string(),
                created_at: "2024-01-02T00:00:00Z".to_string(),
                is_reply: false,
                reply_to_user: None,
                is_quote: false,
                quoted_text: None,
                likes: 200,
                shares: 20,
            },
            Post {
                id: "3".to_string(),
                platform: "bsky".to_string(),
                text: "bluesky post".to_string(),
                created_at: "2024-01-03T00:00:00Z".to_string(),
                is_reply: false,
                reply_to_user: None,
                is_quote: false,
                quoted_text: None,
                likes: 300,
                shares: 30,
            },
        ];
        insert_posts(&conn, &posts).unwrap();

        let platform: String = conn
            .query_row(
                "SELECT platform FROM posts WHERE id = '2'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(platform, "threads");

        // All three are searchable via FTS
        let mut stmt = conn
            .prepare(
                "SELECT t.id, t.platform FROM posts_fts f JOIN posts t ON t.rowid = f.rowid WHERE posts_fts MATCH 'post' ORDER BY t.id",
            )
            .unwrap();
        let results: Vec<(String, String)> = stmt
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        assert_eq!(results.len(), 3);
        assert_eq!(results[0], ("1".to_string(), "x".to_string()));
        assert_eq!(results[1], ("2".to_string(), "threads".to_string()));
        assert_eq!(results[2], ("3".to_string(), "bsky".to_string()));
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test -p dril-builder test_posts_store_platform`
Expected: FAIL — `platform` column doesn't exist in the schema yet

- [ ] **Step 3: Update create_db schema**

In `builder/src/db.rs`, update the `CREATE TABLE posts` statement to add `platform` after `id`:

```sql
CREATE TABLE posts (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL DEFAULT 'x',
    text TEXT NOT NULL,
    ...
```

Update `CREATE TABLE reposts` to add `platform` after `id`:

```sql
CREATE TABLE reposts (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL DEFAULT 'x',
    created_at TEXT NOT NULL,
    ...
```

Update `CREATE TABLE users` to add `platform` after `id`:

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL DEFAULT 'x',
    screen_name TEXT NOT NULL,
    ...
```

- [ ] **Step 4: Update insert_posts**

Change the INSERT statement in `insert_posts` to include `platform`:

```sql
INSERT INTO posts (id, platform, text, created_at, is_reply, reply_to_user, is_quote, quoted_text, likes, shares)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
```

Update the `params!` to include `post.platform` after `post.id`:

```rust
rusqlite::params![
    post.id,
    post.platform,
    post.text,
    post.created_at,
    post.is_reply as i64,
    post.reply_to_user,
    post.is_quote as i64,
    post.quoted_text,
    post.likes as i64,
    post.shares as i64,
]
```

- [ ] **Step 5: Update insert_reposts**

Change the INSERT statement to include `platform`:

```sql
INSERT INTO reposts (id, platform, created_at, original_post_id, original_user_id, original_text, original_created_at, likes, shares)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
```

Update `params!` to include `repost.platform` after `repost.id`.

- [ ] **Step 6: Update insert_users**

Change the INSERT statement to include `platform`:

```sql
INSERT INTO users (id, platform, screen_name, name)
VALUES (?1, ?2, ?3, ?4)
```

Update `params!` to include `user.platform` after `user.id`.

- [ ] **Step 7: Run all tests**

Run: `cargo test`
Expected: All tests pass (27 existing + 1 new = 28)

- [ ] **Step 8: Commit**

```bash
git add builder/src/db.rs
git commit -m "feat(builder): add platform column to posts, reposts, and users tables"
```

---

### Task 3: Update frontend to show platform-specific links

**Files:**
- Modify: `site/app.js`

- [ ] **Step 1: Add postUrl function and update search query**

In `site/app.js`, add this function before the `search` function:

```javascript
function postUrl(platform, id) {
    switch (platform) {
        case "threads":
            return `https://www.threads.com/@dril/post/${id}`;
        case "bsky":
            return `https://bsky.app/profile/dril.bsky.social/post/${id}`;
        default:
            return `https://x.com/dril/status/${id}`;
    }
}
```

Update the SQL query in the `search` function to include `t.platform`:

```javascript
const stmt = db.prepare(
    `SELECT t.id, t.text, t.created_at, t.is_reply, t.reply_to_user, t.platform
     FROM posts_fts f
     JOIN posts t ON t.rowid = f.rowid
     WHERE posts_fts MATCH ?
     ORDER BY rank
     LIMIT 50`,
);
```

Update the destructuring to include `platform`:

```javascript
const [id, text, created_at, is_reply, reply_to_user, platform] = stmt.get([]);
const url = postUrl(platform, id);
```

Update the link text from "view on X" to "view original":

```javascript
html += `${formatDate(created_at)} · ${escapeHtml(platform)} · <a href="${url}" target="_blank" rel="noopener">view original</a>`;
```

- [ ] **Step 2: Format with biome**

Run:
```bash
bunx @biomejs/biome format --write site/app.js
bunx @biomejs/biome check --write site/app.js
```

- [ ] **Step 3: Run E2E tests**

Run: `rm -f site/dril.db && bun run test:e2e`

The existing tests should still pass — the test DB defaults platform to "x", so the "view original" link still works (it points to x.com). The platform text "x" will appear in the results.

If the "search returns results" test checks for "view on X" text specifically, update the assertion in `e2e/search.spec.ts` to check for "view original" instead.

- [ ] **Step 4: Commit**

```bash
git add site/app.js e2e/search.spec.ts
git commit -m "feat(site): platform-aware URLs and 'view original' links"
```

---

### Task 4: Update normalizer CodmasherSource + rebuild real data

**Files:**
- No file changes needed (Task 1 already added `platform: "x"` to codemasher output)
- Verify the full pipeline works

- [ ] **Step 1: Run normalizer on real data**

Run:
```bash
cargo run --release -p dril-normalizer -- --source codemasher --input /tmp/dril-archive/.build/dril.json --output-dir data/
```
Expected: Completes with same counts as before (11075 posts, 916 reposts, etc.)

- [ ] **Step 2: Verify platform field in output**

Run:
```bash
head -1 data/posts.ndjson | python3 -c "import sys,json; print(json.load(sys.stdin).get('platform','MISSING'))"
```
Expected: `x`

- [ ] **Step 3: Build the database**

Run:
```bash
cargo run --release -p dril-builder -- data/ site/dril.db
```
Expected: Builds successfully

- [ ] **Step 4: Verify platform in database**

Run:
```bash
sqlite3 site/dril.db "SELECT DISTINCT platform FROM posts;"
```
Expected: `x`

```bash
sqlite3 site/dril.db "SELECT platform, COUNT(*) FROM posts GROUP BY platform;"
```
Expected: `x|11075`

- [ ] **Step 5: Commit and push**

```bash
git push origin main
```

(No file changes to commit — this is a verification step.)

---

## Deferred

- **ManualSource** normalizer — reads a mixed-type NDJSON file with `type` and `platform` fields from hand-scraped Threads/Bluesky data. Will be built when we have actual scraped data to work with.

# Normalizer + Schema Extensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Rust normalizer that ingests the codemasher/dril-archive JSON and outputs NDJSON, extend the DB schema with reposts/media/users tables, and update the builder to handle multi-file directory input.

**Architecture:** A shared `types` crate defines Repost, MediaItem, and User structs. The builder creates the new tables and inserts from NDJSON files. The normalizer reads `.build/dril.json`, splits tweets into posts vs reposts, extracts media, and writes 4 NDJSON files. A DataSource trait allows future input sources.

**Tech Stack:** Rust (workspace crates: `types`, `builder`, `normalizer`), `rusqlite` (bundled FTS5), `serde`/`serde_json`, `chrono` (timestamp conversion)

---

## File Map

**Create:**
- `types/Cargo.toml` — shared types crate
- `types/src/lib.rs` — Repost, MediaItem, User structs (Serialize + Deserialize)
- `normalizer/Cargo.toml` — normalizer crate
- `normalizer/src/main.rs` — CLI entry point
- `normalizer/src/source.rs` — DataSource trait
- `normalizer/src/codemasher.rs` — CodmasherSource implementation
- `testdata/codemasher/dril.json` — minimal test fixture

**Modify:**
- `Cargo.toml` — add `types` and `normalizer` to workspace members
- `builder/Cargo.toml` — add `types` dependency
- `builder/src/main.rs` — detect file vs directory input
- `builder/src/db.rs` — new tables, new insert functions
- `builder/src/post.rs` — re-export or use types from `types` crate

---

### Task 1: Shared Types Crate

**Files:**
- Create: `types/Cargo.toml`
- Create: `types/src/lib.rs`
- Modify: `Cargo.toml` (workspace)

- [ ] **Step 1: Create the types crate**

Create `types/Cargo.toml`:

```toml
[package]
name = "dril-types"
version = "0.1.0"
edition = "2024"

[dependencies]
serde = { version = "1", features = ["derive"] }
```

- [ ] **Step 2: Define shared types**

Create `types/src/lib.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Repost {
    pub id: String,
    pub created_at: String,
    pub original_post_id: String,
    pub original_user_id: String,
    pub original_text: String,
    pub original_created_at: String,
    pub likes: u64,
    pub shares: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MediaItem {
    pub post_id: String,
    #[serde(rename = "type")]
    pub media_type: String,
    pub url: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub alt_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct User {
    pub id: String,
    pub screen_name: String,
    pub name: Option<String>,
}
```

- [ ] **Step 3: Add types to workspace**

Update `Cargo.toml`:

```toml
[workspace]
members = ["builder", "types"]
resolver = "2"
```

- [ ] **Step 4: Verify it compiles**

Run: `cargo build -p dril-types`
Expected: Compiles successfully

- [ ] **Step 5: Commit**

```bash
git add types/ Cargo.toml
git commit -m "feat(types): add shared Repost, MediaItem, User structs"
```

---

### Task 2: Builder Schema — New Tables

**Files:**
- Modify: `builder/Cargo.toml`
- Modify: `builder/src/db.rs`

- [ ] **Step 1: Add types dependency to builder**

Add to `builder/Cargo.toml` under `[dependencies]`:

```toml
dril-types = { path = "../types" }
```

- [ ] **Step 2: Write tests for new table creation**

Add the following tests to the `#[cfg(test)] mod tests` block in `builder/src/db.rs`:

```rust
    #[test]
    fn test_create_db_creates_all_tables() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = create_db(&db_path).unwrap();

        // Verify all tables exist
        for table in &["posts", "posts_fts", "reposts", "media", "users"] {
            let count: i64 = conn
                .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))
                .unwrap();
            assert_eq!(count, 0, "table {table} should exist and be empty");
        }
    }
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cargo test -p dril-builder test_create_db_creates_all_tables`
Expected: FAIL — tables `reposts`, `media`, `users` don't exist yet

- [ ] **Step 4: Update create_db to create all tables**

Replace the `create_db` function in `builder/src/db.rs`:

```rust
pub fn create_db(path: &std::path::Path) -> Result<Connection, String> {
    let conn = Connection::open(path).map_err(|e| format!("open db: {e}"))?;

    conn.execute_batch(
        "
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

        CREATE VIRTUAL TABLE posts_fts USING fts5(
            text,
            quoted_text,
            content='posts',
            content_rowid='rowid'
        );

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

        CREATE TABLE media (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id TEXT NOT NULL REFERENCES posts(id),
            type TEXT NOT NULL,
            url TEXT NOT NULL,
            width INTEGER,
            height INTEGER,
            alt_text TEXT
        );

        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            screen_name TEXT NOT NULL,
            name TEXT
        );
        ",
    )
    .map_err(|e| format!("create tables: {e}"))?;

    Ok(conn)
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cargo test -p dril-builder`
Expected: All tests pass (existing + new)

- [ ] **Step 6: Commit**

```bash
git add builder/Cargo.toml builder/src/db.rs
git commit -m "feat(builder): create reposts, media, and users tables"
```

---

### Task 3: Builder — Insert Functions for New Types

**Files:**
- Modify: `builder/src/db.rs`

- [ ] **Step 1: Write tests for insert_reposts**

Add to the tests module in `builder/src/db.rs`:

```rust
    use dril_types::{MediaItem, Repost, User};

    fn sample_reposts() -> Vec<Repost> {
        vec![
            Repost {
                id: "100".to_string(),
                created_at: "2023-01-15T10:00:00Z".to_string(),
                original_post_id: "200".to_string(),
                original_user_id: "300".to_string(),
                original_text: "some funny tweet dril retweeted".to_string(),
                original_created_at: "2023-01-14T08:00:00Z".to_string(),
                likes: 5000,
                shares: 1200,
            },
            Repost {
                id: "101".to_string(),
                created_at: "2023-02-20T14:30:00Z".to_string(),
                original_post_id: "201".to_string(),
                original_user_id: "301".to_string(),
                original_text: "another retweet".to_string(),
                original_created_at: "2023-02-19T12:00:00Z".to_string(),
                likes: 300,
                shares: 50,
            },
        ]
    }

    fn sample_media() -> Vec<MediaItem> {
        vec![
            MediaItem {
                post_id: "1".to_string(),
                media_type: "photo".to_string(),
                url: "https://pbs.twimg.com/media/example1.jpg".to_string(),
                width: Some(1200),
                height: Some(800),
                alt_text: Some("a funny image".to_string()),
            },
            MediaItem {
                post_id: "1".to_string(),
                media_type: "photo".to_string(),
                url: "https://pbs.twimg.com/media/example2.jpg".to_string(),
                width: Some(600),
                height: Some(400),
                alt_text: None,
            },
            MediaItem {
                post_id: "2".to_string(),
                media_type: "video".to_string(),
                url: "https://video.twimg.com/example3.mp4".to_string(),
                width: Some(1920),
                height: Some(1080),
                alt_text: None,
            },
        ]
    }

    fn sample_users() -> Vec<User> {
        vec![
            User {
                id: "16298441".to_string(),
                screen_name: "dril".to_string(),
                name: Some("wint".to_string()),
            },
            User {
                id: "300".to_string(),
                screen_name: "someone".to_string(),
                name: Some("Some Person".to_string()),
            },
            User {
                id: "301".to_string(),
                screen_name: "another".to_string(),
                name: None,
            },
        ]
    }

    #[test]
    fn test_insert_reposts() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = create_db(&db_path).unwrap();
        let reposts = sample_reposts();
        let count = insert_reposts(&conn, &reposts).unwrap();
        assert_eq!(count, 2);

        let stored: i64 = conn
            .query_row("SELECT COUNT(*) FROM reposts", [], |r| r.get(0))
            .unwrap();
        assert_eq!(stored, 2);

        let (orig_text, likes): (String, i64) = conn
            .query_row(
                "SELECT original_text, likes FROM reposts WHERE id = '100'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(orig_text, "some funny tweet dril retweeted");
        assert_eq!(likes, 5000);
    }

    #[test]
    fn test_insert_media() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = create_db(&db_path).unwrap();
        insert_posts(&conn, &sample_posts()).unwrap();
        let count = insert_media(&conn, &sample_media()).unwrap();
        assert_eq!(count, 3);

        let stored: i64 = conn
            .query_row("SELECT COUNT(*) FROM media", [], |r| r.get(0))
            .unwrap();
        assert_eq!(stored, 3);

        // Two media items for post 1
        let post1_media: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM media WHERE post_id = '1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(post1_media, 2);
    }

    #[test]
    fn test_insert_users() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = create_db(&db_path).unwrap();
        let count = insert_users(&conn, &sample_users()).unwrap();
        assert_eq!(count, 3);

        let screen_name: String = conn
            .query_row(
                "SELECT screen_name FROM users WHERE id = '16298441'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(screen_name, "dril");
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test -p dril-builder`
Expected: New tests fail — `insert_reposts`, `insert_media`, `insert_users` don't exist

- [ ] **Step 3: Implement insert_reposts**

Add to `builder/src/db.rs`, after `insert_posts`:

```rust
pub fn insert_reposts(conn: &Connection, reposts: &[dril_types::Repost]) -> Result<usize, String> {
    conn.execute_batch("BEGIN;")
        .map_err(|e| format!("begin transaction: {e}"))?;

    let mut stmt = conn
        .prepare(
            "INSERT INTO reposts (id, created_at, original_post_id, original_user_id, original_text, original_created_at, likes, shares)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        )
        .map_err(|e| format!("prepare repost insert: {e}"))?;

    for repost in reposts {
        stmt.execute(rusqlite::params![
            repost.id,
            repost.created_at,
            repost.original_post_id,
            repost.original_user_id,
            repost.original_text,
            repost.original_created_at,
            repost.likes as i64,
            repost.shares as i64,
        ])
        .map_err(|e| format!("insert repost {}: {e}", repost.id))?;
    }

    conn.execute_batch("COMMIT;")
        .map_err(|e| format!("commit transaction: {e}"))?;

    Ok(reposts.len())
}
```

- [ ] **Step 4: Implement insert_media**

Add to `builder/src/db.rs`:

```rust
pub fn insert_media(conn: &Connection, media: &[dril_types::MediaItem]) -> Result<usize, String> {
    conn.execute_batch("BEGIN;")
        .map_err(|e| format!("begin transaction: {e}"))?;

    let mut stmt = conn
        .prepare(
            "INSERT INTO media (post_id, type, url, width, height, alt_text)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )
        .map_err(|e| format!("prepare media insert: {e}"))?;

    for item in media {
        stmt.execute(rusqlite::params![
            item.post_id,
            item.media_type,
            item.url,
            item.width.map(|v| v as i64),
            item.height.map(|v| v as i64),
            item.alt_text,
        ])
        .map_err(|e| format!("insert media for post {}: {e}", item.post_id))?;
    }

    conn.execute_batch("COMMIT;")
        .map_err(|e| format!("commit transaction: {e}"))?;

    Ok(media.len())
}
```

- [ ] **Step 5: Implement insert_users**

Add to `builder/src/db.rs`:

```rust
pub fn insert_users(conn: &Connection, users: &[dril_types::User]) -> Result<usize, String> {
    conn.execute_batch("BEGIN;")
        .map_err(|e| format!("begin transaction: {e}"))?;

    let mut stmt = conn
        .prepare(
            "INSERT INTO users (id, screen_name, name)
             VALUES (?1, ?2, ?3)",
        )
        .map_err(|e| format!("prepare user insert: {e}"))?;

    for user in users {
        stmt.execute(rusqlite::params![user.id, user.screen_name, user.name,])
            .map_err(|e| format!("insert user {}: {e}", user.id))?;
    }

    conn.execute_batch("COMMIT;")
        .map_err(|e| format!("commit transaction: {e}"))?;

    Ok(users.len())
}
```

- [ ] **Step 6: Run all tests**

Run: `cargo test -p dril-builder`
Expected: All tests pass (existing 14 + 4 new = 18)

- [ ] **Step 7: Commit**

```bash
git add builder/src/db.rs
git commit -m "feat(builder): insert functions for reposts, media, and users"
```

---

### Task 4: Builder — Directory Input Mode

**Files:**
- Modify: `builder/src/main.rs`

- [ ] **Step 1: Add NDJSON parsers for new types**

Add to `builder/src/post.rs` (after the existing `parse_ndjson` function):

```rust
pub fn parse_ndjson_generic<T: serde::de::DeserializeOwned, R: std::io::BufRead>(
    reader: R,
) -> Result<Vec<T>, String> {
    let mut items = Vec::new();

    for (line_num, line) in reader.lines().enumerate() {
        let line = line.map_err(|e| format!("line {}: {}", line_num + 1, e))?;
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let item: T =
            serde_json::from_str(line).map_err(|e| format!("line {}: {}", line_num + 1, e))?;
        items.push(item);
    }

    Ok(items)
}
```

- [ ] **Step 2: Update main.rs for directory mode**

Replace `builder/src/main.rs` with:

```rust
mod db;
mod post;

use std::fs::File;
use std::io::{self, BufReader};
use std::path::{Path, PathBuf};

fn read_ndjson_file<T: serde::de::DeserializeOwned>(path: &Path) -> Result<Vec<T>, String> {
    let file = File::open(path).map_err(|e| format!("open {}: {e}", path.display()))?;
    let reader = BufReader::new(file);
    post::parse_ndjson_generic(reader)
}

fn run_file_mode(input_path: &str, output_path: &Path) -> Result<(), String> {
    eprintln!("Reading posts from {input_path}...");
    let reader: Box<dyn io::BufRead> = if input_path == "-" {
        Box::new(BufReader::new(io::stdin()))
    } else {
        let file = File::open(input_path).map_err(|e| format!("open {input_path}: {e}"))?;
        Box::new(BufReader::new(file))
    };

    let posts = post::parse_ndjson(reader)?;
    eprintln!("Parsed {} posts", posts.len());

    if output_path.exists() {
        std::fs::remove_file(output_path).map_err(|e| format!("remove existing db: {e}"))?;
    }

    let conn = db::create_db(output_path)?;
    let count = db::insert_posts(&conn, &posts)?;
    db::finalize(&conn)?;

    eprintln!("Built {} with {count} posts", output_path.display());
    Ok(())
}

fn run_dir_mode(input_dir: &Path, output_path: &Path) -> Result<(), String> {
    eprintln!("Reading data from {}...", input_dir.display());

    let posts_path = input_dir.join("posts.ndjson");
    let reposts_path = input_dir.join("reposts.ndjson");
    let media_path = input_dir.join("media.ndjson");
    let users_path = input_dir.join("users.ndjson");

    let posts: Vec<post::Post> = read_ndjson_file(&posts_path)?;
    eprintln!("  {} posts", posts.len());

    let reposts: Vec<dril_types::Repost> = if reposts_path.exists() {
        read_ndjson_file(&reposts_path)?
    } else {
        Vec::new()
    };
    eprintln!("  {} reposts", reposts.len());

    let media: Vec<dril_types::MediaItem> = if media_path.exists() {
        read_ndjson_file(&media_path)?
    } else {
        Vec::new()
    };
    eprintln!("  {} media items", media.len());

    let users: Vec<dril_types::User> = if users_path.exists() {
        read_ndjson_file(&users_path)?
    } else {
        Vec::new()
    };
    eprintln!("  {} users", users.len());

    if output_path.exists() {
        std::fs::remove_file(output_path).map_err(|e| format!("remove existing db: {e}"))?;
    }

    let conn = db::create_db(output_path)?;

    let post_count = db::insert_posts(&conn, &posts)?;
    let repost_count = db::insert_reposts(&conn, &reposts)?;
    let media_count = db::insert_media(&conn, &media)?;
    let user_count = db::insert_users(&conn, &users)?;

    db::finalize(&conn)?;

    eprintln!(
        "Built {} with {post_count} posts, {repost_count} reposts, {media_count} media, {user_count} users",
        output_path.display()
    );
    Ok(())
}

fn run() -> Result<(), String> {
    let args: Vec<String> = std::env::args().collect();

    if args.len() < 2 || args.len() > 3 {
        return Err(format!(
            "Usage: {} <input.ndjson|input-dir/> [output.db]",
            args[0]
        ));
    }

    let input_path = &args[1];
    let output_path = if args.len() == 3 {
        PathBuf::from(&args[2])
    } else {
        PathBuf::from("dril.db")
    };

    let input = Path::new(input_path);
    if input.is_dir() {
        run_dir_mode(input, &output_path)
    } else {
        run_file_mode(input_path, &output_path)
    }
}

fn main() {
    if let Err(e) = run() {
        eprintln!("Error: {e}");
        std::process::exit(1);
    }
}
```

- [ ] **Step 3: Add dril-types dependency to builder**

Ensure `builder/Cargo.toml` has `dril-types = { path = "../types" }` under `[dependencies]` (added in Task 2).

- [ ] **Step 4: Test file mode still works**

Run:
```bash
cargo run -p dril-builder -- testdata/sample.ndjson /tmp/test-file.db
```
Expected: `Built /tmp/test-file.db with 10 posts`

```bash
sqlite3 /tmp/test-file.db "SELECT COUNT(*) FROM posts; SELECT COUNT(*) FROM reposts; SELECT COUNT(*) FROM users;"
```
Expected: `10`, `0`, `0`

- [ ] **Step 5: Create a test directory with NDJSON files**

Create `testdata/dir-test/posts.ndjson` (copy first 3 lines from `testdata/sample.ndjson`):

```
{"id":"1","text":"no","created_at":"2008-09-15T12:00:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":4200,"shares":850}
{"id":"2","text":"the wise man bowed his head solemnly and spoke: theres actually zero difference between good and bad things. you imbecile. you fucking moron","created_at":"2014-11-12T18:30:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":178000,"shares":89000}
{"id":"3","text":"IF THE ZOO BANS ME FOR HOLLERING AT THE ANIMALS I WILL FACE GOD AND WALK BACKWARDS INTO HELL","created_at":"2012-07-22T03:15:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":245000,"shares":98000}
```

Create `testdata/dir-test/reposts.ndjson`:

```
{"id":"100","created_at":"2023-01-15T10:00:00Z","original_post_id":"200","original_user_id":"999","original_text":"a tweet dril retweeted","original_created_at":"2023-01-14T08:00:00Z","likes":5000,"shares":1200}
```

Create `testdata/dir-test/media.ndjson`:

```
{"post_id":"1","type":"photo","url":"https://pbs.twimg.com/media/example.jpg","width":1200,"height":800,"alt_text":"funny image"}
```

Create `testdata/dir-test/users.ndjson`:

```
{"id":"16298441","screen_name":"dril","name":"wint"}
{"id":"999","screen_name":"someguy","name":"Some Guy"}
```

- [ ] **Step 6: Test directory mode**

Run:
```bash
cargo run -p dril-builder -- testdata/dir-test/ /tmp/test-dir.db
```
Expected:
```
Reading data from testdata/dir-test/...
  3 posts
  1 reposts
  1 media items
  2 users
Built /tmp/test-dir.db with 3 posts, 1 reposts, 1 media, 2 users
```

Verify:
```bash
sqlite3 /tmp/test-dir.db "SELECT COUNT(*) FROM posts; SELECT COUNT(*) FROM reposts; SELECT COUNT(*) FROM media; SELECT COUNT(*) FROM users;"
```
Expected: `3`, `1`, `1`, `2`

- [ ] **Step 7: Run all tests**

Run: `cargo test -p dril-builder`
Expected: All 18 tests pass

- [ ] **Step 8: Run E2E tests (file mode unchanged)**

Run: `rm -f site/dril.db && bun run test:e2e`
Expected: All 5 E2E tests pass

- [ ] **Step 9: Commit**

```bash
git add builder/src/main.rs builder/src/post.rs testdata/dir-test/
git commit -m "feat(builder): directory input mode for multi-file NDJSON"
```

---

### Task 5: Normalizer — Scaffold and DataSource Trait

**Files:**
- Create: `normalizer/Cargo.toml`
- Create: `normalizer/src/main.rs`
- Create: `normalizer/src/source.rs`
- Modify: `Cargo.toml` (workspace)

- [ ] **Step 1: Create the normalizer crate**

Create `normalizer/Cargo.toml`:

```toml
[package]
name = "dril-normalizer"
version = "0.1.0"
edition = "2024"

[dependencies]
dril-types = { path = "../types" }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chrono = { version = "0.4", features = ["serde"] }
```

- [ ] **Step 2: Add normalizer to workspace**

Update `Cargo.toml`:

```toml
[workspace]
members = ["builder", "types", "normalizer"]
resolver = "2"
```

- [ ] **Step 3: Create the DataSource trait**

Create `normalizer/src/source.rs`:

```rust
use crate::post::Post;
use dril_types::{MediaItem, Repost, User};

pub trait DataSource {
    fn posts(&self) -> Result<Vec<Post>, String>;
    fn reposts(&self) -> Result<Vec<Repost>, String>;
    fn media(&self) -> Result<Vec<MediaItem>, String>;
    fn users(&self) -> Result<Vec<User>, String>;
}
```

Note: This uses `crate::post::Post` — the normalizer will have its own `Post` type that mirrors the builder's, with `Serialize` added. We'll define it next.

- [ ] **Step 4: Create the normalizer's Post type**

Create `normalizer/src/post.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Post {
    pub id: String,
    pub text: String,
    pub created_at: String,
    pub is_reply: bool,
    pub reply_to_user: Option<String>,
    pub is_quote: bool,
    pub quoted_text: Option<String>,
    pub likes: u64,
    pub shares: u64,
}
```

- [ ] **Step 5: Create the CLI skeleton**

Create `normalizer/src/main.rs`:

```rust
mod codemasher;
mod post;
mod source;

use source::DataSource;
use std::fs;
use std::io::Write;
use std::path::Path;

fn write_ndjson<T: serde::Serialize>(items: &[T], path: &Path) -> Result<(), String> {
    let mut file =
        fs::File::create(path).map_err(|e| format!("create {}: {e}", path.display()))?;
    for item in items {
        let line =
            serde_json::to_string(item).map_err(|e| format!("serialize: {e}"))?;
        writeln!(file, "{line}").map_err(|e| format!("write {}: {e}", path.display()))?;
    }
    Ok(())
}

fn run() -> Result<(), String> {
    let args: Vec<String> = std::env::args().collect();

    if args.len() != 5 {
        return Err(format!(
            "Usage: {} --source <codemasher> --input <file> --output-dir <dir>",
            args[0]
        ));
    }

    // Simple arg parsing: expect exactly --source X --input Y --output-dir Z
    let mut source_name = None;
    let mut input_path = None;
    let mut output_dir = None;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--source" => {
                source_name = Some(args[i + 1].clone());
                i += 2;
            }
            "--input" => {
                input_path = Some(args[i + 1].clone());
                i += 2;
            }
            "--output-dir" => {
                output_dir = Some(args[i + 1].clone());
                i += 2;
            }
            other => return Err(format!("unknown argument: {other}")),
        }
    }

    let source_name = source_name.ok_or("missing --source")?;
    let input_path = input_path.ok_or("missing --input")?;
    let output_dir = output_dir.ok_or("missing --output-dir")?;

    let source: Box<dyn DataSource> = match source_name.as_str() {
        "codemasher" => Box::new(codemasher::CodmasherSource::load(&input_path)?),
        other => return Err(format!("unknown source: {other}")),
    };

    let output = Path::new(&output_dir);
    fs::create_dir_all(output).map_err(|e| format!("create output dir: {e}"))?;

    let posts = source.posts()?;
    eprintln!("{} posts", posts.len());
    write_ndjson(&posts, &output.join("posts.ndjson"))?;

    let reposts = source.reposts()?;
    eprintln!("{} reposts", reposts.len());
    write_ndjson(&reposts, &output.join("reposts.ndjson"))?;

    let media = source.media()?;
    eprintln!("{} media items", media.len());
    write_ndjson(&media, &output.join("media.ndjson"))?;

    let users = source.users()?;
    eprintln!("{} users", users.len());
    write_ndjson(&users, &output.join("users.ndjson"))?;

    eprintln!("Output written to {output_dir}");
    Ok(())
}

fn main() {
    if let Err(e) = run() {
        eprintln!("Error: {e}");
        std::process::exit(1);
    }
}
```

- [ ] **Step 6: Create a stub codemasher module**

Create `normalizer/src/codemasher.rs`:

```rust
use crate::post::Post;
use crate::source::DataSource;
use dril_types::{MediaItem, Repost, User};

pub struct CodmasherSource;

impl CodmasherSource {
    pub fn load(_path: &str) -> Result<Self, String> {
        todo!()
    }
}

impl DataSource for CodmasherSource {
    fn posts(&self) -> Result<Vec<Post>, String> {
        todo!()
    }
    fn reposts(&self) -> Result<Vec<Repost>, String> {
        todo!()
    }
    fn media(&self) -> Result<Vec<MediaItem>, String> {
        todo!()
    }
    fn users(&self) -> Result<Vec<User>, String> {
        todo!()
    }
}
```

- [ ] **Step 7: Verify it compiles**

Run: `cargo build -p dril-normalizer`
Expected: Compiles (with dead_code warnings, that's fine)

- [ ] **Step 8: Commit**

```bash
git add normalizer/ Cargo.toml
git commit -m "feat(normalizer): scaffold with DataSource trait and CLI"
```

---

### Task 6: Normalizer — CodmasherSource Implementation

**Files:**
- Modify: `normalizer/src/codemasher.rs`
- Create: `testdata/codemasher/dril.json`

- [ ] **Step 1: Create the test fixture**

Create `testdata/codemasher/dril.json`:

```json
{
  "tweets": [
    {
      "id": 1234567890,
      "user_id": 16298441,
      "created_at": 1221498320,
      "text": "no",
      "source": null,
      "retweet_count": 850,
      "like_count": 4200,
      "reply_count": 100,
      "quote_count": 50,
      "favorited": false,
      "retweeted": false,
      "possibly_sensitive": false,
      "in_reply_to_status_id": null,
      "in_reply_to_user_id": null,
      "in_reply_to_screen_name": null,
      "is_quote_status": false,
      "self_thread_id": null,
      "conversation_id": 1234567890,
      "media": [],
      "coordinates": null,
      "geo": null,
      "place": null
    },
    {
      "id": 2345678901,
      "user_id": 16298441,
      "created_at": 1415817000,
      "text": "the wise man bowed his head solemnly and spoke: theres actually zero difference between good and bad things. you imbecile. you fucking moron",
      "source": null,
      "retweet_count": 89000,
      "like_count": 178000,
      "reply_count": 5000,
      "quote_count": 2000,
      "favorited": false,
      "retweeted": false,
      "possibly_sensitive": false,
      "in_reply_to_status_id": null,
      "in_reply_to_user_id": null,
      "in_reply_to_screen_name": null,
      "is_quote_status": false,
      "self_thread_id": null,
      "conversation_id": 2345678901,
      "media": [
        {
          "type": "photo",
          "url": "https://pbs.twimg.com/media/wise_man.jpg",
          "width": 600,
          "height": 400,
          "alt_text": "wise man"
        }
      ],
      "coordinates": null,
      "geo": null,
      "place": null
    },
    {
      "id": 3456789012,
      "user_id": 16298441,
      "created_at": 1425808800,
      "text": "@someone you are like a little baby. watch this",
      "source": null,
      "retweet_count": 8,
      "like_count": 45,
      "reply_count": 2,
      "quote_count": 0,
      "favorited": false,
      "retweeted": false,
      "possibly_sensitive": false,
      "in_reply_to_status_id": 3456789000,
      "in_reply_to_user_id": 99999,
      "in_reply_to_screen_name": "someone",
      "is_quote_status": false,
      "self_thread_id": null,
      "conversation_id": 3456789000,
      "media": [],
      "coordinates": null,
      "geo": null,
      "place": null
    },
    {
      "id": 4567890123,
      "user_id": 16298441,
      "created_at": 1463640300,
      "text": "THERAPIST: your problem is, that youre perfect",
      "source": null,
      "retweet_count": 12345,
      "like_count": 54321,
      "reply_count": 500,
      "quote_count": 100,
      "favorited": false,
      "retweeted": false,
      "possibly_sensitive": false,
      "in_reply_to_status_id": null,
      "in_reply_to_user_id": null,
      "in_reply_to_screen_name": null,
      "is_quote_status": true,
      "quoted_status_id": 4567000000,
      "quoted_status": {
        "id": 4567000000,
        "user_id": 88888,
        "created_at": 1463600000,
        "text": "whats the worst thing a therapist has ever said to you",
        "source": null,
        "retweet_count": 100,
        "like_count": 200,
        "reply_count": 50,
        "quote_count": 10,
        "favorited": false,
        "retweeted": false,
        "possibly_sensitive": false,
        "in_reply_to_status_id": null,
        "in_reply_to_user_id": null,
        "in_reply_to_screen_name": null,
        "is_quote_status": false,
        "self_thread_id": null,
        "conversation_id": 4567000000,
        "media": [],
        "coordinates": null,
        "geo": null,
        "place": null
      },
      "self_thread_id": null,
      "conversation_id": 4567890123,
      "media": [],
      "coordinates": null,
      "geo": null,
      "place": null
    },
    {
      "id": 9999999999,
      "user_id": 16298441,
      "created_at": 1673780400,
      "text": "RT @funperson: this is the funniest thing ive ever seen",
      "source": null,
      "retweet_count": 0,
      "like_count": 0,
      "reply_count": 0,
      "quote_count": 0,
      "favorited": false,
      "retweeted": false,
      "possibly_sensitive": false,
      "in_reply_to_status_id": null,
      "in_reply_to_user_id": null,
      "in_reply_to_screen_name": null,
      "is_quote_status": false,
      "retweeted_status_id": 8888888888,
      "retweeted_status": {
        "id": 8888888888,
        "user_id": 77777,
        "created_at": 1673700000,
        "text": "this is the funniest thing ive ever seen",
        "source": null,
        "retweet_count": 5000,
        "like_count": 15000,
        "reply_count": 200,
        "quote_count": 50,
        "favorited": false,
        "retweeted": false,
        "possibly_sensitive": false,
        "in_reply_to_status_id": null,
        "in_reply_to_user_id": null,
        "in_reply_to_screen_name": null,
        "is_quote_status": false,
        "self_thread_id": null,
        "conversation_id": 8888888888,
        "media": [],
        "coordinates": null,
        "geo": null,
        "place": null
      },
      "self_thread_id": null,
      "conversation_id": 9999999999,
      "media": [],
      "coordinates": null,
      "geo": null,
      "place": null
    }
  ],
  "users": [
    {"id": 16298441, "screen_name": "dril", "name": "wint"},
    {"id": 99999, "screen_name": "someone", "name": "Some Person"},
    {"id": 88888, "screen_name": "quoteguy", "name": "Quote Guy"},
    {"id": 77777, "screen_name": "funperson", "name": "Fun Person"}
  ]
}
```

This fixture has: 4 original posts (1 plain, 1 with media, 1 reply, 1 quote tweet) + 1 retweet + 4 users.

- [ ] **Step 2: Write tests for CodmasherSource**

Add to `normalizer/src/codemasher.rs` (replace the stub):

```rust
use crate::post::Post;
use crate::source::DataSource;
use dril_types::{MediaItem, Repost, User};
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Deserialize)]
struct RawArchive {
    tweets: Vec<RawTweet>,
    users: Vec<RawUser>,
}

#[derive(Deserialize)]
struct RawTweet {
    id: u64,
    #[allow(dead_code)]
    user_id: u64,
    created_at: i64,
    text: String,
    like_count: u64,
    retweet_count: u64,
    in_reply_to_status_id: Option<u64>,
    in_reply_to_screen_name: Option<String>,
    is_quote_status: bool,
    quoted_status: Option<Box<RawTweet>>,
    retweeted_status_id: Option<u64>,
    retweeted_status: Option<Box<RawTweet>>,
    media: Vec<RawMedia>,
}

#[derive(Deserialize)]
struct RawMedia {
    #[serde(rename = "type")]
    media_type: String,
    url: String,
    width: Option<u32>,
    height: Option<u32>,
    alt_text: Option<String>,
}

#[derive(Deserialize)]
struct RawUser {
    id: u64,
    screen_name: String,
    name: Option<String>,
}

fn unix_to_iso(ts: i64) -> String {
    chrono::DateTime::from_timestamp(ts, 0)
        .map(|dt| dt.format("%Y-%m-%dT%H:%M:%SZ").to_string())
        .unwrap_or_else(|| format!("invalid-timestamp-{ts}"))
}

pub struct CodmasherSource {
    archive: RawArchive,
}

impl CodmasherSource {
    pub fn load(path: &str) -> Result<Self, String> {
        let data = std::fs::read_to_string(path).map_err(|e| format!("read {path}: {e}"))?;
        let archive: RawArchive =
            serde_json::from_str(&data).map_err(|e| format!("parse {path}: {e}"))?;
        Ok(CodmasherSource { archive })
    }
}

impl DataSource for CodmasherSource {
    fn posts(&self) -> Result<Vec<Post>, String> {
        let mut posts = Vec::new();
        for tweet in &self.archive.tweets {
            if tweet.retweeted_status_id.is_some() {
                continue;
            }
            let quoted_text = tweet
                .quoted_status
                .as_ref()
                .map(|qs| qs.text.clone());
            posts.push(Post {
                id: tweet.id.to_string(),
                text: tweet.text.clone(),
                created_at: unix_to_iso(tweet.created_at),
                is_reply: tweet.in_reply_to_status_id.is_some(),
                reply_to_user: tweet.in_reply_to_screen_name.clone(),
                is_quote: tweet.is_quote_status,
                quoted_text,
                likes: tweet.like_count,
                shares: tweet.retweet_count,
            });
        }
        Ok(posts)
    }

    fn reposts(&self) -> Result<Vec<Repost>, String> {
        let mut reposts = Vec::new();
        for tweet in &self.archive.tweets {
            if tweet.retweeted_status_id.is_none() {
                continue;
            }
            let (original_text, original_created_at, original_user_id, likes, shares) =
                match &tweet.retweeted_status {
                    Some(rt) => (
                        rt.text.clone(),
                        unix_to_iso(rt.created_at),
                        rt.user_id.to_string(),
                        rt.like_count,
                        rt.retweet_count,
                    ),
                    None => (
                        String::new(),
                        String::new(),
                        String::new(),
                        0,
                        0,
                    ),
                };
            reposts.push(Repost {
                id: tweet.id.to_string(),
                created_at: unix_to_iso(tweet.created_at),
                original_post_id: tweet.retweeted_status_id.unwrap().to_string(),
                original_user_id,
                original_text,
                original_created_at,
                likes,
                shares,
            });
        }
        Ok(reposts)
    }

    fn media(&self) -> Result<Vec<MediaItem>, String> {
        let mut items = Vec::new();
        for tweet in &self.archive.tweets {
            if tweet.retweeted_status_id.is_some() {
                continue;
            }
            for m in &tweet.media {
                items.push(MediaItem {
                    post_id: tweet.id.to_string(),
                    media_type: m.media_type.clone(),
                    url: m.url.clone(),
                    width: m.width,
                    height: m.height,
                    alt_text: m.alt_text.clone(),
                });
            }
        }
        Ok(items)
    }

    fn users(&self) -> Result<Vec<User>, String> {
        let mut seen = HashMap::new();
        for user in &self.archive.users {
            seen.entry(user.id).or_insert_with(|| User {
                id: user.id.to_string(),
                screen_name: user.screen_name.clone(),
                name: user.name.clone(),
            });
        }
        Ok(seen.into_values().collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn load_test_source() -> CodmasherSource {
        CodmasherSource::load("testdata/codemasher/dril.json").unwrap()
    }

    #[test]
    fn test_posts_excludes_retweets() {
        let source = load_test_source();
        let posts = source.posts().unwrap();
        assert_eq!(posts.len(), 4);
        assert!(posts.iter().all(|p| !p.text.starts_with("RT @")));
    }

    #[test]
    fn test_posts_converts_timestamps() {
        let source = load_test_source();
        let posts = source.posts().unwrap();
        let first = posts.iter().find(|p| p.id == "1234567890").unwrap();
        assert_eq!(first.created_at, "2008-09-15T17:25:20Z");
    }

    #[test]
    fn test_posts_reply_metadata() {
        let source = load_test_source();
        let posts = source.posts().unwrap();
        let reply = posts.iter().find(|p| p.id == "3456789012").unwrap();
        assert!(reply.is_reply);
        assert_eq!(reply.reply_to_user.as_deref(), Some("someone"));
    }

    #[test]
    fn test_posts_quote_tweet() {
        let source = load_test_source();
        let posts = source.posts().unwrap();
        let quote = posts.iter().find(|p| p.id == "4567890123").unwrap();
        assert!(quote.is_quote);
        assert_eq!(
            quote.quoted_text.as_deref(),
            Some("whats the worst thing a therapist has ever said to you")
        );
    }

    #[test]
    fn test_posts_engagement_metrics() {
        let source = load_test_source();
        let posts = source.posts().unwrap();
        let wise = posts.iter().find(|p| p.id == "2345678901").unwrap();
        assert_eq!(wise.likes, 178000);
        assert_eq!(wise.shares, 89000);
    }

    #[test]
    fn test_reposts() {
        let source = load_test_source();
        let reposts = source.reposts().unwrap();
        assert_eq!(reposts.len(), 1);
        assert_eq!(reposts[0].id, "9999999999");
        assert_eq!(reposts[0].original_post_id, "8888888888");
        assert_eq!(reposts[0].original_user_id, "77777");
        assert_eq!(reposts[0].original_text, "this is the funniest thing ive ever seen");
        assert_eq!(reposts[0].likes, 15000);
        assert_eq!(reposts[0].shares, 5000);
    }

    #[test]
    fn test_media() {
        let source = load_test_source();
        let media = source.media().unwrap();
        assert_eq!(media.len(), 1);
        assert_eq!(media[0].post_id, "2345678901");
        assert_eq!(media[0].media_type, "photo");
        assert_eq!(media[0].url, "https://pbs.twimg.com/media/wise_man.jpg");
        assert_eq!(media[0].width, Some(600));
        assert_eq!(media[0].alt_text.as_deref(), Some("wise man"));
    }

    #[test]
    fn test_users() {
        let source = load_test_source();
        let users = source.users().unwrap();
        assert_eq!(users.len(), 4);
        assert!(users.iter().any(|u| u.screen_name == "dril"));
        assert!(users.iter().any(|u| u.screen_name == "funperson"));
    }

    #[test]
    fn test_ids_are_strings() {
        let source = load_test_source();
        let posts = source.posts().unwrap();
        assert_eq!(posts[0].id, "1234567890");

        let reposts = source.reposts().unwrap();
        assert_eq!(reposts[0].id, "9999999999");
    }
}
```

- [ ] **Step 3: Run the tests**

Run: `cargo test -p dril-normalizer`
Expected: All 9 tests pass

- [ ] **Step 4: Test the CLI end-to-end**

Run:
```bash
cargo run -p dril-normalizer -- --source codemasher --input testdata/codemasher/dril.json --output-dir /tmp/normalizer-test/
```
Expected:
```
4 posts
1 reposts
1 media items
4 users
Output written to /tmp/normalizer-test/
```

Verify:
```bash
wc -l /tmp/normalizer-test/*.ndjson
```
Expected: 4 posts, 1 reposts, 1 media, 4 users

- [ ] **Step 5: Test full pipeline (normalizer → builder)**

Run:
```bash
cargo run -p dril-builder -- /tmp/normalizer-test/ /tmp/pipeline-test.db
```
Expected: `Built /tmp/pipeline-test.db with 4 posts, 1 reposts, 1 media, 4 users`

Verify FTS works:
```bash
sqlite3 /tmp/pipeline-test.db "SELECT id, text FROM posts JOIN posts_fts ON posts.rowid = posts_fts.rowid WHERE posts_fts MATCH 'wise' LIMIT 1;"
```
Expected: Returns the wise man post

- [ ] **Step 6: Commit**

```bash
git add normalizer/src/codemasher.rs testdata/codemasher/
git commit -m "feat(normalizer): CodmasherSource parses dril-archive JSON"
```

---

### Task 7: Documentation Updates

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Update CLAUDE.md**

Add the normalizer to the Project Layout:

```
normalizer/        Rust CLI (Cargo workspace member)
  src/main.rs      CLI entry point: --source, --input, --output-dir
  src/source.rs    DataSource trait
  src/codemasher.rs  CodmasherSource implementation
  src/post.rs      Post type (Serialize + Deserialize)
types/             Shared types crate
  src/lib.rs       Repost, MediaItem, User structs
```

Update the Testing section:

```sh
cargo test -p dril-builder    # 18 Rust tests (7 post parser + 11 db)
cargo test -p dril-normalizer  # 9 normalizer tests
bun run test:e2e              # 5 E2E browser tests (Playwright)
```

Update the Tech Stack table to include normalizer:

```
| Normalizer | Rust, `serde`/`serde_json`, `chrono` |
```

Update the Intermediate Data Format section to mention that the normalizer outputs 4 files.

Remove the Normalizer entry from "Not Yet Implemented".

- [ ] **Step 2: Update README.md**

Add a "Data Pipeline" section:

```markdown
## Data pipeline

To ingest the [codemasher/dril-archive](https://github.com/codemasher/dril-archive):

```sh
# Clone the archive
git clone https://github.com/codemasher/dril-archive.git /tmp/dril-archive

# Normalize to NDJSON
cargo run -p dril-normalizer -- --source codemasher --input /tmp/dril-archive/.build/dril.json --output-dir data/

# Build the database
cargo run --release -p dril-builder -- data/ site/dril.db
```
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: update for normalizer, new tables, and data pipeline"
```

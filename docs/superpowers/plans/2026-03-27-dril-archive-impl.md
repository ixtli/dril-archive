# dril-archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static web app that provides instant fuzzy search over @dril's tweet archive, distributable via CDN as a handful of static files.

**Architecture:** Rust CLI builder generates a SQLite database with FTS5 full-text search index from NDJSON tweet data. A vanilla HTML/JS/CSS frontend loads this database in-browser via sql.js (SQLite compiled to WASM) and provides as-you-type search. No backend server.

**Tech Stack:** Rust (builder, normalizer), SQLite FTS5, sql.js (WASM), vanilla HTML/JS/CSS

---

## File Map

**Create:**
- `Cargo.toml` — workspace root
- `builder/Cargo.toml` — builder crate manifest
- `builder/src/main.rs` — builder CLI: reads NDJSON, writes SQLite DB with FTS5
- `builder/src/tweet.rs` — Tweet struct, deserialization, validation
- `builder/src/db.rs` — SQLite schema creation, tweet insertion, FTS5 population
- `site/index.html` — single-page app shell, loading UI, search UI
- `site/app.js` — DB loading with progress, sql.js init, search logic, result rendering
- `site/style.css` — minimal styling for loading states, search box, results
- `.gitignore` — ignore data/, site/dril.db, target/
- `testdata/sample.ndjson` — synthetic test fixtures (10 tweets)

**Deferred (not in this plan):**
- `normalizer/` — depends on data source format, built when we have real data
- `scraper/` — depends on which archive/API we use

---

### Task 1: Project Scaffolding

**Files:**
- Create: `Cargo.toml`
- Create: `builder/Cargo.toml`
- Create: `builder/src/main.rs`
- Create: `.gitignore`

- [ ] **Step 1: Create workspace Cargo.toml**

Create `Cargo.toml` at the repo root:

```toml
[workspace]
members = ["builder"]
resolver = "2"
```

- [ ] **Step 2: Create builder crate**

Run:
```bash
cargo init --name dril-builder builder
```

- [ ] **Step 3: Add builder dependencies**

Replace `builder/Cargo.toml` with:

```toml
[package]
name = "dril-builder"
version = "0.1.0"
edition = "2024"

[dependencies]
rusqlite = { version = "0.35", features = ["bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 4: Verify it compiles**

Run: `cargo build`
Expected: Compiles successfully (downloads and builds bundled SQLite)

- [ ] **Step 5: Create .gitignore**

Create `.gitignore`:

```
/target
/data/
/site/dril.db
```

- [ ] **Step 6: Create test data directory and sample fixture**

Create `testdata/sample.ndjson`:

```
{"id":"1","text":"no","created_at":"2008-09-15T12:00:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null}
{"id":"2","text":"the wise man bowed his head solemnly and spoke: theres actually zero difference between good and bad things. you imbecile. you fucking moron","created_at":"2014-11-12T18:30:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null}
{"id":"3","text":"IF THE ZOO BANS ME FOR HOLLERING AT THE ANIMALS I WILL FACE GOD AND WALK BACKWARDS INTO HELL","created_at":"2012-07-22T03:15:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null}
{"id":"4","text":"another day volunteering at the betsy ross museum. everyone keeps asking me if they can fuck the flag. buddy, they wont even let me fuck it","created_at":"2019-06-14T14:00:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null}
{"id":"5","text":"\"im not owned! im not owned!!\", i continue to insist as i slowly shrink and transform into a corn cob","created_at":"2011-11-09T20:45:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null}
{"id":"6","text":"@someone you are like a little baby. watch this","created_at":"2015-03-08T09:00:00Z","is_reply":true,"reply_to_user":"someone","is_quote":false,"quoted_text":null}
{"id":"7","text":"awfully bold of you to fly the american flag on your house every day. this is my neighborhood and i wont stand for it","created_at":"2018-07-04T16:20:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null}
{"id":"8","text":"blocked. blocked. blocked. youre all blocked. none of you are free of sin","created_at":"2014-08-20T22:10:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null}
{"id":"9","text":"drunk driving may kill a lot of people, but it also helps a lot of people get to work on time, so, it;s impossible to say if its bad or not,","created_at":"2012-12-01T11:30:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null}
{"id":"10","text":"THERAPIST: your problem is, that youre perfect, and everyone is jealous of your good posts, and status. ME: I agree","created_at":"2016-05-19T07:45:00Z","is_reply":false,"reply_to_user":null,"is_quote":true,"quoted_text":"whats the worst thing a therapist has ever said to you"}
```

- [ ] **Step 7: Commit**

```bash
git add Cargo.toml builder/Cargo.toml builder/src/main.rs .gitignore testdata/sample.ndjson
git commit -m "scaffold: cargo workspace with builder crate and test fixtures"
```

---

### Task 2: Tweet Struct and NDJSON Parsing

**Files:**
- Create: `builder/src/tweet.rs`
- Modify: `builder/src/main.rs`

- [ ] **Step 1: Write tests for Tweet deserialization**

Create `builder/src/tweet.rs`:

```rust
use serde::Deserialize;

#[derive(Debug, Deserialize, PartialEq)]
pub struct Tweet {
    pub id: String,
    pub text: String,
    pub created_at: String,
    pub is_reply: bool,
    pub reply_to_user: Option<String>,
    pub is_quote: bool,
    pub quoted_text: Option<String>,
}

/// Parse an NDJSON reader into a Vec of Tweets, deduplicating by ID.
/// Returns tweets in order of first occurrence.
pub fn parse_ndjson<R: std::io::BufRead>(reader: R) -> Result<Vec<Tweet>, String> {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::BufReader;

    #[test]
    fn test_parse_single_tweet() {
        let input = r#"{"id":"1","text":"no","created_at":"2008-09-15T12:00:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null}"#;
        let reader = BufReader::new(input.as_bytes());
        let tweets = parse_ndjson(reader).unwrap();
        assert_eq!(tweets.len(), 1);
        assert_eq!(tweets[0].id, "1");
        assert_eq!(tweets[0].text, "no");
        assert!(!tweets[0].is_reply);
        assert!(tweets[0].reply_to_user.is_none());
    }

    #[test]
    fn test_parse_reply_tweet() {
        let input = r#"{"id":"6","text":"@someone you are like a little baby. watch this","created_at":"2015-03-08T09:00:00Z","is_reply":true,"reply_to_user":"someone","is_quote":false,"quoted_text":null}"#;
        let reader = BufReader::new(input.as_bytes());
        let tweets = parse_ndjson(reader).unwrap();
        assert_eq!(tweets.len(), 1);
        assert!(tweets[0].is_reply);
        assert_eq!(tweets[0].reply_to_user.as_deref(), Some("someone"));
    }

    #[test]
    fn test_parse_quote_tweet() {
        let input = r#"{"id":"10","text":"THERAPIST: your problem is, that youre perfect","created_at":"2016-05-19T07:45:00Z","is_reply":false,"reply_to_user":null,"is_quote":true,"quoted_text":"whats the worst thing a therapist has ever said to you"}"#;
        let reader = BufReader::new(input.as_bytes());
        let tweets = parse_ndjson(reader).unwrap();
        assert_eq!(tweets.len(), 1);
        assert!(tweets[0].is_quote);
        assert_eq!(
            tweets[0].quoted_text.as_deref(),
            Some("whats the worst thing a therapist has ever said to you")
        );
    }

    #[test]
    fn test_parse_multiple_tweets() {
        let input = concat!(
            r#"{"id":"1","text":"no","created_at":"2008-09-15T12:00:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null}"#,
            "\n",
            r#"{"id":"2","text":"yes","created_at":"2009-01-01T00:00:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null}"#,
        );
        let reader = BufReader::new(input.as_bytes());
        let tweets = parse_ndjson(reader).unwrap();
        assert_eq!(tweets.len(), 2);
        assert_eq!(tweets[0].id, "1");
        assert_eq!(tweets[1].id, "2");
    }

    #[test]
    fn test_deduplicates_by_id() {
        let input = concat!(
            r#"{"id":"1","text":"first","created_at":"2008-09-15T12:00:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null}"#,
            "\n",
            r#"{"id":"1","text":"duplicate","created_at":"2008-09-15T12:00:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null}"#,
        );
        let reader = BufReader::new(input.as_bytes());
        let tweets = parse_ndjson(reader).unwrap();
        assert_eq!(tweets.len(), 1);
        assert_eq!(tweets[0].text, "first");
    }

    #[test]
    fn test_skips_blank_lines() {
        let input = concat!(
            r#"{"id":"1","text":"no","created_at":"2008-09-15T12:00:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null}"#,
            "\n\n",
            r#"{"id":"2","text":"yes","created_at":"2009-01-01T00:00:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null}"#,
        );
        let reader = BufReader::new(input.as_bytes());
        let tweets = parse_ndjson(reader).unwrap();
        assert_eq!(tweets.len(), 2);
    }

    #[test]
    fn test_invalid_json_returns_error() {
        let input = "not json at all";
        let reader = BufReader::new(input.as_bytes());
        let result = parse_ndjson(reader);
        assert!(result.is_err());
    }
}
```

- [ ] **Step 2: Wire up the module in main.rs**

Replace `builder/src/main.rs` with:

```rust
mod tweet;
mod db;

fn main() {
    println!("dril-builder");
}
```

Note: `db` module doesn't exist yet. Create a placeholder at `builder/src/db.rs`:

```rust
// Database module — implemented in Task 3
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cargo test -p dril-builder`
Expected: Tests fail with `not yet implemented` panics

- [ ] **Step 4: Implement parse_ndjson**

Replace the `todo!()` in `builder/src/tweet.rs` `parse_ndjson` function with:

```rust
pub fn parse_ndjson<R: std::io::BufRead>(reader: R) -> Result<Vec<Tweet>, String> {
    let mut tweets = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();

    for (line_num, line) in reader.lines().enumerate() {
        let line = line.map_err(|e| format!("line {}: {}", line_num + 1, e))?;
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let tweet: Tweet = serde_json::from_str(line)
            .map_err(|e| format!("line {}: {}", line_num + 1, e))?;
        if seen_ids.insert(tweet.id.clone()) {
            tweets.push(tweet);
        }
    }

    Ok(tweets)
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cargo test -p dril-builder`
Expected: All 7 tests pass

- [ ] **Step 6: Commit**

```bash
git add builder/src/tweet.rs builder/src/main.rs builder/src/db.rs
git commit -m "feat(builder): tweet struct and NDJSON parser with deduplication"
```

---

### Task 3: SQLite Database Creation with FTS5

**Files:**
- Create: `builder/src/db.rs`

- [ ] **Step 1: Write tests for database creation and search**

Replace `builder/src/db.rs` with:

```rust
use crate::tweet::Tweet;
use rusqlite::Connection;

/// Create a new SQLite database with the tweets table and FTS5 index.
pub fn create_db(path: &std::path::Path) -> Result<Connection, String> {
    todo!()
}

/// Insert tweets into the database and populate the FTS5 index.
pub fn insert_tweets(conn: &Connection, tweets: &[Tweet]) -> Result<usize, String> {
    todo!()
}

/// Finalize the database: optimize and vacuum.
pub fn finalize(conn: &Connection) -> Result<(), String> {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tweet::Tweet;

    fn sample_tweets() -> Vec<Tweet> {
        vec![
            Tweet {
                id: "1".to_string(),
                text: "no".to_string(),
                created_at: "2008-09-15T12:00:00Z".to_string(),
                is_reply: false,
                reply_to_user: None,
                is_quote: false,
                quoted_text: None,
            },
            Tweet {
                id: "2".to_string(),
                text: "the wise man bowed his head solemnly and spoke: theres actually zero difference between good and bad things. you imbecile. you fucking moron".to_string(),
                created_at: "2014-11-12T18:30:00Z".to_string(),
                is_reply: false,
                reply_to_user: None,
                is_quote: false,
                quoted_text: None,
            },
            Tweet {
                id: "3".to_string(),
                text: "@someone you are like a little baby. watch this".to_string(),
                created_at: "2015-03-08T09:00:00Z".to_string(),
                is_reply: true,
                reply_to_user: Some("someone".to_string()),
                is_quote: false,
                quoted_text: None,
            },
            Tweet {
                id: "4".to_string(),
                text: "THERAPIST: your problem is, that youre perfect".to_string(),
                created_at: "2016-05-19T07:45:00Z".to_string(),
                is_reply: false,
                reply_to_user: None,
                is_quote: true,
                quoted_text: Some("whats the worst thing a therapist has ever said to you".to_string()),
            },
        ]
    }

    #[test]
    fn test_create_db_creates_tables() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = create_db(&db_path).unwrap();

        // Verify tweets table exists
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM tweets", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);

        // Verify FTS5 table exists
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM tweets_fts", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_insert_tweets() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = create_db(&db_path).unwrap();
        let tweets = sample_tweets();

        let count = insert_tweets(&conn, &tweets).unwrap();
        assert_eq!(count, 4);

        let stored: i64 = conn
            .query_row("SELECT COUNT(*) FROM tweets", [], |row| row.get(0))
            .unwrap();
        assert_eq!(stored, 4);
    }

    #[test]
    fn test_fts5_search_by_text() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = create_db(&db_path).unwrap();
        insert_tweets(&conn, &sample_tweets()).unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT t.id, t.text FROM tweets_fts f \
                 JOIN tweets t ON t.rowid = f.rowid \
                 WHERE tweets_fts MATCH ? ORDER BY rank",
            )
            .unwrap();

        let results: Vec<(String, String)> = stmt
            .query_map(["wise"], |row| Ok((row.get(0)?, row.get(1)?)))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].0, "2");
    }

    #[test]
    fn test_fts5_prefix_search() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = create_db(&db_path).unwrap();
        insert_tweets(&conn, &sample_tweets()).unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT t.id FROM tweets_fts f \
                 JOIN tweets t ON t.rowid = f.rowid \
                 WHERE tweets_fts MATCH ? ORDER BY rank",
            )
            .unwrap();

        // "ther*" should match "theres" (tweet 2) and "THERAPIST" (tweet 4)
        let results: Vec<String> = stmt
            .query_map(["ther*"], |row| row.get(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_fts5_searches_quoted_text() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = create_db(&db_path).unwrap();
        insert_tweets(&conn, &sample_tweets()).unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT t.id FROM tweets_fts f \
                 JOIN tweets t ON t.rowid = f.rowid \
                 WHERE tweets_fts MATCH ?",
            )
            .unwrap();

        // "therapist" appears in quoted_text of tweet 4
        let results: Vec<String> = stmt
            .query_map(["therapist"], |row| row.get(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert!(results.contains(&"4".to_string()));
    }

    #[test]
    fn test_reply_metadata_stored() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = create_db(&db_path).unwrap();
        insert_tweets(&conn, &sample_tweets()).unwrap();

        let (is_reply, reply_to): (bool, Option<String>) = conn
            .query_row(
                "SELECT is_reply, reply_to_user FROM tweets WHERE id = '3'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();

        assert!(is_reply);
        assert_eq!(reply_to.as_deref(), Some("someone"));
    }

    #[test]
    fn test_finalize_succeeds() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = create_db(&db_path).unwrap();
        insert_tweets(&conn, &sample_tweets()).unwrap();
        finalize(&conn).unwrap();
    }
}
```

- [ ] **Step 2: Add tempfile dev-dependency**

Add to `builder/Cargo.toml` under a new section:

```toml
[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cargo test -p dril-builder`
Expected: tweet tests pass, db tests fail with `not yet implemented`

- [ ] **Step 4: Implement create_db**

Replace the `todo!()` in `create_db`:

```rust
pub fn create_db(path: &std::path::Path) -> Result<Connection, String> {
    let conn = Connection::open(path).map_err(|e| format!("open db: {e}"))?;

    conn.execute_batch(
        "CREATE TABLE tweets (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            created_at TEXT NOT NULL,
            is_reply INTEGER NOT NULL DEFAULT 0,
            reply_to_user TEXT,
            is_quote INTEGER NOT NULL DEFAULT 0,
            quoted_text TEXT
        );

        CREATE VIRTUAL TABLE tweets_fts USING fts5(
            text,
            quoted_text,
            content='tweets',
            content_rowid='rowid'
        );",
    )
    .map_err(|e| format!("create tables: {e}"))?;

    Ok(conn)
}
```

- [ ] **Step 5: Implement insert_tweets**

Replace the `todo!()` in `insert_tweets`:

```rust
pub fn insert_tweets(conn: &Connection, tweets: &[Tweet]) -> Result<usize, String> {
    let mut insert_tweet = conn
        .prepare(
            "INSERT INTO tweets (id, text, created_at, is_reply, reply_to_user, is_quote, quoted_text) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        )
        .map_err(|e| format!("prepare insert: {e}"))?;

    let mut insert_fts = conn
        .prepare("INSERT INTO tweets_fts (rowid, text, quoted_text) VALUES (?1, ?2, ?3)")
        .map_err(|e| format!("prepare fts insert: {e}"))?;

    let mut count = 0;
    for tweet in tweets {
        insert_tweet
            .execute(rusqlite::params![
                tweet.id,
                tweet.text,
                tweet.created_at,
                tweet.is_reply,
                tweet.reply_to_user,
                tweet.is_quote,
                tweet.quoted_text,
            ])
            .map_err(|e| format!("insert tweet {}: {e}", tweet.id))?;

        let rowid = conn.last_insert_rowid();
        insert_fts
            .execute(rusqlite::params![rowid, tweet.text, tweet.quoted_text])
            .map_err(|e| format!("insert fts for {}: {e}", tweet.id))?;

        count += 1;
    }

    Ok(count)
}
```

- [ ] **Step 6: Implement finalize**

Replace the `todo!()` in `finalize`:

```rust
pub fn finalize(conn: &Connection) -> Result<(), String> {
    conn.execute_batch("INSERT INTO tweets_fts(tweets_fts) VALUES('optimize');")
        .map_err(|e| format!("optimize fts: {e}"))?;
    conn.execute_batch("VACUUM;")
        .map_err(|e| format!("vacuum: {e}"))?;
    Ok(())
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cargo test -p dril-builder`
Expected: All 14 tests pass (7 tweet + 7 db)

- [ ] **Step 8: Commit**

```bash
git add builder/src/db.rs builder/Cargo.toml
git commit -m "feat(builder): sqlite db creation with FTS5 full-text search index"
```

---

### Task 4: Builder CLI

**Files:**
- Modify: `builder/src/main.rs`

- [ ] **Step 1: Write the CLI main function**

Replace `builder/src/main.rs` with:

```rust
mod db;
mod tweet;

use std::fs::File;
use std::io::{self, BufReader};
use std::path::PathBuf;

fn run() -> Result<(), String> {
    let args: Vec<String> = std::env::args().collect();

    if args.len() < 2 || args.len() > 3 {
        return Err(format!("Usage: {} <input.ndjson> [output.db]", args[0]));
    }

    let input_path = &args[1];
    let output_path = if args.len() == 3 {
        PathBuf::from(&args[2])
    } else {
        PathBuf::from("dril.db")
    };

    eprintln!("Reading tweets from {input_path}...");
    let reader: Box<dyn io::BufRead> = if input_path == "-" {
        Box::new(BufReader::new(io::stdin()))
    } else {
        let file = File::open(input_path).map_err(|e| format!("open {input_path}: {e}"))?;
        Box::new(BufReader::new(file))
    };

    let tweets = tweet::parse_ndjson(reader)?;
    eprintln!("Parsed {} tweets", tweets.len());

    if output_path.exists() {
        std::fs::remove_file(&output_path)
            .map_err(|e| format!("remove existing db: {e}"))?;
    }

    let conn = db::create_db(&output_path)?;
    let count = db::insert_tweets(&conn, &tweets)?;
    db::finalize(&conn)?;

    eprintln!("Built {} with {count} tweets", output_path.display());
    Ok(())
}

fn main() {
    if let Err(e) = run() {
        eprintln!("Error: {e}");
        std::process::exit(1);
    }
}
```

- [ ] **Step 2: Build and test with sample data**

Run:
```bash
cargo build -p dril-builder && ./target/debug/dril-builder testdata/sample.ndjson /tmp/test-dril.db
```
Expected output:
```
Reading tweets from testdata/sample.ndjson...
Parsed 10 tweets
Built /tmp/test-dril.db with 10 tweets
```

- [ ] **Step 3: Verify the database with sqlite3**

Run:
```bash
sqlite3 /tmp/test-dril.db "SELECT COUNT(*) FROM tweets;"
```
Expected: `10`

Run:
```bash
sqlite3 /tmp/test-dril.db "SELECT t.id, t.text FROM tweets_fts f JOIN tweets t ON t.rowid = f.rowid WHERE tweets_fts MATCH 'corn' LIMIT 5;"
```
Expected: Returns tweet ID 5 (the corn cob tweet)

- [ ] **Step 4: Verify stdin input works**

Run:
```bash
cat testdata/sample.ndjson | ./target/debug/dril-builder - /tmp/test-stdin.db
```
Expected: Same output, builds successfully

- [ ] **Step 5: Commit**

```bash
git add builder/src/main.rs
git commit -m "feat(builder): CLI reads NDJSON and produces SQLite database"
```

---

### Task 5: Frontend — HTML Structure and Loading States

**Files:**
- Create: `site/index.html`
- Create: `site/style.css`

- [ ] **Step 1: Create index.html**

Create `site/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>dril archive</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="app">
        <h1>dril archive</h1>

        <div id="loading">
            <div id="progress-container">
                <div id="progress-bar"></div>
            </div>
            <p id="loading-text">Downloading archive...</p>
        </div>

        <div id="search-container" class="hidden">
            <input
                type="text"
                id="search-input"
                placeholder="search dril tweets..."
                autocomplete="off"
                autofocus
            >
            <div id="results"></div>
        </div>
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.js"></script>
    <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create style.css**

Create `site/style.css`:

```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
    background: #1a1a1a;
    color: #e0e0e0;
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
}

h1 {
    font-size: 1.4rem;
    margin-bottom: 20px;
    color: #888;
}

#loading {
    margin-top: 40px;
}

#progress-container {
    width: 100%;
    height: 6px;
    background: #333;
    border-radius: 3px;
    overflow: hidden;
}

#progress-bar {
    width: 0%;
    height: 100%;
    background: #4a9eff;
    transition: width 0.1s ease;
}

#loading-text {
    margin-top: 10px;
    font-size: 0.85rem;
    color: #666;
}

.hidden {
    display: none;
}

#search-input {
    width: 100%;
    padding: 12px 16px;
    font-size: 1.1rem;
    font-family: inherit;
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 6px;
    color: #e0e0e0;
    outline: none;
}

#search-input:focus {
    border-color: #4a9eff;
}

#results {
    margin-top: 16px;
}

.tweet {
    padding: 14px 0;
    border-bottom: 1px solid #2a2a2a;
}

.tweet-text {
    font-size: 0.95rem;
    line-height: 1.5;
    white-space: pre-wrap;
}

.tweet-meta {
    margin-top: 6px;
    font-size: 0.75rem;
    color: #666;
}

.tweet-meta a {
    color: #4a9eff;
    text-decoration: none;
}

.tweet-meta a:hover {
    text-decoration: underline;
}

.tweet-reply-to {
    font-size: 0.75rem;
    color: #555;
    margin-bottom: 4px;
}
```

- [ ] **Step 3: Verify the HTML loads in a browser**

Run:
```bash
python3 -m http.server 8080 --directory site &
```

Open `http://localhost:8080` in a browser. Verify:
- "dril archive" heading appears
- Progress bar is visible (at 0%)
- "Downloading archive..." text shows
- Search box is hidden

Kill the server after verifying.

- [ ] **Step 4: Commit**

```bash
git add site/index.html site/style.css
git commit -m "feat(site): html structure with loading states and search ui"
```

---

### Task 6: Frontend — DB Loading with Progress

**Files:**
- Create: `site/app.js`

- [ ] **Step 1: Create app.js with DB loading and progress tracking**

Create `site/app.js`:

```javascript
(function () {
    "use strict";

    const DB_URL = "dril.db";
    let db = null;

    const els = {
        loading: document.getElementById("loading"),
        progressBar: document.getElementById("progress-bar"),
        loadingText: document.getElementById("loading-text"),
        searchContainer: document.getElementById("search-container"),
        searchInput: document.getElementById("search-input"),
        results: document.getElementById("results"),
    };

    async function fetchWithProgress(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.status}`);
        }

        const contentLength = response.headers.get("Content-Length");
        if (!contentLength || !response.body) {
            // Fallback: no streaming progress
            els.loadingText.textContent = "Downloading archive...";
            const buf = await response.arrayBuffer();
            return new Uint8Array(buf);
        }

        const total = parseInt(contentLength, 10);
        let received = 0;
        const chunks = [];
        const reader = response.body.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            const pct = Math.round((received / total) * 100);
            els.progressBar.style.width = pct + "%";
            els.loadingText.textContent =
                `Downloading archive... ${(received / 1024 / 1024).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} MB`;
        }

        const result = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        return result;
    }

    async function init() {
        try {
            // Download DB with progress
            const dbData = await fetchWithProgress(DB_URL);

            // Init sql.js
            els.progressBar.style.width = "100%";
            els.loadingText.textContent = "Preparing search...";

            const SQL = await initSqlJs({
                locateFile: (file) =>
                    `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`,
            });

            db = new SQL.Database(dbData);

            // Ready
            els.loading.classList.add("hidden");
            els.searchContainer.classList.remove("hidden");
            els.searchInput.focus();
        } catch (err) {
            els.loadingText.textContent = "Failed to load: " + err.message;
            els.progressBar.style.background = "#ff4444";
            console.error(err);
        }
    }

    init();
})();
```

- [ ] **Step 2: Test with the sample database**

Build a test DB and copy it to site/:
```bash
cargo run -p dril-builder -- testdata/sample.ndjson site/dril.db
```

Start a local server and verify in browser:
```bash
python3 -m http.server 8080 --directory site &
```

Open `http://localhost:8080`. Verify:
- Progress bar fills as DB downloads
- "Preparing search..." appears briefly
- Search box appears and is focused
- No console errors

Kill the server.

- [ ] **Step 3: Commit**

```bash
git add site/app.js
git commit -m "feat(site): db loading with streaming progress bar"
```

---

### Task 7: Frontend — Search and Results Rendering

**Files:**
- Modify: `site/app.js`

- [ ] **Step 1: Add search and rendering logic to app.js**

Append the following inside the IIFE in `site/app.js`, just before the `init();` call:

```javascript
    function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDate(isoString) {
        const d = new Date(isoString);
        return d.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }

    function buildQuery(input) {
        // Tokenize, strip non-alphanumeric, add prefix wildcards
        const terms = input
            .trim()
            .split(/\s+/)
            .filter((t) => t.length > 0)
            .map((t) => t.replace(/[^\w]/g, ""))
            .filter((t) => t.length > 0)
            .map((t) => '"' + t + '"*');
        return terms.join(" ");
    }

    function search(input) {
        const query = buildQuery(input);
        if (!query) {
            els.results.innerHTML = "";
            return;
        }

        try {
            const stmt = db.prepare(
                `SELECT t.id, t.text, t.created_at, t.is_reply, t.reply_to_user
                 FROM tweets_fts f
                 JOIN tweets t ON t.rowid = f.rowid
                 WHERE tweets_fts MATCH ?
                 ORDER BY rank
                 LIMIT 50`
            );
            stmt.bind([query]);

            let html = "";
            while (stmt.step()) {
                const [id, text, created_at, is_reply, reply_to_user] = stmt.get();
                const url = `https://x.com/dril/status/${id}`;

                html += `<div class="tweet">`;
                if (is_reply && reply_to_user) {
                    html += `<div class="tweet-reply-to">replying to @${escapeHtml(reply_to_user)}</div>`;
                }
                html += `<div class="tweet-text">${escapeHtml(text)}</div>`;
                html += `<div class="tweet-meta">`;
                html += `${formatDate(created_at)} · <a href="${url}" target="_blank" rel="noopener">view on X</a>`;
                html += `</div></div>`;
            }
            stmt.free();

            els.results.innerHTML = html || `<p style="color:#666;margin-top:20px;">no results</p>`;
        } catch (err) {
            console.error("Search error:", err);
            els.results.innerHTML = "";
        }
    }

    let debounceTimer = null;
    function onInput() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => search(els.searchInput.value), 120);
    }

    els.searchInput.addEventListener("input", onInput);
```

- [ ] **Step 2: Test search in the browser**

Ensure the test DB is in place and start the server:
```bash
cargo run -p dril-builder -- testdata/sample.ndjson site/dril.db
python3 -m http.server 8080 --directory site &
```

Open `http://localhost:8080`. Verify:
- Type "corn" — the corn cob tweet appears
- Type "wise" — the wise man tweet appears
- Type "zoo" — the zoo tweet appears
- Type "baby" — the reply tweet appears with "replying to @someone"
- Type "therapist" — tweet 10 appears (matches both text and quoted_text)
- Clear the box — results disappear
- Type gibberish — "no results" message appears
- Each result has a "view on X" link
- Results appear as you type (no noticeable delay)

Kill the server.

- [ ] **Step 3: Commit**

```bash
git add site/app.js
git commit -m "feat(site): search with debounced FTS5 queries and result rendering"
```

---

### Task 8: End-to-End Verification and Cleanup

**Files:**
- Modify: `site/index.html` (minor, if needed)
- No new files

- [ ] **Step 1: Build a fresh database from test data**

```bash
cargo build --release -p dril-builder && ./target/release/dril-builder testdata/sample.ndjson site/dril.db
```
Expected: Builds and runs without error

- [ ] **Step 2: Verify the full site directory is self-contained**

```bash
ls -la site/
```
Expected: `index.html`, `app.js`, `style.css`, `dril.db`

- [ ] **Step 3: Full manual test**

```bash
python3 -m http.server 8080 --directory site &
```

Open `http://localhost:8080`. Walk through:
1. Page loads, progress bar fills, spinner shows "Preparing search..."
2. Search box appears
3. Type "flag" — tweets 4 and 7 appear
4. Type "blocked" — tweet 8 appears
5. Verify "view on X" links point to `https://x.com/dril/status/{correct_id}`
6. Verify reply tweet shows "replying to @someone"
7. Clear search, results disappear

Kill the server.

- [ ] **Step 4: Run all Rust tests one final time**

```bash
cargo test -p dril-builder
```
Expected: All tests pass

- [ ] **Step 5: Commit any final tweaks**

```bash
git add -A && git commit -m "chore: end-to-end verification complete"
```

(Skip this step if there are no changes to commit.)

---

## Deferred Work

These items are explicitly out of scope for this plan and will be addressed in follow-up plans:

1. **Normalizer** — Rust CLI to convert raw archive/API data to NDJSON. Blocked on choosing a data source.
2. **Data acquisition** — Finding a community archive and/or using Twitter API v2. Requires research.
3. **Production deployment** — Choosing a static host and setting up CI/CD.

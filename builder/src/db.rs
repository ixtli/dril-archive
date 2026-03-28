use crate::post::Post;
use rusqlite::Connection;

pub fn create_db(path: &std::path::Path) -> Result<Connection, String> {
    let conn = Connection::open(path).map_err(|e| format!("open db: {e}"))?;

    conn.execute_batch(
        "
        CREATE TABLE posts (
            id TEXT PRIMARY KEY,
            platform TEXT NOT NULL DEFAULT 'x',
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
            platform TEXT NOT NULL DEFAULT 'x',
            created_at TEXT,
            original_post_id TEXT NOT NULL,
            original_user_id TEXT,
            original_text TEXT NOT NULL,
            original_created_at TEXT,
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
            platform TEXT NOT NULL DEFAULT 'x',
            screen_name TEXT NOT NULL,
            name TEXT
        );
        ",
    )
    .map_err(|e| format!("create tables: {e}"))?;

    Ok(conn)
}

pub fn insert_posts(conn: &Connection, posts: &[Post]) -> Result<usize, String> {
    conn.execute_batch("BEGIN;")
        .map_err(|e| format!("begin transaction: {e}"))?;

    let mut post_stmt = conn
        .prepare(
            "INSERT INTO posts (id, platform, text, created_at, is_reply, reply_to_user, is_quote, quoted_text, likes, shares)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        )
        .map_err(|e| format!("prepare insert: {e}"))?;

    let mut fts_stmt = conn
        .prepare("INSERT INTO posts_fts(rowid, text, quoted_text) VALUES (?1, ?2, ?3)")
        .map_err(|e| format!("prepare fts insert: {e}"))?;

    for post in posts {
        post_stmt
            .execute(rusqlite::params![
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
            ])
            .map_err(|e| format!("insert post {}: {e}", post.id))?;

        let rowid = conn.last_insert_rowid();

        fts_stmt
            .execute(rusqlite::params![rowid, post.text, post.quoted_text])
            .map_err(|e| format!("insert fts for {}: {e}", post.id))?;
    }

    conn.execute_batch("COMMIT;")
        .map_err(|e| format!("commit transaction: {e}"))?;

    Ok(posts.len())
}

pub fn insert_reposts(conn: &Connection, reposts: &[dril_types::Repost]) -> Result<usize, String> {
    conn.execute_batch("BEGIN;")
        .map_err(|e| format!("begin transaction: {e}"))?;

    let mut stmt = conn
        .prepare(
            "INSERT INTO reposts (id, platform, created_at, original_post_id, original_user_id, original_text, original_created_at, likes, shares)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        )
        .map_err(|e| format!("prepare repost insert: {e}"))?;

    for repost in reposts {
        let synthetic_id = repost
            .id
            .clone()
            .unwrap_or_else(|| format!("repost-{}", repost.original_post_id));
        stmt.execute(rusqlite::params![
            synthetic_id,
            repost.platform,
            repost.created_at,
            repost.original_post_id,
            repost.original_user_id,
            repost.original_text,
            repost.original_created_at,
            repost.likes as i64,
            repost.shares as i64,
        ])
        .map_err(|e| format!("insert repost {}: {e}", synthetic_id))?;
    }

    conn.execute_batch("COMMIT;")
        .map_err(|e| format!("commit transaction: {e}"))?;
    Ok(reposts.len())
}

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

pub fn insert_users(conn: &Connection, users: &[dril_types::User]) -> Result<usize, String> {
    conn.execute_batch("BEGIN;")
        .map_err(|e| format!("begin transaction: {e}"))?;

    let mut stmt = conn
        .prepare(
            "INSERT INTO users (id, platform, screen_name, name)
             VALUES (?1, ?2, ?3, ?4)",
        )
        .map_err(|e| format!("prepare user insert: {e}"))?;

    for user in users {
        stmt.execute(rusqlite::params![
            user.id,
            user.platform,
            user.screen_name,
            user.name,
        ])
        .map_err(|e| format!("insert user {}: {e}", user.id))?;
    }

    conn.execute_batch("COMMIT;")
        .map_err(|e| format!("commit transaction: {e}"))?;
    Ok(users.len())
}

pub fn finalize(conn: &Connection) -> Result<(), String> {
    conn.execute_batch("INSERT INTO posts_fts(posts_fts) VALUES('optimize');")
        .map_err(|e| format!("optimize fts: {e}"))?;
    conn.execute_batch("VACUUM;")
        .map_err(|e| format!("vacuum: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use dril_types::{MediaItem, Repost, User};
    use tempfile;

    fn sample_posts() -> Vec<Post> {
        vec![
            Post {
                id: "1".to_string(),
                platform: "x".to_string(),
                text: "no".to_string(),
                created_at: "2008-09-15T12:00:00Z".to_string(),
                is_reply: false,
                reply_to_user: None,
                is_quote: false,
                quoted_text: None,
                likes: 4200,
                shares: 850,
            },
            Post {
                id: "2".to_string(),
                platform: "x".to_string(),
                text: "the wise man bowed his head solemnly and spoke: theres actually zero difference between good and bad things. you imbecile. you fucking moron".to_string(),
                created_at: "2014-11-12T18:30:00Z".to_string(),
                is_reply: false,
                reply_to_user: None,
                is_quote: false,
                quoted_text: None,
                likes: 178000,
                shares: 89000,
            },
            Post {
                id: "3".to_string(),
                platform: "x".to_string(),
                text: "@someone you are like a little baby. watch this".to_string(),
                created_at: "2015-03-08T09:00:00Z".to_string(),
                is_reply: true,
                reply_to_user: Some("someone".to_string()),
                is_quote: false,
                quoted_text: None,
                likes: 45,
                shares: 8,
            },
            Post {
                id: "4".to_string(),
                platform: "x".to_string(),
                text: "THERAPIST: your problem is, that youre perfect".to_string(),
                created_at: "2016-05-19T07:45:00Z".to_string(),
                is_reply: false,
                reply_to_user: None,
                is_quote: true,
                quoted_text: Some(
                    "whats the worst thing a therapist has ever said to you".to_string(),
                ),
                likes: 54321,
                shares: 12345,
            },
        ]
    }

    #[test]
    fn test_create_db_creates_all_tables() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = create_db(&db_path).unwrap();

        for table in &["posts", "posts_fts", "reposts", "media", "users"] {
            let count: i64 = conn
                .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))
                .unwrap();
            assert_eq!(count, 0, "table {table} should exist and be empty");
        }
    }

    #[test]
    fn test_create_db_creates_tables() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = create_db(&db_path).unwrap();

        let post_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM posts", [], |r| r.get(0))
            .unwrap();
        assert_eq!(post_count, 0);

        let fts_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM posts_fts", [], |r| r.get(0))
            .unwrap();
        assert_eq!(fts_count, 0);
    }

    #[test]
    fn test_insert_posts() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = create_db(&db_path).unwrap();
        let posts = sample_posts();
        let count = insert_posts(&conn, &posts).unwrap();
        assert_eq!(count, 4);

        let stored: i64 = conn
            .query_row("SELECT COUNT(*) FROM posts", [], |r| r.get(0))
            .unwrap();
        assert_eq!(stored, 4);
    }

    #[test]
    fn test_fts5_search_by_text() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = create_db(&db_path).unwrap();
        insert_posts(&conn, &sample_posts()).unwrap();

        let id: String = conn
            .query_row(
                "SELECT posts.id FROM posts JOIN posts_fts ON posts.rowid = posts_fts.rowid WHERE posts_fts MATCH 'wise'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(id, "2");
    }

    #[test]
    fn test_fts5_prefix_search() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = create_db(&db_path).unwrap();
        insert_posts(&conn, &sample_posts()).unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT posts.id FROM posts JOIN posts_fts ON posts.rowid = posts_fts.rowid WHERE posts_fts MATCH 'ther*'",
            )
            .unwrap();
        let ids: Vec<String> = stmt
            .query_map([], |r| r.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        assert_eq!(ids.len(), 2);
    }

    #[test]
    fn test_fts5_searches_quoted_text() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = create_db(&db_path).unwrap();
        insert_posts(&conn, &sample_posts()).unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT t.id FROM posts_fts f JOIN posts t ON t.rowid = f.rowid WHERE posts_fts MATCH 'therapist'",
            )
            .unwrap();
        let results: Vec<String> = stmt
            .query_map([], |r| r.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();

        assert!(results.contains(&"4".to_string()));
    }

    #[test]
    fn test_reply_metadata_stored() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = create_db(&db_path).unwrap();
        insert_posts(&conn, &sample_posts()).unwrap();

        let (is_reply, reply_to_user): (i64, String) = conn
            .query_row(
                "SELECT is_reply, reply_to_user FROM posts WHERE id = '3'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(is_reply, 1);
        assert_eq!(reply_to_user, "someone");
    }

    #[test]
    fn test_finalize_succeeds() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = create_db(&db_path).unwrap();
        insert_posts(&conn, &sample_posts()).unwrap();
        assert!(finalize(&conn).is_ok());
    }

    fn sample_reposts() -> Vec<Repost> {
        vec![
            Repost {
                id: Some("100".to_string()),
                platform: "x".to_string(),
                created_at: Some("2023-01-15T10:00:00Z".to_string()),
                original_post_id: "200".to_string(),
                original_user_id: Some("300".to_string()),
                original_text: "some funny tweet dril retweeted".to_string(),
                original_created_at: Some("2023-01-14T08:00:00Z".to_string()),
                likes: 5000,
                shares: 1200,
            },
            Repost {
                id: Some("101".to_string()),
                platform: "x".to_string(),
                created_at: Some("2023-02-20T14:30:00Z".to_string()),
                original_post_id: "201".to_string(),
                original_user_id: Some("301".to_string()),
                original_text: "another retweet".to_string(),
                original_created_at: Some("2023-02-19T12:00:00Z".to_string()),
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
                platform: "x".to_string(),
                screen_name: "dril".to_string(),
                name: Some("wint".to_string()),
            },
            User {
                id: "300".to_string(),
                platform: "x".to_string(),
                screen_name: "someone".to_string(),
                name: Some("Some Person".to_string()),
            },
            User {
                id: "301".to_string(),
                platform: "x".to_string(),
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

        let post1_media: i64 = conn
            .query_row("SELECT COUNT(*) FROM media WHERE post_id = '1'", [], |r| {
                r.get(0)
            })
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
            .query_row("SELECT platform FROM posts WHERE id = '2'", [], |r| {
                r.get(0)
            })
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
}

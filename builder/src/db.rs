use crate::post::Post;
use rusqlite::Connection;

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
            "INSERT INTO posts (id, text, created_at, is_reply, reply_to_user, is_quote, quoted_text, likes, shares)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        )
        .map_err(|e| format!("prepare insert: {e}"))?;

    let mut fts_stmt = conn
        .prepare("INSERT INTO posts_fts(rowid, text, quoted_text) VALUES (?1, ?2, ?3)")
        .map_err(|e| format!("prepare fts insert: {e}"))?;

    for post in posts {
        post_stmt
            .execute(rusqlite::params![
                post.id,
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
    use tempfile;

    fn sample_posts() -> Vec<Post> {
        vec![
            Post {
                id: "1".to_string(),
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
}

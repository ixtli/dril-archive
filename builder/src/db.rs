use crate::tweet::Tweet;
use rusqlite::Connection;

#[allow(dead_code)]
pub fn create_db(path: &std::path::Path) -> Result<Connection, String> {
    let conn = Connection::open(path).map_err(|e| e.to_string())?;

    conn.execute_batch(
        "
        CREATE TABLE tweets (
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
        );
        ",
    )
    .map_err(|e| e.to_string())?;

    Ok(conn)
}

#[allow(dead_code)]
pub fn insert_tweets(conn: &Connection, tweets: &[Tweet]) -> Result<usize, String> {
    let mut tweet_stmt = conn
        .prepare(
            "INSERT INTO tweets (id, text, created_at, is_reply, reply_to_user, is_quote, quoted_text)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        )
        .map_err(|e| e.to_string())?;

    let mut fts_stmt = conn
        .prepare("INSERT INTO tweets_fts(rowid, text, quoted_text) VALUES (?1, ?2, ?3)")
        .map_err(|e| e.to_string())?;

    for tweet in tweets {
        tweet_stmt
            .execute(rusqlite::params![
                tweet.id,
                tweet.text,
                tweet.created_at,
                tweet.is_reply as i64,
                tweet.reply_to_user,
                tweet.is_quote as i64,
                tweet.quoted_text,
            ])
            .map_err(|e| e.to_string())?;

        let rowid = conn.last_insert_rowid();

        fts_stmt
            .execute(rusqlite::params![rowid, tweet.text, tweet.quoted_text])
            .map_err(|e| e.to_string())?;
    }

    Ok(tweets.len())
}

#[allow(dead_code)]
pub fn finalize(conn: &Connection) -> Result<(), String> {
    conn.execute_batch("INSERT INTO tweets_fts(tweets_fts) VALUES('optimize');")
        .map_err(|e| e.to_string())?;
    conn.execute_batch("VACUUM;").map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;

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
                quoted_text: Some(
                    "whats the worst thing a therapist has ever said to you".to_string(),
                ),
            },
        ]
    }

    #[test]
    fn test_create_db_creates_tables() {
        let tmp = NamedTempFile::new().unwrap();
        let conn = create_db(tmp.path()).unwrap();

        let tweet_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM tweets", [], |r| r.get(0))
            .unwrap();
        assert_eq!(tweet_count, 0);

        let fts_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM tweets_fts", [], |r| r.get(0))
            .unwrap();
        assert_eq!(fts_count, 0);
    }

    #[test]
    fn test_insert_tweets() {
        let tmp = NamedTempFile::new().unwrap();
        let conn = create_db(tmp.path()).unwrap();
        let tweets = sample_tweets();
        let count = insert_tweets(&conn, &tweets).unwrap();
        assert_eq!(count, 4);
    }

    #[test]
    fn test_fts5_search_by_text() {
        let tmp = NamedTempFile::new().unwrap();
        let conn = create_db(tmp.path()).unwrap();
        insert_tweets(&conn, &sample_tweets()).unwrap();

        let id: String = conn
            .query_row(
                "SELECT tweets.id FROM tweets JOIN tweets_fts ON tweets.rowid = tweets_fts.rowid WHERE tweets_fts MATCH 'wise'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(id, "2");
    }

    #[test]
    fn test_fts5_prefix_search() {
        let tmp = NamedTempFile::new().unwrap();
        let conn = create_db(tmp.path()).unwrap();
        insert_tweets(&conn, &sample_tweets()).unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT tweets.id FROM tweets JOIN tweets_fts ON tweets.rowid = tweets_fts.rowid WHERE tweets_fts MATCH 'ther*'",
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
        let tmp = NamedTempFile::new().unwrap();
        let conn = create_db(tmp.path()).unwrap();
        insert_tweets(&conn, &sample_tweets()).unwrap();

        let id: String = conn
            .query_row(
                "SELECT tweets.id FROM tweets JOIN tweets_fts ON tweets.rowid = tweets_fts.rowid WHERE tweets_fts MATCH 'therapist' AND tweets.is_quote = 1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(id, "4");
    }

    #[test]
    fn test_reply_metadata_stored() {
        let tmp = NamedTempFile::new().unwrap();
        let conn = create_db(tmp.path()).unwrap();
        insert_tweets(&conn, &sample_tweets()).unwrap();

        let (is_reply, reply_to_user): (i64, String) = conn
            .query_row(
                "SELECT is_reply, reply_to_user FROM tweets WHERE id = '3'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(is_reply, 1);
        assert_eq!(reply_to_user, "someone");
    }

    #[test]
    fn test_finalize_succeeds() {
        let tmp = NamedTempFile::new().unwrap();
        let conn = create_db(tmp.path()).unwrap();
        insert_tweets(&conn, &sample_tweets()).unwrap();
        assert!(finalize(&conn).is_ok());
    }
}

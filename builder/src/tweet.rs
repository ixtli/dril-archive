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
    let mut tweets = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();

    for (line_num, line) in reader.lines().enumerate() {
        let line = line.map_err(|e| format!("line {}: {}", line_num + 1, e))?;
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let tweet: Tweet =
            serde_json::from_str(line).map_err(|e| format!("line {}: {}", line_num + 1, e))?;
        if seen_ids.insert(tweet.id.clone()) {
            tweets.push(tweet);
        }
    }

    Ok(tweets)
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

use serde::Deserialize;

fn default_platform() -> String {
    "x".to_string()
}

#[derive(Debug, Deserialize, PartialEq)]
pub struct Post {
    pub id: String,
    #[serde(default = "default_platform")]
    pub platform: String,
    pub text: String,
    pub created_at: String,
    pub is_reply: bool,
    pub reply_to_user: Option<String>,
    pub is_quote: bool,
    pub quoted_text: Option<String>,
    pub likes: u64,
    pub shares: u64,
}

/// Parse an NDJSON reader into a Vec of Posts, deduplicating by ID.
/// Returns posts in order of first occurrence.
pub fn parse_ndjson<R: std::io::BufRead>(reader: R) -> Result<Vec<Post>, String> {
    let mut posts = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();

    for (line_num, line) in reader.lines().enumerate() {
        let line = line.map_err(|e| format!("line {}: {}", line_num + 1, e))?;
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let post: Post =
            serde_json::from_str(line).map_err(|e| format!("line {}: {}", line_num + 1, e))?;
        if seen_ids.insert(post.id.clone()) {
            posts.push(post);
        }
    }

    Ok(posts)
}

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

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::BufReader;

    #[test]
    fn test_parse_single_post() {
        let input = r#"{"id":"1","text":"no","created_at":"2008-09-15T12:00:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":42,"shares":3}"#;
        let reader = BufReader::new(input.as_bytes());
        let posts = parse_ndjson(reader).unwrap();
        assert_eq!(posts.len(), 1);
        assert_eq!(posts[0].id, "1");
        assert_eq!(posts[0].text, "no");
        assert!(!posts[0].is_reply);
        assert!(posts[0].reply_to_user.is_none());
    }

    #[test]
    fn test_parse_reply_post() {
        let input = r#"{"id":"6","text":"@someone you are like a little baby. watch this","created_at":"2015-03-08T09:00:00Z","is_reply":true,"reply_to_user":"someone","is_quote":false,"quoted_text":null,"likes":89,"shares":12}"#;
        let reader = BufReader::new(input.as_bytes());
        let posts = parse_ndjson(reader).unwrap();
        assert_eq!(posts.len(), 1);
        assert!(posts[0].is_reply);
        assert_eq!(posts[0].reply_to_user.as_deref(), Some("someone"));
    }

    #[test]
    fn test_parse_quote_post() {
        let input = r#"{"id":"10","text":"THERAPIST: your problem is, that youre perfect","created_at":"2016-05-19T07:45:00Z","is_reply":false,"reply_to_user":null,"is_quote":true,"quoted_text":"whats the worst thing a therapist has ever said to you","likes":54321,"shares":12345}"#;
        let reader = BufReader::new(input.as_bytes());
        let posts = parse_ndjson(reader).unwrap();
        assert_eq!(posts.len(), 1);
        assert!(posts[0].is_quote);
        assert_eq!(
            posts[0].quoted_text.as_deref(),
            Some("whats the worst thing a therapist has ever said to you")
        );
    }

    #[test]
    fn test_parse_multiple_posts() {
        let input = concat!(
            r#"{"id":"1","text":"no","created_at":"2008-09-15T12:00:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":42,"shares":3}"#,
            "\n",
            r#"{"id":"2","text":"yes","created_at":"2009-01-01T00:00:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":10,"shares":1}"#,
        );
        let reader = BufReader::new(input.as_bytes());
        let posts = parse_ndjson(reader).unwrap();
        assert_eq!(posts.len(), 2);
        assert_eq!(posts[0].id, "1");
        assert_eq!(posts[1].id, "2");
    }

    #[test]
    fn test_deduplicates_by_id() {
        let input = concat!(
            r#"{"id":"1","text":"first","created_at":"2008-09-15T12:00:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":42,"shares":3}"#,
            "\n",
            r#"{"id":"1","text":"duplicate","created_at":"2008-09-15T12:00:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":42,"shares":3}"#,
        );
        let reader = BufReader::new(input.as_bytes());
        let posts = parse_ndjson(reader).unwrap();
        assert_eq!(posts.len(), 1);
        assert_eq!(posts[0].text, "first");
    }

    #[test]
    fn test_skips_blank_lines() {
        let input = concat!(
            r#"{"id":"1","text":"no","created_at":"2008-09-15T12:00:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":42,"shares":3}"#,
            "\n\n",
            r#"{"id":"2","text":"yes","created_at":"2009-01-01T00:00:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":10,"shares":1}"#,
        );
        let reader = BufReader::new(input.as_bytes());
        let posts = parse_ndjson(reader).unwrap();
        assert_eq!(posts.len(), 2);
    }

    #[test]
    fn test_invalid_json_returns_error() {
        let input = "not json at all";
        let reader = BufReader::new(input.as_bytes());
        let result = parse_ndjson(reader);
        assert!(result.is_err());
    }
}

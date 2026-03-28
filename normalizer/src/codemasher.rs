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
    #[serde(default)]
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
            let quoted_text = tweet.quoted_status.as_ref().map(|qs| qs.text.clone());
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
                    None => (String::new(), String::new(), String::new(), 0, 0),
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
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../testdata/codemasher/dril.json"
        );
        CodmasherSource::load(path).unwrap()
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
        assert_eq!(first.created_at, "2008-09-15T17:05:20Z");
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
        assert_eq!(
            reposts[0].original_text,
            "this is the funniest thing ive ever seen"
        );
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

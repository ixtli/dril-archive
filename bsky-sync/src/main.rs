use serde::Deserialize;
use serde::Serialize;
use std::fs;
use std::io::{BufRead, Write};
use std::path::Path;
use std::thread;
use std::time::Duration;

const BASE_URL: &str = "https://public.api.bsky.app";
const ACTOR: &str = "dril.bsky.social";
const USER_AGENT: &str = "dril-archive/0.1";

// --- API response types ---

#[derive(Debug, Deserialize)]
struct FeedResponse {
    #[serde(default)]
    cursor: Option<String>,
    #[serde(default)]
    feed: Vec<FeedItem>,
}

#[derive(Debug, Deserialize)]
struct FeedItem {
    post: Post,
    #[serde(default)]
    reason: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct Post {
    uri: String,
    author: Author,
    record: serde_json::Value,
    #[serde(default)]
    embed: Option<serde_json::Value>,
    #[serde(default, rename = "likeCount")]
    like_count: u64,
    #[serde(default, rename = "repostCount")]
    repost_count: u64,
    #[serde(default, rename = "replyCount")]
    #[allow(dead_code)]
    reply_count: u64,
    #[serde(default, rename = "quoteCount")]
    #[allow(dead_code)]
    quote_count: u64,
}

#[derive(Debug, Deserialize)]
struct Author {
    handle: String,
    #[serde(default, rename = "displayName")]
    #[allow(dead_code)]
    display_name: Option<String>,
}

// --- Output types ---

#[derive(Debug, Serialize)]
struct OutputPost {
    #[serde(rename = "type")]
    record_type: String,
    platform: String,
    id: String,
    text: String,
    created_at: String,
    is_reply: bool,
    reply_to_user: Option<String>,
    is_quote: bool,
    quoted_text: Option<String>,
    likes: u64,
    shares: u64,
    media: Vec<MediaItem>,
}

#[derive(Debug, Serialize)]
struct OutputRepost {
    #[serde(rename = "type")]
    record_type: String,
    platform: String,
    id: Option<String>,
    created_at: Option<String>,
    original_user: String,
    original_post_id: String,
    original_text: String,
    original_created_at: String,
    likes: u64,
    shares: u64,
}

#[derive(Debug, Serialize)]
struct MediaItem {
    #[serde(rename = "type")]
    media_type: String,
    url: String,
    width: Option<u64>,
    height: Option<u64>,
    alt_text: Option<String>,
}

// --- Fetching ---

fn fetch_page(
    client: &reqwest::blocking::Client,
    cursor: Option<&str>,
) -> Result<FeedResponse, String> {
    let mut url = format!(
        "{}/xrpc/app.bsky.feed.getAuthorFeed?actor={}&limit=100&filter=posts_with_replies",
        BASE_URL, ACTOR
    );
    if let Some(c) = cursor {
        url.push_str("&cursor=");
        url.push_str(c);
    }

    let resp = client
        .get(&url)
        .header("User-Agent", USER_AGENT)
        .send()
        .map_err(|e| format!("request failed: {e}"))?;

    let status = resp.status();
    if status == reqwest::StatusCode::TOO_MANY_REQUESTS || status.is_server_error() {
        // Retry once after a short delay
        eprintln!("Got {status}, retrying in 2s...");
        thread::sleep(Duration::from_secs(2));
        let resp = client
            .get(&url)
            .header("User-Agent", USER_AGENT)
            .send()
            .map_err(|e| format!("retry request failed: {e}"))?;
        let retry_status = resp.status();
        if !retry_status.is_success() {
            return Err(format!("API returned {retry_status} on retry"));
        }
        return resp
            .json::<FeedResponse>()
            .map_err(|e| format!("parse response: {e}"));
    }

    if !status.is_success() {
        return Err(format!("API returned {status}"));
    }

    resp.json::<FeedResponse>()
        .map_err(|e| format!("parse response: {e}"))
}

fn paginate_all(
    client: &reqwest::blocking::Client,
    since: Option<&str>,
) -> Result<Vec<FeedItem>, String> {
    let mut all_items = Vec::new();
    let mut cursor: Option<String> = None;
    let mut page = 0;

    loop {
        page += 1;
        eprintln!("Fetching page {page}...");
        let resp = fetch_page(client, cursor.as_deref())?;
        let item_count = resp.feed.len();

        let mut hit_since = false;
        for item in resp.feed {
            if let Some(since_ts) = since {
                let created_at = item
                    .post
                    .record
                    .get("createdAt")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                if !created_at.is_empty() && created_at <= since_ts {
                    hit_since = true;
                    break;
                }
            }
            all_items.push(item);
        }

        if hit_since {
            eprintln!("Reached --since cutoff, stopping.");
            break;
        }

        if item_count == 0 || resp.cursor.is_none() {
            break;
        }

        cursor = resp.cursor;

        // Be polite
        thread::sleep(Duration::from_millis(200));
    }

    Ok(all_items)
}

// --- Conversion ---

fn extract_post_id(uri: &str) -> String {
    uri.rsplit('/').next().unwrap_or("").to_string()
}

fn is_repost_by_dril(reason: &Option<serde_json::Value>) -> bool {
    if let Some(r) = reason {
        let rtype = r.get("$type").and_then(|v| v.as_str()).unwrap_or("");
        if rtype == "app.bsky.feed.defs#reasonRepost" {
            let handle = r
                .get("by")
                .and_then(|b| b.get("handle"))
                .and_then(|h| h.as_str())
                .unwrap_or("");
            return handle == ACTOR;
        }
    }
    false
}

fn convert_item(item: &FeedItem) -> Option<serde_json::Value> {
    let post = &item.post;

    // If it's a repost by dril, output a repost record
    if is_repost_by_dril(&item.reason) {
        let original_user = post.author.handle.clone();
        let original_post_id = extract_post_id(&post.uri);
        let original_text = post
            .record
            .get("text")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let original_created_at = post
            .record
            .get("createdAt")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let repost = OutputRepost {
            record_type: "repost".to_string(),
            platform: "bsky".to_string(),
            id: None,
            created_at: item
                .reason
                .as_ref()
                .and_then(|r| r.get("indexedAt"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            original_user,
            original_post_id,
            original_text,
            original_created_at,
            likes: post.like_count,
            shares: post.repost_count,
        };
        return serde_json::to_value(repost).ok();
    }

    // If this is a reason-type we don't handle, or author isn't dril, skip
    if item.reason.is_some() {
        return None;
    }
    if post.author.handle != ACTOR {
        return None;
    }

    // Regular post or reply
    let text = post
        .record
        .get("text")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let created_at = post
        .record
        .get("createdAt")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let id = extract_post_id(&post.uri);

    let is_reply = post.record.get("reply").is_some();

    // Check for quote post
    let (is_quote, quoted_text) = check_quote_embed(&post.embed);

    // Extract media
    let media = extract_media(&post.embed);

    let output = OutputPost {
        record_type: "post".to_string(),
        platform: "bsky".to_string(),
        id,
        text,
        created_at,
        is_reply,
        reply_to_user: None,
        is_quote,
        quoted_text,
        likes: post.like_count,
        shares: post.repost_count,
        media,
    };
    serde_json::to_value(output).ok()
}

fn check_quote_embed(embed: &Option<serde_json::Value>) -> (bool, Option<String>) {
    if let Some(e) = embed {
        let etype = e.get("$type").and_then(|v| v.as_str()).unwrap_or("");
        if etype == "app.bsky.embed.record#view" {
            let quoted = e
                .get("record")
                .and_then(|r| r.get("value"))
                .and_then(|v| v.get("text"))
                .and_then(|t| t.as_str())
                .map(|s| s.to_string());
            return (true, quoted);
        }
        // recordWithMedia also contains a record embed
        if etype == "app.bsky.embed.recordWithMedia#view" {
            let quoted = e
                .get("record")
                .and_then(|r| r.get("record"))
                .and_then(|r| r.get("value"))
                .and_then(|v| v.get("text"))
                .and_then(|t| t.as_str())
                .map(|s| s.to_string());
            return (true, quoted);
        }
    }
    (false, None)
}

fn extract_media(embed: &Option<serde_json::Value>) -> Vec<MediaItem> {
    let mut media = Vec::new();
    if let Some(e) = embed {
        let etype = e.get("$type").and_then(|v| v.as_str()).unwrap_or("");
        let images = if etype == "app.bsky.embed.images#view" {
            e.get("images")
        } else if etype == "app.bsky.embed.recordWithMedia#view" {
            // Images nested under media.images
            e.get("media").and_then(|m| m.get("images"))
        } else {
            None
        };

        if let Some(serde_json::Value::Array(imgs)) = images {
            for img in imgs {
                let url = img
                    .get("fullsize")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                if url.is_empty() {
                    continue;
                }
                let width = img
                    .get("aspectRatio")
                    .and_then(|a| a.get("width"))
                    .and_then(|v| v.as_u64());
                let height = img
                    .get("aspectRatio")
                    .and_then(|a| a.get("height"))
                    .and_then(|v| v.as_u64());
                let alt_text = img
                    .get("alt")
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.is_empty())
                    .map(|s| s.to_string());
                media.push(MediaItem {
                    media_type: "photo".to_string(),
                    url,
                    width,
                    height,
                    alt_text,
                });
            }
        }
    }
    media
}

// --- Incremental support ---

fn read_latest_created_at(path: &Path) -> Option<String> {
    if !path.exists() {
        return None;
    }
    let file = fs::File::open(path).ok()?;
    let reader = std::io::BufReader::new(file);
    let mut latest: Option<String> = None;

    for line in reader.lines() {
        let line = line.ok()?;
        if line.is_empty() {
            continue;
        }
        let val: serde_json::Value = serde_json::from_str(&line).ok()?;
        if let Some(ts) = val.get("created_at").and_then(|v| v.as_str())
            && !ts.is_empty()
        {
            match &latest {
                None => latest = Some(ts.to_string()),
                Some(current) if ts > current.as_str() => {
                    latest = Some(ts.to_string());
                }
                _ => {}
            }
        }
    }

    latest
}

// --- CLI ---

fn parse_args() -> Result<(String, Option<String>), String> {
    let args: Vec<String> = std::env::args().collect();
    let mut output = "data/scraped/bsky-dril.jsonl".to_string();
    let mut since: Option<String> = None;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--output" => {
                i += 1;
                output = args.get(i).ok_or("missing value for --output")?.clone();
            }
            "--since" => {
                i += 1;
                since = Some(args.get(i).ok_or("missing value for --since")?.clone());
            }
            other => return Err(format!("unknown argument: {other}")),
        }
        i += 1;
    }

    Ok((output, since))
}

fn run() -> Result<(), String> {
    let (output_path, since_arg) = parse_args()?;
    let output = Path::new(&output_path);

    // Determine since cutoff: CLI arg takes precedence, then existing file
    let since = since_arg.or_else(|| {
        let latest = read_latest_created_at(output);
        if let Some(ref ts) = latest {
            eprintln!("Incremental sync: resuming from {ts}");
        }
        latest
    });

    let client = reqwest::blocking::Client::new();
    let items = paginate_all(&client, since.as_deref())?;
    eprintln!("Fetched {} feed items", items.len());

    // Convert
    let records: Vec<serde_json::Value> = items.iter().filter_map(convert_item).collect();
    eprintln!("Converted {} records", records.len());

    // Ensure parent directory exists
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create dir: {e}"))?;
    }

    // Write output (overwrite for full sync, but for incremental we prepend new items)
    if since.is_some() && output.exists() {
        // Read existing content, prepend new records
        let existing = fs::read_to_string(output).map_err(|e| format!("read existing: {e}"))?;
        let mut file =
            fs::File::create(output).map_err(|e| format!("create {}: {e}", output.display()))?;
        for record in &records {
            let line = serde_json::to_string(record).map_err(|e| format!("serialize: {e}"))?;
            writeln!(file, "{line}").map_err(|e| format!("write: {e}"))?;
        }
        file.write_all(existing.as_bytes())
            .map_err(|e| format!("write existing: {e}"))?;
    } else {
        let mut file =
            fs::File::create(output).map_err(|e| format!("create {}: {e}", output.display()))?;
        for record in &records {
            let line = serde_json::to_string(record).map_err(|e| format!("serialize: {e}"))?;
            writeln!(file, "{line}").map_err(|e| format!("write: {e}"))?;
        }
    }

    eprintln!("Wrote {} records to {}", records.len(), output.display());
    Ok(())
}

fn main() {
    if let Err(e) = run() {
        eprintln!("Error: {e}");
        std::process::exit(1);
    }
}

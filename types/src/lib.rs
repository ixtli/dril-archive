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

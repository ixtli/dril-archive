use serde::{Deserialize, Serialize};

fn default_platform() -> String {
    "x".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
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

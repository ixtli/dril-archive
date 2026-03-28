use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Post {
    pub id: String,
    pub text: String,
    pub created_at: String,
    pub is_reply: bool,
    pub reply_to_user: Option<String>,
    pub is_quote: bool,
    pub quoted_text: Option<String>,
    pub likes: u64,
    pub shares: u64,
}

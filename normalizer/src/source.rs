use crate::post::Post;
use dril_types::{MediaItem, Repost, User};

pub trait DataSource {
    fn posts(&self) -> Result<Vec<Post>, String>;
    fn reposts(&self) -> Result<Vec<Repost>, String>;
    fn media(&self) -> Result<Vec<MediaItem>, String>;
    fn users(&self) -> Result<Vec<User>, String>;
}

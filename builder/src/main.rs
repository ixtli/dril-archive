mod db;
mod post;

use std::fs::File;
use std::io::{self, BufReader};
use std::path::{Path, PathBuf};

fn read_ndjson_file<T: serde::de::DeserializeOwned>(path: &Path) -> Result<Vec<T>, String> {
    let file = File::open(path).map_err(|e| format!("open {}: {e}", path.display()))?;
    let reader = BufReader::new(file);
    post::parse_ndjson_generic(reader)
}

fn run_file_mode(input_path: &str, output_path: &Path) -> Result<(), String> {
    eprintln!("Reading posts from {input_path}...");
    let reader: Box<dyn io::BufRead> = if input_path == "-" {
        Box::new(BufReader::new(io::stdin()))
    } else {
        let file = File::open(input_path).map_err(|e| format!("open {input_path}: {e}"))?;
        Box::new(BufReader::new(file))
    };

    let posts = post::parse_ndjson(reader)?;
    eprintln!("Parsed {} posts", posts.len());

    if output_path.exists() {
        std::fs::remove_file(output_path).map_err(|e| format!("remove existing db: {e}"))?;
    }

    let conn = db::create_db(output_path)?;
    let count = db::insert_posts(&conn, &posts)?;
    db::finalize(&conn)?;

    eprintln!("Built {} with {count} posts", output_path.display());
    Ok(())
}

fn run_dir_mode(input_dir: &Path, output_path: &Path) -> Result<(), String> {
    eprintln!("Reading data from {}...", input_dir.display());

    let posts_path = input_dir.join("posts.ndjson");
    let reposts_path = input_dir.join("reposts.ndjson");
    let media_path = input_dir.join("media.ndjson");
    let users_path = input_dir.join("users.ndjson");

    let posts: Vec<post::Post> = read_ndjson_file(&posts_path)?;
    eprintln!("  {} posts", posts.len());

    let reposts: Vec<dril_types::Repost> = if reposts_path.exists() {
        read_ndjson_file(&reposts_path)?
    } else {
        Vec::new()
    };
    eprintln!("  {} reposts", reposts.len());

    let media: Vec<dril_types::MediaItem> = if media_path.exists() {
        read_ndjson_file(&media_path)?
    } else {
        Vec::new()
    };
    eprintln!("  {} media items", media.len());

    let users: Vec<dril_types::User> = if users_path.exists() {
        read_ndjson_file(&users_path)?
    } else {
        Vec::new()
    };
    eprintln!("  {} users", users.len());

    if output_path.exists() {
        std::fs::remove_file(output_path).map_err(|e| format!("remove existing db: {e}"))?;
    }

    let conn = db::create_db(output_path)?;

    let post_count = db::insert_posts(&conn, &posts)?;
    let repost_count = db::insert_reposts(&conn, &reposts)?;
    let media_count = db::insert_media(&conn, &media)?;
    let user_count = db::insert_users(&conn, &users)?;

    db::finalize(&conn)?;

    eprintln!(
        "Built {} with {post_count} posts, {repost_count} reposts, {media_count} media, {user_count} users",
        output_path.display()
    );
    Ok(())
}

fn run() -> Result<(), String> {
    let args: Vec<String> = std::env::args().collect();

    if args.len() < 2 || args.len() > 3 {
        return Err(format!(
            "Usage: {} <input.ndjson|input-dir/> [output.db]",
            args[0]
        ));
    }

    let input_path = &args[1];
    let output_path = if args.len() == 3 {
        PathBuf::from(&args[2])
    } else {
        PathBuf::from("dril.db")
    };

    let input = Path::new(input_path);
    if input.is_dir() {
        run_dir_mode(input, &output_path)
    } else {
        run_file_mode(input_path, &output_path)
    }
}

fn main() {
    if let Err(e) = run() {
        eprintln!("Error: {e}");
        std::process::exit(1);
    }
}

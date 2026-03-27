mod db;
mod tweet;

use std::fs::File;
use std::io::{self, BufReader};
use std::path::PathBuf;

fn run() -> Result<(), String> {
    let args: Vec<String> = std::env::args().collect();

    if args.len() < 2 || args.len() > 3 {
        return Err(format!("Usage: {} <input.ndjson> [output.db]", args[0]));
    }

    let input_path = &args[1];
    let output_path = if args.len() == 3 {
        PathBuf::from(&args[2])
    } else {
        PathBuf::from("dril.db")
    };

    eprintln!("Reading tweets from {input_path}...");
    let reader: Box<dyn io::BufRead> = if input_path == "-" {
        Box::new(BufReader::new(io::stdin()))
    } else {
        let file = File::open(input_path).map_err(|e| format!("open {input_path}: {e}"))?;
        Box::new(BufReader::new(file))
    };

    let tweets = tweet::parse_ndjson(reader)?;
    eprintln!("Parsed {} tweets", tweets.len());

    if output_path.exists() {
        std::fs::remove_file(&output_path).map_err(|e| format!("remove existing db: {e}"))?;
    }

    let conn = db::create_db(&output_path)?;
    let count = db::insert_tweets(&conn, &tweets)?;
    db::finalize(&conn)?;

    eprintln!("Built {} with {count} tweets", output_path.display());
    Ok(())
}

fn main() {
    if let Err(e) = run() {
        eprintln!("Error: {e}");
        std::process::exit(1);
    }
}

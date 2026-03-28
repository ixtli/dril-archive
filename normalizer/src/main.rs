mod codemasher;
mod post;
mod source;

use source::DataSource;
use std::fs;
use std::io::Write;
use std::path::Path;

fn write_ndjson<T: serde::Serialize>(items: &[T], path: &Path) -> Result<(), String> {
    let mut file = fs::File::create(path).map_err(|e| format!("create {}: {e}", path.display()))?;
    for item in items {
        let line = serde_json::to_string(item).map_err(|e| format!("serialize: {e}"))?;
        writeln!(file, "{line}").map_err(|e| format!("write {}: {e}", path.display()))?;
    }
    Ok(())
}

fn run() -> Result<(), String> {
    let args: Vec<String> = std::env::args().collect();

    let mut source_name = None;
    let mut input_path = None;
    let mut output_dir = None;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--source" => {
                i += 1;
                source_name = Some(args.get(i).ok_or("missing value for --source")?.clone());
            }
            "--input" => {
                i += 1;
                input_path = Some(args.get(i).ok_or("missing value for --input")?.clone());
            }
            "--output-dir" => {
                i += 1;
                output_dir = Some(args.get(i).ok_or("missing value for --output-dir")?.clone());
            }
            other => return Err(format!("unknown argument: {other}")),
        }
        i += 1;
    }

    let source_name = source_name.ok_or("missing --source")?;
    let input_path = input_path.ok_or("missing --input")?;
    let output_dir = output_dir.ok_or("missing --output-dir")?;

    let source: Box<dyn DataSource> = match source_name.as_str() {
        "codemasher" => Box::new(codemasher::CodmasherSource::load(&input_path)?),
        other => return Err(format!("unknown source: {other}")),
    };

    let output = Path::new(&output_dir);
    fs::create_dir_all(output).map_err(|e| format!("create output dir: {e}"))?;

    let posts = source.posts()?;
    eprintln!("{} posts", posts.len());
    write_ndjson(&posts, &output.join("posts.ndjson"))?;

    let reposts = source.reposts()?;
    eprintln!("{} reposts", reposts.len());
    write_ndjson(&reposts, &output.join("reposts.ndjson"))?;

    let media = source.media()?;
    eprintln!("{} media items", media.len());
    write_ndjson(&media, &output.join("media.ndjson"))?;

    let users = source.users()?;
    eprintln!("{} users", users.len());
    write_ndjson(&users, &output.join("users.ndjson"))?;

    eprintln!("Output written to {output_dir}");
    Ok(())
}

fn main() {
    if let Err(e) = run() {
        eprintln!("Error: {e}");
        std::process::exit(1);
    }
}

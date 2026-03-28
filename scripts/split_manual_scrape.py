#!/usr/bin/env python3
"""Split a mixed-type manual scrape JSONL file into our 4 NDJSON files.

Posts (no "type" field) go to posts.ndjson with media extracted to media.ndjson.
Reposts ("type": "repost") go to reposts.ndjson.
Users are synthesized from the data.

Usage:
    python3 scripts/split_manual_scrape.py data/scraped.jsonl data/
"""

import json
import sys
from pathlib import Path


def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <input.jsonl> <output-dir>", file=sys.stderr)
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)

    posts = []
    reposts = []
    media_items = []
    users = set()

    with open(input_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)

            if record.get("type") == "repost":
                # Map original_user to original_user_id (screen name as ID for manual scrapes)
                repost = {
                    "id": record.get("id"),
                    "platform": record.get("platform", "x"),
                    "created_at": record.get("created_at"),
                    "original_post_id": record["original_post_id"],
                    "original_user_id": record.get("original_user"),
                    "original_text": record.get("original_text", ""),
                    "original_created_at": record.get("original_created_at"),
                    "likes": record.get("likes", 0),
                    "shares": record.get("shares", 0),
                }
                reposts.append(repost)
                if record.get("original_user"):
                    users.add(record["original_user"])
            else:
                # Extract media from the post
                post_media = record.pop("media", [])
                post = {
                    "id": record["id"],
                    "platform": record.get("platform", "x"),
                    "text": record["text"],
                    "created_at": record.get("created_at", ""),
                    "is_reply": record.get("is_reply", False),
                    "reply_to_user": record.get("reply_to_user"),
                    "is_quote": record.get("is_quote", False),
                    "quoted_text": record.get("quoted_text"),
                    "likes": record.get("likes", 0),
                    "shares": record.get("shares", 0),
                }
                posts.append(post)

                for m in post_media:
                    if not m.get("url"):
                        continue
                    media_items.append({
                        "post_id": record["id"],
                        "type": m.get("type", "photo"),
                        "url": m["url"],
                        "width": m.get("width"),
                        "height": m.get("height"),
                        "alt_text": m.get("alt_text"),
                    })

                if record.get("reply_to_user"):
                    users.add(record["reply_to_user"])

    # Write outputs — append to existing files if they exist
    def write_ndjson(items, filename):
        path = output_dir / filename
        mode = "a" if path.exists() else "w"
        with open(path, mode) as f:
            for item in items:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
        return len(items)

    post_count = write_ndjson(posts, "posts.ndjson")
    repost_count = write_ndjson(reposts, "reposts.ndjson")
    media_count = write_ndjson(media_items, "media.ndjson")

    # Synthesize user records
    user_records = [
        {"id": name, "platform": "x", "screen_name": name, "name": None}
        for name in users
    ]
    user_count = write_ndjson(user_records, "users.ndjson")

    print(f"{post_count} posts", file=sys.stderr)
    print(f"{repost_count} reposts", file=sys.stderr)
    print(f"{media_count} media items", file=sys.stderr)
    print(f"{user_count} users", file=sys.stderr)


if __name__ == "__main__":
    main()

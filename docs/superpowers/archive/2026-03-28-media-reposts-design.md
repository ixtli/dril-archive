# Media & Repost Rendering Design

## Summary

Connect the existing media and reposts database tables to the frontend so that:
- Posts with attached images show a click-to-load placeholder
- Reposts (retweets by dril) appear as searchable results with a "dril retweeted" banner
- A toggle in Controls lets users include/exclude reposts from search

## Current State

The backend pipeline is complete: the builder reads `media.ndjson` and `reposts.ndjson` and populates `media` and `reposts` tables in SQLite. The frontend ignores both tables entirely — queries only touch `posts` and `posts_fts`.

## Data Layer

### SQL: Media

Add a correlated subselect to the existing posts query to fetch media as a JSON array:

```sql
(SELECT json_group_array(json_object(
  'type', m.type, 'url', m.url,
  'width', m.width, 'height', m.height,
  'alt_text', m.alt_text
)) FROM media m WHERE m.post_id = t.id) AS media_json
```

This avoids row multiplication — each post still returns one row. Parse `media_json` in JS after fetch (empty array when no media).

### SQL: Reposts

Reposts are a separate table with different columns. Include them via UNION when the toggle is on:

```sql
-- Posts arm (existing, plus media subselect)
SELECT t.id, t.text, t.created_at, t.is_reply, t.reply_to_user,
       t.is_quote, t.quoted_text, t.likes, t.shares, t.platform,
       0 AS is_repost, NULL AS original_user_id,
       (SELECT json_group_array(...) FROM media m WHERE m.post_id = t.id) AS media_json
FROM posts_fts f
JOIN posts t ON t.rowid = f.rowid
WHERE posts_fts MATCH ?

UNION ALL

-- Reposts arm (only when toggle is on)
SELECT r.id, r.original_text AS text, COALESCE(r.original_created_at, r.created_at) AS created_at,
       0 AS is_reply, NULL AS reply_to_user,
       0 AS is_quote, NULL AS quoted_text,
       r.likes, r.shares, r.platform,
       1 AS is_repost, r.original_user_id,
       '[]' AS media_json
FROM reposts r
WHERE r.original_text LIKE ?

ORDER BY ... LIMIT 50
```

Note: reposts don't have FTS5 indexing, so use LIKE for text search. If performance is an issue, we can add an FTS table for reposts later. Media on reposts is out of scope (reposts don't have media attachments in our data).

When the toggle is off, omit the UNION arm entirely.

### Browse mode (no search query)

The same UNION pattern applies to the browse/chronological query. When no search term is present, the reposts arm drops the WHERE clause and just returns all reposts (or none, based on toggle).

## Types

### `types.ts`

```typescript
export interface MediaItem {
  type: string;
  url: string;
  width: number | null;
  height: number | null;
  alt_text: string | null;
}

export interface Post {
  // ... existing fields ...
  media: MediaItem[];
  is_repost: boolean;
  original_user_id: string | null;
}
```

### Result parsing

In the search/query function, parse `media_json` from string to `MediaItem[]` and attach to the Post object. Handle `"[null]"` (SQLite's json_group_array with no matches) as empty array.

## Controls

Add a checkbox to the existing Controls component:

- Label: "Include retweets"
- Default: checked (on)
- Wired as a reactive prop/binding that the search function reads
- Toggling triggers a re-search with current query

This follows the pattern of any existing filter controls in the Controls component.

## Template Rendering

### Repost banner

When `post.is_repost` is true, render a banner above the card content:

```
  [repost icon] @dril retweeted
```

- Small, muted text, indented slightly from the left edge
- Uses a simple repost/retweet icon (Unicode arrow or SVG)
- Era-appropriate color (match the muted/secondary text color of each template)
- The post text shown is the original author's text
- Handle: show original_user_id if available, otherwise just "@dril retweeted"

Applied to all 6 templates with per-era styling.

### Media placeholder

When `post.media.length > 0`, render a block below the post text:

**Default state (not loaded):**
- Light gray box with rounded corners
- Camera/image icon + "N image(s) — click to load"
- Muted, unobtrusive styling

**Loading state:**
- Same box with a simple spinner or "Loading..." text

**Loaded state:**
- Actual `<img>` tag(s) with the original URL
- Constrained to card width, maintain aspect ratio using width/height from data
- If `alt_text` is present, set it on the img tag

**Error state:**
- "Image unavailable" message in the same box

This can be a shared Svelte component (`MediaPlaceholder.svelte`) used by all templates, since the loading behavior is the same regardless of era. Style the container to blend with each era's card via CSS custom properties or simple neutral styling.

## Files to Create/Modify

| File | Change |
|------|--------|
| `site/src/lib/types.ts` | Add `MediaItem` interface, extend `Post` |
| `site/src/lib/search.ts` | Add media subselect, repost UNION, toggle param |
| `site/src/components/Controls.svelte` | Add "Include retweets" checkbox |
| `site/src/components/MediaPlaceholder.svelte` | New: click-to-load media component |
| `site/src/templates/TwitterClassic.svelte` | Add repost banner + media placeholder |
| `site/src/templates/TwitterNew.svelte` | Add repost banner + media placeholder |
| `site/src/templates/TwitterMaterial.svelte` | Add repost banner + media placeholder |
| `site/src/templates/TwitterModern.svelte` | Add repost banner + media placeholder |
| `site/src/templates/Bluesky.svelte` | Add repost banner + media placeholder |
| `site/src/templates/Threads.svelte` | Add repost banner + media placeholder |
| `site/src/App.svelte` | Wire toggle state between Controls and search |

## Testing

- E2E tests using the `testdata/dir-test/` fixtures which include 1 repost and 1 media item
- Test that repost toggle on/off changes result count
- Test that media placeholder appears and click-to-load works
- Test that repost banner displays correctly

## Out of scope

- FTS5 indexing for reposts (LIKE search is fine for ~hundreds of reposts)
- Media on reposts (our data doesn't have this)
- Video playback (media type "video" gets same placeholder treatment as photos)
- Profile pictures / avatars (separate future work)

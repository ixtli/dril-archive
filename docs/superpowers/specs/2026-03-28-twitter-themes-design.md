# Twitter Era Themes & Profile Archive Design Spec

## Overview

Present dril's tweets styled as they appeared when originally posted by faithfully reproducing the DOM structure and CSS of each Twitter design era. Archive dril's profile metadata (display name, avatar, bio) over time via Wayback Machine snapshots. Theme selection defaults to era-correct based on post timestamp; user can override.

## Goals

- Faithfully archive the actual DOM structure and computed CSS from each Twitter era as data
- Render each post in a period-accurate card that reproduces the original tweet presentation
- Archive dril's profile snapshots (display name, avatar image, bio) at multiple points in time
- Let users choose a theme override; default to era-correct for each post's `created_at`

## Non-Goals

- Pixel-perfect rendering across all browsers (we archive the data; how a modern browser renders it is out of scope)
- Reproducing the full Twitter page layout (only the individual tweet/post card)
- The X-era rebrand (dril was suspended before this solidified)
- Interactive elements (like/retweet buttons are display-only)

## Themes

### Theme IDs and Platform Scoping

Theme IDs are prefixed by platform to avoid ambiguity, since the archive includes posts from Twitter/X, Bluesky, and Threads. The four Twitter eras are the initial themes; Bluesky and Threads themes can be added later using the same infrastructure.

| Theme | ID | Platform | Date Range | Key Visual Traits |
|-------|-----|----------|------------|-------------------|
| Twitter Classic | `twitter-classic` | x | 2008-06 – 2010-09 | Light blue (#c0deed) page background, white card, 12px Lucida Grande/Arial, 73×73 square avatar with 4px border-radius, gray (#999) metadata, #0084B4 links |
| Twitter New | `twitter-new` | x | 2010-09 – 2014-06 | White/light gray (#f5f8fa) background, stream cards with bottom border, 14px Helvetica Neue, 48×48 rounded-square avatar, #292f33 text, #66757f metadata, #1da1f2-precursor links, inline engagement counts |
| Twitter Material | `twitter-material` | x | 2014-06 – 2019-07 | Clean white cards, 15px Helvetica Neue/Arial, 48×48 circular avatar, #14171a text, #657786 metadata, #1da1f2 links, thin #e1e8ed borders, heart icon replaces star (Nov 2015) |
| Twitter Modern | `twitter-modern` | x | 2019-07 – 2023-07 | Chirp font (falls back to -apple-system/Segoe UI), 15px, rounded 16px card borders, 40×48 circular avatar, #0f1419 text, #536471 metadata, #1d9bf0 links, more whitespace |

Future themes (not in scope for this work):

| Theme | ID | Platform | Notes |
|-------|-----|----------|-------|
| Bluesky | `bsky-default` | bsky | Current Bluesky design |
| Threads | `threads-default` | threads | Current Threads design |

### Auto-Theme Resolution

Each post has a `platform` and a `created_at`. The auto-theme logic picks the era-correct theme for that platform:

```js
function getAutoTheme(platform, createdAt) {
  if (platform === "bsky") return "bsky-default";     // future
  if (platform === "threads") return "threads-default"; // future
  // platform === "x"
  const d = new Date(createdAt);
  if (d < new Date("2010-09-01")) return "twitter-classic";
  if (d < new Date("2014-06-01")) return "twitter-new";
  if (d < new Date("2019-07-15")) return "twitter-material";
  return "twitter-modern";
}
```

### Cross-Platform Theme Application

Users can apply **any** theme to **any** post — e.g., view a Bluesky post styled as Twitter Classic, or a 2009 tweet styled as Twitter Modern. The theme selector makes all themes available regardless of the current post's platform. The "Auto" option uses era-correct matching per platform.

## Wayback Machine Extraction

### CDX API for Snapshot Discovery

Use the Wayback Machine CDX API to find available snapshots:

```
# Find tweet page snapshots (for DOM/CSS extraction)
https://web.archive.org/cdx/search/cdx?url=twitter.com/dril/status/*&output=json&fl=timestamp,original,statuscode&collapse=timestamp:4&filter=statuscode:200

# Find profile page snapshots (for profile metadata)
https://web.archive.org/cdx/search/cdx?url=twitter.com/dril&output=json&fl=timestamp,original,statuscode&filter=statuscode:200&collapse=timestamp:6
```

### Target Snapshots — Intentional Sampling from the Archive

Rather than picking random tweets, we use the existing archive data (posts, reposts, media tables) to identify specific post IDs that cover every distinct rendering mode Twitter used. Each era needs samples of every content type:

| Content Type | Source Table | Selection Criteria |
|-------------|-------------|-------------------|
| Plain text tweet | `posts` | `is_reply = 0 AND is_quote = 0`, no media row |
| Reply | `posts` | `is_reply = 1` |
| Quote tweet | `posts` | `is_quote = 1` |
| Tweet with photo | `posts` + `media` | `media.type = 'photo'` |
| Tweet with video | `posts` + `media` | `media.type = 'video'` |
| Retweet | `reposts` | Any repost row |

**Sampling script** (`theme-extractor/src/select-samples.ts`):

1. Build or load the SQLite database
2. For each era (by `created_at` date range), query for candidate post IDs of each content type
3. For each candidate, check the CDX API to see if the Wayback Machine has a snapshot of `twitter.com/dril/status/{id}`
4. Pick the first available hit per content type per era
5. Output `theme-extractor/data/sample-manifest.json`:

```json
{
  "twitter-classic": {
    "plain": { "post_id": "12345", "wayback_timestamp": "20090815123456", "created_at": "2009-08-15T..." },
    "reply": { "post_id": "12346", "wayback_timestamp": "20091201...", "created_at": "..." },
    "quote": null,
    "photo": { "post_id": "12350", "wayback_timestamp": "...", "created_at": "..." },
    "video": null,
    "retweet": { "post_id": "12360", "wayback_timestamp": "...", "created_at": "..." }
  },
  "twitter-new": { "...": "..." },
  "twitter-material": { "...": "..." },
  "twitter-modern": { "...": "..." }
}
```

Some combinations will legitimately not exist (quote tweets didn't exist in the Classic era, video embeds came later). `null` entries are expected and documented.

This gives us ~16-24 targeted page loads (4 eras × 4-6 content types) instead of random sampling, and guarantees we capture the DOM/CSS for every rendering variant.

### Extraction Tool (`theme-extractor/`)

A self-contained subdirectory with its own `package.json` and Playwright dependency. The tooling is split into a **reusable Wayback Machine core library** and **task-specific scripts** that consume it.

The core library is designed to be reused beyond theme extraction — in particular, for backfilling post content from the Wayback Machine during periods where the archive has gaps (e.g., 2023-01-01 to 2024-06-01, when Twitter/X's API became unreliable and the Internet Archive's coverage is spotty).

```
theme-extractor/
  package.json                # Playwright, better-sqlite3, tsx
  tsconfig.json
  src/
    lib/                      # Reusable Wayback Machine core
      cdx.ts                  # CDX API client (query, paginate, rate-limit)
      wayback-page.ts         # Playwright page loader (navigate, wait, retry)
      rate-limiter.ts         # Configurable delay + backoff
      progress.ts             # Resumable progress tracker (JSON state file)
      tweet-selectors.ts      # Era-aware DOM selectors for tweet containers
      types.ts                # Shared types (WaybackSnapshot, CdxResult, etc.)
    tasks/
      select-samples.ts       # Query archive DB for theme sample candidates
      discover-samples.ts     # Check CDX availability for sample candidates
      extract-themes.ts       # DOM/CSS extraction from tweet pages
      extract-profiles.ts     # Profile metadata + avatar extraction
      build-themes.ts         # Generate CSS from extracted data
      backfill-posts.ts       # Crawl Wayback for missing posts (gap-fill)
  data/                       # All extraction output (gitignored)
    wayback/                  # Raw DOM/CSS/screenshots per era
    profile/                  # Profile snapshots + avatars
    backfill/                 # Recovered posts from gap-fill crawls
  output/                     # Generated artifacts (checked in)
    themes/
      twitter-classic.css
      twitter-new.css
      twitter-material.css
      twitter-modern.css
    avatars/                  # Downloaded profile images (checked in)
    profile-snapshots.ndjson  # Curated profile data for the builder
```

### Core Library (`src/lib/`)

**`cdx.ts`** — Wayback Machine CDX API client:
- `querySnapshots(url, options)` — query CDX API with filters, collapse, pagination
- `findBestSnapshot(url, targetDate)` — find the snapshot closest to a target date
- `checkAvailability(url)` — quick existence check
- Built-in response caching to `data/.cdx-cache/` so repeated runs don't re-query
- Uses the shared rate limiter

**`wayback-page.ts`** — Playwright page loader for Wayback Machine pages:
- `loadPage(waybackUrl, options)` — navigate with configurable timeout and retry
- Handles Wayback Machine toolbar injection (removes `#wm-ipp-base` overlay)
- Handles common failure modes: 404 within Wayback frame, redirect loops, empty captures
- Returns a Playwright `Page` object for callers to extract whatever they need
- Uses the shared rate limiter between page loads

**`rate-limiter.ts`** — configurable rate limiting:
- Constructor takes `minDelayMs` (default 10000) and `maxDelayMs` for jitter
- `wait()` — sleep for the configured delay with random jitter
- `backoff()` — exponential backoff on failure (2x, capped at `maxDelayMs`)
- Shared instance across CDX queries and page loads

**`progress.ts`** — resumable progress tracker:
- Reads/writes a JSON state file (e.g., `data/backfill/progress.json`)
- Tracks which items have been processed, which failed, which are pending
- Allows long-running crawls to be interrupted and resumed
- `isProcessed(key)`, `markProcessed(key, result)`, `markFailed(key, error)`

**`tweet-selectors.ts`** — era-aware DOM selectors:
- `getTweetContainerSelector(era)` — returns the right CSS selector for the tweet container
- `getTweetTextSelector(era)` — returns selector for tweet text content
- `getMetadataSelectors(era)` — returns selectors for timestamp, likes, shares, etc.
- `getProfileSelectors(era)` — returns selectors for name, bio, avatar on profile pages
- Fallback chains: try primary selector, then alternatives

**`types.ts`** — shared TypeScript types:
- `CdxResult`, `WaybackSnapshot`, `Era`, `ContentType`
- `ProgressState`, `ExtractedPost`, `ExtractedStyles`

### Task Scripts

Each task script in `src/tasks/` is a standalone CLI entry point that composes the core library. They are invoked manually and are never run in CI.

**Rate limiting across all tasks:** 10-second minimum delay between Wayback page loads. 5-second delay between CDX API calls. Polite User-Agent. Manual invocation only.

### Extracted Data Format

Each snapshot produces a raw archive file, organized by era and content type:

```
theme-extractor/data/wayback/
  {theme}/                # twitter-classic, twitter-new, etc.
    {content_type}/       # plain, reply, quote, photo, video, retweet
      dom.html            # innerHTML of the tweet container
      styles.json         # computed styles per element selector
      screenshot.png      # visual reference
      metadata.json       # wayback URL, timestamp, post ID, content type
```

The raw DOM and computed styles are the archival artifact. Theme CSS files derived from this data are a separate build step.

### Theme CSS Generation

A build script (`theme-extractor/src/build-themes.ts`) reads the extracted data and produces theme CSS files in `theme-extractor/output/themes/`. These are checked into the repo and copied to `site/themes/` during the site build step.

Each CSS file styles the standardized post DOM structure (see below) to match the era.

## Post DOM Structure

The frontend renders each post with a richer DOM than today:

```html
<article class="post" data-platform="x" data-theme="twitter-material">
  <div class="post-avatar">
    <img src="..." alt="@dril" />
  </div>
  <div class="post-body">
    <div class="post-header">
      <span class="post-display-name">wint</span>
      <span class="post-handle">@dril</span>
      <span class="post-separator">·</span>
      <time class="post-timestamp" datetime="2014-03-12T15:30:00Z">Mar 12, 2014</time>
    </div>
    <div class="post-text">the wise man bowed his head solemnly and spoke: "theres actually zero difference between good &amp; bad things. you imbecile. you fucking moron"</div>
    <div class="post-quoted"> <!-- if is_quote -->
      <div class="post-quoted-text">...</div>
    </div>
    <div class="post-reply-context"> <!-- if is_reply -->
      Replying to <span class="post-reply-to">@someone</span>
    </div>
    <div class="post-engagement">
      <span class="post-likes">♡ 42K</span>
      <span class="post-shares">⟲ 12K</span>
    </div>
    <div class="post-link">
      <a href="https://x.com/dril/status/...">View original</a>
    </div>
  </div>
</article>
```

- `data-platform` is the post's source platform (`x`, `bsky`, `threads`)
- `data-theme` reflects the user's current selection, or the auto-resolved theme from `getAutoTheme(platform, created_at)`
- Theme CSS targets `.post[data-theme="twitter-classic"]`, `.post[data-theme="twitter-material"]`, etc.
- Light backgrounds are self-contained within the `.post` card; the page stays dark
- Any theme can be applied to any platform's posts — the DOM structure is platform-neutral

## Profile Snapshots

### Extraction

The profile extraction script (`theme-extractor/src/extract-profiles.ts`) uses Playwright to:

1. Load Wayback Machine snapshots of `twitter.com/dril`
2. Extract: display name, bio/description, avatar image URL
3. Download the avatar image to `theme-extractor/data/profile/avatars/`
4. Output `theme-extractor/data/profile/snapshots.ndjson`

### Data Format

**`theme-extractor/data/profile/snapshots.ndjson`** — one line per snapshot:
```json
{"captured_at":"2014-06-15T00:00:00Z","display_name":"wint","description":"TORTURE ME WITH PAIN","avatar_filename":"2014-06-15.jpg","avatar_url":"https://pbs.twimg.com/...","source_url":"https://web.archive.org/web/20140615/https://twitter.com/dril"}
```

**`theme-extractor/data/profile/avatars/`** — downloaded images (copied to `theme-extractor/output/avatars/` for checked-in distribution):
```
2009-03-20.jpg
2011-08-14.jpg
2014-06-15.jpg
2018-01-22.jpg
2021-05-10.jpg
```

### Database Schema

New table:

```sql
CREATE TABLE profile_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'x',
    captured_at TEXT NOT NULL,
    display_name TEXT,
    description TEXT,
    avatar_path TEXT
);
```

The builder reads `theme-extractor/data/profile/snapshots.ndjson` and inserts rows. Avatar images from `theme-extractor/output/avatars/` are copied to `site/avatars/` during the site build step.

### Frontend Profile Resolution

For each post, the frontend finds the closest-in-time profile snapshot:

```sql
SELECT display_name, avatar_path FROM profile_snapshots
WHERE user_id = '16298441' AND captured_at <= ?
ORDER BY captured_at DESC LIMIT 1
```

Where `?` is the post's `created_at`. This gives the profile as it appeared when the tweet was posted.

## Theme Selection UX

### Controls

A theme selector in the page header:

```html
<div class="theme-selector">
  <label>Theme:</label>
  <select id="theme-select">
    <option value="auto" selected>Auto (era-accurate)</option>
    <optgroup label="Twitter">
      <option value="twitter-classic">Twitter Classic (2008–2010)</option>
      <option value="twitter-new">Twitter New (2010–2014)</option>
      <option value="twitter-material">Twitter Material (2014–2019)</option>
      <option value="twitter-modern">Twitter Modern (2019–2023)</option>
    </optgroup>
    <!-- future: Bluesky, Threads optgroups -->
  </select>
</div>
```

### Behavior

- **Auto mode (default):** Each post's `data-theme` is set by `getAutoTheme(platform, created_at)` — era-correct per platform
- **Manual override:** All posts use the selected theme regardless of platform or date
- Selection persists in `localStorage`

## Post Backfill from Wayback Machine

### Problem

The archive has a significant gap from approximately 2023-01-01 to 2024-06-01. During this period, Twitter's API became unreliable/expensive, and automated archiving tools lost access. The Wayback Machine captured some (not all) of these tweets. We can recover post content from those snapshots.

### Approach

The backfill task (`src/tasks/backfill-posts.ts`) reuses the same core library as theme extraction:

1. **Discover available snapshots** — use `cdx.ts` to query for all Wayback captures of `twitter.com/dril/status/*` in the target date range
2. **Filter to unique post IDs** — the CDX API returns the original URL, from which we extract the post ID. Collapse duplicates, keeping the best (most recent) capture per post
3. **Cross-reference with existing archive** — skip any post ID already in the database
4. **Extract post content** — for each missing post, use `wayback-page.ts` to load it, then extract:
   - Tweet text
   - Timestamp (`datetime` attribute or parsed from display)
   - Whether it's a reply (and to whom)
   - Whether it's a quote tweet (and the quoted text)
   - Media URLs and types
   - Engagement counts (likes, retweets) — as of the snapshot date
5. **Output NDJSON** — write recovered posts to `data/backfill/recovered-posts.ndjson` in the same format the normalizer outputs, so the builder can ingest them directly

### Scale and Rate Limiting

The 2023-01-01 to 2024-06-01 window is ~18 months. dril posted roughly 2-5 times per day, so ~1000-2700 posts. The Wayback Machine won't have all of them, but may have captured hundreds.

- CDX discovery: single API call with date range filter, fast
- Page loads: potentially hundreds, at 10-second intervals = ~30-60 minutes per batch of ~200
- The progress tracker (`progress.ts`) makes this safe to run in multiple sessions over days/weeks
- Run in batches: process 50-100 posts per session, resume later

### Output Integration

The recovered NDJSON files slot into the existing data pipeline:

```
theme-extractor/data/backfill/recovered-posts.ndjson
  → copy to data/backfill/ (or reference directly)
  → dril-builder ingests alongside other NDJSON sources
```

The builder already supports directory input with multiple NDJSON files, so backfilled posts merge naturally. The builder's deduplication (by post ID) prevents double-counting if some posts are already in the archive.

## Implementation Phases

### Phase 1: Wayback Extraction Tooling
- `theme-extractor/` subdirectory with its own `package.json`
- `src/lib/` — reusable Wayback Machine core (CDX client, page loader, rate limiter, progress tracker, selectors)
- `src/tasks/select-samples.ts` — query archive DB for theme sample candidates
- `src/tasks/discover-samples.ts` — check CDX availability for candidates
- `src/tasks/extract-themes.ts` — Playwright DOM/CSS extraction
- `src/tasks/extract-profiles.ts` — Playwright profile metadata extraction
- Raw data lands in `theme-extractor/data/` (gitignored)
- Manual invocation, all results cached, resumable

### Phase 2: Theme CSS + Profile Pipeline
- `src/tasks/build-themes.ts` — generate `theme-extractor/output/themes/*.css` from extracted data
- Extend builder to read `data/profile/snapshots.ndjson` and populate `profile_snapshots` table
- Copy avatar images to `site/avatars/` during build

### Phase 3: Frontend Integration
- Richer post DOM structure with avatar, display name, engagement stats
- Theme CSS loaded and applied per-post based on `data-era`/`data-theme`
- Theme selector UI with auto/manual modes
- Profile snapshot resolution for display name and avatar per post

### Phase 4: Post Backfill (2023–2024 Gap)
- `src/tasks/backfill-posts.ts` — crawl Wayback for missing posts in the gap period
- Uses same core library: CDX discovery, page loading, rate limiting, progress tracking
- Outputs NDJSON compatible with the existing builder pipeline
- Designed for incremental runs over days/weeks

### Phase 5: Refinement
- Hand-tune theme CSS against screenshots for fidelity
- Fill gaps where Wayback snapshots are incomplete
- Responsive behavior for themed cards

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

## Twitter Eras

| Era | ID | Date Range | Key Visual Traits |
|-----|----|------------|-------------------|
| Classic | `classic` | 2008-06 – 2010-09 | Light blue (#c0deed) page background, white card, 12px Lucida Grande/Arial, 73×73 square avatar with 4px border-radius, gray (#999) metadata, #0084B4 links |
| New Twitter | `new` | 2010-09 – 2014-06 | White/light gray (#f5f8fa) background, stream cards with bottom border, 14px Helvetica Neue, 48×48 rounded-square avatar, #292f33 text, #66757f metadata, #1da1f2-precursor links, inline engagement counts |
| Material | `material` | 2014-06 – 2019-07 | Clean white cards, 15px Helvetica Neue/Arial, 48×48 circular avatar, #14171a text, #657786 metadata, #1da1f2 links, thin #e1e8ed borders, heart icon replaces star (Nov 2015) |
| Modern | `modern` | 2019-07 – 2023-07 | Chirp font (falls back to -apple-system/Segoe UI), 15px, rounded 16px card borders, 40×48 circular avatar, #0f1419 text, #536471 metadata, #1d9bf0 links, more whitespace |

## Wayback Machine Extraction

### CDX API for Snapshot Discovery

Use the Wayback Machine CDX API to find available snapshots:

```
# Find tweet page snapshots (for DOM/CSS extraction)
https://web.archive.org/cdx/search/cdx?url=twitter.com/dril/status/*&output=json&fl=timestamp,original,statuscode&collapse=timestamp:4&filter=statuscode:200

# Find profile page snapshots (for profile metadata)
https://web.archive.org/cdx/search/cdx?url=twitter.com/dril&output=json&fl=timestamp,original,statuscode&filter=statuscode:200&collapse=timestamp:6
```

### Target Snapshots

Select 2-3 snapshots per era from the CDX results, targeting:
- One early in the era (shortly after redesign)
- One late in the era (mature version before next redesign)

~8-12 total page loads. Cache everything locally.

### Extraction Tool (`theme-extractor/`)

A self-contained subdirectory with its own `package.json` and Playwright dependency. All extraction scripts, output data, and generated theme CSS live here.

```
theme-extractor/
  package.json              # Playwright + ts dependencies
  src/
    cdx-discover.ts         # CDX API snapshot discovery
    extract-themes.ts       # DOM/CSS extraction from tweet pages
    extract-profiles.ts     # Profile metadata + avatar extraction
    build-themes.ts         # Generate CSS from extracted data
  data/                     # Extraction output (gitignored)
    wayback/                # Raw DOM/CSS/screenshots per era
    profile/                # Profile snapshots + avatars
  output/                   # Generated theme CSS (checked in)
    themes/
      classic.css
      new.css
      material.css
      modern.css
    avatars/                # Downloaded profile images (checked in)
```

Uses Playwright to:

1. Load each Wayback Machine URL in headless Chromium
2. Wait for the tweet container to render
3. Extract the tweet card's DOM structure (tag names, class names, nesting)
4. Call `getComputedStyle()` on each significant element
5. Download any relevant assets (avatar images, icon sprites)
6. Write raw results to `theme-extractor/data/wayback/`

**Rate limiting:** 10-second delay between requests. Polite User-Agent. Manual invocation only, never in CI.

### Extracted Data Format

Each snapshot produces a raw archive file:

```
theme-extractor/data/wayback/
  {era}/
    {timestamp}/
      dom.html          # innerHTML of the tweet container
      styles.json       # computed styles per element selector
      screenshot.png    # visual reference
      metadata.json     # wayback URL, timestamp, extraction date
```

The raw DOM and computed styles are the archival artifact. Theme CSS files derived from this data are a separate build step.

### Theme CSS Generation

A build script (`theme-extractor/src/build-themes.ts`) reads the extracted data and produces theme CSS files in `theme-extractor/output/themes/`. These are checked into the repo and copied to `site/themes/` during the site build step.

Each CSS file styles the standardized post DOM structure (see below) to match the era.

## Post DOM Structure

The frontend renders each post with a richer DOM than today:

```html
<article class="post" data-era="material" data-theme="material">
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

- `data-era` is computed from `created_at` and is the default theme
- `data-theme` reflects the user's current selection (or matches `data-era` if auto)
- Theme CSS targets `.post[data-theme="classic"]`, `.post[data-theme="material"]`, etc.
- Light backgrounds are self-contained within the `.post` card; the page stays dark

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
    <option value="auto" selected>Era-accurate (auto)</option>
    <option value="classic">Classic (2008–2010)</option>
    <option value="new">New Twitter (2010–2014)</option>
    <option value="material">Material (2014–2019)</option>
    <option value="modern">Modern (2019–2023)</option>
  </select>
</div>
```

### Behavior

- **Auto mode (default):** Each post's `data-theme` matches its `data-era`, computed from `created_at`
- **Manual override:** All posts use the selected theme regardless of date
- Selection persists in `localStorage`

### Era Resolution

```js
function getEra(createdAt) {
  const d = new Date(createdAt);
  if (d < new Date("2010-09-01")) return "classic";
  if (d < new Date("2014-06-01")) return "new";
  if (d < new Date("2019-07-15")) return "material";
  return "modern";
}
```

## Implementation Phases

### Phase 1: Wayback Extraction Tooling
- `theme-extractor/` subdirectory with its own `package.json`
- `src/cdx-discover.ts` — snapshot discovery via CDX API
- `src/extract-themes.ts` — Playwright DOM/CSS extraction
- `src/extract-profiles.ts` — Playwright profile metadata extraction
- Raw data lands in `theme-extractor/data/` (gitignored)
- Manual invocation, results cached

### Phase 2: Theme CSS + Profile Pipeline
- `src/build-themes.ts` — generate `theme-extractor/output/themes/*.css` from extracted data
- Extend builder to read `data/profile/snapshots.ndjson` and populate `profile_snapshots` table
- Copy avatar images to `site/avatars/` during build

### Phase 3: Frontend Integration
- Richer post DOM structure with avatar, display name, engagement stats
- Theme CSS loaded and applied per-post based on `data-era`/`data-theme`
- Theme selector UI with auto/manual modes
- Profile snapshot resolution for display name and avatar per post

### Phase 4: Refinement
- Hand-tune theme CSS against screenshots for fidelity
- Fill gaps where Wayback snapshots are incomplete
- Responsive behavior for themed cards

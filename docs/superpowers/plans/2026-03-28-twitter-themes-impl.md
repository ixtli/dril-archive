# Twitter Era Themes & Profile Archive — Implementation Plan

Implements the design in `specs/2026-03-28-twitter-themes-design.md`.

## Phase 1: Wayback Extraction Tooling

All extraction tooling lives in the `theme-extractor/` subdirectory at the repo root.

### 1.0 Scaffold `theme-extractor/`

Create the subdirectory with its own `package.json`:

```
theme-extractor/
  package.json              # playwright, better-sqlite3, tsx
  tsconfig.json
  src/
    lib/                    # Reusable Wayback Machine core
      cdx.ts                # CDX API client
      wayback-page.ts       # Playwright page loader
      rate-limiter.ts       # Configurable delay + backoff
      progress.ts           # Resumable progress tracker
      tweet-selectors.ts    # Era-aware DOM selectors
      types.ts              # Shared types
    tasks/                  # Task-specific entry points
      select-samples.ts
      discover-samples.ts
      extract-themes.ts
      extract-profiles.ts
      build-themes.ts
      backfill-posts.ts
  data/                     # gitignored — raw extraction output
  output/                   # checked in — generated themes + avatars
    themes/
    avatars/
```

`package.json` scripts:
```json
{
  "scripts": {
    "select": "tsx src/tasks/select-samples.ts",
    "discover": "tsx src/tasks/discover-samples.ts",
    "extract:themes": "tsx src/tasks/extract-themes.ts",
    "extract:profiles": "tsx src/tasks/extract-profiles.ts",
    "build:themes": "tsx src/tasks/build-themes.ts",
    "backfill": "tsx src/tasks/backfill-posts.ts"
  }
}
```

Add `theme-extractor/data/` to the repo root `.gitignore`.

### 1.1 Core Library

**Directory:** `theme-extractor/src/lib/`

Implement the reusable Wayback Machine interaction layer. This is the foundation for both theme extraction and the post backfill task.

**`types.ts`** — shared types:
```ts
type Platform = "x" | "bsky" | "threads";
type TwitterEra = "twitter-classic" | "twitter-new" | "twitter-material" | "twitter-modern";
type ThemeId = TwitterEra | "bsky-default" | "threads-default";  // extensible
type ContentType = "plain" | "reply" | "quote" | "photo" | "video" | "retweet";

interface CdxResult {
  timestamp: string;       // "20140315123456"
  originalUrl: string;     // "twitter.com/dril/status/12345"
  statusCode: number;
  mimeType?: string;
}

interface WaybackSnapshot {
  waybackTimestamp: string;
  waybackUrl: string;      // full web.archive.org URL
  originalUrl: string;
  postId?: string;         // extracted from URL if it's a status page
}

interface ProgressState {
  processed: Record<string, { result: unknown; timestamp: string }>;
  failed: Record<string, { error: string; attempts: number; timestamp: string }>;
}
```

**`cdx.ts`** — CDX API client:
```ts
class CdxClient {
  constructor(private rateLimiter: RateLimiter, private cacheDir: string);

  // Query CDX API with full filter support
  async query(url: string, options?: {
    from?: string;           // start date "20230101"
    to?: string;             // end date "20240601"
    matchType?: "exact" | "prefix" | "host" | "domain";
    statusFilter?: number;   // e.g., 200
    collapseField?: string;  // e.g., "timestamp:8" (collapse by day)
    fields?: string[];       // e.g., ["timestamp", "original", "statuscode"]
    limit?: number;
  }): Promise<CdxResult[]>;

  // Find the single best snapshot for a URL, closest to a target date
  async findBestSnapshot(url: string, targetDate: string): Promise<WaybackSnapshot | null>;

  // Quick existence check — returns true if any 200 snapshot exists
  async checkAvailability(url: string): Promise<boolean>;
}
```

Results are cached to `data/.cdx-cache/{urlHash}.json` so repeated runs don't re-query the API.

**`wayback-page.ts`** — Playwright page loader:
```ts
class WaybackPageLoader {
  constructor(private rateLimiter: RateLimiter);

  // Launch or reuse a browser instance
  async init(): Promise<void>;

  // Load a Wayback Machine page, wait for content, return the Page
  async loadPage(snapshot: WaybackSnapshot, options?: {
    waitForSelector?: string;         // CSS selector to wait for
    waitForSelectorTimeout?: number;  // default 30000
    removeWaybackToolbar?: boolean;   // default true
  }): Promise<{ page: Page; success: boolean; error?: string }>;

  // Screenshot a specific element on the current page
  async screenshotElement(page: Page, selector: string, outputPath: string): Promise<void>;

  // Clean up browser
  async close(): Promise<void>;
}
```

Handles: Wayback toolbar removal (`#wm-ipp-base`, `#wm-ipp-print`), redirect detection, empty/error captures, configurable retries (default 2).

**`rate-limiter.ts`**:
```ts
class RateLimiter {
  constructor(private minDelayMs: number = 10000, private maxJitterMs: number = 5000);
  async wait(): Promise<void>;           // sleep minDelay + random jitter
  async backoff(attempt: number): Promise<void>;  // exponential: minDelay * 2^attempt, capped
}
```

**`progress.ts`** — resumable state:
```ts
class ProgressTracker {
  constructor(private stateFilePath: string);
  isProcessed(key: string): boolean;
  getResult(key: string): unknown | null;
  markProcessed(key: string, result: unknown): void;
  markFailed(key: string, error: string): void;
  getPending(allKeys: string[]): string[];  // returns keys not yet processed or failed
  getStats(): { processed: number; failed: number; pending: number };
  save(): void;  // flush to disk (also called by markProcessed/markFailed)
}
```

State file lives alongside the task's output, e.g., `data/backfill/progress.json`.

**`tweet-selectors.ts`** — era-aware selector chains:
```ts
function getAutoTheme(platform: Platform, date: string): ThemeId;

// Each returns an array of selectors to try in order (first match wins)
function getTweetContainerSelectors(theme: TwitterEra): string[];
function getTweetTextSelectors(theme: TwitterEra): string[];
function getTimestampSelectors(theme: TwitterEra): string[];
function getEngagementSelectors(theme: TwitterEra): string[];
function getProfileSelectors(theme: TwitterEra): { name: string[]; bio: string[]; avatar: string[] };
```

### 1.2 Sample Selection Script

**File:** `theme-extractor/src/tasks/select-samples.ts`

Uses the existing archive database to identify specific post IDs that cover every content type in every era:

1. Open the built SQLite database (`site/dril.db` or accept a path argument)
2. For each era (date range), query for candidate post IDs:
   - **Plain text**: `SELECT id FROM posts WHERE is_reply=0 AND is_quote=0 AND id NOT IN (SELECT post_id FROM media) AND created_at BETWEEN ? AND ? LIMIT 10`
   - **Reply**: `SELECT id FROM posts WHERE is_reply=1 AND created_at BETWEEN ? AND ? LIMIT 10`
   - **Quote tweet**: `SELECT id FROM posts WHERE is_quote=1 AND created_at BETWEEN ? AND ? LIMIT 10`
   - **Photo**: `SELECT p.id FROM posts p JOIN media m ON p.id=m.post_id WHERE m.type='photo' AND p.created_at BETWEEN ? AND ? LIMIT 10`
   - **Video**: `SELECT p.id FROM posts p JOIN media m ON p.id=m.post_id WHERE m.type='video' AND p.created_at BETWEEN ? AND ? LIMIT 10`
   - **Retweet**: `SELECT id FROM reposts WHERE created_at BETWEEN ? AND ? LIMIT 10`
3. Output `theme-extractor/data/candidates.json` — multiple candidates per slot so the next step has fallbacks

Returns 10 candidates per type per era (some will be `null` — quote tweets didn't exist in Classic era, etc.).

### 1.3 CDX Discovery Script

**File:** `theme-extractor/src/tasks/discover-samples.ts`

Uses `CdxClient` from the core library. Takes the candidates from `data/candidates.json` and checks Wayback Machine availability:

1. For each candidate post ID, call `cdxClient.findBestSnapshot("twitter.com/dril/status/{id}", post.created_at)` — results cached automatically
2. Walk through candidates in order until a CDX hit is found for each content type
3. Also query for profile page snapshots: `cdxClient.query("twitter.com/dril", { collapseField: "timestamp:6" })` — 1-2 per year
5. Output `theme-extractor/data/sample-manifest.json`:

```json
{
  "twitter-classic": {
    "plain": { "post_id": "12345", "wayback_timestamp": "20090815123456", "created_at": "..." },
    "reply": { "post_id": "12346", "wayback_timestamp": "20091201...", "created_at": "..." },
    "quote": null,
    "photo": null,
    "video": null,
    "retweet": { "post_id": "12360", "wayback_timestamp": "...", "created_at": "..." }
  },
  "twitter-new": { "...": "..." },
  "twitter-material": { "...": "..." },
  "twitter-modern": { "...": "..." },
  "profiles": [
    { "wayback_timestamp": "20090301...", "url": "twitter.com/dril" },
    { "wayback_timestamp": "20110815...", "url": "twitter.com/dril" }
  ]
}
```

Human review step: inspect `sample-manifest.json`, optionally override entries with hand-picked IDs.

**Rate limiting:** 5-second delay between CDX API calls. ~60-100 lookups total (10 candidates × 6 types × ~partial coverage).

### 1.4 Theme Extraction Script

**File:** `theme-extractor/src/tasks/extract-themes.ts`

Uses `WaybackPageLoader` and `ProgressTracker` from the core library. Reads `data/sample-manifest.json` and extracts DOM/CSS for each non-null entry:

1. Initialize `WaybackPageLoader` and `ProgressTracker("data/wayback/progress.json")`
2. For each unprocessed entry in the manifest:
   a. Call `pageLoader.loadPage(snapshot, { waitForSelector: getTweetContainerSelectors(era) })`
   b. Extract `innerHTML` of the tweet container → `dom.html`
   c. For each significant child element, call `getComputedStyle()` and record all properties → `styles.json`
   d. Call `pageLoader.screenshotElement(page, selector, path)` → `screenshot.png`
   e. Write metadata → `metadata.json`
   f. Call `progress.markProcessed(key, metadata)`
3. Write all output to `theme-extractor/data/wayback/{theme}/{content_type}/`

Selector chains come from `tweet-selectors.ts` — the script doesn't hardcode them.

### 1.5 Profile Extraction Script

**File:** `theme-extractor/src/tasks/extract-profiles.ts`

Uses `WaybackPageLoader` and `ProgressTracker` from the core library. For each profile-page snapshot in the manifest:

1. Call `pageLoader.loadPage(snapshot)` for each profile URL
2. Use `getProfileSelectors(era)` to find name, bio, avatar elements
3. Extract text content and download avatar image to `theme-extractor/data/profile/avatars/{date}.jpg`
4. Append to `theme-extractor/data/profile/snapshots.ndjson`
5. Call `progress.markProcessed(key, metadata)`

## Phase 2: Theme CSS & Profile Pipeline

### 2.1 Theme CSS Builder

**File:** `theme-extractor/src/tasks/build-themes.ts`

Reads `theme-extractor/data/wayback/{theme}/*/styles.json` and generates `theme-extractor/output/themes/{theme}.css`.

For each era, map extracted computed styles to CSS rules targeting the standardized post DOM:

```css
/* theme-extractor/output/themes/twitter-classic.css */
.post[data-theme="twitter-classic"] {
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 5px;
  font-family: "Lucida Grande", Arial, sans-serif;
  font-size: 12px;
  /* ... all properties from styles.json */
}
.post[data-theme="twitter-classic"] .post-avatar img {
  width: 73px;
  height: 73px;
  border-radius: 4px;
}
/* etc. */
```

The mapping from extracted DOM elements to our standardized DOM is manual/semi-automated — the script provides a scaffold, then we hand-tune against the archived screenshots.

### 2.2 Profile Snapshots in Builder

**Files:** `builder/src/profile.rs` (new), `builder/src/db.rs`, `builder/src/main.rs`

- New struct `ProfileSnapshot { user_id, platform, captured_at, display_name, description, avatar_path }`
- Parse `theme-extractor/data/profile/snapshots.ndjson`
- New table `profile_snapshots` (see design spec for schema)
- Insert during build
- Copy `theme-extractor/output/avatars/*` to `site/avatars/` during build

### 2.3 Extend Builder CLI

The builder accepts an optional `--profiles` flag pointing to the profile NDJSON:

```sh
dril-builder data/ site/dril.db --profiles theme-extractor/data/profile/snapshots.ndjson
```

## Phase 3: Frontend Integration

### 3.1 Richer Post DOM

**File:** `site/app.js`

Update the `search()` function to render the new post structure:

- Add `<article>` with `data-platform` and `data-theme` attributes
- Add avatar `<img>` (resolved from profile snapshots)
- Add display name and handle in header
- Add engagement stats (likes/shares)
- Move reply context above post text (Twitter convention)
- `getAutoTheme(platform, createdAt)` function for platform-aware era classification

New query to fetch profile data:

```sql
SELECT display_name, avatar_path FROM profile_snapshots
WHERE user_id = '16298441' AND captured_at <= ?
ORDER BY captured_at DESC LIMIT 1
```

Cache profile resolution results (there are only ~10-20 snapshots, so preload all and binary-search in JS).

### 3.2 Theme CSS Loading

**File:** `site/index.html`, `site/app.js`

- Add `<link>` tags for each theme CSS file in `<head>`
- Alternatively, bundle all themes into one `themes.css` (they're small)

### 3.3 Theme Selector

**File:** `site/index.html`, `site/app.js`, `site/style.css`

- Add `<select>` to the header area
- On change: update all visible posts' `data-theme` attribute, save to `localStorage`
- On load: read from `localStorage`, default to `"auto"`
- In auto mode, each post gets `data-theme` = `getAutoTheme(post.platform, post.created_at)`
- All themes available regardless of post platform (user can apply Twitter Classic to a Bluesky post)

### 3.4 Avatar Serving

Avatars are small static images served from `site/avatars/`. The build step copies them there. For the dev server, `scripts/dev.ts` also copies them.

## Phase 3.5: GitHub Pages Deployment

### Current Deploy Pipeline (`.github/workflows/deploy.yml`)

The existing workflow triggers on push to main, daily at 6am UTC, and manual dispatch. It:

1. Checks out the repo
2. Builds Rust tools (`dril-normalizer`, `dril-builder`, `dril-bsky-sync`)
3. Clones codemasher/dril-archive, normalizes it
4. Syncs Bluesky posts
5. Appends scraped data
6. Builds the SQLite DB → `site/dril.db`
7. Copies SQLite WASM → `site/sqlite3/`
8. Uploads `site/` as the Pages artifact

### Required Changes

Since `theme-extractor/output/` (themes CSS + avatars) is checked into the repo, the deploy workflow only needs copy steps — no Playwright or extraction at CI time.

Add these steps **after** "Copy SQLite WASM runtime" and **before** "Upload Pages artifact":

```yaml
- name: Copy theme CSS
  run: |
    mkdir -p site/themes
    cp -r theme-extractor/output/themes/* site/themes/

- name: Copy avatar images
  run: |
    mkdir -p site/avatars
    cp -r theme-extractor/output/avatars/* site/avatars/
```

Update the "Build database" step to include profile data once the builder supports it:

```yaml
- name: Build database
  run: ./target/release/dril-builder data/ site/dril.db --profiles theme-extractor/data/profile/snapshots.ndjson
```

**Note:** `theme-extractor/data/profile/snapshots.ndjson` is gitignored (raw extraction output), but this specific file should be promoted to `theme-extractor/output/profile-snapshots.ndjson` and checked in so CI can use it. Update the builder `--profiles` path accordingly:

```yaml
- name: Build database
  run: ./target/release/dril-builder data/ site/dril.db --profiles theme-extractor/output/profile-snapshots.ndjson
```

### No New CI Dependencies

The extraction tooling (Playwright, tsx) is **not** needed in CI. All extraction happens offline and the results are committed. CI only copies static files and passes a new flag to the builder.

## Phase 4: Post Backfill (2023–2024 Gap)

### 4.1 Backfill Task

**File:** `theme-extractor/src/tasks/backfill-posts.ts`

Reuses the core library to crawl Wayback Machine snapshots and recover missing posts from the 2023-01-01 to 2024-06-01 gap.

**Step 1: Discover available snapshots**

```ts
const cdx = new CdxClient(rateLimiter, "data/.cdx-cache");
const snapshots = await cdx.query("twitter.com/dril/status/*", {
  from: "20230101",
  to: "20240601",
  statusFilter: 200,
  collapseField: "urlkey",  // one snapshot per unique URL
  fields: ["timestamp", "original", "statuscode"],
});
```

Extract post IDs from the original URLs. This is a single CDX API call that may return hundreds of results.

**Step 2: Filter against existing archive**

Open the built database and query for existing post IDs. Skip any post already in `posts` table.

```ts
const existingIds = new Set(db.prepare("SELECT id FROM posts WHERE platform='x'").all().map(r => r.id));
const missing = snapshots.filter(s => !existingIds.has(s.postId));
```

**Step 3: Extract post content**

Initialize `WaybackPageLoader` and `ProgressTracker("data/backfill/progress.json")`.

For each missing post (respecting progress state):

1. `pageLoader.loadPage(snapshot, { waitForSelector: getTweetContainerSelectors("modern") })`
2. Extract from the rendered page:
   - Tweet text (innerText of tweet text element)
   - Timestamp (from `datetime` attribute or `time` element)
   - Reply status and `reply_to_user` (from reply context element)
   - Quote tweet status and quoted text (from quoted tweet container)
   - Media URLs and types (from media container)
   - Engagement counts (likes, retweets from aria-labels or text)
3. `progress.markProcessed(postId, extractedData)` or `progress.markFailed(postId, error)`

**Step 4: Output NDJSON**

Write recovered posts to `data/backfill/recovered-posts.ndjson` in the normalizer's output format:

```json
{"id":"1234567890","text":"...","created_at":"2023-05-15T14:30:00Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":42000,"shares":12000}
```

Also write `data/backfill/recovered-media.ndjson` for any media found.

### 4.2 Running the Backfill

The backfill is designed to be run incrementally over multiple sessions:

```sh
cd theme-extractor

# First run: discovers snapshots, starts extracting
bun run backfill

# Interrupted? Just run again — picks up where it left off
bun run backfill

# Check progress
cat data/backfill/progress.json | jq '.processed | length'
```

Accepts CLI options for batch size and date range overrides:

```sh
# Process at most 50 posts per session
bun run backfill -- --batch-size 50

# Override date range
bun run backfill -- --from 20230601 --to 20231231
```

### 4.3 Integrating Recovered Posts

Once backfill is complete, the recovered NDJSON is copied into the main data pipeline:

```sh
cp theme-extractor/data/backfill/recovered-posts.ndjson data/scraped/wayback-backfill.jsonl
cp theme-extractor/data/backfill/recovered-media.ndjson data/scraped/wayback-backfill-media.jsonl
```

The existing `deploy.yml` already processes `data/scraped/*.jsonl` via `scripts/split_manual_scrape.py`. Alternatively, the recovered NDJSON can be committed directly as a checked-in data source.

The builder's deduplication (by post ID) prevents double-counting if any recovered posts overlap with existing data.

## Phase 5: Refinement

### 5.1 Visual QA

- Compare rendered posts against archived screenshots
- Adjust CSS values where computed style extraction was imprecise
- Test in Chrome, Firefox, Safari

### 5.2 Gap Filling

- If Wayback Machine is missing snapshots for an era, research the CSS from other sources (Twitter UI archives, blog posts about redesigns, GitHub repos that replicated Twitter UI)
- Manually supplement `styles.json` files

### 5.3 Dev Server Updates

**File:** `scripts/dev.ts`

- Copy theme CSS and avatar images alongside existing SQLite WASM copy step
- Build test profile data for E2E tests

### 5.4 E2E Test Updates

**File:** `tests/e2e.spec.ts`

- Test that posts render with era-correct theme in auto mode
- Test that theme selector overrides work
- Test that avatar and display name appear

## File Summary

| File | Action | Phase |
|------|--------|-------|
| `theme-extractor/package.json` | Create | 1.0 |
| `theme-extractor/tsconfig.json` | Create | 1.0 |
| `theme-extractor/src/lib/types.ts` | Create | 1.1 |
| `theme-extractor/src/lib/rate-limiter.ts` | Create | 1.1 |
| `theme-extractor/src/lib/cdx.ts` | Create | 1.1 |
| `theme-extractor/src/lib/wayback-page.ts` | Create | 1.1 |
| `theme-extractor/src/lib/progress.ts` | Create | 1.1 |
| `theme-extractor/src/lib/tweet-selectors.ts` | Create | 1.1 |
| `theme-extractor/src/tasks/select-samples.ts` | Create | 1.2 |
| `theme-extractor/src/tasks/discover-samples.ts` | Create | 1.3 |
| `theme-extractor/src/tasks/extract-themes.ts` | Create | 1.4 |
| `theme-extractor/src/tasks/extract-profiles.ts` | Create | 1.5 |
| `theme-extractor/src/tasks/build-themes.ts` | Create | 2.1 |
| `theme-extractor/src/tasks/backfill-posts.ts` | Create | 4.1 |
| `theme-extractor/data/` | Populate (gitignored) | 1 |
| `theme-extractor/output/themes/*.css` | Create (generated, checked in) | 2.1 |
| `theme-extractor/output/avatars/` | Populate (checked in) | 1.5 |
| `theme-extractor/output/profile-snapshots.ndjson` | Create (checked in) | 1.5 |
| `builder/src/profile.rs` | Create | 2.2 |
| `builder/src/db.rs` | Modify — add profile_snapshots table | 2.2 |
| `builder/src/main.rs` | Modify — add --profiles flag, copy avatars | 2.3 |
| `site/themes/*.css` | Copy from theme-extractor/output (build artifact) | 3.2 |
| `site/avatars/` | Copy from theme-extractor/output (build artifact, gitignored) | 3.4 |
| `site/app.js` | Modify — new post DOM, theme logic, profile resolution | 3.1-3.3 |
| `site/index.html` | Modify — theme CSS links, selector UI | 3.2-3.3 |
| `site/style.css` | Modify — theme selector styling, base post layout | 3.3 |
| `.github/workflows/deploy.yml` | Modify — add theme/avatar copy steps, --profiles flag | 3.5 |
| `scripts/dev.ts` | Modify — copy themes + avatars from theme-extractor/output | 5.3 |
| `tests/e2e.spec.ts` | Modify — theme tests | 5.4 |
| `testdata/` | Add profile fixture data | 5.3 |

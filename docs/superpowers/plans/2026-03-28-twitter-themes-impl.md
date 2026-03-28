# Twitter Era Themes & Profile Archive — Implementation Plan

Implements the design in `specs/2026-03-28-twitter-themes-design.md`.

## Phase 1: Wayback Extraction Tooling

All extraction tooling lives in the `theme-extractor/` subdirectory at the repo root.

### 1.0 Scaffold `theme-extractor/`

Create the subdirectory with its own `package.json`:

```
theme-extractor/
  package.json              # playwright, typescript, tsx
  tsconfig.json
  src/
    cdx-discover.ts
    extract-themes.ts
    extract-profiles.ts
    build-themes.ts
  data/                     # gitignored — raw extraction output
  output/                   # checked in — generated themes + avatars
    themes/
    avatars/
```

`package.json` scripts:
```json
{
  "scripts": {
    "discover": "tsx src/cdx-discover.ts",
    "extract:themes": "tsx src/extract-themes.ts",
    "extract:profiles": "tsx src/extract-profiles.ts",
    "build:themes": "tsx src/build-themes.ts"
  }
}
```

Add `theme-extractor/data/` to the repo root `.gitignore`.

### 1.1 CDX Discovery Script

**File:** `theme-extractor/src/cdx-discover.ts`

Query the Wayback Machine CDX API to find usable snapshots:

- Tweet pages: `twitter.com/dril/status/*` — need ~2-3 per era for DOM/CSS extraction
- Profile pages: `twitter.com/dril` — need ~1-2 per year for profile metadata
- Filter by `statuscode:200`, collapse by `timestamp:4` (yearly) or `timestamp:6` (monthly)
- Output a curated `theme-extractor/data/snapshots.json` listing the selected URLs and timestamps
- Use `fetch()` with 5s delay between CDX API calls

Human review step: manually inspect `snapshots.json` and prune to the best candidates.

### 1.2 Theme Extraction Script

**File:** `theme-extractor/src/extract-themes.ts`

For each selected tweet-page snapshot:

1. Launch Playwright headless Chromium
2. Navigate to `https://web.archive.org/web/{timestamp}/https://twitter.com/dril/status/{id}`
3. Wait for the tweet container to render (wait for known selectors: `.tweet`, `.css-1dbjc4n`, `[data-testid="tweet"]` depending on era)
4. Extract:
   - `document.querySelector(tweetSelector).innerHTML` → `dom.html`
   - For each significant child element, call `getComputedStyle()` and record all properties → `styles.json`
   - `page.screenshot({ clip: tweetBoundingBox })` → `screenshot.png`
   - Metadata (URL, timestamp, selectors used) → `metadata.json`
5. 10-second delay before next snapshot
6. Write all output to `theme-extractor/data/wayback/{era}/{timestamp}/`

**Key selectors by era:**
| Era | Tweet container selector |
|-----|------------------------|
| Classic | `.hentry .entry-content`, `#status_` |
| New | `.tweet`, `.js-stream-tweet` |
| Material | `.tweet`, `.js-actionable-tweet` |
| Modern | `[data-testid="tweet"]`, `article[role="article"]` |

### 1.3 Profile Extraction Script

**File:** `theme-extractor/src/extract-profiles.ts`

For each selected profile-page snapshot:

1. Navigate to `https://web.archive.org/web/{timestamp}/https://twitter.com/dril`
2. Extract display name, bio, avatar URL from the DOM
3. Download avatar image to `theme-extractor/data/profile/avatars/{date}.jpg`
4. Append to `theme-extractor/data/profile/snapshots.ndjson`
5. 10-second delay between snapshots

**Key selectors by era:**
| Era | Name | Bio | Avatar |
|-----|------|-----|--------|
| Classic | `.fn`, `.fullname` | `.bio` | `.profile-image`, `.avatar` |
| New | `.ProfileHeaderCard-nameLink`, `.fullname` | `.ProfileHeaderCard-bio`, `.bio` | `.ProfileAvatar-image` |
| Material | `.ProfileHeaderCard-nameLink` | `.ProfileHeaderCard-bio` | `.ProfileAvatar-image` |
| Modern | `[data-testid="UserName"]` | `[data-testid="UserDescription"]` | `[data-testid="UserAvatar"] img` |

## Phase 2: Theme CSS & Profile Pipeline

### 2.1 Theme CSS Builder

**File:** `theme-extractor/src/build-themes.ts`

Reads `theme-extractor/data/wayback/{era}/*/styles.json` and generates `theme-extractor/output/themes/{era}.css`.

For each era, map extracted computed styles to CSS rules targeting the standardized post DOM:

```css
/* theme-extractor/output/themes/classic.css */
.post[data-theme="classic"] {
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 5px;
  font-family: "Lucida Grande", Arial, sans-serif;
  font-size: 12px;
  /* ... all properties from styles.json */
}
.post[data-theme="classic"] .post-avatar img {
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

- Add `<article>` with `data-era` and `data-theme` attributes
- Add avatar `<img>` (resolved from profile snapshots)
- Add display name and handle in header
- Add engagement stats (likes/shares)
- Move reply context above post text (Twitter convention)
- `getEra(createdAt)` function for era classification

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
- In auto mode, each post gets `data-theme` = `getEra(post.created_at)`

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

## Phase 4: Refinement

### 4.1 Visual QA

- Compare rendered posts against archived screenshots
- Adjust CSS values where computed style extraction was imprecise
- Test in Chrome, Firefox, Safari

### 4.2 Gap Filling

- If Wayback Machine is missing snapshots for an era, research the CSS from other sources (Twitter UI archives, blog posts about redesigns, GitHub repos that replicated Twitter UI)
- Manually supplement `styles.json` files

### 4.3 Dev Server Updates

**File:** `scripts/dev.ts`

- Copy theme CSS and avatar images alongside existing SQLite WASM copy step
- Build test profile data for E2E tests

### 4.4 E2E Test Updates

**File:** `tests/e2e.spec.ts`

- Test that posts render with era-correct theme in auto mode
- Test that theme selector overrides work
- Test that avatar and display name appear

## File Summary

| File | Action | Phase |
|------|--------|-------|
| `theme-extractor/package.json` | Create | 1.0 |
| `theme-extractor/tsconfig.json` | Create | 1.0 |
| `theme-extractor/src/cdx-discover.ts` | Create | 1.1 |
| `theme-extractor/src/extract-themes.ts` | Create | 1.2 |
| `theme-extractor/src/extract-profiles.ts` | Create | 1.3 |
| `theme-extractor/data/` | Populate (gitignored) | 1 |
| `theme-extractor/src/build-themes.ts` | Create | 2.1 |
| `theme-extractor/output/themes/*.css` | Create (generated, checked in) | 2.1 |
| `theme-extractor/output/avatars/` | Populate (checked in) | 1.3 |
| `theme-extractor/output/profile-snapshots.ndjson` | Create (checked in) | 1.3 |
| `builder/src/profile.rs` | Create | 2.2 |
| `builder/src/db.rs` | Modify — add profile_snapshots table | 2.2 |
| `builder/src/main.rs` | Modify — add --profiles flag, copy avatars | 2.3 |
| `site/themes/*.css` | Copy from theme-extractor/output (build artifact) | 3.2 |
| `site/avatars/` | Copy from theme-extractor/output (build artifact, gitignored) | 3.4 |
| `site/app.js` | Modify — new post DOM, theme logic, profile resolution | 3.1-3.3 |
| `site/index.html` | Modify — theme CSS links, selector UI | 3.2-3.3 |
| `site/style.css` | Modify — theme selector styling, base post layout | 3.3 |
| `.github/workflows/deploy.yml` | Modify — add theme/avatar copy steps, --profiles flag | 3.5 |
| `scripts/dev.ts` | Modify — copy themes + avatars from theme-extractor/output | 4.3 |
| `tests/e2e.spec.ts` | Modify — theme tests | 4.4 |
| `testdata/` | Add profile fixture data | 4.3 |

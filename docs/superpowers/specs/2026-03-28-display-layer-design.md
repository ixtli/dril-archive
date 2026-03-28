# Display Layer Rewrite Design Spec

## Overview

Replace the vanilla HTML/JS/CSS frontend with a Svelte 5 + Vite app that renders era-themed post cards, supports responsive mobile/desktop layout, and adds a controls panel for sort, filter, and theme override. The site remains fully static and CDN-deployable.

## Goals

- Render each post as a card matching the visual style of its era and platform
- Responsive design — works well on mobile and desktop
- Small bundle, fast load time, instant search (preserve existing sub-50ms FTS5)
- Collapsible controls panel for sort, filter, and theme override
- Clean tooling with full linting/formatting coverage and pre-commit hooks

## Non-Goals

- Pixel-perfect reproduction of old browser rendering quirks
- Routing, post detail pages, or browsing by date
- Server-side rendering or SSR
- Interactive elements on post cards (like/retweet buttons are display-only)

## Framework Choice: Svelte 5 + Vite

**Why Svelte 5:**
- ~2KB runtime — compiles away, near-zero framework overhead
- Scoped CSS built-in — perfect for theme isolation (each template's styles don't leak)
- HTML-first templates — era-specific DOM structures are readable and maintainable
- Direct DOM updates — no virtual DOM diffing, fast rendering of search results
- Runes (`$state`, `$derived`) for reactive state with minimal boilerplate

**Why Vite:**
- Fast HMR for development
- Tree-shaking, code splitting, hashed asset output
- Native Svelte plugin (`@sveltejs/vite-plugin-svelte`)
- Compatible with bun as package manager

## Project Structure

```
site/
  src/
    App.svelte                  # Root — loading state, search, controls, result list
    lib/
      db.ts                     # SQLite WASM loading, query execution
      search.ts                 # FTS5 query building, debounce logic
      themes.ts                 # Era detection from platform + created_at, theme registry
    components/
      SearchBar.svelte          # Input + cog icon to toggle controls
      Controls.svelte           # Collapsible panel: sort, filter, theme override
      PostCard.svelte            # Dispatcher — picks the right era template
      LoadingBar.svelte         # Progress bar for DB download + "Preparing search..." spinner
    templates/
      TwitterClassic.svelte     # 2008-2010 card (73px square avatar, #0084b4 links, Helvetica 13px)
      TwitterNew.svelte         # 2010-2014 card (48px rounded-square avatar, stream cards)
      TwitterMaterial.svelte    # 2014-2019 card (48px circular avatar, #1da1f2 blue)
      TwitterModern.svelte      # 2019-2023 card (40px circular avatar, Chirp font, 16px rounded)
      Bluesky.svelte            # Bluesky card (clean blue/white, current design)
      Threads.svelte            # Threads card (Instagram-ish minimal)
    styles/
      global.css                # Dark theme shell, responsive layout, loading states
      twitter-classic.css       # Copied from theme-extractor/output/themes/
      twitter-new.css
      twitter-material.css
      twitter-modern.css
      bluesky.css               # Hand-written to match current Bluesky
      threads.css               # Hand-written to match current Threads
  index.html                    # Vite entry point
  vite.config.ts
  svelte.config.js
  package.json
  tsconfig.json
  .eslintrc.cjs
  .prettierrc
```

## Template + Theme Architecture

### Swappable DOM Templates

Each era/platform gets its own Svelte component with its own HTML structure and scoped CSS. This is not CSS-variable swapping on a shared DOM — each era has a genuinely different component tree reflecting how that platform actually structured its post cards.

The `PostCard.svelte` dispatcher selects the template:

```svelte
{#if theme === 'twitter-classic'}
  <TwitterClassic {post} />
{:else if theme === 'twitter-new'}
  <TwitterNew {post} />
{:else if theme === 'twitter-material'}
  <TwitterMaterial {post} />
{:else if theme === 'twitter-modern'}
  <TwitterModern {post} />
{:else if theme === 'bsky'}
  <Bluesky {post} />
{:else if theme === 'threads'}
  <Threads {post} />
{/if}
```

### Theme Resolution

Each post has a `platform` and `created_at`. Auto-theme picks the era-correct theme:

```typescript
function getAutoTheme(platform: string, createdAt: string): ThemeId {
  if (platform === 'bsky') return 'bsky';
  if (platform === 'threads') return 'threads';
  const d = new Date(createdAt);
  if (d < new Date('2010-09-01')) return 'twitter-classic';
  if (d < new Date('2014-06-01')) return 'twitter-new';
  if (d < new Date('2019-07-15')) return 'twitter-material';
  return 'twitter-modern';
}
```

Users can override to force a specific theme on all results via the controls panel. Override applies to display only — doesn't affect the data or search.

### CSS Integration

The theme CSS files from `theme-extractor/output/themes/` are copied into `site/src/styles/` and imported by each template component. Each template component uses Svelte's scoped `<style>` block that imports its era CSS, ensuring no style leakage between eras.

### Platform Cards (Bluesky, Threads)

Hand-written to capture ~80-90% visual fidelity of the current platform designs. These use the same component interface as the Twitter era cards (accept a `post` prop, render a card). CSS is hand-authored, not extracted — these platforms are current and stable.

## Controls Panel

### Trigger

A cog icon button to the right of the search input. Clicking toggles a collapsible panel below the search bar.

### Sort Options

| Option | SQL | Default |
|--------|-----|---------|
| Relevance | `ORDER BY rank` (FTS5) | Yes |
| Newest first | `ORDER BY created_at DESC` | |
| Oldest first | `ORDER BY created_at ASC` | |
| Most liked | `ORDER BY likes DESC` | |
| Most shared | `ORDER BY shares DESC` | |

Note: Non-relevance sorts require a different query strategy since FTS5 `rank` only applies to `MATCH` queries. When sorting by date/likes/shares, the query uses `LIKE` or still uses `MATCH` but overrides the sort.

### Filter Options

| Filter | SQL clause |
|--------|-----------|
| Platform: All / X / Bluesky / Threads | `WHERE platform = ?` |
| Type: All / Original / Replies / Quotes | `WHERE is_reply = ?` / `WHERE is_quote = ?` |

Filters combine with AND. Defaults are All/All.

### Theme Override

| Option | Behavior |
|--------|----------|
| Auto (default) | Each post uses era-correct theme based on platform + created_at |
| Twitter Classic | Force all results to use twitter-classic template |
| Twitter New | Force all results to use twitter-new template |
| Twitter Material | Force all results to use twitter-material template |
| Twitter Modern | Force all results to use twitter-modern template |
| Bluesky | Force all results to use bsky template |
| Threads | Force all results to use threads template |

## Responsive Design

Mobile-first single-column layout with one breakpoint.

### Mobile (< 640px)
- Search bar full width, cog icon inline right
- Controls panel full width below search bar
- Post cards full width with reduced padding
- Smaller meta text

### Desktop (>= 640px)
- Search bar centered, max-width 700px
- Controls panel same width as search bar
- Post cards match search bar width
- Standard font sizes

CSS approach: base styles are mobile, `@media (min-width: 640px)` adjusts for desktop. No tablet breakpoint, no sidebar, no multi-column.

## Data Layer

The SQLite WASM loading and FTS5 search logic from the current `app.js` moves into `site/src/lib/db.ts` and `site/src/lib/search.ts` with minimal changes. The `@sqlite.org/sqlite-wasm` package and its WASM files are handled by Vite (either as a static asset or via the existing copy-to-dist approach).

The search query is extended to support the controls panel:

```sql
-- Base query (relevance sort, no filters)
SELECT t.id, t.text, t.created_at, t.is_reply, t.reply_to_user, t.platform
FROM posts_fts f
JOIN posts t ON t.rowid = f.rowid
WHERE posts_fts MATCH ?
ORDER BY rank
LIMIT 50

-- With filters and sort override
SELECT t.id, t.text, t.created_at, t.is_reply, t.reply_to_user, t.platform
FROM posts_fts f
JOIN posts t ON t.rowid = f.rowid
WHERE posts_fts MATCH ?
  AND t.platform = ?
  AND t.is_reply = 0
ORDER BY t.likes DESC
LIMIT 50
```

## Tooling + Pre-commit Hooks

### Linting/Formatting Stack

Two toolchains, cleanly separated by directory:

**`site/src/` (Svelte app) — Prettier + eslint + svelte-check:**

| Tool | Purpose |
|------|---------|
| `prettier` + `prettier-plugin-svelte` | Format `.svelte`, `.ts`, `.css`, `.html` |
| `eslint` + `eslint-plugin-svelte` + `@typescript-eslint/eslint-plugin` | Lint `.svelte`, `.ts` (a11y, best practices, type-aware rules) |
| `svelte-check` | TypeScript + Svelte template validation |

**Everything else (scripts, e2e, config files) — Biome:**

| Tool | Purpose |
|------|---------|
| `biome format` | Format `.js`, `.ts`, `.css` outside `site/src/` |
| `biome lint` | Lint `.js` outside `site/src/` |

**Rust — unchanged:**

| Tool | Purpose |
|------|---------|
| `cargo fmt` | Format Rust |
| `cargo clippy` | Lint Rust |

### Why Two JS Formatters

Biome does not support `.svelte` files. Prettier + prettier-plugin-svelte is the standard for Svelte formatting. To avoid conflicts, the boundary is clean: Prettier owns `site/src/`, Biome owns everything else. No file is touched by both formatters.

### Pre-commit Hooks

```yaml
repos:
  - repo: local
    hooks:
      - id: cargo-fmt
        name: cargo fmt
        entry: cargo fmt --check
        language: system
        types: [rust]
        pass_filenames: false

      - id: cargo-clippy
        name: cargo clippy
        entry: cargo clippy --workspace -- -D warnings
        language: system
        types: [rust]
        pass_filenames: false

      - id: biome-format
        name: biome format (non-svelte)
        entry: bunx @biomejs/biome format --html-formatter-enabled=true --css-formatter-enabled=true
        language: system
        types_or: [javascript, css]
        exclude: ^site/src/
        pass_filenames: true

      - id: biome-lint
        name: biome lint (non-svelte)
        entry: bunx @biomejs/biome lint
        language: system
        types: [javascript]
        exclude: ^site/src/
        pass_filenames: true

      - id: prettier
        name: prettier (svelte app)
        entry: bunx prettier --check
        language: system
        files: ^site/src/
        types_or: [svelte, typescript, css, html]
        pass_filenames: true

      - id: eslint
        name: eslint (svelte app)
        entry: bunx eslint
        language: system
        files: ^site/src/
        types_or: [svelte, typescript]
        pass_filenames: true

      - id: svelte-check
        name: svelte-check
        entry: bash -c 'cd site && bunx svelte-check'
        language: system
        files: ^site/src/
        pass_filenames: false
```

## Build + Deploy

### Development

```sh
cd site && bun run dev    # Vite dev server with HMR
```

The dev server needs access to `dril.db` and `sqlite3/` WASM files. Vite's `public/` directory or a proxy handles this.

### Production Build

```sh
cd site && bun run build  # Output to site/dist/
```

### Deploy Workflow Update

The GitHub Actions workflow changes:
1. Build Svelte app: `cd site && bun install && bun run build`
2. Copy `dril.db` into `site/dist/`
3. Copy `sqlite3/` WASM files into `site/dist/sqlite3/`
4. Deploy `site/dist/` to GitHub Pages

### E2E Tests

Playwright tests update to point at the Vite preview server (`bun run preview`) instead of the raw file server. Same 5 test cases — they verify the search flow works end-to-end through the new UI.

## Migration

The current `site/app.js`, `site/index.html`, and `site/style.css` are replaced entirely by the Svelte app. The old files are removed. The `scripts/dev.ts` is updated to run `vite dev` instead of `Bun.serve`.

## Test Strategy

- **E2E tests (Playwright):** Existing 5 tests adapted to the new UI selectors. Same scenarios: page load, search, reply metadata, clear, no results.
- **svelte-check:** Catches type errors and template issues at pre-commit time.
- **eslint:** Catches a11y and best practice issues.
- **Rust tests:** Unchanged (27 builder + normalizer tests).

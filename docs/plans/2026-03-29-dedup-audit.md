# Codebase Deduplication & Modularization Audit

**Date:** 2026-03-29
**Scope:** `site/src/` — Svelte 5 frontend (~3,000 lines, 27 files)

---

## Domain 1: Templates (6 files, ~1,100 lines)

### 1.1 `formattedDate` derived expression (6 sites)
- **Category:** Duplication
- **Files:** All 6 templates, lines 11-17 each
- **Pattern:** Identical 7-line `$derived` block computing `new Date(post.created_at).toLocaleDateString("en-US", ...)` in every template
- **Suggestion:** Extract `formatPostDate(created_at: string): string` to `lib/format.ts`

### 1.2 Repost display name/handle ternaries (6 sites)
- **Category:** Duplication
- **Files:** All 6 templates, header blocks
- **Pattern:** `{post.is_repost && post.original_user_name ? post.original_user_name : "wint"}` repeated in all 6; handle ternary in 5 (Threads omits handle). Bluesky uses `"dril.bsky.social"` fallback — a legitimate variance buried in copy-paste
- **Suggestion:** `resolveDisplayName(post)` and `resolveHandle(post, fallback)` in `lib/format.ts`

### 1.3 Repost banner text says "retweeted" on non-Twitter platforms (6 sites)
- **Category:** Inconsistency → correctness bug
- **Files:** All 6 templates, lines ~27-31
- **Pattern:** Identical `@dril retweeted` text in all 6, including Bluesky and Threads where the correct term is "reposted"
- **Suggestion:** Parameterize the verb per platform; fix Bluesky/Threads to say "reposted"

### 1.4 Full card DOM scaffold (6 sites)
- **Category:** Duplication (structural)
- **Files:** All 6 templates
- **Pattern:** Identical `article > reply-context? > repost-banner? > card-layout > avatar-col + content-col > header + text + quoted? + media? + engagement` structure in every template
- **Suggestion:** `PostCardLayout.svelte` base component with Svelte 5 snippets for era-specific header and engagement blocks

### 1.5 Quoted block markup (6 sites)
- **Category:** Duplication
- **Files:** All 6 templates, lines ~55-61
- **Pattern:** Identical `{#if post.is_quote && post.quoted_text}` block in all 6
- **Suggestion:** Absorbed into PostCardLayout (1.4)

### 1.6 MediaPlaceholder guard is redundant (6 sites)
- **Category:** Duplication + redundancy
- **Files:** All 6 templates, lines ~60-62
- **Pattern:** `{#if post.media.length > 0} <MediaPlaceholder .../> {/if}` — but MediaPlaceholder already checks `media.length > 0` internally
- **Suggestion:** Remove outer `{#if}` guard from all 6 templates

### 1.7 Reply context phrasing varies across templates (6 sites)
- **Category:** Inconsistency (intentional but undocumented)
- **Files:** All 6 templates, line ~23
- **Pattern:** Six different phrasings: "replying to" (Classic), "Replying to" (Modern/Material), "In reply to" (New), "Reply to" (Bluesky), "replying to" (Threads). Likely era-accurate but undocumented
- **Suggestion:** Extract `REPLY_LABELS` map keyed by ThemeId in `lib/format.ts`; add source comments

### 1.8 Repost banner `padding-left` offset has 2px bug in TwitterNew (6 sites)
- **Category:** Inconsistency → correctness bug
- **Files:** `TwitterNew.svelte` line 182
- **Pattern:** `padding-left: 60px` but avatar is 48px + gap is 10px = 58px. The 60px value is from the 12px-gap templates, copy-pasted incorrectly
- **Suggestion:** Fix to `58px`, or better: use `calc(var(--avatar-size) + var(--card-gap))`

### 1.9 `margin-bottom: 8px` on card root (6 sites)
- **Category:** Duplication + wrong responsibility
- **Files:** All 6 templates, card root class
- **Pattern:** Self-imposed margin that should be the parent container's `gap`
- **Suggestion:** Remove from all templates; add `gap: 8px` to result list container

| # | Pattern | Category | Sites | Priority |
|---|---------|----------|-------|----------|
| 1.1 | formattedDate | Duplication | 6 | Tier 1 |
| 1.2 | name/handle ternaries | Duplication | 6 | Tier 1 |
| 1.3 | "retweeted" on non-Twitter | Inconsistency → bug | 2 | Tier 1+ |
| 1.4 | card DOM scaffold | Duplication | 6 | Tier 2 |
| 1.5 | quoted block markup | Duplication | 6 | Tier 2 |
| 1.6 | redundant media guard | Duplication | 6 | Tier 1 |
| 1.7 | reply context phrasing | Inconsistency | 6 | Tier 4 |
| 1.8 | TwitterNew padding bug | Inconsistency → bug | 1 | Tier 1+ |
| 1.9 | card margin-bottom | Wrong responsibility | 6 | Tier 4 |

---

## Domain 2: Components (6 files, ~850 lines)

### 2.1 Repeated `<select>` control block in Controls.svelte (4 sites)
- **Category:** Duplication
- **Files:** `Controls.svelte` lines 76-132
- **Pattern:** Four identical `<div class="control-group"><label/><select/></div>` blocks differing only in label, id, options, and handler. Each repeats `(e.target as HTMLSelectElement).value` cast
- **Suggestion:** Extract `SelectControl.svelte` component; reduces ~56 lines to 4 invocations

### 2.2 PostCard is a god-component (1 file, 280 lines)
- **Category:** Structural
- **Files:** `PostCard.svelte`
- **Pattern:** Manages theme resolution, URL construction, long-press gesture, hover menu, html2canvas lazy loading, blob URL lifecycle, screenshot modal UI, and template dispatch. Screenshot feature accounts for ~150 lines (code + CSS)
- **Suggestion:** Extract `ScreenshotOverlay.svelte` or a `lib/screenshot.ts` rune-based helper

### 2.3 `stopPropagation` inconsistency (1 file, 2 sites)
- **Category:** Inconsistency
- **Files:** `PostCard.svelte` lines 27, 111-113
- **Pattern:** Named handler `handleMoreClick` calls `e.stopPropagation()` but popover uses inline `onclick/onkeydown` stopPropagation. The `onkeydown` stopPropagation on the popover is likely dead code
- **Suggestion:** Audit; remove dead `onkeydown` handler

### 2.4 Keyboard accessibility inconsistency (1 file, 2 overlays)
- **Category:** Inconsistency
- **Files:** `PostCard.svelte` lines 107-143
- **Pattern:** Popover has no Escape handler; screenshot overlay has Escape on `tabindex="-1"` div (can't receive focus). Two `svelte-ignore` comments suppress a11y warnings
- **Suggestion:** Fix both overlays; consider shared `Modal.svelte` if more overlays are added

### 2.5 `639px` breakpoint magic number (8+ sites across codebase)
- **Category:** Duplication
- **Files:** `SearchBar.svelte`, `Controls.svelte`, `App.svelte`, all 6 templates
- **Pattern:** `@media (max-width: 639px)` hardcoded in 8+ files with no central definition
- **Suggestion:** Document as project constant; cannot use CSS custom properties in media queries without PostCSS

### 2.6 MediaPlaceholder uses light palette vs dark shell (1 file)
- **Category:** Inconsistency
- **Files:** `MediaPlaceholder.svelte`
- **Pattern:** `background: #f0f0f0`, `color: #666` vs shell's `#2a2a2a`, `#e0e0e0`. Intentional (inside light card), but the only component not using shell design tokens
- **Suggestion:** Document as intentional exception

| # | Pattern | Category | Sites | Priority |
|---|---------|----------|-------|----------|
| 2.1 | select control blocks | Duplication | 4 | Tier 1 |
| 2.2 | PostCard god-component | Structural | 1 | Tier 2 |
| 2.3 | stopPropagation inconsistency | Inconsistency | 2 | Tier 4 |
| 2.4 | keyboard a11y gaps | Inconsistency | 2 | Tier 3 |
| 2.5 | 639px magic number | Duplication | 8+ | Tier 4 |
| 2.6 | light vs dark palette | Inconsistency | 1 | Tier 4 |

---

## Domain 3: Styles (8 CSS files, ~340 lines)

### 3.1 Four Twitter CSS files are verbatim structural duplicates (~50 lines × 4)
- **Category:** Duplication
- **Files:** `twitter-{classic,modern,new,material}.css` lines ~21-74
- **Pattern:** All rule bodies after the variable block are letter-for-letter identical. Only the `[data-theme="..."]` selector prefix differs
- **Suggestion:** Extract `base-post.css` with shared rules; era files keep only `--var` declarations

### 3.2 External CSS files likely target non-existent classes (dead code)
- **Category:** Structural
- **Files:** All `twitter-*.css` files
- **Pattern:** External CSS targets `.post-avatar`, `.post-text`, `.post-engagement` etc. Svelte templates use `.avatar`, `.text`, `.engagement` (no `post-` prefix). No `data-theme` attribute is set on any rendered element
- **Suggestion:** Verify against PostCard wrapper. If unused, delete all 4 external Twitter CSS files

### 3.3 `bluesky.css` and `threads.css` use `:root` not `[data-theme]` (2 files)
- **Category:** Inconsistency → architectural divergence
- **Files:** `bluesky.css`, `threads.css`
- **Pattern:** Variables defined on `:root` (global), not scoped to `[data-theme]`. Will overwrite each other when co-loaded. Also missing several variables defined in Twitter files
- **Suggestion:** Either scope to `[data-theme]` and complete variable set, or delete if unused stubs

### 3.4 `app.css` hardcodes values already defined in `global.css` (4 sites)
- **Category:** Inconsistency
- **Files:** `app.css` lines 9-10, 16, 31; `global.css` lines 2-9
- **Pattern:** `#1a1a1a` instead of `var(--shell-bg)`, `#e0e0e0` instead of `var(--shell-text)`, `#4a9eff` instead of `var(--shell-accent)`
- **Suggestion:** Replace literals with `var(--shell-*)` references

### 3.5 Svelte template `<style>` blocks duplicate structural layout rules (6 sites)
- **Category:** Duplication
- **Files:** All 6 template `<style>` blocks
- **Pattern:** `.avatar-col { flex-shrink: 0 }`, `.content-col { flex: 1; min-width: 0 }`, `.text { white-space: pre-wrap; word-wrap: break-word }` — identical in all 6. Layout gap varies (10px or 12px)
- **Suggestion:** Absorbed into PostCardLayout component (1.4)

### 3.6 `.engagement` `margin-top` has three different values (6 sites)
- **Category:** Inconsistency (value drift)
- **Files:** All 6 templates
- **Pattern:** Classic: 4px, New/Material: 6px, Modern/Bluesky/Threads: 8px — no clear era rationale for the variation
- **Suggestion:** Audit for intent; normalize or introduce `--engagement-margin-top`

### 3.7 TwitterClassic media query missing `.handle` shrink (1 file)
- **Category:** Inconsistency → likely bug
- **Files:** `TwitterClassic.svelte` lines 160-164
- **Pattern:** Only shrinks `.engagement` at 639px, while all other templates with `.handle`/`.separator` also shrink those. Classic has both elements but doesn't resize them
- **Suggestion:** Add `.handle`, `.separator`, `.timestamp` to Classic's media query

### 3.8 `.quoted` border uses variables in external CSS but literals in Svelte (8 sites)
- **Category:** Inconsistency (parallel systems)
- **Files:** `twitter-*.css` use `var(--meta-color)` for `.post-quoted` border; Svelte templates hardcode hex values
- **Suggestion:** If external CSS files are dead (3.2), this is moot. Otherwise, standardize approach

| # | Pattern | Category | Sites | Priority |
|---|---------|----------|-------|----------|
| 3.1 | Twitter CSS verbatim duplication | Duplication | 4 | Tier 2 |
| 3.2 | External CSS targets wrong classes | Structural (dead code) | 4 | Tier 1 |
| 3.3 | bluesky/threads use `:root` | Inconsistency | 2 | Tier 3 |
| 3.4 | app.css ignores global.css vars | Inconsistency | 4 | Tier 1 |
| 3.5 | Template layout rules duplication | Duplication | 6 | Tier 2 |
| 3.6 | engagement margin-top drift | Inconsistency | 6 | Tier 4 |
| 3.7 | Classic missing responsive rules | Inconsistency → bug | 1 | Tier 1+ |
| 3.8 | var() vs literals for borders | Inconsistency | 8 | Tier 4 |

---

## Domain 4: Lib + Core Logic (6 files, ~650 lines)

### 4.1 `platformMap` duplicated in `search-worker.ts` (2 sites)
- **Category:** Duplication
- **Files:** `search-worker.ts` lines 134-138 and 287-293
- **Pattern:** Identical `Record<string, string>` map `{ x: "x", bsky: "bsky", threads: "threads" }` declared independently in `buildFilterClauses` and `getTotalCount`
- **Suggestion:** Extract module-level `PLATFORM_DB_MAP` constant; or eliminate the map entirely since keys === values

### 4.2 `getTotalCount` doesn't use `buildFilterClauses` for reposts (1 site)
- **Category:** Inconsistency → silent correctness issue
- **Files:** `search-worker.ts` lines 284-298
- **Pattern:** `getTotalCount` calls `buildFilterClauses` for the posts arm but re-implements platform filtering independently for reposts. The type filter (`original`, `replies`, `quotes`) is silently dropped for reposts
- **Suggestion:** Either extend `buildFilterClauses` with a `tableAlias` param, or document that type filter intentionally doesn't apply to reposts

### 4.3 Worker response messages have no type definition (asymmetric types)
- **Category:** Inconsistency
- **Files:** `search-worker.ts` lines 7-16 (incoming `WorkerMessage`); `db.ts` lines 17-29 (untyped `msg.type` comparisons)
- **Pattern:** Messages sent TO worker are typed (`WorkerMessage`). Messages sent FROM worker (`progress`, `ready`, `error`, `results`) are untyped — `db.ts` uses raw string comparisons
- **Suggestion:** Define `WorkerResponse` discriminated union in `types.ts`

### 4.4 `SearchResult` partially mirrors worker `results` message (2 sites)
- **Category:** Duplication (type)
- **Files:** `db.ts` lines 38-41; `search-worker.ts` line 264
- **Pattern:** `SearchResult = { results: Post[]; totalCount: number }` duplicates the worker's outgoing shape minus `type` and `id`
- **Suggestion:** Derive from `WorkerResponse` if introduced: `Omit<Extract<WorkerResponse, {type: "results"}>, "type" | "id">`

### 4.5 Platform string literals scattered across 4 files (many sites)
- **Category:** Inconsistency
- **Files:** `types.ts`, `themes.ts`, `search.ts`, `search-worker.ts`
- **Pattern:** `"bsky"`, `"threads"`, `"x"` appear as bare literals in 4 files. No shared `Platform` type ties `PlatformFilter`, `Post.platform`, `ThemeId`, and `postUrl` together
- **Suggestion:** Add `type Platform = "x" | "bsky" | "threads"` to `types.ts`; type `Post.platform` as `Platform`

### 4.6 `ALL_THEMES` and `THEME_LABELS` are parallel structures (1 file)
- **Category:** Duplication (maintenance risk)
- **Files:** `themes.ts` lines 22-40
- **Pattern:** Manually ordered array + Record must stay in sync. Adding a theme to one but not the other silently drops it from the dropdown
- **Suggestion:** Derive `ALL_THEMES` from `THEME_LABELS`: `Object.keys(THEME_LABELS) as (ThemeId | "auto")[]`

### 4.7 `postProgress` message construction (3 sites)
- **Category:** Duplication (minor)
- **Files:** `search-worker.ts` lines 37-41, 59-63, 84-88
- **Pattern:** `self.postMessage({ type: "progress", received, total, phase })` constructed inline in 3 places
- **Suggestion:** Extract `postProgress(received, total, phase)` helper within search-worker.ts

### 4.8 Error serialization pattern (2 sites)
- **Category:** Duplication (minor)
- **Files:** `search-worker.ts` line 77; `App.svelte` line 45
- **Pattern:** `err instanceof Error ? err.message : String(err)` repeated
- **Suggestion:** `errorMessage(err: unknown): string` in `lib/format.ts`

| # | Pattern | Category | Sites | Priority |
|---|---------|----------|-------|----------|
| 4.1 | platformMap duplication | Duplication | 2 | Tier 1 |
| 4.2 | getTotalCount filter gap | Inconsistency | 1 | Tier 1+ |
| 4.3 | untyped worker responses | Inconsistency | 2 | Tier 2 |
| 4.4 | SearchResult type overlap | Duplication | 2 | Tier 2 |
| 4.5 | platform string literals | Inconsistency | 4 | Tier 2 |
| 4.6 | ALL_THEMES parallel array | Duplication | 1 | Tier 1 |
| 4.7 | postProgress construction | Duplication | 3 | Tier 4 |
| 4.8 | error serialization | Duplication | 2 | Tier 4 |

---

## Cross-Domain Findings

### X.1 External `site/src/styles/twitter-*.css` files appear to be dead code
- **Category:** Structural
- **Pattern:** External CSS targets `.post-avatar`, `.post-text` class names that don't exist in any Svelte template. Templates use `.avatar`, `.text`. No `data-theme` attribute is applied. The Svelte scoped `<style>` blocks provide all styling. `bluesky.css` and `threads.css` are variable-only stubs on `:root`
- **Impact:** 6 CSS files (~330 lines) may be entirely unused. If confirmed dead, removing them eliminates findings 3.1, 3.2, 3.3, 3.8 and simplifies the style architecture

### X.2 Template CSS and external CSS are a dual system with no clear ownership
- **Category:** Structural
- **Pattern:** Two complete styling systems exist in parallel — Svelte-scoped `<style>` blocks (which are active) and external `site/src/styles/*.css` files (which may be dead). The external files use CSS custom properties properly; the Svelte blocks hardcode values
- **Suggestion:** Resolve by verifying 3.2, then either delete external CSS or migrate Svelte styles to use them

---

## Priority Matrix

### Tier 1+ — Correctness bugs
| Finding | Description |
|---------|-------------|
| 1.3 | "retweeted" text on Bluesky/Threads (should be "reposted") |
| 1.8 | TwitterNew repost banner 2px padding misalignment |
| 3.7 | TwitterClassic media query missing `.handle`/`.separator`/`.timestamp` |
| 4.2 | `getTotalCount` silently drops type filter for reposts |

### Tier 1 — High impact, low risk
| Finding | Description |
|---------|-------------|
| 1.1 | Extract `formatPostDate` (6 copy-paste sites) |
| 1.2 | Extract `resolveDisplayName`/`resolveHandle` (6 sites) |
| 1.6 | Remove redundant media `{#if}` guards (6 sites) |
| 2.1 | Extract `SelectControl.svelte` (4 repeated blocks) |
| 3.2 | Verify and delete dead external CSS files |
| 3.4 | Wire `app.css` to use `global.css` variables |
| 4.1 | Hoist `platformMap` to module-level constant |
| 4.6 | Derive `ALL_THEMES` from `THEME_LABELS` |

### Tier 2 — High impact, moderate complexity
| Finding | Description |
|---------|-------------|
| 1.4+1.5 | `PostCardLayout.svelte` with Svelte 5 snippets |
| 2.2 | Extract screenshot feature from PostCard |
| 3.1+3.5 | Shared post card layout CSS (absorbed by 1.4) |
| 4.3+4.4 | `WorkerResponse` union type |
| 4.5 | `Platform` type unifying string literals |

### Tier 3 — Safety nets
| Finding | Description |
|---------|-------------|
| 2.4 | Fix keyboard a11y on PostCard overlays |
| 3.3 | Fix bluesky/threads CSS scoping (if files retained) |

### Tier 4 — Nice-to-have cleanup
| Finding | Description |
|---------|-------------|
| 1.7 | Document reply context phrasing as intentional |
| 1.9 | Move card `margin-bottom` to parent gap |
| 2.3 | Audit stopPropagation patterns |
| 2.5 | Document 639px breakpoint constant |
| 2.6 | Document MediaPlaceholder light palette |
| 3.6 | Audit engagement margin-top drift |
| 3.8 | Standardize var() vs literals for borders |
| 4.7 | Extract `postProgress` helper |
| 4.8 | Extract `errorMessage` helper |

---

## Implementation Batches

### Batch A — Quick wins and bug fixes (Tier 1+ and Tier 1, no overlap)
**Touches:** all 6 templates, `Controls.svelte`, `app.css`, `search-worker.ts`, `themes.ts`
**New files:** `lib/format.ts`, `components/SelectControl.svelte`

1. Create `lib/format.ts` with `formatPostDate`, `resolveDisplayName`, `resolveHandle`
2. Update all 6 templates to use helpers (1.1, 1.2)
3. Fix "retweeted" → "reposted" in Bluesky/Threads (1.3)
4. Fix TwitterNew padding-left 60→58px (1.8)
5. Fix TwitterClassic media query scope (3.7)
6. Remove redundant media `{#if}` guards (1.6)
7. Extract `SelectControl.svelte` from Controls (2.1)
8. Wire `app.css` to use `var(--shell-*)` references (3.4)
9. Hoist `platformMap` to module constant in search-worker.ts (4.1)
10. Derive `ALL_THEMES` from `THEME_LABELS` (4.6)

### Batch B — Type safety (Tier 2, lib/ only)
**Touches:** `types.ts`, `db.ts`, `search-worker.ts`, `themes.ts`, `search.ts`

1. Add `Platform` type to `types.ts`, narrow `Post.platform` (4.5)
2. Define `WorkerResponse` discriminated union (4.3)
3. Derive `SearchResult` from `WorkerResponse` (4.4)
4. Fix `getTotalCount` to use `buildFilterClauses` for reposts (4.2)

### Batch C — PostCardLayout extraction (Tier 2, templates + components)
**Touches:** all 6 templates, new `PostCardLayout.svelte`

1. Create `PostCardLayout.svelte` with Svelte 5 snippets
2. Migrate all 6 templates to use it (1.4, 1.5, 3.5)
3. Use CSS custom properties for avatar offset (1.8 systemic fix)
4. Move `margin-bottom` to parent gap (1.9)

### Batch D — Dead code cleanup (Tier 1-3, styles only)
**Touches:** `site/src/styles/`, `PostCard.svelte` (verification only)

1. Verify external CSS files are unused (3.2)
2. If confirmed dead: delete all 6 external CSS files
3. If retained: fix bluesky/threads scoping (3.3), complete variable sets

### Batch E — PostCard decomposition (Tier 2, components)
**Touches:** `PostCard.svelte`, new `ScreenshotOverlay.svelte`

1. Extract screenshot overlay + html2canvas logic (2.2)
2. Fix keyboard a11y on both overlays (2.4)

**Dependencies:** Batch A is independent. Batch B is independent. Batch C depends on A (helpers exist). Batch D is independent. Batch E is independent. Batches A, B, D, and E can all run in parallel.

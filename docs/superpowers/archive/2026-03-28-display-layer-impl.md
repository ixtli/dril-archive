# Display Layer Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the vanilla HTML/JS/CSS frontend with a Svelte 5 + Vite app that renders era-themed post cards with a controls panel for sort, filter, and theme override.

**Architecture:** The Svelte app lives in `site/` with Vite as the build tool. Each Twitter era and platform gets its own Svelte template component with scoped CSS (no style leakage). A dispatcher component (`PostCard.svelte`) selects the correct template based on era detection or user theme override. The data layer ports the existing SQLite WASM loading and FTS5 search logic into TypeScript modules, extended with sort/filter support for the controls panel.

**Tech Stack:** Svelte 5, Vite, TypeScript, `@sqlite.org/sqlite-wasm`, Prettier + eslint (Svelte), Biome (non-Svelte), Playwright

---

## File Map

**Create:**
- `site/package.json` — Svelte app dependencies and scripts
- `site/vite.config.ts` — Vite config with Svelte plugin and SQLite WASM exclusion
- `site/svelte.config.js` — Svelte preprocessor config
- `site/tsconfig.json` — TypeScript config for the Svelte app
- `site/.eslintrc.cjs` — ESLint config for Svelte + TypeScript
- `site/.prettierrc` — Prettier config with svelte plugin
- `site/index.html` — Vite entry point (replaces current)
- `site/src/main.ts` — Svelte app mount point
- `site/src/App.svelte` — Root component: loading, search, controls, results
- `site/src/app.css` — Global styles (dark shell, responsive layout)
- `site/src/lib/db.ts` — SQLite WASM loading with progress callback
- `site/src/lib/search.ts` — FTS5 query building, debounce, sort/filter query composition
- `site/src/lib/themes.ts` — Era detection, theme registry, ThemeId type
- `site/src/lib/types.ts` — Shared TypeScript types (Post, SortOption, FilterState, etc.)
- `site/src/components/SearchBar.svelte` — Search input + cog toggle
- `site/src/components/Controls.svelte` — Collapsible sort/filter/theme panel
- `site/src/components/PostCard.svelte` — Template dispatcher
- `site/src/components/LoadingBar.svelte` — Progress bar + spinner
- `site/src/templates/TwitterClassic.svelte` — 2008-2010 era card
- `site/src/templates/TwitterNew.svelte` — 2010-2014 era card
- `site/src/templates/TwitterMaterial.svelte` — 2014-2019 era card
- `site/src/templates/TwitterModern.svelte` — 2019-2023 era card
- `site/src/templates/Bluesky.svelte` — Bluesky platform card
- `site/src/templates/Threads.svelte` — Threads platform card
- `site/src/styles/twitter-classic.css` — Classic era theme variables (from theme-extractor)
- `site/src/styles/twitter-new.css` — New era theme variables (from theme-extractor)
- `site/src/styles/twitter-material.css` — Material era theme variables (from theme-extractor)
- `site/src/styles/twitter-modern.css` — Modern era theme variables (from theme-extractor)
- `site/src/styles/bluesky.css` — Bluesky theme variables (placeholder)
- `site/src/styles/threads.css` — Threads theme variables (placeholder)
- `site/src/styles/global.css` — Dark theme shell variables

**Modify:**
- `.pre-commit-config.yaml` — Add prettier/eslint/svelte-check hooks, scope biome to exclude `site/src/`
- `package.json` — Update root scripts for Vite dev/build
- `scripts/dev.ts` — Update to run Vite dev server instead of Bun.serve
- `playwright.config.ts` — Point at Vite dev server
- `e2e/search.spec.ts` — Adapt selectors + add new display layer tests
- `CLAUDE.md` — Update to reflect Svelte stack
- `README.md` — Document Svelte + Vite stack, dual formatter boundary, updated commands
- `.github/workflows/deploy.yml` — Build Svelte app and deploy `site/dist/`

**Delete (Task 12):**
- `site/app.js` — replaced by Svelte app
- `site/style.css` — replaced by `site/src/app.css` + scoped component styles

---

### Task 1: Scaffold Svelte + Vite Project

**Files:**
- Create: `site/package.json`
- Create: `site/vite.config.ts`
- Create: `site/svelte.config.js`
- Create: `site/tsconfig.json`
- Create: `site/index.html`
- Create: `site/src/main.ts`

- [ ] **Step 1: Create `site/package.json`**

Create `site/package.json`:

```json
{
  "name": "dril-archive-site",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --port 4173",
    "check": "svelte-check --tsconfig ./tsconfig.json"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^5.0.0",
    "@tsconfig/svelte": "^5.0.0",
    "svelte": "^5.0.0",
    "svelte-check": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  },
  "dependencies": {
    "@sqlite.org/sqlite-wasm": "^3.51.2-build8"
  }
}
```

- [ ] **Step 2: Create `site/vite.config.ts`**

Create `site/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
  server: {
    port: 3000,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  preview: {
    port: 4173,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
```

Note: The COOP/COEP headers are required for `SharedArrayBuffer` which SQLite WASM uses for optimal performance. Without them, SQLite falls back to a slower mode.

- [ ] **Step 3: Create `site/svelte.config.js`**

Create `site/svelte.config.js`:

```javascript
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess(),
};
```

- [ ] **Step 4: Create `site/tsconfig.json`**

Create `site/tsconfig.json`:

```json
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "resolveJsonModule": true,
    "allowJs": true,
    "checkJs": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src/**/*.ts", "src/**/*.svelte"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `site/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Create Vite entry point `site/index.html`**

Create `site/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>dril archive</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Create app mount point `site/src/main.ts`**

Create `site/src/main.ts`:

```typescript
import { mount } from "svelte";
import App from "./App.svelte";
import "./app.css";

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
```

- [ ] **Step 7: Create placeholder `site/src/App.svelte`**

Create `site/src/App.svelte`:

```svelte
<script lang="ts">
  let message = $state("dril archive - Svelte app loading");
</script>

<main>
  <h1>{message}</h1>
</main>
```

This is a placeholder to verify the scaffold works. It will be replaced in Task 4.

- [ ] **Step 8: Create placeholder `site/src/app.css`**

Create `site/src/app.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
  background: #1a1a1a;
  color: #e0e0e0;
}
```

This is a minimal placeholder. Full global styles are added in Task 8.

- [ ] **Step 9: Copy SQLite WASM files to `site/public/sqlite3/`**

Run:
```bash
mkdir -p site/public/sqlite3
cp node_modules/@sqlite.org/sqlite-wasm/dist/index.mjs site/public/sqlite3/index.mjs
cp node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3.wasm site/public/sqlite3/sqlite3.wasm
```

These files must be in `public/` so Vite serves them as static assets without bundling. The `optimizeDeps.exclude` in `vite.config.ts` prevents Vite from trying to pre-bundle the package, and placing the files in `public/sqlite3/` makes them accessible at `/sqlite3/index.mjs` at runtime.

- [ ] **Step 10: Install dependencies and verify build**

Run:
```bash
cd site && bun install
```

Expected: `bun.lock` created, `node_modules/` populated.

Run:
```bash
cd site && bunx vite build
```

Expected: Build succeeds, output in `site/dist/`. Console shows bundle size.

- [ ] **Step 11: Add `site/dist/` and `site/node_modules/` to `.gitignore`**

Check if `.gitignore` already has these entries. If not, append:

```
site/dist/
site/node_modules/
```

- [ ] **Step 12: Commit scaffold**

```bash
git add site/package.json site/vite.config.ts site/svelte.config.js site/tsconfig.json site/tsconfig.node.json site/index.html site/src/main.ts site/src/App.svelte site/src/app.css .gitignore
git commit -m "feat(site): scaffold Svelte 5 + Vite project"
```

---

### Task 2: Tooling Setup (Prettier, ESLint, svelte-check, Pre-commit Hooks)

**Files:**
- Create: `site/.prettierrc`
- Create: `site/.eslintrc.cjs`
- Modify: `.pre-commit-config.yaml`

- [ ] **Step 1: Install formatting/linting dependencies in `site/`**

Run:
```bash
cd site && bun add -d prettier prettier-plugin-svelte "eslint@^8" eslint-plugin-svelte @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

Expected: packages added to `site/package.json` devDependencies.

Note: ESLint is pinned to v8 (`"eslint@^8"`) because `.eslintrc.cjs` uses the v8 config format. ESLint v9 requires a flat config (`eslint.config.js`), which is incompatible with `.eslintrc.cjs`.

- [ ] **Step 2: Create `site/.prettierrc`**

Create `site/.prettierrc`:

```json
{
  "plugins": ["prettier-plugin-svelte"],
  "overrides": [
    {
      "files": "*.svelte",
      "options": {
        "parser": "svelte"
      }
    }
  ],
  "useTabs": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 3: Create `site/.eslintrc.cjs`**

Create `site/.eslintrc.cjs`:

```javascript
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:svelte/recommended",
  ],
  plugins: ["@typescript-eslint"],
  parserOptions: {
    sourceType: "module",
    ecmaVersion: 2022,
    extraFileExtensions: [".svelte"],
  },
  env: {
    browser: true,
    es2022: true,
  },
  overrides: [
    {
      files: ["*.svelte"],
      parser: "svelte-eslint-parser",
      parserOptions: {
        parser: "@typescript-eslint/parser",
      },
    },
  ],
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_" },
    ],
  },
};
```

- [ ] **Step 4: Verify prettier works on Svelte files**

Run:
```bash
cd site && bunx prettier --check src/App.svelte
```

Expected: Either passes (already formatted) or shows a diff. Fix with `bunx prettier --write src/App.svelte` if needed.

- [ ] **Step 5: Verify eslint works on Svelte files**

Run:
```bash
cd site && bunx eslint src/App.svelte
```

Expected: No errors (or only warnings).

- [ ] **Step 6: Verify svelte-check works**

Run:
```bash
cd site && bunx svelte-check
```

Expected: 0 errors, 0 warnings (on the placeholder App.svelte).

- [ ] **Step 7: Update `.pre-commit-config.yaml`**

Replace the entire contents of `.pre-commit-config.yaml` with:

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
        entry: bash -c 'cd site && bunx prettier --check "$@"' --
        language: system
        files: ^site/src/.*\.(svelte|ts|css|html)$
        pass_filenames: true

      - id: eslint
        name: eslint (svelte app)
        entry: bash -c 'cd site && bunx eslint "$@"' --
        language: system
        files: ^site/src/.*\.(svelte|ts)$
        pass_filenames: true

      - id: svelte-check
        name: svelte-check
        entry: bash -c 'cd site && bunx svelte-check'
        language: system
        files: ^site/src/
        pass_filenames: false
```

Key changes from the current config:
- `cargo-clippy` now uses `--workspace` flag
- `biome-format` and `biome-lint` exclude `^site/src/` so they don't conflict with prettier
- Three new hooks: `prettier`, `eslint`, `svelte-check` scoped to `site/src/`
- Uses `files:` regex patterns instead of `types: [svelte]` (which pre-commit does not recognize)
- The prettier and eslint hooks use `bash -c 'cd site && ...'` to run from the `site/` directory where configs live

- [ ] **Step 8: Test pre-commit hooks**

Run:
```bash
pre-commit run --all-files
```

Expected: All hooks pass. If prettier reformats files, fix them and re-run.

- [ ] **Step 9: Commit tooling setup**

```bash
git add site/.prettierrc site/.eslintrc.cjs site/package.json site/bun.lock .pre-commit-config.yaml
git commit -m "chore(site): add prettier, eslint, svelte-check configs and update pre-commit hooks"
```

---

### Task 2b: Extract Theme CSS Files

**Files:**
- Create: `site/src/styles/twitter-classic.css`
- Create: `site/src/styles/twitter-new.css`
- Create: `site/src/styles/twitter-material.css`
- Create: `site/src/styles/twitter-modern.css`
- Create: `site/src/styles/bluesky.css`
- Create: `site/src/styles/threads.css`
- Create: `site/src/styles/global.css`

The spec requires template components to import from `site/src/styles/*.css` files rather than inlining all CSS in `<style>` blocks. The 4 Twitter era CSS files are copied from `theme-extractor/output/themes/` and define CSS custom properties (variables) for each era. Bluesky and Threads get placeholder files. `global.css` holds the dark theme shell variables.

- [ ] **Step 1: Create `site/src/styles/` directory**

```bash
mkdir -p site/src/styles
```

- [ ] **Step 2: Copy the 4 Twitter era CSS files from theme-extractor output**

```bash
cp theme-extractor/output/themes/twitter-classic.css site/src/styles/twitter-classic.css
cp theme-extractor/output/themes/twitter-new.css site/src/styles/twitter-new.css
cp theme-extractor/output/themes/twitter-material.css site/src/styles/twitter-material.css
cp theme-extractor/output/themes/twitter-modern.css site/src/styles/twitter-modern.css
```

- [ ] **Step 3: Create `site/src/styles/bluesky.css` placeholder**

Create `site/src/styles/bluesky.css`:

```css
/* Bluesky theme variables — placeholder derived from current Bluesky web design */
:root {
  --card-bg: #fff;
  --card-border: 1px solid #e4e6eb;
  --card-border-radius: 12px;
  --card-padding: 14px 16px;
  --text-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --text-size: 15px;
  --text-color: #1a1a1a;
  --meta-color: #8a8a8a;
  --meta-size: 13px;
  --link-color: #0085ff;
  --avatar-size: 42px;
  --avatar-radius: 50%;
}
```

- [ ] **Step 4: Create `site/src/styles/threads.css` placeholder**

Create `site/src/styles/threads.css`:

```css
/* Threads theme variables — placeholder derived from current Threads web design */
:root {
  --card-bg: #fff;
  --card-border: none;
  --card-border-bottom: 1px solid #e0e0e0;
  --card-border-radius: 0;
  --card-padding: 16px;
  --text-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --text-size: 15px;
  --text-color: #000;
  --meta-color: #999;
  --meta-size: 14px;
  --link-color: #000;
  --avatar-size: 40px;
  --avatar-radius: 50%;
}
```

- [ ] **Step 5: Create `site/src/styles/global.css`**

Create `site/src/styles/global.css`:

```css
/* Global dark theme shell — wraps the light-themed post cards */
:root {
  --shell-bg: #1a1a1a;
  --shell-text: #e0e0e0;
  --shell-muted: #888;
  --shell-border: #333;
  --shell-input-bg: #2a2a2a;
  --shell-input-border: #444;
  --shell-accent: #4a9eff;
}
```

- [ ] **Step 6: Commit theme CSS files**

```bash
git add site/src/styles/
git commit -m "feat(site): add theme CSS files (copied from theme-extractor + placeholders)"
```

> **Important for Tasks 5 and 6:** Template components should import their corresponding CSS file from `site/src/styles/` and reference the CSS custom properties defined there, rather than hardcoding color/font values in the `<style>` block. For example, in `TwitterClassic.svelte`, add `@import '../styles/twitter-classic.css';` at the top of the `<style>` block, then use `var(--card-bg)`, `var(--text-font)`, etc. in the CSS rules. The `<style>` blocks should contain layout rules and reference the CSS variables for theme-specific values (colors, fonts, sizes). This keeps the theme definitions in one place and allows future theme customization without editing Svelte components.

---

### Task 3: Core Data Layer

**Files:**
- Create: `site/src/lib/types.ts`
- Create: `site/src/lib/themes.ts`
- Create: `site/src/lib/db.ts`
- Create: `site/src/lib/search.ts`

- [ ] **Step 1: Create `site/src/lib/types.ts`**

Create `site/src/lib/types.ts`:

```typescript
export type ThemeId =
  | "twitter-classic"
  | "twitter-new"
  | "twitter-material"
  | "twitter-modern"
  | "bsky"
  | "threads";

export type SortOption = "relevance" | "newest" | "oldest" | "most-liked" | "most-shared";

export type PlatformFilter = "all" | "x" | "bsky" | "threads";

export type TypeFilter = "all" | "original" | "replies" | "quotes";

export interface FilterState {
  platform: PlatformFilter;
  type: TypeFilter;
}

export interface Post {
  id: string;
  text: string;
  created_at: string;
  is_reply: boolean;
  reply_to_user: string | null;
  is_quote: boolean;
  quoted_text: string | null;
  likes: number;
  shares: number;
  platform: string;
}

export interface SearchState {
  query: string;
  sort: SortOption;
  filters: FilterState;
  themeOverride: ThemeId | "auto";
}
```

- [ ] **Step 2: Create `site/src/lib/themes.ts`**

Create `site/src/lib/themes.ts`:

```typescript
import type { ThemeId } from "./types";

export function getAutoTheme(platform: string, createdAt: string): ThemeId {
  if (platform === "bsky") return "bsky";
  if (platform === "threads") return "threads";
  const d = new Date(createdAt);
  if (d < new Date("2010-09-01")) return "twitter-classic";
  if (d < new Date("2014-06-01")) return "twitter-new";
  if (d < new Date("2019-07-15")) return "twitter-material";
  return "twitter-modern";
}

export function resolveTheme(
  platform: string,
  createdAt: string,
  override: ThemeId | "auto",
): ThemeId {
  if (override !== "auto") return override;
  return getAutoTheme(platform, createdAt);
}

export const THEME_LABELS: Record<ThemeId | "auto", string> = {
  auto: "Auto (era-correct)",
  "twitter-classic": "Twitter Classic (2008-2010)",
  "twitter-new": "Twitter New (2010-2014)",
  "twitter-material": "Twitter Material (2014-2019)",
  "twitter-modern": "Twitter Modern (2019-2023)",
  bsky: "Bluesky",
  threads: "Threads",
};

export const ALL_THEMES: (ThemeId | "auto")[] = [
  "auto",
  "twitter-classic",
  "twitter-new",
  "twitter-material",
  "twitter-modern",
  "bsky",
  "threads",
];
```

- [ ] **Step 3: Create `site/src/lib/db.ts`**

Port the SQLite WASM loading logic from `site/app.js` into TypeScript.

Create `site/src/lib/db.ts`:

```typescript
type ProgressCallback = (received: number, total: number, phase: string) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;

const DB_URL = "dril.db";

async function fetchWithProgress(
  url: string,
  onProgress: ProgressCallback,
): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const contentLength = response.headers.get("Content-Length");
  if (!contentLength || !response.body) {
    onProgress(0, 0, "Downloading archive...");
    const buf = await response.arrayBuffer();
    return new Uint8Array(buf);
  }

  const total = parseInt(contentLength, 10);
  let received = 0;
  const chunks: Uint8Array[] = [];
  const reader = response.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(received, total, "Downloading archive...");
  }

  const result = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export async function initDb(onProgress: ProgressCallback): Promise<void> {
  const dbData = await fetchWithProgress(DB_URL, onProgress);

  onProgress(dbData.length, dbData.length, "Preparing search...");

  const sqlite3InitModule = (await import("/sqlite3/index.mjs")).default;
  const sqlite3 = await sqlite3InitModule();

  sqlite3.capi.sqlite3_js_posix_create_file("/dril.db", dbData);
  db = new sqlite3.oo1.DB("/dril.db", "r");
}

export function getDb() {
  return db;
}

export function isDbReady(): boolean {
  return db !== null;
}
```

- [ ] **Step 4: Create `site/src/lib/search.ts`**

Port the search logic from `site/app.js` and extend with sort/filter support.

Create `site/src/lib/search.ts`:

```typescript
import type { Post, SortOption, FilterState } from "./types";
import { getDb } from "./db";

export function buildFtsQuery(input: string): string {
  const terms = input
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => t.replace(/["*^()]/g, ""))
    .filter((t) => t.length > 0)
    .map((t) => `"${t}"*`);
  return terms.join(" ");
}

export function postUrl(platform: string, id: string): string {
  switch (platform) {
    case "threads":
      return `https://www.threads.com/@dril/post/${id}`;
    case "bsky":
      return `https://bsky.app/profile/dril.bsky.social/post/${id}`;
    default:
      return `https://x.com/dril/status/${id}`;
  }
}

function buildSortClause(sort: SortOption): string {
  switch (sort) {
    case "relevance":
      return "ORDER BY rank";
    case "newest":
      return "ORDER BY t.created_at DESC";
    case "oldest":
      return "ORDER BY t.created_at ASC";
    case "most-liked":
      return "ORDER BY t.likes DESC";
    case "most-shared":
      return "ORDER BY t.shares DESC";
  }
}

function buildFilterClauses(filters: FilterState): { clauses: string[]; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.platform !== "all") {
    const platformMap: Record<string, string> = {
      x: "x",
      bsky: "bsky",
      threads: "threads",
    };
    clauses.push("AND t.platform = ?");
    params.push(platformMap[filters.platform]);
  }

  if (filters.type === "original") {
    clauses.push("AND t.is_reply = 0 AND t.is_quote = 0");
  } else if (filters.type === "replies") {
    clauses.push("AND t.is_reply = 1");
  } else if (filters.type === "quotes") {
    clauses.push("AND t.is_quote = 1");
  }

  return { clauses, params };
}

export function executeSearch(
  input: string,
  sort: SortOption,
  filters: FilterState,
): Post[] {
  const db = getDb();
  if (!db) return [];

  const ftsQuery = buildFtsQuery(input);
  if (!ftsQuery) return [];

  const { clauses, params } = buildFilterClauses(filters);
  const sortClause = buildSortClause(sort);
  const filterSql = clauses.join("\n    ");

  const sql = `
    SELECT t.id, t.text, t.created_at, t.is_reply, t.reply_to_user,
           t.is_quote, t.quoted_text, t.likes, t.shares, t.platform
    FROM posts_fts f
    JOIN posts t ON t.rowid = f.rowid
    WHERE posts_fts MATCH ?
    ${filterSql}
    ${sortClause}
    LIMIT 50
  `;

  const allParams = [ftsQuery, ...params];

  try {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(allParams);
      const results: Post[] = [];
      while (stmt.step()) {
        const row = stmt.get([]);
        results.push({
          id: row[0] as string,
          text: row[1] as string,
          created_at: row[2] as string,
          is_reply: Boolean(row[3]),
          reply_to_user: row[4] as string | null,
          is_quote: Boolean(row[5]),
          quoted_text: row[6] as string | null,
          likes: row[7] as number,
          shares: row[8] as number,
          platform: row[9] as string,
        });
      }
      return results;
    } finally {
      stmt.finalize();
    }
  } catch (err) {
    console.error("Search error:", err);
    return [];
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function debouncedSearch(
  input: string,
  sort: SortOption,
  filters: FilterState,
  callback: (results: Post[]) => void,
  delay: number = 120,
): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    callback(executeSearch(input, sort, filters));
  }, delay);
}
```

- [ ] **Step 5: Verify types compile**

Run:
```bash
cd site && bunx svelte-check
```

Expected: 0 errors.

- [ ] **Step 6: Commit data layer**

```bash
git add site/src/lib/types.ts site/src/lib/themes.ts site/src/lib/db.ts site/src/lib/search.ts
git commit -m "feat(site): add core data layer (db, search, themes, types)"
```

---

### Task 4: App Shell (App.svelte, LoadingBar, SearchBar)

**Files:**
- Create: `site/src/components/LoadingBar.svelte`
- Create: `site/src/components/SearchBar.svelte`
- Modify: `site/src/App.svelte`

- [ ] **Step 1: Create `site/src/components/LoadingBar.svelte`**

Create `site/src/components/LoadingBar.svelte`:

```svelte
<script lang="ts">
  interface Props {
    progress: number;
    message: string;
  }

  let { progress, message }: Props = $props();
</script>

<div class="loading" data-testid="loading">
  <div class="progress-container">
    <div class="progress-bar" style="width: {progress}%"></div>
  </div>
  <p class="loading-text">{message}</p>
</div>

<style>
  .loading {
    margin-top: 40px;
  }

  .progress-container {
    width: 100%;
    height: 6px;
    background: #333;
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    background: #4a9eff;
    transition: width 0.1s ease;
  }

  .loading-text {
    margin-top: 10px;
    font-size: 0.85rem;
    color: #666;
  }
</style>
```

- [ ] **Step 2: Create `site/src/components/SearchBar.svelte`**

Create `site/src/components/SearchBar.svelte`:

```svelte
<script lang="ts">
  interface Props {
    value: string;
    onInput: (value: string) => void;
    onToggleControls: () => void;
  }

  let { value, onInput, onToggleControls }: Props = $props();

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    onInput(target.value);
  }
</script>

<div class="search-bar">
  <input
    type="text"
    class="search-input"
    data-testid="search-input"
    placeholder="search dril posts..."
    autocomplete="off"
    {value}
    oninput={handleInput}
  />
  <button
    class="controls-toggle"
    data-testid="controls-toggle"
    onclick={onToggleControls}
    aria-label="Toggle controls panel"
    title="Controls"
  >
    <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor">
      <path
        d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
      />
    </svg>
  </button>
</div>

<style>
  .search-bar {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .search-input {
    flex: 1;
    padding: 12px 16px;
    font-size: 1.1rem;
    font-family: inherit;
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 6px;
    color: #e0e0e0;
    outline: none;
  }

  .search-input:focus {
    border-color: #4a9eff;
  }

  .controls-toggle {
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 6px;
    color: #888;
    cursor: pointer;
    padding: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s;
  }

  .controls-toggle:hover {
    color: #e0e0e0;
  }
</style>
```

- [ ] **Step 3: Replace `site/src/App.svelte` with working app shell**

Replace the contents of `site/src/App.svelte`:

```svelte
<script lang="ts">
  import type { Post, SortOption, FilterState, ThemeId } from "./lib/types";
  import { initDb } from "./lib/db";
  import { debouncedSearch, executeSearch } from "./lib/search";
  import LoadingBar from "./components/LoadingBar.svelte";
  import SearchBar from "./components/SearchBar.svelte";

  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let progress = $state(0);
  let loadingMessage = $state("Downloading archive...");

  let query = $state("");
  let results = $state<Post[]>([]);
  let sort = $state<SortOption>("relevance");
  let filters = $state<FilterState>({ platform: "all", type: "all" });
  let themeOverride = $state<ThemeId | "auto">("auto");
  let controlsOpen = $state(false);

  async function init() {
    try {
      await initDb((received, total, phase) => {
        if (total > 0) {
          progress = Math.round((received / total) * 100);
        }
        loadingMessage = total > 0
          ? `${phase} ${(received / 1024 / 1024).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} MB`
          : phase;
      });
      loading = false;
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err);
      loadingMessage = `Failed to load: ${loadError}`;
    }
  }

  function handleInput(value: string) {
    query = value;
    if (!value.trim()) {
      results = [];
      return;
    }
    debouncedSearch(value, sort, filters, (r) => {
      results = r;
    });
  }

  function handleToggleControls() {
    controlsOpen = !controlsOpen;
  }

  function rerunSearch() {
    if (!query.trim()) {
      results = [];
      return;
    }
    results = executeSearch(query, sort, filters);
  }

  init();
</script>

<main>
  <h1>dril archive</h1>

  {#if loading}
    <LoadingBar {progress} message={loadingMessage} />
  {:else}
    <SearchBar value={query} onInput={handleInput} onToggleControls={handleToggleControls} />

    <div class="results" data-testid="results">
      {#if query.trim() && results.length === 0}
        <p class="no-results">no results</p>
      {/if}
      {#each results as post (post.id)}
        <div class="post" data-testid="post-card">
          {#if post.is_reply && post.reply_to_user}
            <div class="post-reply-to">replying to @{post.reply_to_user}</div>
          {/if}
          <div class="post-text">{post.text}</div>
          <div class="post-meta">
            {new Date(post.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })} &middot; {post.platform}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</main>

<style>
  main {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
  }

  h1 {
    font-size: 1.4rem;
    margin-bottom: 20px;
    color: #888;
  }

  .results {
    margin-top: 16px;
  }

  .no-results {
    color: #666;
    margin-top: 20px;
  }

  .post {
    padding: 14px 0;
    border-bottom: 1px solid #2a2a2a;
  }

  .post-text {
    font-size: 0.95rem;
    line-height: 1.5;
    white-space: pre-wrap;
  }

  .post-meta {
    margin-top: 6px;
    font-size: 0.75rem;
    color: #666;
  }

  .post-reply-to {
    font-size: 0.75rem;
    color: #555;
    margin-bottom: 4px;
  }
</style>
```

Note: This App.svelte uses inline post rendering (no PostCard dispatcher yet) to get basic search working first. The PostCard component is wired in during Task 5.

- [ ] **Step 4: Verify the app builds**

Run:
```bash
cd site && bunx vite build
```

Expected: Build succeeds.

- [ ] **Step 5: Verify svelte-check passes**

Run:
```bash
cd site && bunx svelte-check
```

Expected: 0 errors.

- [ ] **Step 6: Commit app shell**

```bash
git add site/src/App.svelte site/src/components/LoadingBar.svelte site/src/components/SearchBar.svelte
git commit -m "feat(site): add app shell with loading bar, search bar, and basic results"
```

---

### Task 5: Post Card Templates -- Twitter Classic + Modern

**Files:**
- Create: `site/src/components/PostCard.svelte`
- Create: `site/src/templates/TwitterClassic.svelte`
- Create: `site/src/templates/TwitterModern.svelte`
- Modify: `site/src/App.svelte`

- [ ] **Step 1: Create `site/src/components/PostCard.svelte`**

Create `site/src/components/PostCard.svelte`:

```svelte
<script lang="ts">
  import type { Post, ThemeId } from "../lib/types";
  import { resolveTheme } from "../lib/themes";
  import TwitterClassic from "../templates/TwitterClassic.svelte";
  import TwitterNew from "../templates/TwitterNew.svelte";
  import TwitterMaterial from "../templates/TwitterMaterial.svelte";
  import TwitterModern from "../templates/TwitterModern.svelte";
  import Bluesky from "../templates/Bluesky.svelte";
  import Threads from "../templates/Threads.svelte";

  interface Props {
    post: Post;
    themeOverride: ThemeId | "auto";
  }

  let { post, themeOverride }: Props = $props();

  let theme = $derived(resolveTheme(post.platform, post.created_at, themeOverride));
</script>

<div data-testid="post-card" data-theme={theme}>
  {#if theme === "twitter-classic"}
    <TwitterClassic {post} />
  {:else if theme === "twitter-new"}
    <TwitterNew {post} />
  {:else if theme === "twitter-material"}
    <TwitterMaterial {post} />
  {:else if theme === "twitter-modern"}
    <TwitterModern {post} />
  {:else if theme === "bsky"}
    <Bluesky {post} />
  {:else if theme === "threads"}
    <Threads {post} />
  {/if}
</div>
```

Note: This imports all 6 templates. Templates created in this task (Classic + Modern) will have full implementations. The remaining 4 (TwitterNew, TwitterMaterial, Bluesky, Threads) will be created as minimal stubs in this step and fully implemented in Task 6.

- [ ] **Step 2: Create template stub files for templates not yet implemented**

Create these four stub files. Each follows the same pattern — a simple card with the post text and a data attribute for the theme name. These stubs exist only so PostCard.svelte compiles; they are replaced in Task 6.

Create `site/src/templates/TwitterNew.svelte`:

```svelte
<script lang="ts">
  import type { Post } from "../lib/types";
  import { postUrl } from "../lib/search";

  interface Props {
    post: Post;
  }

  let { post }: Props = $props();
</script>

<article class="twitter-new-card">
  <div class="card-body">
    {#if post.is_reply && post.reply_to_user}
      <div class="reply-context">replying to @{post.reply_to_user}</div>
    {/if}
    <div class="header">
      <span class="display-name">@dril</span>
      <span class="separator">&middot;</span>
      <span class="timestamp">
        {new Date(post.created_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </span>
    </div>
    <div class="text">{post.text}</div>
    <div class="footer">
      <a href={postUrl(post.platform, post.id)} target="_blank" rel="noopener">
        view original
      </a>
    </div>
  </div>
</article>

<style>
  .twitter-new-card {
    background: #fff;
    border-bottom: 1px solid #e1e8ed;
    padding: 12px 16px;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #14171a;
  }

  .reply-context {
    color: #66757f;
    font-size: 12px;
    margin-bottom: 4px;
  }

  .header {
    margin-bottom: 4px;
  }

  .display-name {
    font-weight: bold;
    font-size: 14px;
  }

  .separator,
  .timestamp {
    color: #66757f;
    font-size: 12px;
  }

  .text {
    font-size: 14px;
    line-height: 20px;
    white-space: pre-wrap;
  }

  .footer {
    margin-top: 8px;
    font-size: 12px;
  }

  .footer a {
    color: #1b95e0;
    text-decoration: none;
  }

  .footer a:hover {
    text-decoration: underline;
  }
</style>
```

Create `site/src/templates/TwitterMaterial.svelte`:

```svelte
<script lang="ts">
  import type { Post } from "../lib/types";
  import { postUrl } from "../lib/search";

  interface Props {
    post: Post;
  }

  let { post }: Props = $props();
</script>

<article class="twitter-material-card">
  <div class="card-body">
    {#if post.is_reply && post.reply_to_user}
      <div class="reply-context">replying to @{post.reply_to_user}</div>
    {/if}
    <div class="header">
      <span class="display-name">@dril</span>
      <span class="separator">&middot;</span>
      <span class="timestamp">
        {new Date(post.created_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </span>
    </div>
    <div class="text">{post.text}</div>
    <div class="footer">
      <a href={postUrl(post.platform, post.id)} target="_blank" rel="noopener">
        view original
      </a>
    </div>
  </div>
</article>

<style>
  .twitter-material-card {
    background: #fff;
    border: 1px solid #e1e8ed;
    padding: 12px 16px;
    font-family: "Segoe UI", Arial, sans-serif;
    color: #14171a;
  }

  .reply-context {
    color: #657786;
    font-size: 13px;
    margin-bottom: 4px;
  }

  .header {
    margin-bottom: 4px;
  }

  .display-name {
    font-weight: bold;
    font-size: 15px;
  }

  .separator,
  .timestamp {
    color: #657786;
    font-size: 13px;
  }

  .text {
    font-size: 14px;
    line-height: 20px;
    white-space: pre-wrap;
  }

  .footer {
    margin-top: 8px;
    font-size: 13px;
  }

  .footer a {
    color: #1da1f2;
    text-decoration: none;
  }

  .footer a:hover {
    text-decoration: underline;
  }
</style>
```

Create `site/src/templates/Bluesky.svelte`:

```svelte
<script lang="ts">
  import type { Post } from "../lib/types";
  import { postUrl } from "../lib/search";

  interface Props {
    post: Post;
  }

  let { post }: Props = $props();
</script>

<article class="bluesky-card">
  <div class="card-body">
    {#if post.is_reply && post.reply_to_user}
      <div class="reply-context">replying to @{post.reply_to_user}</div>
    {/if}
    <div class="header">
      <span class="display-name">@dril.bsky.social</span>
      <span class="separator">&middot;</span>
      <span class="timestamp">
        {new Date(post.created_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </span>
    </div>
    <div class="text">{post.text}</div>
    <div class="footer">
      <a href={postUrl(post.platform, post.id)} target="_blank" rel="noopener">
        view original
      </a>
    </div>
  </div>
</article>

<style>
  .bluesky-card {
    background: #fff;
    border: 1px solid #e4e6eb;
    border-radius: 12px;
    padding: 14px 16px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1a1a1a;
  }

  .reply-context {
    color: #8a8a8a;
    font-size: 13px;
    margin-bottom: 4px;
  }

  .header {
    margin-bottom: 4px;
  }

  .display-name {
    font-weight: 600;
    font-size: 15px;
  }

  .separator,
  .timestamp {
    color: #8a8a8a;
    font-size: 13px;
  }

  .text {
    font-size: 15px;
    line-height: 21px;
    white-space: pre-wrap;
  }

  .footer {
    margin-top: 8px;
    font-size: 13px;
  }

  .footer a {
    color: #0085ff;
    text-decoration: none;
  }

  .footer a:hover {
    text-decoration: underline;
  }
</style>
```

Create `site/src/templates/Threads.svelte`:

```svelte
<script lang="ts">
  import type { Post } from "../lib/types";
  import { postUrl } from "../lib/search";

  interface Props {
    post: Post;
  }

  let { post }: Props = $props();
</script>

<article class="threads-card">
  <div class="card-body">
    {#if post.is_reply && post.reply_to_user}
      <div class="reply-context">replying to @{post.reply_to_user}</div>
    {/if}
    <div class="header">
      <span class="display-name">@dril</span>
      <span class="separator">&middot;</span>
      <span class="timestamp">
        {new Date(post.created_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </span>
    </div>
    <div class="text">{post.text}</div>
    <div class="footer">
      <a href={postUrl(post.platform, post.id)} target="_blank" rel="noopener">
        view original
      </a>
    </div>
  </div>
</article>

<style>
  .threads-card {
    background: #fff;
    border-bottom: 1px solid #e0e0e0;
    padding: 16px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #000;
  }

  .reply-context {
    color: #999;
    font-size: 13px;
    margin-bottom: 4px;
  }

  .header {
    margin-bottom: 4px;
  }

  .display-name {
    font-weight: 600;
    font-size: 15px;
  }

  .separator,
  .timestamp {
    color: #999;
    font-size: 13px;
  }

  .text {
    font-size: 15px;
    line-height: 21px;
    white-space: pre-wrap;
  }

  .footer {
    margin-top: 8px;
    font-size: 13px;
  }

  .footer a {
    color: #000;
    text-decoration: none;
    font-weight: 500;
  }

  .footer a:hover {
    text-decoration: underline;
  }
</style>
```

- [ ] **Step 3: Create `site/src/templates/TwitterClassic.svelte`**

This is the full implementation of the Classic era (2008-2010) card.

Create `site/src/templates/TwitterClassic.svelte`:

```svelte
<script lang="ts">
  import type { Post } from "../lib/types";
  import { postUrl } from "../lib/search";

  interface Props {
    post: Post;
  }

  let { post }: Props = $props();

  let formattedDate = $derived(
    new Date(post.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  );

  let url = $derived(postUrl(post.platform, post.id));
</script>

<article class="twitter-classic-card">
  {#if post.is_reply && post.reply_to_user}
    <div class="reply-context">
      <span class="reply-icon">&#8617;</span> replying to @{post.reply_to_user}
    </div>
  {/if}

  <div class="card-layout">
    <div class="avatar-col">
      <div class="avatar-placeholder"></div>
    </div>
    <div class="content-col">
      <div class="header">
        <span class="display-name">dril</span>
        <span class="handle">@dril</span>
      </div>
      <div class="text">{post.text}</div>
      {#if post.is_quote && post.quoted_text}
        <div class="quoted">
          <div class="quoted-text">{post.quoted_text}</div>
        </div>
      {/if}
      <div class="meta">
        <span class="timestamp">{formattedDate}</span>
        <span class="separator">&middot;</span>
        <a href={url} target="_blank" rel="noopener" class="view-link">
          view original
        </a>
      </div>
      <div class="engagement">
        <span class="engagement-item">{post.likes.toLocaleString()} likes</span>
        <span class="engagement-item">{post.shares.toLocaleString()} shares</span>
      </div>
    </div>
  </div>
</article>

<style>
  .twitter-classic-card {
    background: rgba(255, 255, 255, 0.98);
    border: 1px solid #cccccc;
    border-radius: 5px;
    padding: 10px;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: rgb(136, 153, 166);
    margin-bottom: 8px;
  }

  .reply-context {
    color: #999;
    font-size: 11px;
    margin-bottom: 6px;
    padding-left: 83px;
  }

  .reply-icon {
    font-size: 10px;
  }

  .card-layout {
    display: flex;
    gap: 10px;
  }

  .avatar-col {
    flex-shrink: 0;
  }

  .avatar-placeholder {
    width: 73px;
    height: 73px;
    border-radius: 4px;
    background: #e1e8ed;
  }

  .content-col {
    flex: 1;
    min-width: 0;
  }

  .header {
    margin-bottom: 2px;
  }

  .display-name {
    font-weight: bold;
    font-size: 14px;
    color: rgb(136, 153, 166);
  }

  .handle {
    color: #999;
    font-size: 11px;
    margin-left: 4px;
  }

  .text {
    font-size: 13px;
    line-height: 24px;
    color: rgb(136, 153, 166);
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .quoted {
    border: 1px solid #999;
    border-radius: 5px;
    padding: 8px 12px;
    margin-top: 8px;
  }

  .quoted-text {
    font-size: 12px;
    line-height: 18px;
    color: #666;
  }

  .meta {
    margin-top: 6px;
    font-size: 11px;
    color: #999;
  }

  .separator {
    margin: 0 4px;
  }

  .view-link {
    color: #0084b4;
    text-decoration: none;
  }

  .view-link:hover {
    text-decoration: underline;
  }

  .engagement {
    margin-top: 4px;
    font-size: 11px;
    color: #999;
    display: flex;
    gap: 12px;
  }
</style>
```

CSS properties are derived from `theme-extractor/output/themes/twitter-classic.css`: `--card-bg: rgba(255,255,255,0.98)`, `--card-border: 1px solid #ccc`, `--card-border-radius: 5px`, `--card-padding: 10px`, `--text-font: "Helvetica Neue"...`, `--text-size: 13px`, `--text-color: rgb(136,153,166)`, `--meta-color: #999`, `--meta-size: 11px`, `--link-color: #0084b4`, `--avatar-size: 73px`, `--avatar-radius: 4px`.

- [ ] **Step 4: Create `site/src/templates/TwitterModern.svelte`**

This is the full implementation of the Modern era (2019-2023) card.

Create `site/src/templates/TwitterModern.svelte`:

```svelte
<script lang="ts">
  import type { Post } from "../lib/types";
  import { postUrl } from "../lib/search";

  interface Props {
    post: Post;
  }

  let { post }: Props = $props();

  let formattedDate = $derived(
    new Date(post.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  );

  let url = $derived(postUrl(post.platform, post.id));
</script>

<article class="twitter-modern-card">
  {#if post.is_reply && post.reply_to_user}
    <div class="reply-context">
      Replying to <span class="reply-mention">@{post.reply_to_user}</span>
    </div>
  {/if}

  <div class="card-layout">
    <div class="avatar-col">
      <div class="avatar-placeholder"></div>
    </div>
    <div class="content-col">
      <div class="header">
        <span class="display-name">dril</span>
        <span class="handle">@dril</span>
        <span class="separator">&middot;</span>
        <span class="timestamp">{formattedDate}</span>
      </div>
      <div class="text">{post.text}</div>
      {#if post.is_quote && post.quoted_text}
        <div class="quoted">
          <div class="quoted-text">{post.quoted_text}</div>
        </div>
      {/if}
      <div class="engagement">
        <span class="engagement-item">
          <span class="engagement-count">{post.likes.toLocaleString()}</span> Likes
        </span>
        <span class="engagement-item">
          <span class="engagement-count">{post.shares.toLocaleString()}</span> Reposts
        </span>
      </div>
      <div class="meta">
        <a href={url} target="_blank" rel="noopener" class="view-link">
          view original
        </a>
      </div>
    </div>
  </div>
</article>

<style>
  .twitter-modern-card {
    background: #fff;
    border: 1px solid #eff3f4;
    border-radius: 16px;
    padding: 12px 16px;
    font-family:
      TwitterChirp,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      Helvetica,
      Arial,
      sans-serif;
    color: rgb(83, 100, 113);
    margin-bottom: 8px;
  }

  .reply-context {
    color: #536471;
    font-size: 13px;
    margin-bottom: 4px;
    padding-left: 52px;
  }

  .reply-mention {
    color: #1d9bf0;
  }

  .card-layout {
    display: flex;
    gap: 12px;
  }

  .avatar-col {
    flex-shrink: 0;
  }

  .avatar-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #e1e8ed;
  }

  .content-col {
    flex: 1;
    min-width: 0;
  }

  .header {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin-bottom: 2px;
  }

  .display-name {
    font-weight: 700;
    font-size: 15px;
    color: rgb(15, 20, 25);
  }

  .handle {
    color: #536471;
    font-size: 15px;
  }

  .separator {
    color: #536471;
    font-size: 13px;
  }

  .timestamp {
    color: #536471;
    font-size: 13px;
  }

  .text {
    font-size: 15px;
    line-height: 20px;
    color: rgb(15, 20, 25);
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .quoted {
    border: 1px solid #536471;
    border-radius: 16px;
    padding: 8px 12px;
    margin-top: 8px;
  }

  .quoted-text {
    font-size: 14px;
    line-height: 18px;
    color: #536471;
  }

  .engagement {
    margin-top: 8px;
    font-size: 13px;
    color: #536471;
    display: flex;
    gap: 16px;
  }

  .engagement-count {
    font-weight: 700;
    color: rgb(15, 20, 25);
  }

  .meta {
    margin-top: 4px;
    font-size: 13px;
  }

  .view-link {
    color: #1d9bf0;
    text-decoration: none;
  }

  .view-link:hover {
    text-decoration: underline;
  }
</style>
```

CSS properties are derived from `theme-extractor/output/themes/twitter-modern.css`: `--card-bg: rgb(255,255,255)`, `--card-border: 1px solid #eff3f4`, `--card-border-radius: 16px`, `--card-padding: 12px 16px`, `--text-font: TwitterChirp...`, `--text-size: 15px`, `--text-color: rgb(83,100,113)`, `--meta-color: #536471`, `--meta-size: 13px`, `--link-color: #1d9bf0`, `--avatar-size: 40px`, `--avatar-radius: 50%`.

- [ ] **Step 5: Wire PostCard into App.svelte**

In `site/src/App.svelte`, replace the inline post rendering with the PostCard component.

Add import at the top of the `<script>` block (after the existing imports):

```typescript
import PostCard from "./components/PostCard.svelte";
```

Replace the `{#each results as post (post.id)}` block. Change:

```svelte
      {#each results as post (post.id)}
        <div class="post" data-testid="post-card">
          {#if post.is_reply && post.reply_to_user}
            <div class="post-reply-to">replying to @{post.reply_to_user}</div>
          {/if}
          <div class="post-text">{post.text}</div>
          <div class="post-meta">
            {new Date(post.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })} &middot; {post.platform}
          </div>
        </div>
      {/each}
```

To:

```svelte
      {#each results as post (post.id)}
        <PostCard {post} {themeOverride} />
      {/each}
```

Also remove the now-unused `.post`, `.post-text`, `.post-meta`, and `.post-reply-to` styles from the `<style>` block since those are handled by individual templates.

- [ ] **Step 6: Verify build and svelte-check**

Run:
```bash
cd site && bunx svelte-check && bunx vite build
```

Expected: 0 errors, build succeeds.

- [ ] **Step 7: Commit post card templates**

```bash
git add site/src/components/PostCard.svelte site/src/templates/ site/src/App.svelte
git commit -m "feat(site): add PostCard dispatcher with TwitterClassic and TwitterModern templates"
```

---

### Task 6: Remaining Templates -- Twitter New, Material, Bluesky, Threads

**Files:**
- Modify: `site/src/templates/TwitterNew.svelte`
- Modify: `site/src/templates/TwitterMaterial.svelte`
- Modify: `site/src/templates/Bluesky.svelte`
- Modify: `site/src/templates/Threads.svelte`

The stubs created in Task 5 already have basic structure. This task upgrades them to full implementations with era-accurate layout (avatar column, header with name/handle/timestamp, engagement counts, quoted text support, view-original link) matching the same component interface as TwitterClassic and TwitterModern.

- [ ] **Step 1: Replace `site/src/templates/TwitterNew.svelte` with full implementation**

Replace the entire contents of `site/src/templates/TwitterNew.svelte`:

```svelte
<script lang="ts">
  import type { Post } from "../lib/types";
  import { postUrl } from "../lib/search";

  interface Props {
    post: Post;
  }

  let { post }: Props = $props();

  let formattedDate = $derived(
    new Date(post.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  );

  let url = $derived(postUrl(post.platform, post.id));
</script>

<article class="twitter-new-card">
  {#if post.is_reply && post.reply_to_user}
    <div class="reply-context">
      <span class="reply-icon">&#8617;</span> In reply to @{post.reply_to_user}
    </div>
  {/if}

  <div class="card-layout">
    <div class="avatar-col">
      <div class="avatar-placeholder"></div>
    </div>
    <div class="content-col">
      <div class="header">
        <span class="display-name">dril</span>
        <span class="handle">@dril</span>
        <span class="separator">&middot;</span>
        <span class="timestamp">{formattedDate}</span>
      </div>
      <div class="text">{post.text}</div>
      {#if post.is_quote && post.quoted_text}
        <div class="quoted">
          <div class="quoted-text">{post.quoted_text}</div>
        </div>
      {/if}
      <div class="engagement">
        <span class="engagement-item">{post.likes.toLocaleString()} favorites</span>
        <span class="engagement-item">{post.shares.toLocaleString()} retweets</span>
      </div>
      <div class="meta">
        <a href={url} target="_blank" rel="noopener" class="view-link">view original</a>
      </div>
    </div>
  </div>
</article>

<style>
  .twitter-new-card {
    background: #fff;
    border-bottom: 1px solid #e1e8ed;
    padding: 12px 16px;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #14171a;
    margin-bottom: 0;
  }

  .reply-context {
    color: #66757f;
    font-size: 12px;
    margin-bottom: 4px;
    padding-left: 60px;
  }

  .reply-icon {
    font-size: 10px;
  }

  .card-layout {
    display: flex;
    gap: 10px;
  }

  .avatar-col {
    flex-shrink: 0;
  }

  .avatar-placeholder {
    width: 48px;
    height: 48px;
    border-radius: 4px;
    background: #e1e8ed;
  }

  .content-col {
    flex: 1;
    min-width: 0;
  }

  .header {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin-bottom: 2px;
  }

  .display-name {
    font-weight: bold;
    font-size: 14px;
    color: #14171a;
  }

  .handle {
    color: #66757f;
    font-size: 12px;
  }

  .separator {
    color: #66757f;
    font-size: 12px;
  }

  .timestamp {
    color: #66757f;
    font-size: 12px;
  }

  .text {
    font-size: 14px;
    line-height: 20px;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .quoted {
    border: 1px solid #66757f;
    border-radius: 0;
    padding: 8px 12px;
    margin-top: 8px;
  }

  .quoted-text {
    font-size: 13px;
    line-height: 18px;
    color: #66757f;
  }

  .engagement {
    margin-top: 6px;
    font-size: 12px;
    color: #66757f;
    display: flex;
    gap: 12px;
  }

  .meta {
    margin-top: 4px;
    font-size: 12px;
  }

  .view-link {
    color: #1b95e0;
    text-decoration: none;
  }

  .view-link:hover {
    text-decoration: underline;
  }
</style>
```

CSS values from `theme-extractor/output/themes/twitter-new.css`: `--card-bg: rgb(255,255,255)`, `--card-border: none`, `--card-border-bottom: 1px solid #e1e8ed`, `--card-border-radius: 0`, `--card-padding: 12px 16px`, `--text-font: "Helvetica Neue"...`, `--text-size: 14px`, `--text-color: rgb(20,23,26)`, `--meta-color: #66757f`, `--meta-size: 12px`, `--link-color: #1b95e0`, `--avatar-size: 48px`, `--avatar-radius: 4px`.

- [ ] **Step 2: Replace `site/src/templates/TwitterMaterial.svelte` with full implementation**

Replace the entire contents of `site/src/templates/TwitterMaterial.svelte`:

```svelte
<script lang="ts">
  import type { Post } from "../lib/types";
  import { postUrl } from "../lib/search";

  interface Props {
    post: Post;
  }

  let { post }: Props = $props();

  let formattedDate = $derived(
    new Date(post.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  );

  let url = $derived(postUrl(post.platform, post.id));
</script>

<article class="twitter-material-card">
  {#if post.is_reply && post.reply_to_user}
    <div class="reply-context">
      Replying to <span class="reply-mention">@{post.reply_to_user}</span>
    </div>
  {/if}

  <div class="card-layout">
    <div class="avatar-col">
      <div class="avatar-placeholder"></div>
    </div>
    <div class="content-col">
      <div class="header">
        <span class="display-name">dril</span>
        <span class="handle">@dril</span>
        <span class="separator">&middot;</span>
        <span class="timestamp">{formattedDate}</span>
      </div>
      <div class="text">{post.text}</div>
      {#if post.is_quote && post.quoted_text}
        <div class="quoted">
          <div class="quoted-text">{post.quoted_text}</div>
        </div>
      {/if}
      <div class="engagement">
        <span class="engagement-item">{post.likes.toLocaleString()} likes</span>
        <span class="engagement-item">{post.shares.toLocaleString()} retweets</span>
      </div>
      <div class="meta">
        <a href={url} target="_blank" rel="noopener" class="view-link">view original</a>
      </div>
    </div>
  </div>
</article>

<style>
  .twitter-material-card {
    background: #fff;
    border: 1px solid #e1e8ed;
    padding: 12px 16px;
    font-family: "Segoe UI", Arial, sans-serif;
    color: #14171a;
    margin-bottom: 8px;
  }

  .reply-context {
    color: #657786;
    font-size: 13px;
    margin-bottom: 4px;
    padding-left: 60px;
  }

  .reply-mention {
    color: #1da1f2;
  }

  .card-layout {
    display: flex;
    gap: 12px;
  }

  .avatar-col {
    flex-shrink: 0;
  }

  .avatar-placeholder {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #e1e8ed;
  }

  .content-col {
    flex: 1;
    min-width: 0;
  }

  .header {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin-bottom: 2px;
  }

  .display-name {
    font-weight: bold;
    font-size: 15px;
    color: #14171a;
  }

  .handle {
    color: #657786;
    font-size: 13px;
  }

  .separator {
    color: #657786;
    font-size: 13px;
  }

  .timestamp {
    color: #657786;
    font-size: 13px;
  }

  .text {
    font-size: 14px;
    line-height: 20px;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .quoted {
    border: 1px solid #657786;
    border-radius: 0;
    padding: 8px 12px;
    margin-top: 8px;
  }

  .quoted-text {
    font-size: 13px;
    line-height: 18px;
    color: #657786;
  }

  .engagement {
    margin-top: 6px;
    font-size: 13px;
    color: #657786;
    display: flex;
    gap: 16px;
  }

  .meta {
    margin-top: 4px;
    font-size: 13px;
  }

  .view-link {
    color: #1da1f2;
    text-decoration: none;
  }

  .view-link:hover {
    text-decoration: underline;
  }
</style>
```

CSS values from `theme-extractor/output/themes/twitter-material.css`: `--card-bg: rgb(255,255,255)`, `--card-border: 1px solid #e1e8ed`, `--card-border-radius: 0`, `--card-padding: 12px 16px`, `--text-font: "Segoe UI"...`, `--text-size: 14px`, `--text-color: rgb(20,23,26)`, `--meta-color: #657786`, `--meta-size: 13px`, `--link-color: #1da1f2`, `--avatar-size: 48px`, `--avatar-radius: 50%`.

- [ ] **Step 3: Replace `site/src/templates/Bluesky.svelte` with full implementation**

Replace the entire contents of `site/src/templates/Bluesky.svelte`:

```svelte
<script lang="ts">
  import type { Post } from "../lib/types";
  import { postUrl } from "../lib/search";

  interface Props {
    post: Post;
  }

  let { post }: Props = $props();

  let formattedDate = $derived(
    new Date(post.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  );

  let url = $derived(postUrl(post.platform, post.id));
</script>

<article class="bluesky-card">
  {#if post.is_reply && post.reply_to_user}
    <div class="reply-context">
      Reply to @{post.reply_to_user}
    </div>
  {/if}

  <div class="card-layout">
    <div class="avatar-col">
      <div class="avatar-placeholder"></div>
    </div>
    <div class="content-col">
      <div class="header">
        <span class="display-name">dril</span>
        <span class="handle">@dril.bsky.social</span>
        <span class="separator">&middot;</span>
        <span class="timestamp">{formattedDate}</span>
      </div>
      <div class="text">{post.text}</div>
      {#if post.is_quote && post.quoted_text}
        <div class="quoted">
          <div class="quoted-text">{post.quoted_text}</div>
        </div>
      {/if}
      <div class="engagement">
        <span class="engagement-item">{post.likes.toLocaleString()} likes</span>
        <span class="engagement-item">{post.shares.toLocaleString()} reposts</span>
      </div>
      <div class="meta">
        <a href={url} target="_blank" rel="noopener" class="view-link">view original</a>
      </div>
    </div>
  </div>
</article>

<style>
  .bluesky-card {
    background: #fff;
    border: 1px solid #e4e6eb;
    border-radius: 12px;
    padding: 14px 16px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1a1a1a;
    margin-bottom: 8px;
  }

  .reply-context {
    color: #8a8a8a;
    font-size: 13px;
    margin-bottom: 4px;
    padding-left: 52px;
  }

  .card-layout {
    display: flex;
    gap: 10px;
  }

  .avatar-col {
    flex-shrink: 0;
  }

  .avatar-placeholder {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: #d6e6f7;
  }

  .content-col {
    flex: 1;
    min-width: 0;
  }

  .header {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin-bottom: 2px;
  }

  .display-name {
    font-weight: 600;
    font-size: 15px;
    color: #1a1a1a;
  }

  .handle {
    color: #8a8a8a;
    font-size: 14px;
  }

  .separator {
    color: #8a8a8a;
    font-size: 13px;
  }

  .timestamp {
    color: #8a8a8a;
    font-size: 13px;
  }

  .text {
    font-size: 15px;
    line-height: 21px;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .quoted {
    border: 1px solid #d6d6d6;
    border-radius: 8px;
    padding: 10px 12px;
    margin-top: 8px;
    background: #f9f9f9;
  }

  .quoted-text {
    font-size: 14px;
    line-height: 19px;
    color: #555;
  }

  .engagement {
    margin-top: 8px;
    font-size: 13px;
    color: #8a8a8a;
    display: flex;
    gap: 14px;
  }

  .meta {
    margin-top: 4px;
    font-size: 13px;
  }

  .view-link {
    color: #0085ff;
    text-decoration: none;
  }

  .view-link:hover {
    text-decoration: underline;
  }
</style>
```

Bluesky CSS is hand-written to match the current Bluesky web design: clean white cards with `#0085ff` accent, 42px circular avatars, system font stack, `12px` border-radius.

- [ ] **Step 4: Replace `site/src/templates/Threads.svelte` with full implementation**

Replace the entire contents of `site/src/templates/Threads.svelte`:

```svelte
<script lang="ts">
  import type { Post } from "../lib/types";
  import { postUrl } from "../lib/search";

  interface Props {
    post: Post;
  }

  let { post }: Props = $props();

  let formattedDate = $derived(
    new Date(post.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  );

  let url = $derived(postUrl(post.platform, post.id));
</script>

<article class="threads-card">
  {#if post.is_reply && post.reply_to_user}
    <div class="reply-context">
      replying to @{post.reply_to_user}
    </div>
  {/if}

  <div class="card-layout">
    <div class="avatar-col">
      <div class="avatar-placeholder"></div>
    </div>
    <div class="content-col">
      <div class="header">
        <span class="display-name">dril</span>
        <span class="timestamp">{formattedDate}</span>
      </div>
      <div class="text">{post.text}</div>
      {#if post.is_quote && post.quoted_text}
        <div class="quoted">
          <div class="quoted-text">{post.quoted_text}</div>
        </div>
      {/if}
      <div class="engagement">
        <span class="engagement-item">{post.likes.toLocaleString()} likes</span>
        <span class="engagement-item">{post.shares.toLocaleString()} reposts</span>
      </div>
      <div class="meta">
        <a href={url} target="_blank" rel="noopener" class="view-link">view original</a>
      </div>
    </div>
  </div>
</article>

<style>
  .threads-card {
    background: #fff;
    border-bottom: 1px solid #e0e0e0;
    padding: 16px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #000;
    margin-bottom: 0;
  }

  .reply-context {
    color: #999;
    font-size: 13px;
    margin-bottom: 4px;
    padding-left: 52px;
  }

  .card-layout {
    display: flex;
    gap: 12px;
  }

  .avatar-col {
    flex-shrink: 0;
  }

  .avatar-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #e0e0e0;
  }

  .content-col {
    flex: 1;
    min-width: 0;
  }

  .header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 2px;
  }

  .display-name {
    font-weight: 600;
    font-size: 15px;
    color: #000;
  }

  .timestamp {
    color: #999;
    font-size: 14px;
  }

  .text {
    font-size: 15px;
    line-height: 21px;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .quoted {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 10px 12px;
    margin-top: 8px;
  }

  .quoted-text {
    font-size: 14px;
    line-height: 19px;
    color: #666;
  }

  .engagement {
    margin-top: 8px;
    font-size: 14px;
    color: #999;
    display: flex;
    gap: 16px;
  }

  .meta {
    margin-top: 4px;
    font-size: 14px;
  }

  .view-link {
    color: #000;
    text-decoration: none;
    font-weight: 500;
  }

  .view-link:hover {
    text-decoration: underline;
  }
</style>
```

Threads CSS is hand-written to match Threads' Instagram-derived minimal design: white background, border-bottom separators, 40px circular avatars, dark text with grey metadata, no card border-radius.

- [ ] **Step 5: Verify build and svelte-check**

Run:
```bash
cd site && bunx svelte-check && bunx vite build
```

Expected: 0 errors, build succeeds.

- [ ] **Step 6: Commit remaining templates**

```bash
git add site/src/templates/
git commit -m "feat(site): implement TwitterNew, TwitterMaterial, Bluesky, and Threads templates"
```

---

### Task 7: Controls Panel

**Files:**
- Create: `site/src/components/Controls.svelte`
- Modify: `site/src/App.svelte`

- [ ] **Step 1: Create `site/src/components/Controls.svelte`**

Create `site/src/components/Controls.svelte`:

```svelte
<script lang="ts">
  import type { SortOption, PlatformFilter, TypeFilter, ThemeId } from "../lib/types";
  import { ALL_THEMES, THEME_LABELS } from "../lib/themes";

  interface Props {
    sort: SortOption;
    platformFilter: PlatformFilter;
    typeFilter: TypeFilter;
    themeOverride: ThemeId | "auto";
    onSortChange: (sort: SortOption) => void;
    onPlatformChange: (platform: PlatformFilter) => void;
    onTypeChange: (type: TypeFilter) => void;
    onThemeChange: (theme: ThemeId | "auto") => void;
  }

  let {
    sort,
    platformFilter,
    typeFilter,
    themeOverride,
    onSortChange,
    onPlatformChange,
    onTypeChange,
    onThemeChange,
  }: Props = $props();

  const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: "relevance", label: "Relevance" },
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "most-liked", label: "Most liked" },
    { value: "most-shared", label: "Most shared" },
  ];

  const PLATFORM_OPTIONS: { value: PlatformFilter; label: string }[] = [
    { value: "all", label: "All platforms" },
    { value: "x", label: "X (Twitter)" },
    { value: "bsky", label: "Bluesky" },
    { value: "threads", label: "Threads" },
  ];

  const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
    { value: "all", label: "All types" },
    { value: "original", label: "Original posts" },
    { value: "replies", label: "Replies" },
    { value: "quotes", label: "Quote posts" },
  ];
</script>

<div class="controls" data-testid="controls-panel">
  <div class="control-group">
    <label class="control-label" for="sort-select">Sort</label>
    <select
      id="sort-select"
      data-testid="sort-select"
      value={sort}
      onchange={(e) => onSortChange((e.target as HTMLSelectElement).value as SortOption)}
    >
      {#each SORT_OPTIONS as opt}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
  </div>

  <div class="control-group">
    <label class="control-label" for="platform-select">Platform</label>
    <select
      id="platform-select"
      data-testid="platform-select"
      value={platformFilter}
      onchange={(e) =>
        onPlatformChange((e.target as HTMLSelectElement).value as PlatformFilter)}
    >
      {#each PLATFORM_OPTIONS as opt}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
  </div>

  <div class="control-group">
    <label class="control-label" for="type-select">Type</label>
    <select
      id="type-select"
      data-testid="type-select"
      value={typeFilter}
      onchange={(e) => onTypeChange((e.target as HTMLSelectElement).value as TypeFilter)}
    >
      {#each TYPE_OPTIONS as opt}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
  </div>

  <div class="control-group">
    <label class="control-label" for="theme-select">Theme</label>
    <select
      id="theme-select"
      data-testid="theme-select"
      value={themeOverride}
      onchange={(e) =>
        onThemeChange((e.target as HTMLSelectElement).value as ThemeId | "auto")}
    >
      {#each ALL_THEMES as themeId}
        <option value={themeId}>{THEME_LABELS[themeId]}</option>
      {/each}
    </select>
  </div>
</div>

<style>
  .controls {
    background: #222;
    border: 1px solid #333;
    border-radius: 6px;
    padding: 12px 16px;
    margin-top: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 140px;
  }

  .control-label {
    font-size: 0.7rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  select {
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 4px;
    color: #e0e0e0;
    padding: 6px 8px;
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
    outline: none;
  }

  select:focus {
    border-color: #4a9eff;
  }
</style>
```

- [ ] **Step 2: Wire Controls into App.svelte**

In `site/src/App.svelte`, add the Controls import and render it conditionally.

Add to the imports in the `<script>` block:

```typescript
import Controls from "./components/Controls.svelte";
```

Add these handler functions (after the existing `handleToggleControls` function):

```typescript
  function handleSortChange(newSort: SortOption) {
    sort = newSort;
    rerunSearch();
  }

  function handlePlatformChange(newPlatform: PlatformFilter) {
    filters = { ...filters, platform: newPlatform };
    rerunSearch();
  }

  function handleTypeChange(newType: TypeFilter) {
    filters = { ...filters, type: newType };
    rerunSearch();
  }

  function handleThemeChange(newTheme: ThemeId | "auto") {
    themeOverride = newTheme;
  }
```

Add the Controls component render right after the `<SearchBar>` line:

```svelte
    {#if controlsOpen}
      <Controls
        {sort}
        platformFilter={filters.platform}
        typeFilter={filters.type}
        {themeOverride}
        onSortChange={handleSortChange}
        onPlatformChange={handlePlatformChange}
        onTypeChange={handleTypeChange}
        onThemeChange={handleThemeChange}
      />
    {/if}
```

Also add the missing type imports to the top of the script block:

```typescript
import type { Post, SortOption, FilterState, ThemeId, PlatformFilter, TypeFilter } from "./lib/types";
```

- [ ] **Step 3: Verify build and svelte-check**

Run:
```bash
cd site && bunx svelte-check && bunx vite build
```

Expected: 0 errors, build succeeds.

- [ ] **Step 4: Commit controls panel**

```bash
git add site/src/components/Controls.svelte site/src/App.svelte
git commit -m "feat(site): add collapsible controls panel with sort, filter, and theme override"
```

---

### Task 8: Responsive CSS + Global Styles

**Files:**
- Modify: `site/src/app.css`
- Modify: `site/src/App.svelte`
- Modify: `site/src/components/SearchBar.svelte`
- Modify: `site/src/components/Controls.svelte`

- [ ] **Step 1: Replace `site/src/app.css` with full global styles**

Replace the entire contents of `site/src/app.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
  background: #1a1a1a;
  color: #e0e0e0;
  min-height: 100vh;
}

/* Focus visible for keyboard navigation */
:focus-visible {
  outline: 2px solid #4a9eff;
  outline-offset: 2px;
}

/* Scrollbar styling for dark theme */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #1a1a1a;
}

::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}
```

- [ ] **Step 2: Add responsive styles to `site/src/App.svelte`**

In the `<style>` block of `App.svelte`, replace the existing styles with:

```css
  main {
    max-width: 700px;
    margin: 0 auto;
    padding: 16px;
  }

  h1 {
    font-size: 1.2rem;
    margin-bottom: 16px;
    color: #888;
  }

  .results {
    margin-top: 12px;
  }

  .no-results {
    color: #666;
    margin-top: 20px;
  }

  @media (min-width: 640px) {
    main {
      padding: 20px;
    }

    h1 {
      font-size: 1.4rem;
      margin-bottom: 20px;
    }

    .results {
      margin-top: 16px;
    }
  }
```

- [ ] **Step 3: Add responsive styles to `site/src/components/SearchBar.svelte`**

Add a `@media` query to the existing `<style>` block in SearchBar.svelte. Append inside the `<style>` block:

```css
  @media (max-width: 639px) {
    .search-input {
      padding: 10px 12px;
      font-size: 1rem;
    }

    .controls-toggle {
      padding: 8px;
    }
  }
```

- [ ] **Step 4: Add responsive styles to `site/src/components/Controls.svelte`**

Add a `@media` query to the existing `<style>` block in Controls.svelte. Append inside the `<style>` block:

```css
  @media (max-width: 639px) {
    .controls {
      padding: 10px 12px;
      gap: 8px;
    }

    .control-group {
      min-width: 100%;
    }
  }
```

This makes controls stack vertically on mobile (each select takes full width).

- [ ] **Step 4b: Add responsive typography to template components**

Each template component (`TwitterClassic.svelte`, `TwitterNew.svelte`, `TwitterMaterial.svelte`, `TwitterModern.svelte`, `Bluesky.svelte`, `Threads.svelte`) should include a `@media (max-width: 639px)` rule that reduces meta/timestamp font sizes by 1-2px on mobile viewports. For example, append to each template's `<style>` block:

```css
  @media (max-width: 639px) {
    .meta, .timestamp, .separator, .engagement {
      font-size: calc(var(--meta-size, 13px) - 1px);
    }
  }
```

Adjust the selector names to match each template's actual class names. This prevents metadata text from feeling oversized on small screens.

- [ ] **Step 5: Verify build**

Run:
```bash
cd site && bunx svelte-check && bunx vite build
```

Expected: 0 errors, build succeeds.

- [ ] **Step 6: Commit responsive styles**

```bash
git add site/src/app.css site/src/App.svelte site/src/components/SearchBar.svelte site/src/components/Controls.svelte
git commit -m "feat(site): add responsive CSS with mobile-first layout"
```

---

### Task 9: E2E Tests

**Files:**
- Modify: `e2e/search.spec.ts`
- Modify: `playwright.config.ts`

Note: `playwright.config.ts` is written once in Task 10 (Step 4) with the final Vite dev server configuration. Do not write it here — Task 10 handles the definitive version.

- [ ] **Step 1: Replace `e2e/search.spec.ts` with adapted + new tests**

Replace the entire contents of `e2e/search.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("dril archive search", () => {
  // --- Existing tests (adapted selectors) ---

  test("page loads and search box appears", async ({ page }) => {
    await page.goto("/");

    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    const loading = page.locator('[data-testid="loading"]');
    await expect(loading).toHaveCount(0);
  });

  test("search returns results", async ({ page }) => {
    await page.goto("/");
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    await searchInput.fill("corn");

    const results = page.locator('[data-testid="results"]');
    await expect(results.locator('[data-testid="post-card"]')).toHaveCount(1, {
      timeout: 5_000,
    });

    await expect(results).toContainText("corn cob");
    await expect(
      results.locator('a[href="https://x.com/dril/status/5"]'),
    ).toBeVisible();
  });

  test("reply metadata renders", async ({ page }) => {
    await page.goto("/");
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    await searchInput.fill("baby");

    const results = page.locator('[data-testid="results"]');
    await expect(results.locator('[data-testid="post-card"]')).toHaveCount(1, {
      timeout: 5_000,
    });

    await expect(results).toContainText("@someone");
  });

  test("clear search clears results", async ({ page }) => {
    await page.goto("/");
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    await searchInput.fill("corn");
    const results = page.locator('[data-testid="results"]');
    await expect(results.locator('[data-testid="post-card"]')).toHaveCount(1, {
      timeout: 5_000,
    });

    await searchInput.fill("");

    await expect(results.locator('[data-testid="post-card"]')).toHaveCount(0);
  });

  test("no results state", async ({ page }) => {
    await page.goto("/");
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    await searchInput.fill("xyzgarbage123");

    const results = page.locator('[data-testid="results"]');
    await expect(results).toContainText("no results", { timeout: 5_000 });
  });

  // --- New tests for display layer ---

  test("era theme rendering - classic era post gets twitter-classic template", async ({
    page,
  }) => {
    await page.goto("/");
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    // Post id=1 "no" is from 2008-09-15 -> twitter-classic era
    await searchInput.fill("no");

    const results = page.locator('[data-testid="results"]');
    await expect(results.locator('[data-testid="post-card"]')).toHaveCount(1, {
      timeout: 5_000,
    });

    const card = results.locator('[data-testid="post-card"]').first();
    await expect(card).toHaveAttribute("data-theme", "twitter-classic");
  });

  test("era theme rendering - modern era post gets twitter-modern template", async ({
    page,
  }) => {
    await page.goto("/");
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    // Post id=4 "betsy ross" is from 2019-06-14 -> twitter-modern era
    await searchInput.fill("betsy ross");

    const results = page.locator('[data-testid="results"]');
    await expect(results.locator('[data-testid="post-card"]')).toHaveCount(1, {
      timeout: 5_000,
    });

    const card = results.locator('[data-testid="post-card"]').first();
    await expect(card).toHaveAttribute("data-theme", "twitter-modern");
  });

  test("controls panel toggle - open and close", async ({ page }) => {
    await page.goto("/");
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    const controlsPanel = page.locator('[data-testid="controls-panel"]');
    const toggleButton = page.locator('[data-testid="controls-toggle"]');

    // Controls should not be visible initially
    await expect(controlsPanel).toHaveCount(0);

    // Click cog to open
    await toggleButton.click();
    await expect(controlsPanel).toBeVisible();

    // Click cog again to close
    await toggleButton.click();
    await expect(controlsPanel).toHaveCount(0);
  });

  test("sort by newest - results ordered by date descending", async ({
    page,
  }) => {
    await page.goto("/");
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    // Search for a broad term that returns multiple results
    await searchInput.fill("the");

    const results = page.locator('[data-testid="results"]');
    await expect(
      results.locator('[data-testid="post-card"]'),
    ).not.toHaveCount(0, { timeout: 5_000 });

    // Open controls and change sort to newest
    const toggleButton = page.locator('[data-testid="controls-toggle"]');
    await toggleButton.click();

    const sortSelect = page.locator('[data-testid="sort-select"]');
    await sortSelect.selectOption("newest");

    // Wait for results to update
    await page.waitForTimeout(300);

    // Get all post cards and verify they contain dates
    const cards = results.locator('[data-testid="post-card"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(1);

    // Extract dates from card text content and verify descending order
    const dates: Date[] = [];
    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).textContent();
      // Date format: "Mon DD, YYYY" — extract with regex
      const match = text?.match(
        /(\w{3}\s+\d{1,2},\s+\d{4})/,
      );
      if (match) {
        dates.push(new Date(match[1]));
      }
    }

    for (let i = 1; i < dates.length; i++) {
      expect(dates[i].getTime()).toBeLessThanOrEqual(dates[i - 1].getTime());
    }
  });

  test("theme override - force all posts to twitter-classic", async ({
    page,
  }) => {
    await page.goto("/");
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    // Search for something returning posts from different eras
    await searchInput.fill("the");

    const results = page.locator('[data-testid="results"]');
    await expect(
      results.locator('[data-testid="post-card"]'),
    ).not.toHaveCount(0, { timeout: 5_000 });

    // Open controls and set theme override
    const toggleButton = page.locator('[data-testid="controls-toggle"]');
    await toggleButton.click();

    const themeSelect = page.locator('[data-testid="theme-select"]');
    await themeSelect.selectOption("twitter-classic");

    // All cards should have data-theme="twitter-classic"
    const cards = results.locator('[data-testid="post-card"]');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i)).toHaveAttribute(
        "data-theme",
        "twitter-classic",
      );
    }
  });

  test("responsive mobile - layout does not overflow at 375px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    // Search for results
    await searchInput.fill("corn");
    const results = page.locator('[data-testid="results"]');
    await expect(results.locator('[data-testid="post-card"]')).toHaveCount(1, {
      timeout: 5_000,
    });

    // Verify no horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);

    // Verify controls panel works on mobile
    const toggleButton = page.locator('[data-testid="controls-toggle"]');
    await toggleButton.click();
    const controlsPanel = page.locator('[data-testid="controls-panel"]');
    await expect(controlsPanel).toBeVisible();
  });

  test("filter by platform - X filter excludes Bluesky posts", async ({
    page,
  }) => {
    await page.goto("/");
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    // Search for a broad term that includes the Bluesky test post
    await searchInput.fill("hello");

    const results = page.locator('[data-testid="results"]');
    await expect(
      results.locator('[data-testid="post-card"]'),
    ).not.toHaveCount(0, { timeout: 5_000 });

    // Open controls and filter to X only
    const toggleButton = page.locator('[data-testid="controls-toggle"]');
    await toggleButton.click();

    const platformSelect = page.locator('[data-testid="platform-select"]');
    await platformSelect.selectOption("x");

    // Wait for results to update
    await page.waitForTimeout(300);

    // Verify no Bluesky cards remain
    const cards = results.locator('[data-testid="post-card"]');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i)).not.toHaveAttribute("data-theme", "bsky");
    }
  });
});
```

Note: The spec calls for test 8 (platform template for Bluesky). The sample test data (`testdata/sample.ndjson`) currently has no Bluesky or Threads posts. Test 8 can be added when the test fixture is expanded with multi-platform posts.

**Test fixture update for platform filter test:** Before running tests, add a Bluesky post to `testdata/sample.ndjson` so the platform filter test (below) has multi-platform data. Append a line like:

```json
{"id":"bsky-1","text":"hello from bluesky","created_at":"2024-12-01T12:00:00.000Z","is_reply":false,"reply_to_user":null,"is_quote":false,"quoted_text":null,"likes":42,"shares":5,"platform":"bsky"}
```

Then rebuild the test DB (`bun run build:testdb`).

- [ ] **Step 2: Verify E2E test file has no syntax errors**

Run:
```bash
cd /home/ixtli/Public/project/dril-archive && bunx tsc --noEmit --strict e2e/search.spec.ts --skipLibCheck --moduleResolution bundler --module esnext --target esnext 2>&1 | head -5
```

This is a quick syntax check only. Full E2E execution happens after Task 10 when the dev/preview server is wired up.

- [ ] **Step 3: Commit E2E tests**

```bash
git add e2e/search.spec.ts
git commit -m "test(e2e): adapt existing tests and add new display layer tests"
```

---

### Task 10: Build/Deploy Updates

**Files:**
- Modify: `package.json` (root)
- Modify: `scripts/dev.ts`

- [ ] **Step 1: Update root `package.json` scripts**

Replace the entire contents of `package.json`:

```json
{
  "name": "dril-archive",
  "private": true,
  "scripts": {
    "dev": "bun scripts/dev.ts",
    "build:testdb": "cargo run -p dril-builder -- testdata/sample.ndjson site/public/dril.db",
    "build:site": "cd site && bun run build",
    "preview": "cd site && bun run preview",
    "test:e2e": "bunx playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.52"
  }
}
```

Changes:
- `build:testdb` now outputs to `site/public/dril.db` (Vite serves `public/` as static)
- Added `build:site` script
- Added `preview` script
- Removed `@sqlite.org/sqlite-wasm` from root (it's now in `site/package.json`)

- [ ] **Step 2: Replace `scripts/dev.ts`**

Replace the entire contents of `scripts/dev.ts`:

```typescript
import { execSync } from "child_process";
import { mkdirSync, copyFileSync, statSync } from "fs";
import { join } from "path";

const ROOT_DIR = join(import.meta.dir, "..");
const SITE_DIR = join(ROOT_DIR, "site");
const PUBLIC_DIR = join(SITE_DIR, "public");
const DB_PATH = join(PUBLIC_DIR, "dril.db");
const SQLITE3_DIR = join(PUBLIC_DIR, "sqlite3");

// Ensure public directories exist
mkdirSync(SQLITE3_DIR, { recursive: true });

// Copy SQLite WASM files from site's node_modules
const SQLITE_SRC = join(SITE_DIR, "node_modules/@sqlite.org/sqlite-wasm/dist");
copyFileSync(join(SQLITE_SRC, "index.mjs"), join(SQLITE3_DIR, "index.mjs"));
copyFileSync(join(SQLITE_SRC, "sqlite3.wasm"), join(SQLITE3_DIR, "sqlite3.wasm"));

// Build the test DB if it doesn't exist
try {
  statSync(DB_PATH);
  console.log("dril.db exists, skipping build");
} catch {
  console.log("Building test database...");
  execSync(
    `cargo run -p dril-builder -- testdata/sample.ndjson ${DB_PATH}`,
    {
      stdio: "inherit",
      cwd: ROOT_DIR,
    },
  );
}

// Install site dependencies if needed
try {
  statSync(join(SITE_DIR, "node_modules"));
} catch {
  console.log("Installing site dependencies...");
  execSync("bun install", { stdio: "inherit", cwd: SITE_DIR });
}

// Start Vite dev server
console.log("Starting Vite dev server...");
execSync("bunx vite", {
  stdio: "inherit",
  cwd: SITE_DIR,
});
```

- [ ] **Step 3: Update `.gitignore` for new paths**

Ensure `.gitignore` includes:

```
site/public/dril.db
site/public/sqlite3/
site/dist/
site/node_modules/
```

Verify the old entries (`site/dril.db`, `site/sqlite3/`) are still present (or replaced by the new ones). Check the current `.gitignore` and update accordingly.

- [ ] **Step 4: Update `playwright.config.ts` webServer command**

The playwright config from Task 9 needs the webServer to build and preview. Update the `webServer` section in `playwright.config.ts`:

```typescript
  webServer: {
    command: "bun run build:testdb && bun run dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
```

Wait -- the Vite dev server runs on port 3000 (configured in `vite.config.ts`). Update `playwright.config.ts` to use port 3000 and baseURL `http://localhost:3000`:

Replace the entire contents of `playwright.config.ts`:

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://localhost:3000",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: "bun run dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 5: Verify the full dev flow works**

Run:
```bash
bun run dev
```

Expected: SQLite WASM files are copied, test DB is built if needed, Vite dev server starts on port 3000. Visit `http://localhost:3000` and verify the Svelte app loads, DB downloads, and search works.

Stop the server (Ctrl+C).

- [ ] **Step 6: Run E2E tests**

Run:
```bash
bun run test:e2e
```

Expected: All 14 tests pass. If any fail, debug and fix the specific test or component.

- [ ] **Step 7: Update `.github/workflows/deploy.yml` for Vite build**

Update the deploy workflow to build the Svelte app and deploy `site/dist/` instead of `site/`. The build steps should:

1. Install site dependencies: `cd site && bun install`
2. Build the Svelte app: `cd site && bun run build`
3. Copy `dril.db` into `site/dist/`: `cp dril.db site/dist/dril.db` (adjust source path based on how the production DB is produced)
4. Copy SQLite WASM files into `site/dist/sqlite3/`:
   ```bash
   mkdir -p site/dist/sqlite3
   cp site/node_modules/@sqlite.org/sqlite-wasm/dist/index.mjs site/dist/sqlite3/index.mjs
   cp site/node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3.wasm site/dist/sqlite3/sqlite3.wasm
   ```
5. Deploy `site/dist/` as the publish directory (instead of `site/`)

Review the existing workflow file and adapt accordingly. The deploy target directory changes from `site/` to `site/dist/`.

- [ ] **Step 8: Commit build/deploy updates**

```bash
git add package.json scripts/dev.ts playwright.config.ts .gitignore .github/workflows/deploy.yml
git commit -m "chore: update build scripts, dev server, deploy workflow, and playwright config for Vite"
```

---

### Task 11: Documentation Updates

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Update `CLAUDE.md` architecture section**

In the `## Architecture` section, change:

```
- **Frontend** (`site/`): Vanilla HTML/JS/CSS single-page app that loads the SQLite DB in-browser via `@sqlite.org/sqlite-wasm` and provides instant as-you-type search
```

To:

```
- **Frontend** (`site/`): Svelte 5 + Vite single-page app that loads the SQLite DB in-browser via `@sqlite.org/sqlite-wasm`, renders era-themed post cards, and provides instant as-you-type search with sort/filter/theme controls
```

- [ ] **Step 2: Update `CLAUDE.md` project layout**

Replace the `site/` section in the project layout with:

```
site/              Svelte 5 + Vite frontend (the deployable artifact)
  index.html       Vite entry point
  vite.config.ts   Vite config (SQLite WASM exclusion, COOP/COEP headers)
  svelte.config.js Svelte preprocessor config
  package.json     Site-specific dependencies (svelte, vite, sqlite-wasm)
  tsconfig.json    TypeScript config for Svelte
  .eslintrc.cjs    ESLint config (svelte + typescript)
  .prettierrc      Prettier config (svelte plugin)
  src/
    main.ts        App mount point
    App.svelte     Root component (loading, search, controls, results)
    app.css        Global dark theme + responsive layout
    lib/
      db.ts        SQLite WASM loading with progress callback
      search.ts    FTS5 query building, debounce, sort/filter
      themes.ts    Era detection, theme registry
      types.ts     Shared TypeScript types (Post, SortOption, etc.)
    components/
      SearchBar.svelte    Search input + cog icon toggle
      Controls.svelte     Collapsible sort/filter/theme panel
      PostCard.svelte     Template dispatcher (selects era template)
      LoadingBar.svelte   Progress bar + spinner
    templates/
      TwitterClassic.svelte   2008-2010 era card
      TwitterNew.svelte       2010-2014 era card
      TwitterMaterial.svelte  2014-2019 era card
      TwitterModern.svelte    2019-2023 era card
      Bluesky.svelte          Bluesky platform card
      Threads.svelte          Threads platform card
  public/
    dril.db        Database (copied by dev script, gitignored)
    sqlite3/       WASM files (copied by dev script, gitignored)
```

- [ ] **Step 3: Update `CLAUDE.md` Build & Run section**

Replace the `## Build & Run` section content with:

```sh
# Build the builder
cargo build --release -p dril-builder

# Generate the database from NDJSON
./target/release/dril-builder <input.ndjson> [output.db]

# Dev server (builds test DB + copies WASM + starts Vite)
bun run dev

# Production build
cd site && bun run build    # Output to site/dist/
```

- [ ] **Step 4: Update `CLAUDE.md` Testing section**

Replace the `## Testing` section content with:

```sh
cargo test -p dril-builder     # 18 Rust tests (7 post parser + 11 db)
cargo test -p dril-normalizer  # 9 normalizer tests
bun run test:e2e               # 14 E2E browser tests (Playwright)
```

- [ ] **Step 5: Update `CLAUDE.md` Code Quality section**

Replace the `## Code Quality` section content with:

```
Pre-commit hooks enforce formatting and linting. They run automatically on `git commit`.

- **Rust**: `cargo fmt --check`, `cargo clippy --workspace -- -D warnings`
- **Svelte app** (`site/src/`): `prettier` + `eslint` + `svelte-check` (via `prettier-plugin-svelte`, `eslint-plugin-svelte`)
- **Everything else**: `biome format` and `biome lint` (via `bunx @biomejs/biome`)

To manually run all hooks: `pre-commit run --all-files`

To format before committing:
```sh
cargo fmt
cd site && bunx prettier --write src/     # Svelte, TS, CSS
bunx @biomejs/biome format --write --html-formatter-enabled=true --css-formatter-enabled=true scripts/ e2e/
```
```

- [ ] **Step 6: Update `CLAUDE.md` Tech Stack table**

Replace the `Frontend` and `Formatting/Linting` rows:

```
| Frontend | Svelte 5 + Vite, TypeScript, `@sqlite.org/sqlite-wasm`, scoped CSS |
| Formatting/Linting | Prettier + eslint (Svelte app), Biome (scripts/e2e), cargo fmt, clippy |
```

- [ ] **Step 7: Update `CLAUDE.md` Conventions section**

Replace:
```
- No frameworks, no build step for frontend — just static files
```

With:
```
- Frontend uses Svelte 5 + Vite with TypeScript; site has its own package.json
```

- [ ] **Step 8: Update `CLAUDE.md` Gotchas section**

Add this gotcha:

```
- **SQLite WASM in Vite** — the `@sqlite.org/sqlite-wasm` package cannot be pre-bundled by Vite. The config uses `optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] }` and the WASM files must be in `site/public/sqlite3/` (copied by `scripts/dev.ts`).
- **Two JS formatters** — Prettier owns `site/src/` (Svelte support), Biome owns everything else. No file is touched by both. This split exists because Biome does not support `.svelte` files.
- **COOP/COEP headers** — Vite dev and preview servers set `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` for SQLite WASM `SharedArrayBuffer` support.
```

- [ ] **Step 9: Update the "Not Yet Implemented" section**

Remove this line (now implemented):
```
- **Twitter era themes** in the frontend (extraction tooling is built, frontend integration is pending)
```

- [ ] **Step 10: Update `README.md`**

Update `README.md` to document:

1. **Tech stack change**: The frontend is now Svelte 5 + Vite (not vanilla HTML/JS/CSS). Mention TypeScript and scoped CSS.
2. **Dual formatter boundary**: Prettier + eslint own `site/src/` (Svelte support), Biome owns everything else (`scripts/`, `e2e/`, root JS/TS). No file is touched by both.
3. **Updated dev commands**:
   - `bun run dev` — starts Vite dev server (builds test DB + copies WASM automatically)
   - `cd site && bun run build` — production build to `site/dist/`
   - `bun run test:e2e` — runs Playwright E2E tests
   - `cargo test` — runs Rust unit tests
4. **Updated build commands**:
   - `cd site && bun install` — install frontend dependencies
   - `cd site && bun run build` — production build

- [ ] **Step 11: Commit documentation updates**

```bash
git add CLAUDE.md README.md
git commit -m "docs: update CLAUDE.md and README.md for Svelte 5 + Vite frontend rewrite"
```

---

### Task 12: Migration Cleanup

**Files:**
- Delete: `site/app.js`
- Delete: `site/style.css`

- [ ] **Step 1: Verify the old files are no longer referenced**

Search for references to `app.js` and `style.css` in the codebase:

```bash
grep -r "app\.js" site/src/ e2e/ scripts/ || echo "No references found"
grep -r "style\.css" site/src/ e2e/ scripts/ || echo "No references found"
```

Expected: No references found (the new Svelte app uses `main.ts` and `app.css`).

- [ ] **Step 2: Delete old frontend files**

```bash
rm site/app.js site/style.css
```

- [ ] **Step 3: Verify the old `site/index.html` is already replaced**

The `site/index.html` was replaced in Task 1 Step 5 with the Vite entry point. Verify it references `/src/main.ts` and not `app.js`:

```bash
grep "main.ts" site/index.html && echo "OK: references main.ts"
grep "app.js" site/index.html && echo "ERROR: still references app.js" || echo "OK: no app.js reference"
```

Expected: "OK: references main.ts" and "OK: no app.js reference".

- [ ] **Step 4: Run full E2E test suite to confirm nothing is broken**

```bash
bun run test:e2e
```

Expected: All 14 tests pass.

- [ ] **Step 5: Commit migration cleanup**

```bash
git add -A
git commit -m "chore: remove old vanilla JS frontend files (app.js, style.css)"
```

- [ ] **Step 6: Run pre-commit hooks on the full repo**

```bash
pre-commit run --all-files
```

Expected: All hooks pass.

# E2E Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Playwright-based E2E browser tests and a dev server command to the dril-archive frontend.

**Architecture:** A bun script (`scripts/dev.ts`) builds the test DB and serves `site/` on port 3000. Playwright's `webServer` config reuses this script to start/stop the server around tests. Five E2E tests verify the full user flow in headless Chromium.

**Tech Stack:** Bun, Playwright, TypeScript (config + tests only)

---

## File Map

**Create:**
- `package.json` — bun project with playwright dev dependency and scripts
- `scripts/dev.ts` — builds test DB via cargo, serves `site/` on port 3000
- `playwright.config.ts` — Playwright config pointing at `./e2e`, webServer using dev script
- `e2e/search.spec.ts` — 5 E2E test cases

**Modify:**
- `.gitignore` — add `node_modules/`, `test-results/`, `playwright-report/`

---

### Task 1: Package Setup and Dev Server

**Files:**
- Create: `package.json`
- Create: `scripts/dev.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create package.json**

Create `package.json`:

```json
{
  "name": "dril-archive",
  "private": true,
  "scripts": {
    "dev": "bun scripts/dev.ts",
    "build:testdb": "cargo run -p dril-builder -- testdata/sample.ndjson site/dril.db",
    "test:e2e": "bunx playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.52"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
bun install
```
Expected: `bun.lock` created, `node_modules/` populated

- [ ] **Step 3: Install Playwright browsers**

Run:
```bash
bunx playwright install chromium
```
Expected: Chromium browser downloaded to Playwright's cache

- [ ] **Step 4: Create the dev server script**

Create `scripts/dev.ts`:

```typescript
import { execSync } from "child_process";
import { join } from "path";
import { statSync } from "fs";

const SITE_DIR = join(import.meta.dir, "..", "site");
const DB_PATH = join(SITE_DIR, "dril.db");
const PORT = 3000;

// Build the test DB if it doesn't exist
try {
  statSync(DB_PATH);
  console.log("dril.db exists, skipping build");
} catch {
  console.log("Building test database...");
  execSync("cargo run -p dril-builder -- testdata/sample.ndjson site/dril.db", {
    stdio: "inherit",
    cwd: join(import.meta.dir, ".."),
  });
}

// Serve the site directory
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;
    if (path === "/") path = "/index.html";

    const filePath = join(SITE_DIR, path);
    const file = Bun.file(filePath);

    if (await file.exists()) {
      return new Response(file);
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Serving site at http://localhost:${server.port}`);
```

- [ ] **Step 5: Update .gitignore**

Append to `.gitignore`:

```
node_modules/
test-results/
playwright-report/
```

- [ ] **Step 6: Test the dev server**

Run:
```bash
bun run dev
```
Expected: Prints "Building test database..." (or "dril.db exists"), then "Serving site at http://localhost:3000"

Open `http://localhost:3000` in a browser. Verify the search page loads and works. Kill the server with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add package.json bun.lock scripts/dev.ts .gitignore
git commit -m "feat: add bun project with dev server script"
```

Note: `node_modules/` is gitignored so it won't be staged.

---

### Task 2: Playwright Configuration

**Files:**
- Create: `playwright.config.ts`

- [ ] **Step 1: Create playwright.config.ts**

Create `playwright.config.ts`:

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
    command: "bun scripts/dev.ts",
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 2: Verify Playwright picks up the config**

Run:
```bash
bunx playwright test --list
```
Expected: Output should show "no tests found" (since we haven't written any yet), but no config errors.

- [ ] **Step 3: Commit**

```bash
git add playwright.config.ts
git commit -m "feat: add playwright config with dev server integration"
```

---

### Task 3: E2E Search Tests

**Files:**
- Create: `e2e/search.spec.ts`

- [ ] **Step 1: Create the test file with all 5 tests**

Create `e2e/search.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("dril archive search", () => {
  test("page loads and search box appears", async ({ page }) => {
    await page.goto("/");

    // Loading indicator should be visible initially
    const loading = page.locator("#loading");
    await expect(loading).toBeVisible();

    // Wait for search container to appear (DB loaded, WASM initialized)
    const searchInput = page.locator("#search-input");
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    // Loading should be hidden now
    await expect(loading).toBeHidden();
  });

  test("search returns results", async ({ page }) => {
    await page.goto("/");
    const searchInput = page.locator("#search-input");
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    await searchInput.fill("corn");

    // Wait for debounce + query
    const results = page.locator("#results");
    await expect(results.locator(".post")).toHaveCount(1, { timeout: 5_000 });

    // Verify it's the corn cob post
    await expect(results).toContainText("corn cob");
    // Verify the link to X is present
    await expect(results.locator('a[href="https://x.com/dril/status/5"]')).toBeVisible();
  });

  test("reply metadata renders", async ({ page }) => {
    await page.goto("/");
    const searchInput = page.locator("#search-input");
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    await searchInput.fill("baby");

    const results = page.locator("#results");
    await expect(results.locator(".post")).toHaveCount(1, { timeout: 5_000 });

    // Verify reply-to metadata is shown
    await expect(results.locator(".post-reply-to")).toContainText("replying to @someone");
  });

  test("clear search clears results", async ({ page }) => {
    await page.goto("/");
    const searchInput = page.locator("#search-input");
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    // Type a query and wait for results
    await searchInput.fill("corn");
    const results = page.locator("#results");
    await expect(results.locator(".post")).toHaveCount(1, { timeout: 5_000 });

    // Clear the input
    await searchInput.fill("");

    // Results should be empty (no .post elements, no "no results" message)
    await expect(results).toBeEmpty();
  });

  test("no results state", async ({ page }) => {
    await page.goto("/");
    const searchInput = page.locator("#search-input");
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    await searchInput.fill("xyzgarbage123");

    const results = page.locator("#results");
    await expect(results).toContainText("no results", { timeout: 5_000 });
  });
});
```

- [ ] **Step 2: Run the tests**

Run:
```bash
bun run test:e2e
```
Expected: All 5 tests pass. Output should show:

```
  ✓ dril archive search > page loads and search box appears
  ✓ dril archive search > search returns results
  ✓ dril archive search > reply metadata renders
  ✓ dril archive search > clear search clears results
  ✓ dril archive search > no results state

  5 passed
```

If any test fails, debug by running with headed mode:
```bash
bunx playwright test --headed
```

- [ ] **Step 3: Verify tests fail when they should**

Temporarily break something to make sure tests aren't vacuously passing. For example, change the search term in "search returns results" from "corn" to "xyznotreal" and verify the test fails. Then revert.

- [ ] **Step 4: Commit**

```bash
git add e2e/search.spec.ts
git commit -m "feat: add 5 E2E search tests with Playwright"
```

---

### Task 4: Update Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Update CLAUDE.md**

Add an "E2E Testing" section to `CLAUDE.md` after the "Testing" section:

```markdown
## E2E Testing

```sh
bun run test:e2e          # Run Playwright tests in headless Chromium
bunx playwright test --headed  # Run with visible browser for debugging
```

Playwright is configured in `playwright.config.ts`. Tests live in `e2e/`. The dev server (`scripts/dev.ts`) builds the test DB and serves `site/` — Playwright starts/stops it automatically.
```

Update the existing "Testing" section to mention both:

```markdown
## Testing

```sh
cargo test -p dril-builder    # 14 Rust tests (7 post parser + 7 db)
bun run test:e2e              # 5 E2E browser tests (Playwright)
```
```

- [ ] **Step 2: Update README.md**

Add to the Development section:

```markdown
## Development

```sh
# Run Rust tests
cargo test

# Start dev server (builds test DB + serves site)
bun run dev

# Run E2E browser tests
bun run test:e2e

# Check formatting and lints (requires pre-commit, bun)
pre-commit run --all-files
```
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: add E2E testing instructions to CLAUDE.md and README"
```

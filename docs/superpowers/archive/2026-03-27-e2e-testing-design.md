# E2E Testing Design Spec

## Overview

Add end-to-end browser tests for the dril-archive frontend using Playwright, plus a dev server command for local development. The frontend remains plain static files — no build step, no framework migration.

## Goals

- Verify the full user flow works in a real browser: DB download, WASM init, search, result rendering
- Provide a `bun run dev` command for local development
- Establish `package.json` so CSS/JS libraries can be added later

## Non-Goals

- Unit testing JS functions in isolation (not needed at this scale)
- Testing the Rust builder (already covered by cargo test)
- Live reload / HMR (plain static server is sufficient)

## Architecture

### Package Setup

A `package.json` at the repo root with:
- `@playwright/test` as a dev dependency
- Scripts: `dev`, `test:e2e`, `build:testdb`

### Dev Server

`bun run dev` does two things:
1. Builds the test DB: `cargo run -p dril-builder -- testdata/sample.ndjson site/dril.db`
2. Starts a static HTTP server on `site/` (using bun's built-in `Bun.serve` or a simple static file server script)

### Test Infrastructure

Playwright's `webServer` config option handles the test lifecycle:
1. Before tests: runs a command that builds the test DB and starts a static server on `site/`
2. Tests run against `http://localhost:3000` in headless Chromium
3. After tests: the server is killed automatically by Playwright

A `globalSetup` or the webServer command itself ensures `site/dril.db` is built from `testdata/sample.ndjson` before the server starts.

### Playwright Config

```
playwright.config.ts
- testDir: ./e2e
- webServer: command that builds DB + serves site/
- use: { baseURL: http://localhost:3000 }
- projects: [chromium] (single browser is sufficient)
```

### Test File

`e2e/search.spec.ts` — 5 test cases:

1. **Page loads and search box appears** — navigate to `/`, wait for loading to finish, assert search input is visible
2. **Search returns results** — type "corn" in the search box, assert the corn cob post text appears in results
3. **Reply metadata renders** — type "baby" (matches the reply post), assert "replying to @someone" is visible
4. **Clear search clears results** — type a query, then clear the input, assert results area is empty
5. **No results state** — type "xyzgarbage123", assert "no results" message appears

### Dev Script

A small bun script (`scripts/dev.ts` or similar) that:
1. Runs the builder to create `site/dril.db` from test data
2. Serves the `site/` directory on a local port
3. Logs the URL to the console

This script is reused by both `bun run dev` and Playwright's `webServer`.

## Project Structure Changes

```
dril-archive/
├── package.json              # NEW — bun project, playwright dep
├── bun.lock                  # NEW — lockfile
├── playwright.config.ts      # NEW — playwright config
├── e2e/                      # NEW — test directory
│   └── search.spec.ts        # NEW — 5 E2E test cases
├── scripts/                  # NEW — dev/build scripts
│   └── dev.ts                # NEW — builds test DB + serves site/
├── builder/                  # unchanged
├── site/                     # unchanged
├── testdata/                 # unchanged
└── ...
```

## .gitignore Updates

Add:
- `node_modules/`
- `test-results/`
- `playwright-report/`

## Test Data

Tests use the existing `testdata/sample.ndjson` (10 sample posts). No new test data needed — the current fixtures cover all 5 test scenarios:
- Post ID 5: corn cob post (search test)
- Post ID 6: reply to @someone (reply metadata test)
- Any query with no matches (no results test)

## Commands

| Command | What it does |
|---------|-------------|
| `bun run dev` | Build test DB + serve site locally |
| `bun run test:e2e` | Build test DB + run Playwright tests in headless Chromium |
| `bunx playwright install` | One-time browser install (part of setup) |

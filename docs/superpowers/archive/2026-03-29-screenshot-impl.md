# Screenshot Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Save as image" option to the post card menu that captures the themed card as a JPEG and shows it in a saveable overlay.

**Architecture:** html2canvas captures the template DOM element, converts to JPEG blob, and displays in a modal overlay with download button and long-press hint for mobile. Entirely client-side, no new components beyond the overlay.

**Tech Stack:** html2canvas, Svelte 5, existing PostCard.svelte

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `site/src/components/PostCard.svelte` | Add "Save as image" menu item, capture logic, ref to template element, overlay rendering |
| Modify | `site/package.json` | Add html2canvas dependency |
| Modify | `e2e/search.spec.ts` | E2E test for screenshot menu item and overlay |

The overlay is simple enough (an img, a button, a hint line) to live inline in PostCard.svelte rather than extracting a separate component.

---

### Task 1: Add html2canvas dependency

**Files:**
- Modify: `site/package.json`

- [ ] **Step 1: Install html2canvas**

```bash
cd site && bun add html2canvas
```

- [ ] **Step 2: Verify installation**

```bash
cd site && bun run check
```

Expected: no type errors

- [ ] **Step 3: Commit**

```bash
git add site/package.json site/bun.lockb
git commit -m "feat(site): add html2canvas dependency for screenshot feature"
```

---

### Task 2: Add template element ref and capture function

**Files:**
- Modify: `site/src/components/PostCard.svelte`

- [ ] **Step 1: Write the E2E test for the menu item**

Add to `e2e/search.spec.ts`:

```typescript
test("save as image menu item appears and opens overlay", async ({ page }) => {
	await page.goto("/");
	const results = await searchFor(page, "corn cob");
	const card = results.locator('[data-testid="post-card"]').first();

	// Hover to reveal menu button, then click it
	await card.hover();
	const moreButton = card.locator("button[aria-label='Post options']");
	await moreButton.click();

	// "Save as image" should be in the popover
	const saveItem = card.locator("button.popover-item", { hasText: "Save as image" });
	await expect(saveItem).toBeVisible();

	// Click it
	await saveItem.click();

	// Overlay should appear with an image
	const overlay = page.locator('[data-testid="screenshot-overlay"]');
	await expect(overlay).toBeVisible({ timeout: 5_000 });
	const img = overlay.locator("img");
	await expect(img).toBeVisible();

	// Should have the mobile hint text
	await expect(overlay).toContainText("Long-press image to save on mobile");

	// Should have a download link
	const downloadLink = overlay.locator("a[download]");
	await expect(downloadLink).toBeVisible();

	// Close overlay by clicking backdrop
	await overlay.click({ position: { x: 5, y: 5 } });
	await expect(overlay).not.toBeVisible();
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /home/ixtli/Public/project/dril-archive && bun run test:e2e -- --grep "save as image"
```

Expected: FAIL — no "Save as image" button exists yet

- [ ] **Step 3: Add the template ref binding to PostCard.svelte**

In the `<script>` block, add after the existing state declarations:

```typescript
import html2canvas from "html2canvas";

let wrapperEl: HTMLElement | undefined = $state();
let screenshotUrl: string | null = $state(null);
```

Instead of wrapping in a new div (which could affect layout), use `bind:this` on the existing `.post-card-wrapper` div. Change the `templateEl` binding target: rather than a wrapper around templates, we'll capture the first child element of the wrapper (the `<article>` rendered by each template) at capture time. This avoids adding any wrapper divs.

No changes to the template block markup. Instead, update the capture function to find the template's root `<article>` element:

```typescript
let wrapperEl: HTMLElement | undefined = $state();
```

And add `bind:this={wrapperEl}` to the `.post-card-wrapper` div (the one that already exists on line 49).

- [ ] **Step 4: Add the capture and overlay logic**

Add the capture function in the `<script>` block:

```typescript
async function handleSaveAsImage() {
	closeMenu();
	if (!wrapperEl) return;
	// Grab the <article> element rendered by the active template
	const articleEl = wrapperEl.querySelector("article");
	if (!articleEl) return;
	const canvas = await html2canvas(articleEl, {
		useCORS: true,
		backgroundColor: null,
	});
	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, "image/jpeg", 0.92),
	);
	if (!blob) return;
	screenshotUrl = URL.createObjectURL(blob);
}

function closeOverlay() {
	if (screenshotUrl) {
		URL.revokeObjectURL(screenshotUrl);
		screenshotUrl = null;
	}
}
```

- [ ] **Step 5: Add the menu item and overlay markup**

Add the "Save as image" button inside the popover, after the "View original" link:

```svelte
<button class="popover-item" onclick={handleSaveAsImage}>Save as image</button>
```

Add the overlay markup after the `</div>` that closes `.post-card-wrapper`, but actually it needs to be inside the wrapper for scoped styles. Add it right before the closing `</div>` of `.post-card-wrapper`, after the popover `{/if}`:

```svelte
{#if screenshotUrl}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="screenshot-overlay"
		data-testid="screenshot-overlay"
		onclick={closeOverlay}
		onkeydown={(e) => { if (e.key === "Escape") closeOverlay(); }}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="screenshot-modal" onclick={(e) => e.stopPropagation()}>
			<button class="screenshot-close" onclick={closeOverlay} aria-label="Close">&times;</button>
			<img src={screenshotUrl} alt="Screenshot of post" class="screenshot-img" />
			<div class="screenshot-actions">
				<a
					href={screenshotUrl}
					download="dril-{post.id}.jpg"
					class="screenshot-download"
				>
					Download
				</a>
			</div>
			<p class="screenshot-hint">Long-press image to save on mobile</p>
		</div>
	</div>
{/if}
```

- [ ] **Step 6: Add the overlay styles**

Add to the `<style>` block in PostCard.svelte:

```css
.screenshot-overlay {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.7);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 100;
	padding: 16px;
}

.screenshot-modal {
	background: #1a1a1a;
	border-radius: 12px;
	padding: 16px;
	max-width: 90vw;
	max-height: 90vh;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;
	position: relative;
}

.screenshot-close {
	position: absolute;
	top: 8px;
	right: 12px;
	background: none;
	border: none;
	color: #999;
	font-size: 24px;
	cursor: pointer;
	line-height: 1;
}

.screenshot-close:hover {
	color: #fff;
}

.screenshot-img {
	max-width: 100%;
	max-height: 70vh;
	border-radius: 4px;
}

.screenshot-actions {
	display: flex;
	gap: 12px;
}

.screenshot-download {
	display: inline-block;
	padding: 8px 20px;
	background: #333;
	color: #e0e0e0;
	text-decoration: none;
	border-radius: 6px;
	font-size: 14px;
}

.screenshot-download:hover {
	background: #444;
}

.screenshot-hint {
	color: #777;
	font-size: 12px;
	margin: 0;
}
```

- [ ] **Step 7: Run the E2E test**

```bash
cd /home/ixtli/Public/project/dril-archive && bun run test:e2e -- --grep "save as image"
```

Expected: PASS

- [ ] **Step 8: Run all E2E tests to check for regressions**

```bash
cd /home/ixtli/Public/project/dril-archive && bun run test:e2e
```

Expected: all 15 tests pass (14 existing + 1 new)

- [ ] **Step 9: Run formatters**

```bash
cd /home/ixtli/Public/project/dril-archive && bunx prettier --write 'site/src/**/*.svelte'
cd /home/ixtli/Public/project/dril-archive && bunx @biomejs/biome format --write --html-formatter-enabled=true --css-formatter-enabled=true site/
cd /home/ixtli/Public/project/dril-archive && bunx @biomejs/biome format --write e2e/
```

- [ ] **Step 10: Commit**

```bash
git add site/src/components/PostCard.svelte e2e/search.spec.ts
git commit -m "feat(site): add save-as-image screenshot feature to post card menu"
```

---

### Task 3: Manual cross-browser verification

This task is manual — verify the feature works on real devices/browsers.

- [ ] **Step 1: Start dev server**

```bash
cd /home/ixtli/Public/project/dril-archive && bun run dev
```

- [ ] **Step 2: Verify on desktop**

Open `http://localhost:5173`, search for a post, click "..." menu, click "Save as image". Confirm:
- Overlay appears with rendered JPEG of the card
- "Download" button triggers file save as `dril-{id}.jpg`
- Click outside dismisses overlay

- [ ] **Step 3: Verify on mobile (or DevTools mobile emulation)**

Same flow on a phone-sized viewport. Confirm:
- Long-press on the image shows the native "Save Image" option
- "Long-press image to save on mobile" hint is visible
- Overlay is scrollable if image is tall

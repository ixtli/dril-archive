# Screenshot Feature Design

## Summary

Add a "Save as image" option to the existing post card popover menu that captures the themed post card as a JPEG and presents it in an overlay for saving.

## Menu Addition

A new "Save as image" item in the PostCard.svelte popover menu, below the existing "View original" link.

## User Flow

1. User clicks the "..." menu on a post card
2. User clicks "Save as image"
3. Menu closes
4. html2canvas captures the template element (the themed card only, not the PostCard wrapper or menu chrome)
5. Canvas is converted to JPEG blob (quality: 0.92)
6. A modal overlay appears containing:
   - The generated image as an `<img>` element
   - A "Download" button (uses `<a download>` — works on desktop, no-ops on iOS)
   - Hint text below the image: "Long-press image to save on mobile" in muted styling
   - Click-outside or close button to dismiss

## Capture Target

html2canvas targets the template container element — the root element inside each era template (TwitterClassic, TwitterModern, Bluesky, etc.), not the PostCard wrapper. This excludes the menu button and popover from the capture.

The capture uses the current rendered size of the card, with no scaling or fixed-width normalization. The output matches what the user sees on screen.

## Output Format

- Format: JPEG
- Quality: 0.92
- Filename for download: `dril-{post.id}.jpg`

## Dependencies

- `html2canvas` added via `bun add html2canvas`
- Chosen over `html-to-image` because html-to-image uses SVG `foreignObject` which has known rendering issues on Safari/iOS. html2canvas re-implements CSS rendering by walking the DOM and painting to a canvas directly, avoiding those pitfalls.

## Components

### PostCard.svelte Changes

- Add "Save as image" menu item below "View original"
- On click: close menu, invoke capture function, show overlay
- Need a ref to the template container element to pass to html2canvas

### Screenshot Overlay (new)

A lightweight modal component (or inline in PostCard) that:
- Shows a semi-transparent backdrop
- Centers the generated image
- Shows "Download" button
- Shows "Long-press image to save on mobile" hint in muted text
- Dismisses on click-outside or close button

## What Is Excluded

- No loading spinner — capture is near-instant for these simple cards
- No error handling UI — if capture fails, the modal simply doesn't appear
- No PNG option — JPEG only for now
- No scaling or fixed-width rendering

<script lang="ts">
	import type { Post, ThemeId } from "../lib/types";
	import { resolveTheme } from "../lib/themes";
	import { postUrl } from "../lib/search";
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
	let url = $derived(postUrl(post.platform, post.id));

	let showMenu = $state(false);
	let wrapperEl: HTMLElement | undefined = $state();
	let screenshotUrl: string | null = $state(null);
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;

	function handleMoreClick(e: MouseEvent) {
		e.stopPropagation();
		showMenu = !showMenu;
	}

	function closeMenu() {
		showMenu = false;
	}

	function handleTouchStart() {
		longPressTimer = setTimeout(() => {
			showMenu = true;
		}, 500);
	}

	function handleTouchEnd() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	}

	async function handleSaveAsImage() {
		closeMenu();
		try {
			if (!wrapperEl) return;
			const articleEl = wrapperEl.querySelector("article");
			if (!articleEl) return;
			const { default: html2canvas } = await import("html2canvas");
			const canvas = await html2canvas(articleEl, {
				useCORS: true,
				backgroundColor: null,
			});
			const blob = await new Promise<Blob | null>((resolve) =>
				canvas.toBlob(resolve, "image/jpeg", 0.92),
			);
			if (!blob) return;
			screenshotUrl = URL.createObjectURL(blob);
		} catch {
			return;
		}
	}

	function closeOverlay() {
		if (screenshotUrl) {
			URL.revokeObjectURL(screenshotUrl);
			screenshotUrl = null;
		}
	}
</script>

<svelte:window onclick={closeMenu} />

<div
	bind:this={wrapperEl}
	class="post-card-wrapper"
	data-testid="post-card"
	data-theme={theme}
	role="article"
	ontouchstart={handleTouchStart}
	ontouchend={handleTouchEnd}
	ontouchmove={handleTouchEnd}
	onmouseleave={closeMenu}
>
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

	<!-- Hover/long-press overlay — doesn't affect card layout -->
	<button class="more-button" onclick={handleMoreClick} aria-label="Post options"> ··· </button>

	{#if showMenu}
		<div
			class="popover"
			role="presentation"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<a href={url} target="_blank" rel="noopener" class="popover-item" onclick={closeMenu}>
				View original
			</a>
			<button class="popover-item" onclick={handleSaveAsImage}>Save as image</button>
		</div>
	{/if}

	{#if screenshotUrl}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="screenshot-overlay"
			data-testid="screenshot-overlay"
			tabindex="-1"
			onclick={closeOverlay}
			onkeydown={(e) => {
				if (e.key === "Escape") closeOverlay();
			}}
		>
			<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
			<div class="screenshot-modal" onclick={(e) => e.stopPropagation()}>
				<button class="screenshot-close" onclick={closeOverlay} aria-label="Close">&times;</button>
				<img src={screenshotUrl} alt="Screenshot of post" class="screenshot-img" />
				<div class="screenshot-actions">
					<a href={screenshotUrl} download="dril-{post.id}.jpg" class="screenshot-download">
						Download
					</a>
				</div>
				<p class="screenshot-hint">Long-press image to save on mobile</p>
			</div>
		</div>
	{/if}
</div>

<style>
	.post-card-wrapper {
		position: relative;
	}

	.more-button {
		position: absolute;
		top: 8px;
		right: 8px;
		opacity: 0;
		transition: opacity 0.15s;
		background: rgba(0, 0, 0, 0.6);
		color: white;
		border: none;
		border-radius: 50%;
		width: 28px;
		height: 28px;
		font-size: 14px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		letter-spacing: 1px;
		z-index: 10;
	}

	.post-card-wrapper:hover .more-button {
		opacity: 1;
	}

	.popover {
		position: absolute;
		top: 40px;
		right: 8px;
		background: #2a2a2a;
		border: 1px solid #444;
		border-radius: 8px;
		padding: 4px;
		z-index: 20;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.popover-item {
		display: block;
		padding: 8px 16px;
		color: #e0e0e0;
		text-decoration: none;
		font-size: 14px;
		border-radius: 4px;
		white-space: nowrap;
		background: none;
		border: none;
		cursor: pointer;
		font: inherit;
	}

	.popover-item:hover {
		background: #333;
	}

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
		top: 0px;
		right: 5px;
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
</style>

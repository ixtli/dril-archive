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
</script>

<svelte:window onclick={closeMenu} />

<div
	class="post-card-wrapper"
	data-testid="post-card"
	data-theme={theme}
	role="article"
	ontouchstart={handleTouchStart}
	ontouchend={handleTouchEnd}
	ontouchmove={handleTouchEnd}
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
			<a href={url} target="_blank" rel="noopener" class="popover-item"> View original </a>
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
	}

	.popover-item:hover {
		background: #333;
	}
</style>

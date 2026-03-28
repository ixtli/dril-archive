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

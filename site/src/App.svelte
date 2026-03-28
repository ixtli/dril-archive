<script lang="ts">
	import type { Post, SortOption, FilterState } from "./lib/types";
	import { initDb } from "./lib/db";
	import { debouncedSearch } from "./lib/search";
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
	let controlsOpen = $state(false);

	async function init() {
		try {
			await initDb((received, total, phase) => {
				if (total > 0) {
					progress = Math.round((received / total) * 100);
				}
				loadingMessage =
					total > 0
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

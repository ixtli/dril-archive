<script lang="ts">
	import type {
		Post,
		SortOption,
		FilterState,
		ThemeId,
		PlatformFilter,
		TypeFilter,
	} from "./lib/types";
	import { initDb, search } from "./lib/db";
	import LoadingBar from "./components/LoadingBar.svelte";
	import SearchBar from "./components/SearchBar.svelte";
	import Controls from "./components/Controls.svelte";
	import PostCard from "./components/PostCard.svelte";

	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let progress = $state(0);
	let loadingMessage = $state("Downloading archive...");

	let query = $state("");
	let results = $state<Post[]>([]);
	let searching = $state(false);
	let sort = $state<SortOption>("relevance");
	let filters = $state<FilterState>({ platform: "all", type: "all" });
	let controlsOpen = $state(false);
	let themeOverride = $state<ThemeId | "auto">("auto");
	let includeRetweets = $state(true);
	let searchVersion = 0;

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

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function runSearch(input: string) {
		if (debounceTimer) clearTimeout(debounceTimer);
		if (!input.trim()) {
			searching = false;
			results = [];
			return;
		}
		searching = true;
		const version = ++searchVersion;
		debounceTimer = setTimeout(async () => {
			const r = await search(input, sort, filters, includeRetweets);
			if (version === searchVersion) {
				results = r;
				searching = false;
			}
		}, 120);
	}

	function handleInput(value: string) {
		query = value;
		runSearch(value);
	}

	function handleToggleControls() {
		controlsOpen = !controlsOpen;
	}

	function rerunSearch() {
		if (!query.trim()) return;
		runSearch(query);
	}

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

	function handleRetweetsChange(include: boolean) {
		includeRetweets = include;
		rerunSearch();
	}

	init();
</script>

<main>
	<h1>dril archive</h1>

	{#if loading}
		<LoadingBar {progress} message={loadingMessage} />
	{:else}
		<SearchBar value={query} onInput={handleInput} onToggleControls={handleToggleControls} />

		{#if controlsOpen}
			<Controls
				{sort}
				platformFilter={filters.platform}
				typeFilter={filters.type}
				{themeOverride}
				{includeRetweets}
				onSortChange={handleSortChange}
				onPlatformChange={handlePlatformChange}
				onTypeChange={handleTypeChange}
				onThemeChange={handleThemeChange}
				onRetweetsChange={handleRetweetsChange}
			/>
		{/if}

		<div class="results" data-testid="results">
			{#if searching}
				<div class="searching" data-testid="searching-indicator">
					<span class="spinner"></span>
					<span>searching...</span>
				</div>
			{:else if query.trim() && results.length === 0}
				<p class="no-results">no results</p>
			{/if}
			{#each results as post (post.id)}
				<PostCard {post} {themeOverride} />
			{/each}
		</div>
	{/if}
</main>

<style>
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

	.searching {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #888;
		margin-top: 20px;
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid #444;
		border-top-color: #4a9eff;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
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
</style>

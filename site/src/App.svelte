<script lang="ts">
	import type {
		Post,
		SortOption,
		FilterState,
		ThemeId,
		PlatformFilter,
		TypeFilter,
	} from "./lib/types";
	import { initDb } from "./lib/db";
	import { debouncedSearch } from "./lib/search";
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
	let sort = $state<SortOption>("relevance");
	let filters = $state<FilterState>({ platform: "all", type: "all" });
	let controlsOpen = $state(false);
	let themeOverride = $state<ThemeId | "auto">("auto");

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

	function rerunSearch() {
		if (!query.trim()) return;
		debouncedSearch(query, sort, filters, (r) => {
			results = r;
		});
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
				onSortChange={handleSortChange}
				onPlatformChange={handlePlatformChange}
				onTypeChange={handleTypeChange}
				onThemeChange={handleThemeChange}
			/>
		{/if}

		<div class="results" data-testid="results">
			{#if query.trim() && results.length === 0}
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
</style>

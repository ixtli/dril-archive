<script lang="ts">
	import type { SortOption, PlatformFilter, TypeFilter, ThemeId } from "../lib/types";
	import { ALL_THEMES, THEME_LABELS } from "../lib/themes";

	interface Props {
		sort: SortOption;
		platformFilter: PlatformFilter;
		typeFilter: TypeFilter;
		themeOverride: ThemeId | "auto";
		onSortChange: (sort: SortOption) => void;
		onPlatformChange: (platform: PlatformFilter) => void;
		onTypeChange: (type: TypeFilter) => void;
		onThemeChange: (theme: ThemeId | "auto") => void;
	}

	let {
		sort,
		platformFilter,
		typeFilter,
		themeOverride,
		onSortChange,
		onPlatformChange,
		onTypeChange,
		onThemeChange,
	}: Props = $props();

	const SORT_OPTIONS: { value: SortOption; label: string }[] = [
		{ value: "relevance", label: "Relevance" },
		{ value: "newest", label: "Newest first" },
		{ value: "oldest", label: "Oldest first" },
		{ value: "most-liked", label: "Most liked" },
		{ value: "most-shared", label: "Most shared" },
	];

	const PLATFORM_OPTIONS: { value: PlatformFilter; label: string }[] = [
		{ value: "all", label: "All platforms" },
		{ value: "x", label: "X (Twitter)" },
		{ value: "bsky", label: "Bluesky" },
		{ value: "threads", label: "Threads" },
	];

	const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
		{ value: "all", label: "All types" },
		{ value: "original", label: "Original posts" },
		{ value: "replies", label: "Replies" },
		{ value: "quotes", label: "Quote posts" },
	];
</script>

<div class="controls" data-testid="controls-panel">
	<div class="control-group">
		<label class="control-label" for="sort-select">Sort</label>
		<select
			id="sort-select"
			data-testid="sort-select"
			value={sort}
			onchange={(e) => onSortChange((e.target as HTMLSelectElement).value as SortOption)}
		>
			{#each SORT_OPTIONS as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	</div>

	<div class="control-group">
		<label class="control-label" for="platform-select">Platform</label>
		<select
			id="platform-select"
			data-testid="platform-select"
			value={platformFilter}
			onchange={(e) => onPlatformChange((e.target as HTMLSelectElement).value as PlatformFilter)}
		>
			{#each PLATFORM_OPTIONS as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	</div>

	<div class="control-group">
		<label class="control-label" for="type-select">Type</label>
		<select
			id="type-select"
			data-testid="type-select"
			value={typeFilter}
			onchange={(e) => onTypeChange((e.target as HTMLSelectElement).value as TypeFilter)}
		>
			{#each TYPE_OPTIONS as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	</div>

	<div class="control-group">
		<label class="control-label" for="theme-select">Theme</label>
		<select
			id="theme-select"
			data-testid="theme-select"
			value={themeOverride}
			onchange={(e) => onThemeChange((e.target as HTMLSelectElement).value as ThemeId | "auto")}
		>
			{#each ALL_THEMES as themeId}
				<option value={themeId}>{THEME_LABELS[themeId]}</option>
			{/each}
		</select>
	</div>
</div>

<style>
	.controls {
		background: #222;
		border: 1px solid #333;
		border-radius: 6px;
		padding: 12px 16px;
		margin-top: 8px;
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}

	.control-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1;
		min-width: 140px;
	}

	.control-label {
		font-size: 0.7rem;
		color: #888;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	select {
		background: #2a2a2a;
		border: 1px solid #444;
		border-radius: 4px;
		color: #e0e0e0;
		padding: 6px 8px;
		font-size: 0.85rem;
		font-family: inherit;
		cursor: pointer;
		outline: none;
	}

	select:focus {
		border-color: #4a9eff;
	}

	@media (max-width: 639px) {
		.controls {
			padding: 10px 12px;
			gap: 8px;
		}

		.control-group {
			min-width: 100%;
		}
	}
</style>

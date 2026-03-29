<script lang="ts">
	import type { SortOption, PlatformFilter, TypeFilter, ThemeId } from "../lib/types";
	import { ALL_THEMES, THEME_LABELS } from "../lib/themes";

	interface Props {
		sort: SortOption;
		platformFilter: PlatformFilter;
		typeFilter: TypeFilter;
		themeOverride: ThemeId | "auto";
		includeRetweets: boolean;
		onSortChange: (sort: SortOption) => void;
		onPlatformChange: (platform: PlatformFilter) => void;
		onTypeChange: (type: TypeFilter) => void;
		onThemeChange: (theme: ThemeId | "auto") => void;
		onRetweetsChange: (include: boolean) => void;
		onReset: () => void;
	}

	let {
		sort,
		platformFilter,
		typeFilter,
		themeOverride,
		includeRetweets,
		onSortChange,
		onPlatformChange,
		onTypeChange,
		onThemeChange,
		onRetweetsChange,
		onReset,
	}: Props = $props();

	let open = $state(false);

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

	function handleClose() {
		open = false;
	}
</script>

<div class="controls-wrapper" data-testid="controls-panel">
	<button
		class="disclosure-header"
		data-testid="controls-toggle"
		onclick={() => (open = !open)}
		aria-expanded={open}
	>
		<span class="disclosure-arrow" class:open>&#9654;</span>
		<span class="disclosure-title">Advanced</span>
	</button>

	{#if open}
		<div class="controls-body">
			<div class="controls-grid">
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
						onchange={(e) =>
							onPlatformChange((e.target as HTMLSelectElement).value as PlatformFilter)}
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
						onchange={(e) =>
							onThemeChange((e.target as HTMLSelectElement).value as ThemeId | "auto")}
					>
						{#each ALL_THEMES as themeId}
							<option value={themeId}>{THEME_LABELS[themeId]}</option>
						{/each}
					</select>
				</div>

				<div class="control-group checkbox-group">
					<label class="checkbox-label">
						<input
							type="checkbox"
							data-testid="retweets-toggle"
							checked={includeRetweets}
							onchange={(e) => onRetweetsChange((e.target as HTMLInputElement).checked)}
						/>
						Include retweets
					</label>
				</div>
			</div>

			<div class="controls-actions">
				<button class="action-btn" data-testid="controls-reset" onclick={onReset}>Reset</button>
				<button class="action-btn" data-testid="controls-close" onclick={handleClose}>
					Close
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.controls-wrapper {
		margin-top: 8px;
	}

	.disclosure-header {
		display: flex;
		align-items: center;
		gap: 6px;
		background: none;
		border: none;
		color: #888;
		cursor: pointer;
		padding: 4px 0;
		font-size: 0.8rem;
		font-family: inherit;
		transition: color 0.15s;
	}

	.disclosure-header:hover {
		color: #e0e0e0;
	}

	.disclosure-arrow {
		font-size: 0.6rem;
		transition: transform 0.15s;
		display: inline-block;
	}

	.disclosure-arrow.open {
		transform: rotate(90deg);
	}

	.disclosure-title {
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.controls-body {
		background: #222;
		border: 1px solid #333;
		border-radius: 6px;
		padding: 12px 16px;
		margin-top: 4px;
	}

	.controls-grid {
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

	.checkbox-group {
		justify-content: center;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.85rem;
		color: #e0e0e0;
		cursor: pointer;
	}

	.checkbox-label input[type="checkbox"] {
		accent-color: #4a9eff;
		cursor: pointer;
	}

	.controls-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 12px;
		padding-top: 10px;
		border-top: 1px solid #333;
	}

	.action-btn {
		background: #2a2a2a;
		border: 1px solid #444;
		border-radius: 4px;
		color: #888;
		padding: 5px 14px;
		font-size: 0.8rem;
		font-family: inherit;
		cursor: pointer;
		transition:
			color 0.15s,
			border-color 0.15s;
	}

	.action-btn:hover {
		color: #e0e0e0;
		border-color: #666;
	}

	@media (max-width: 639px) {
		.controls-body {
			padding: 10px 12px;
		}

		.controls-grid {
			gap: 8px;
		}

		.control-group {
			min-width: 100%;
		}
	}
</style>

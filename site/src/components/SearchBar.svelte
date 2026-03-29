<script lang="ts">
	interface Props {
		value: string;
		searching: boolean;
		resultCount: number | null;
		totalCount: number | null;
		onInput: (value: string) => void;
		onToggleControls: () => void;
	}

	let { value, searching, resultCount, totalCount, onInput, onToggleControls }: Props = $props();

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		onInput(target.value);
	}
</script>

<div class="search-bar">
	<div class="search-input-wrapper">
		<input
			type="text"
			class="search-input"
			data-testid="search-input"
			placeholder="search dril posts..."
			autocomplete="off"
			{value}
			oninput={handleInput}
		/>
		<div class="status-line" data-testid="search-status">
			{#if searching}
				<span class="spinner"></span>
				<span>searching...</span>
			{:else if resultCount !== null && totalCount !== null}
				<span>{resultCount} / {totalCount}</span>
			{/if}
		</div>
	</div>
	<button
		class="controls-toggle"
		data-testid="controls-toggle"
		onclick={onToggleControls}
		aria-label="Toggle controls panel"
		title="Controls"
	>
		<svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor">
			<path
				d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
			/>
		</svg>
	</button>
</div>

<style>
	.search-bar {
		display: flex;
		gap: 8px;
		align-items: flex-start;
	}

	.search-input-wrapper {
		flex: 1;
		position: relative;
		background: #2a2a2a;
		border: 1px solid #444;
		border-radius: 6px;
	}

	.search-input-wrapper:focus-within {
		border-color: #4a9eff;
	}

	.search-input {
		width: 100%;
		padding: 12px 16px 28px 16px;
		font-size: 1.1rem;
		font-family: inherit;
		background: transparent;
		border: none;
		color: #e0e0e0;
		outline: none;
		box-sizing: border-box;
	}

	.status-line {
		position: absolute;
		bottom: 4px;
		left: 16px;
		right: 16px;
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.75rem;
		color: #666;
		height: 16px;
	}

	.spinner {
		width: 10px;
		height: 10px;
		border: 1.5px solid #444;
		border-top-color: #4a9eff;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.controls-toggle {
		background: #2a2a2a;
		border: 1px solid #444;
		border-radius: 6px;
		color: #888;
		cursor: pointer;
		padding: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color 0.15s;
	}

	.controls-toggle:hover {
		color: #e0e0e0;
	}

	@media (max-width: 639px) {
		.search-input {
			padding: 10px 12px 26px 12px;
			font-size: 1rem;
		}

		.status-line {
			left: 12px;
			right: 12px;
		}

		.controls-toggle {
			padding: 8px;
		}
	}
</style>

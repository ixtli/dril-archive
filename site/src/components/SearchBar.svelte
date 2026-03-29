<script lang="ts">
	interface Props {
		value: string;
		searching: boolean;
		resultCount: number | null;
		totalCount: number | null;
		onInput: (value: string) => void;
	}

	let { value, searching, resultCount, totalCount, onInput }: Props = $props();

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
</div>

<style>
	.search-input-wrapper {
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

	@media (max-width: 639px) {
		.search-input {
			padding: 10px 12px 26px 12px;
			font-size: 1rem;
		}

		.status-line {
			left: 12px;
			right: 12px;
		}
	}
</style>

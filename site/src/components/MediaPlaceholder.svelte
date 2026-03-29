<script lang="ts">
	import type { MediaItem } from "../lib/types";

	interface Props {
		media: MediaItem[];
	}

	let { media }: Props = $props();

	type LoadState = "idle" | "loading" | "loaded" | "error";

	let loadStates = $state<LoadState[]>([]);

	$effect(() => {
		loadStates = media.map(() => "idle" as LoadState);
	});

	function loadImage(index: number) {
		loadStates[index] = "loading";
		const img = new Image();
		img.onload = () => {
			loadStates[index] = "loaded";
		};
		img.onerror = () => {
			loadStates[index] = "error";
		};
		img.src = media[index].url;
	}

	function loadAll() {
		for (let i = 0; i < media.length; i++) {
			if (loadStates[i] === "idle") {
				loadImage(i);
			}
		}
	}
</script>

{#if media.length > 0}
	<div class="media-container" data-testid="media-placeholder">
		{#if loadStates.every((s) => s === "idle")}
			<button class="media-prompt" onclick={loadAll}>
				<span class="media-icon">&#128247;</span>
				{media.length} image{media.length > 1 ? "s" : ""} attached — click to load
			</button>
		{:else}
			<div class="media-grid" class:single={media.length === 1}>
				{#each media as item, i}
					<div class="media-item">
						{#if loadStates[i] === "loading"}
							<div class="media-loading">Loading...</div>
						{:else if loadStates[i] === "loaded"}
							<img
								src={item.url}
								alt={item.alt_text ?? ""}
								width={item.width ?? undefined}
								height={item.height ?? undefined}
							/>
						{:else if loadStates[i] === "error"}
							<div class="media-error">Image unavailable</div>
						{:else}
							<button class="media-item-prompt" onclick={() => loadImage(i)}>
								Click to load
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.media-container {
		margin-top: 8px;
	}

	.media-prompt {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 12px;
		background: #f0f0f0;
		border: 1px dashed #ccc;
		border-radius: 8px;
		color: #666;
		font-size: 13px;
		cursor: pointer;
		font-family: inherit;
	}

	.media-prompt:hover {
		background: #e8e8e8;
		border-color: #aaa;
	}

	.media-icon {
		font-size: 16px;
	}

	.media-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 4px;
		border-radius: 8px;
		overflow: hidden;
	}

	.media-grid.single {
		grid-template-columns: 1fr;
	}

	.media-item {
		background: #f0f0f0;
		min-height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.media-item img {
		width: 100%;
		height: auto;
		display: block;
	}

	.media-loading,
	.media-error {
		padding: 16px;
		font-size: 13px;
		color: #888;
	}

	.media-error {
		color: #999;
	}

	.media-item-prompt {
		padding: 16px;
		background: none;
		border: none;
		color: #666;
		font-size: 13px;
		cursor: pointer;
		font-family: inherit;
	}

	.media-item-prompt:hover {
		color: #333;
	}
</style>

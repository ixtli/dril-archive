<script lang="ts">
	import { onMount, onDestroy } from "svelte";

	interface Props {
		targetEl: HTMLElement | undefined;
		postId: string;
		onclose: () => void;
	}

	let { targetEl, postId, onclose }: Props = $props();
	let screenshotUrl: string | null = $state(null);

	onMount(async () => {
		try {
			if (!targetEl) return;
			const articleEl = targetEl.querySelector("article");
			if (!articleEl) return;
			const { default: html2canvas } = await import("html2canvas");
			const canvas = await html2canvas(articleEl, {
				useCORS: true,
				backgroundColor: null,
			});
			const blob = await new Promise<Blob | null>((resolve) =>
				canvas.toBlob(resolve, "image/jpeg", 0.92),
			);
			if (!blob) return;
			screenshotUrl = URL.createObjectURL(blob);
		} catch {
			onclose();
		}
	});

	onDestroy(() => {
		if (screenshotUrl) {
			URL.revokeObjectURL(screenshotUrl);
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			onclose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if screenshotUrl}
	<div
		class="screenshot-overlay"
		data-testid="screenshot-overlay"
		tabindex="-1"
		role="presentation"
		onclick={onclose}
		onkeydown={handleKeydown}
	>
		<div
			class="screenshot-modal"
			role="presentation"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<button class="screenshot-close" onclick={onclose} aria-label="Close">&times;</button>
			<img src={screenshotUrl} alt="Screenshot of post" class="screenshot-img" />
			<div class="screenshot-actions">
				<a href={screenshotUrl} download="dril-{postId}.jpg" class="screenshot-download">
					Download
				</a>
			</div>
			<p class="screenshot-hint">Long-press image to save on mobile</p>
		</div>
	</div>
{/if}

<style>
	.screenshot-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 16px;
	}

	.screenshot-modal {
		background: #1a1a1a;
		border-radius: 12px;
		padding: 16px;
		max-width: 90vw;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		position: relative;
	}

	.screenshot-close {
		position: absolute;
		top: 0px;
		right: 5px;
		background: none;
		border: none;
		color: #999;
		font-size: 24px;
		cursor: pointer;
		line-height: 1;
	}

	.screenshot-close:hover {
		color: #fff;
	}

	.screenshot-img {
		max-width: 100%;
		max-height: 70vh;
		border-radius: 4px;
	}

	.screenshot-actions {
		display: flex;
		gap: 12px;
	}

	.screenshot-download {
		display: inline-block;
		padding: 8px 20px;
		background: #333;
		color: #e0e0e0;
		text-decoration: none;
		border-radius: 6px;
		font-size: 14px;
	}

	.screenshot-download:hover {
		background: #444;
	}

	.screenshot-hint {
		color: #777;
		font-size: 12px;
		margin: 0;
	}
</style>

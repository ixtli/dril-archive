<script lang="ts">
	interface Props {
		progress: number;
		message: string;
	}

	let { progress, message }: Props = $props();
</script>

<div class="loading" data-testid="loading">
	<div class="progress-container">
		<div class="progress-bar" style="width: {progress}%"></div>
	</div>
	<p class="loading-text">{message}</p>
</div>

<style>
	.loading {
		margin-top: 40px;
	}

	.progress-container {
		width: 100%;
		height: 6px;
		background: #333;
		border-radius: 3px;
		overflow: hidden;
	}

	.progress-bar {
		height: 100%;
		background: #4a9eff;
		transition: width 0.1s ease;
	}

	.loading-text {
		margin-top: 10px;
		font-size: 0.85rem;
		color: #666;
	}
</style>

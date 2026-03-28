<script lang="ts">
	import type { Post } from "../lib/types";

	interface Props {
		post: Post;
	}

	let { post }: Props = $props();
</script>

<article class="twitter-classic-card">
	{#if post.is_reply && post.reply_to_user}
		<div class="reply-context">
			<span class="reply-icon">&#8617;</span> replying to @{post.reply_to_user}
		</div>
	{/if}

	<div class="card-layout">
		<div class="avatar-col">
			<div class="avatar-placeholder"></div>
		</div>
		<div class="content-col">
			<div class="header">
				<span class="display-name">dril</span>
				<span class="handle">@dril</span>
			</div>
			<div class="text">{post.text}</div>
			{#if post.is_quote && post.quoted_text}
				<div class="quoted">
					<div class="quoted-text">{post.quoted_text}</div>
				</div>
			{/if}
			<div class="engagement">
				<span class="engagement-item">{post.likes.toLocaleString()} likes</span>
				<span class="engagement-item">{post.shares.toLocaleString()} shares</span>
			</div>
		</div>
	</div>
</article>

<style>
	.twitter-classic-card {
		background: rgba(255, 255, 255, 0.98);
		border: 1px solid #cccccc;
		border-radius: 5px;
		padding: 10px;
		font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
		color: rgb(136, 153, 166);
		margin-bottom: 8px;
	}

	.reply-context {
		color: #999;
		font-size: 11px;
		margin-bottom: 6px;
		padding-left: 83px;
	}

	.reply-icon {
		font-size: 10px;
	}

	.card-layout {
		display: flex;
		gap: 10px;
	}

	.avatar-col {
		flex-shrink: 0;
	}

	.avatar-placeholder {
		width: 73px;
		height: 73px;
		border-radius: 4px;
		background: #e1e8ed;
	}

	.content-col {
		flex: 1;
		min-width: 0;
	}

	.header {
		margin-bottom: 2px;
	}

	.display-name {
		font-weight: bold;
		font-size: 14px;
		color: rgb(136, 153, 166);
	}

	.handle {
		color: #999;
		font-size: 11px;
		margin-left: 4px;
	}

	.text {
		font-size: 13px;
		line-height: 24px;
		color: rgb(136, 153, 166);
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.quoted {
		border: 1px solid #999;
		border-radius: 5px;
		padding: 8px 12px;
		margin-top: 8px;
	}

	.quoted-text {
		font-size: 12px;
		line-height: 18px;
		color: #666;
	}

	.engagement {
		margin-top: 4px;
		font-size: 11px;
		color: #999;
		display: flex;
		gap: 12px;
	}

	@media (max-width: 639px) {
		.engagement {
			font-size: 10px;
		}
	}
</style>

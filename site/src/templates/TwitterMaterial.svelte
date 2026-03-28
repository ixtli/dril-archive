<script lang="ts">
	import type { Post } from "../lib/types";

	interface Props {
		post: Post;
	}

	let { post }: Props = $props();

	let formattedDate = $derived(
		new Date(post.created_at).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		}),
	);
</script>

<article class="twitter-material-card">
	{#if post.is_reply && post.reply_to_user}
		<div class="reply-context">
			Replying to <span class="reply-mention">@{post.reply_to_user}</span>
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
				<span class="separator">&middot;</span>
				<span class="timestamp">{formattedDate}</span>
			</div>
			<div class="text">{post.text}</div>
			{#if post.is_quote && post.quoted_text}
				<div class="quoted">
					<div class="quoted-text">{post.quoted_text}</div>
				</div>
			{/if}
			<div class="engagement">
				<span class="engagement-item">{post.likes.toLocaleString()} likes</span>
				<span class="engagement-item">{post.shares.toLocaleString()} retweets</span>
			</div>
		</div>
	</div>
</article>

<style>
	.twitter-material-card {
		background: #fff;
		border: 1px solid #e1e8ed;
		padding: 12px 16px;
		font-family: "Segoe UI", Arial, sans-serif;
		color: #14171a;
		margin-bottom: 8px;
	}

	.reply-context {
		color: #657786;
		font-size: 13px;
		margin-bottom: 4px;
		padding-left: 60px;
	}

	.reply-mention {
		color: #1da1f2;
	}

	.card-layout {
		display: flex;
		gap: 12px;
	}

	.avatar-col {
		flex-shrink: 0;
	}

	.avatar-placeholder {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: #e1e8ed;
	}

	.content-col {
		flex: 1;
		min-width: 0;
	}

	.header {
		display: flex;
		align-items: baseline;
		gap: 4px;
		margin-bottom: 2px;
	}

	.display-name {
		font-weight: bold;
		font-size: 15px;
		color: #14171a;
	}

	.handle {
		color: #657786;
		font-size: 13px;
	}

	.separator {
		color: #657786;
		font-size: 13px;
	}

	.timestamp {
		color: #657786;
		font-size: 13px;
	}

	.text {
		font-size: 14px;
		line-height: 20px;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.quoted {
		border: 1px solid #657786;
		border-radius: 0;
		padding: 8px 12px;
		margin-top: 8px;
	}

	.quoted-text {
		font-size: 13px;
		line-height: 18px;
		color: #657786;
	}

	.engagement {
		margin-top: 6px;
		font-size: 13px;
		color: #657786;
		display: flex;
		gap: 16px;
	}

	@media (max-width: 639px) {
		.handle,
		.separator,
		.timestamp,
		.engagement {
			font-size: 12px;
		}
	}
</style>

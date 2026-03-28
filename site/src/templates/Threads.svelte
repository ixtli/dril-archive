<script lang="ts">
	import type { Post } from "../lib/types";
	import { postUrl } from "../lib/search";

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

	let url = $derived(postUrl(post.platform, post.id));
</script>

<article class="threads-card">
	{#if post.is_reply && post.reply_to_user}
		<div class="reply-context">
			replying to @{post.reply_to_user}
		</div>
	{/if}

	<div class="card-layout">
		<div class="avatar-col">
			<div class="avatar-placeholder"></div>
		</div>
		<div class="content-col">
			<div class="header">
				<span class="display-name">dril</span>
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
				<span class="engagement-item">{post.shares.toLocaleString()} reposts</span>
			</div>
			<div class="meta">
				<a href={url} target="_blank" rel="noopener" class="view-link">view original</a>
			</div>
		</div>
	</div>
</article>

<style>
	.threads-card {
		background: #fff;
		border-bottom: 1px solid #e0e0e0;
		padding: 16px;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		color: #000;
		margin-bottom: 8px;
	}

	.reply-context {
		color: #999;
		font-size: 13px;
		margin-bottom: 4px;
		padding-left: 52px;
	}

	.card-layout {
		display: flex;
		gap: 12px;
	}

	.avatar-col {
		flex-shrink: 0;
	}

	.avatar-placeholder {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: #e0e0e0;
	}

	.content-col {
		flex: 1;
		min-width: 0;
	}

	.header {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin-bottom: 2px;
	}

	.display-name {
		font-weight: 600;
		font-size: 15px;
		color: #000;
	}

	.timestamp {
		color: #999;
		font-size: 14px;
	}

	.text {
		font-size: 15px;
		line-height: 21px;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.quoted {
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 10px 12px;
		margin-top: 8px;
	}

	.quoted-text {
		font-size: 14px;
		line-height: 19px;
		color: #666;
	}

	.engagement {
		margin-top: 8px;
		font-size: 14px;
		color: #999;
		display: flex;
		gap: 16px;
	}

	.meta {
		margin-top: 4px;
		font-size: 14px;
	}

	.view-link {
		color: #000;
		text-decoration: none;
		font-weight: 500;
	}

	.view-link:hover {
		text-decoration: underline;
	}

	@media (max-width: 639px) {
		.meta,
		.timestamp,
		.engagement {
			font-size: 13px;
		}
	}
</style>

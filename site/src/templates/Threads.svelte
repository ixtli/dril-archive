<script lang="ts">
	import type { Post } from "../lib/types";
	import MediaPlaceholder from "../components/MediaPlaceholder.svelte";

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

<article class="threads-card">
	{#if post.is_reply && post.reply_to_user}
		<div class="reply-context">
			replying to @{post.reply_to_user}
		</div>
	{/if}

	{#if post.is_repost}
		<div class="repost-banner" data-testid="repost-banner">
			<span class="repost-icon">&#8635;</span> @dril retweeted
		</div>
	{/if}

	<div class="card-layout">
		<div class="avatar-col">
			<div class="avatar-placeholder"></div>
		</div>
		<div class="content-col">
			<div class="header">
				<span class="display-name"
					>{post.is_repost && post.original_user_name ? post.original_user_name : "wint"}</span
				>
				<span class="timestamp">{formattedDate}</span>
			</div>
			<div class="text">{post.text}</div>
			{#if post.is_quote && post.quoted_text}
				<div class="quoted">
					<div class="quoted-text">{post.quoted_text}</div>
				</div>
			{/if}
			{#if post.media.length > 0}
				<MediaPlaceholder media={post.media} />
			{/if}
			<div class="engagement">
				<span class="engagement-item">{post.likes.toLocaleString()} likes</span>
				<span class="engagement-item">{post.shares.toLocaleString()} reposts</span>
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

	@media (max-width: 639px) {
		.timestamp,
		.engagement {
			font-size: 13px;
		}
	}

	.repost-banner {
		font-size: 13px;
		color: #999;
		padding: 0 0 4px 52px;
	}

	.repost-icon {
		font-size: 12px;
	}
</style>

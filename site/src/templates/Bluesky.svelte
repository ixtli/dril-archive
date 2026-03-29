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

<article class="bluesky-card">
	{#if post.is_reply && post.reply_to_user}
		<div class="reply-context">
			Reply to @{post.reply_to_user}
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
				<span class="handle"
					>@{post.is_repost && post.original_user_screen_name
						? post.original_user_screen_name
						: "dril.bsky.social"}</span
				>
				<span class="separator">&middot;</span>
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
	.bluesky-card {
		background: #fff;
		border: 1px solid #e4e6eb;
		border-radius: 12px;
		padding: 14px 16px;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		color: #1a1a1a;
		margin-bottom: 8px;
	}

	.reply-context {
		color: #8a8a8a;
		font-size: 13px;
		margin-bottom: 4px;
		padding-left: 52px;
	}

	.card-layout {
		display: flex;
		gap: 10px;
	}

	.avatar-col {
		flex-shrink: 0;
	}

	.avatar-placeholder {
		width: 42px;
		height: 42px;
		border-radius: 50%;
		background: #d6e6f7;
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
		font-weight: 600;
		font-size: 15px;
		color: #1a1a1a;
	}

	.handle {
		color: #8a8a8a;
		font-size: 14px;
	}

	.separator {
		color: #8a8a8a;
		font-size: 13px;
	}

	.timestamp {
		color: #8a8a8a;
		font-size: 13px;
	}

	.text {
		font-size: 15px;
		line-height: 21px;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.quoted {
		border: 1px solid #d6d6d6;
		border-radius: 8px;
		padding: 10px 12px;
		margin-top: 8px;
		background: #f9f9f9;
	}

	.quoted-text {
		font-size: 14px;
		line-height: 19px;
		color: #555;
	}

	.engagement {
		margin-top: 8px;
		font-size: 13px;
		color: #8a8a8a;
		display: flex;
		gap: 14px;
	}

	@media (max-width: 639px) {
		.handle,
		.separator,
		.timestamp,
		.engagement {
			font-size: 12px;
		}
	}

	.repost-banner {
		font-size: 13px;
		color: #8a8a8a;
		padding: 0 0 4px 52px;
	}

	.repost-icon {
		font-size: 12px;
	}
</style>

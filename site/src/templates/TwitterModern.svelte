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

<article class="twitter-modern-card">
	{#if post.is_reply && post.reply_to_user}
		<div class="reply-context">
			Replying to <span class="reply-mention">@{post.reply_to_user}</span>
		</div>
	{/if}

	{#if post.is_repost}
		<div class="repost-banner" data-testid="repost-banner">
			<span class="repost-icon">&#8635;</span> @dril retweeted
		</div>
	{/if}

	<div class="card-layout">
		<div class="avatar-col">
			<img
				class="avatar"
				src="{import.meta.env.BASE_URL}avatars/normal.jpeg"
				alt="@dril avatar"
				width="48"
				height="48"
			/>
		</div>
		<div class="content-col">
			<div class="header">
				<span class="display-name"
					>{post.is_repost && post.original_user_name ? post.original_user_name : "wint"}</span
				>
				<span class="handle"
					>@{post.is_repost && post.original_user_screen_name
						? post.original_user_screen_name
						: "dril"}</span
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
				<span class="engagement-item">
					<span class="engagement-count">{post.likes.toLocaleString()}</span> Likes
				</span>
				<span class="engagement-item">
					<span class="engagement-count">{post.shares.toLocaleString()}</span> Reposts
				</span>
			</div>
		</div>
	</div>
</article>

<style>
	.twitter-modern-card {
		background: #fff;
		border: 1px solid #eff3f4;
		border-radius: 16px;
		padding: 12px 16px;
		font-family:
			TwitterChirp,
			-apple-system,
			BlinkMacSystemFont,
			"Segoe UI",
			Roboto,
			Helvetica,
			Arial,
			sans-serif;
		color: rgb(83, 100, 113);
		margin-bottom: 8px;
	}

	.reply-context {
		color: #536471;
		font-size: 13px;
		margin-bottom: 4px;
		padding-left: 52px;
	}

	.reply-mention {
		color: #1d9bf0;
	}

	.card-layout {
		display: flex;
		gap: 12px;
	}

	.avatar-col {
		flex-shrink: 0;
	}

	.avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: block;
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
		font-weight: 700;
		font-size: 15px;
		color: rgb(15, 20, 25);
	}

	.handle {
		color: #536471;
		font-size: 15px;
	}

	.separator {
		color: #536471;
		font-size: 13px;
	}

	.timestamp {
		color: #536471;
		font-size: 13px;
	}

	.text {
		font-size: 15px;
		line-height: 20px;
		color: rgb(15, 20, 25);
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.quoted {
		border: 1px solid #536471;
		border-radius: 16px;
		padding: 8px 12px;
		margin-top: 8px;
	}

	.quoted-text {
		font-size: 14px;
		line-height: 18px;
		color: #536471;
	}

	.engagement {
		margin-top: 8px;
		font-size: 13px;
		color: #536471;
		display: flex;
		gap: 16px;
	}

	.engagement-count {
		font-weight: 700;
		color: rgb(15, 20, 25);
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
		color: #536471;
		padding: 0 0 4px 52px;
	}

	.repost-icon {
		font-size: 12px;
	}
</style>

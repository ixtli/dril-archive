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

<article class="twitter-modern-card">
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
				<span class="engagement-item">
					<span class="engagement-count">{post.likes.toLocaleString()}</span> Likes
				</span>
				<span class="engagement-item">
					<span class="engagement-count">{post.shares.toLocaleString()}</span> Reposts
				</span>
			</div>
			<div class="meta">
				<a href={url} target="_blank" rel="noopener" class="view-link"> view original </a>
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

	.avatar-placeholder {
		width: 40px;
		height: 40px;
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

	.meta {
		margin-top: 4px;
		font-size: 13px;
	}

	.view-link {
		color: #1d9bf0;
		text-decoration: none;
	}

	.view-link:hover {
		text-decoration: underline;
	}
</style>

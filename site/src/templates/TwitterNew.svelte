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

<article class="twitter-new-card">
	{#if post.is_reply && post.reply_to_user}
		<div class="reply-context">
			<span class="reply-icon">&#8617;</span> In reply to @{post.reply_to_user}
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
				<span class="engagement-item">{post.likes.toLocaleString()} favorites</span>
				<span class="engagement-item">{post.shares.toLocaleString()} retweets</span>
			</div>
			<div class="meta">
				<a href={url} target="_blank" rel="noopener" class="view-link">view original</a>
			</div>
		</div>
	</div>
</article>

<style>
	.twitter-new-card {
		background: #fff;
		border-bottom: 1px solid #e1e8ed;
		padding: 12px 16px;
		font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
		color: #14171a;
		margin-bottom: 0;
	}

	.reply-context {
		color: #66757f;
		font-size: 12px;
		margin-bottom: 4px;
		padding-left: 60px;
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
		width: 48px;
		height: 48px;
		border-radius: 4px;
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
		font-size: 14px;
		color: #14171a;
	}

	.handle {
		color: #66757f;
		font-size: 12px;
	}

	.separator {
		color: #66757f;
		font-size: 12px;
	}

	.timestamp {
		color: #66757f;
		font-size: 12px;
	}

	.text {
		font-size: 14px;
		line-height: 20px;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.quoted {
		border: 1px solid #66757f;
		border-radius: 0;
		padding: 8px 12px;
		margin-top: 8px;
	}

	.quoted-text {
		font-size: 13px;
		line-height: 18px;
		color: #66757f;
	}

	.engagement {
		margin-top: 6px;
		font-size: 12px;
		color: #66757f;
		display: flex;
		gap: 12px;
	}

	.meta {
		margin-top: 4px;
		font-size: 12px;
	}

	.view-link {
		color: #1b95e0;
		text-decoration: none;
	}

	.view-link:hover {
		text-decoration: underline;
	}

	@media (max-width: 639px) {
		.meta,
		.handle,
		.separator,
		.timestamp,
		.engagement {
			font-size: 11px;
		}
	}
</style>

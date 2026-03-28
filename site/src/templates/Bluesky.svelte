<script lang="ts">
	import type { Post } from "../lib/types";
	import { postUrl } from "../lib/search";

	interface Props {
		post: Post;
	}

	let { post }: Props = $props();
</script>

<article class="bluesky-card">
	<div class="card-body">
		{#if post.is_reply && post.reply_to_user}
			<div class="reply-context">replying to @{post.reply_to_user}</div>
		{/if}
		<div class="header">
			<span class="display-name">@dril.bsky.social</span>
			<span class="separator">&middot;</span>
			<span class="timestamp">
				{new Date(post.created_at).toLocaleDateString("en-US", {
					year: "numeric",
					month: "short",
					day: "numeric",
				})}
			</span>
		</div>
		<div class="text">{post.text}</div>
		<div class="footer">
			<a href={postUrl(post.platform, post.id)} target="_blank" rel="noopener"> view original </a>
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
	}

	.reply-context {
		color: #8a8a8a;
		font-size: 13px;
		margin-bottom: 4px;
	}

	.header {
		margin-bottom: 4px;
	}

	.display-name {
		font-weight: 600;
		font-size: 15px;
	}

	.separator,
	.timestamp {
		color: #8a8a8a;
		font-size: 13px;
	}

	.text {
		font-size: 15px;
		line-height: 21px;
		white-space: pre-wrap;
	}

	.footer {
		margin-top: 8px;
		font-size: 13px;
	}

	.footer a {
		color: #0085ff;
		text-decoration: none;
	}

	.footer a:hover {
		text-decoration: underline;
	}
</style>

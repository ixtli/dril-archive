<script lang="ts">
	import type { Post } from "../lib/types";
	import { postUrl } from "../lib/search";

	interface Props {
		post: Post;
	}

	let { post }: Props = $props();
</script>

<article class="threads-card">
	<div class="card-body">
		{#if post.is_reply && post.reply_to_user}
			<div class="reply-context">replying to @{post.reply_to_user}</div>
		{/if}
		<div class="header">
			<span class="display-name">@dril</span>
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
	.threads-card {
		background: #fff;
		border-bottom: 1px solid #e0e0e0;
		padding: 16px;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		color: #000;
	}

	.reply-context {
		color: #999;
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
		color: #999;
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
		color: #000;
		text-decoration: none;
		font-weight: 500;
	}

	.footer a:hover {
		text-decoration: underline;
	}
</style>

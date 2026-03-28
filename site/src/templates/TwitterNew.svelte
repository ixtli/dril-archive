<script lang="ts">
	import type { Post } from "../lib/types";
	import { postUrl } from "../lib/search";

	interface Props {
		post: Post;
	}

	let { post }: Props = $props();
</script>

<article class="twitter-new-card">
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
	.twitter-new-card {
		background: #fff;
		border-bottom: 1px solid #e1e8ed;
		padding: 12px 16px;
		font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
		color: #14171a;
	}

	.reply-context {
		color: #66757f;
		font-size: 12px;
		margin-bottom: 4px;
	}

	.header {
		margin-bottom: 4px;
	}

	.display-name {
		font-weight: bold;
		font-size: 14px;
	}

	.separator,
	.timestamp {
		color: #66757f;
		font-size: 12px;
	}

	.text {
		font-size: 14px;
		line-height: 20px;
		white-space: pre-wrap;
	}

	.footer {
		margin-top: 8px;
		font-size: 12px;
	}

	.footer a {
		color: #1b95e0;
		text-decoration: none;
	}

	.footer a:hover {
		text-decoration: underline;
	}
</style>

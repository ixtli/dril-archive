<script lang="ts">
	import type { Post } from "../lib/types";
	import { formatPostDate, resolveDisplayName, resolveHandle } from "../lib/format";
	import PostCardLayout from "../components/PostCardLayout.svelte";

	interface Props {
		post: Post;
	}

	let { post }: Props = $props();

	let formattedDate = $derived(formatPostDate(post.created_at));
</script>

<PostCardLayout
	{post}
	cardClass="twitter-new-card"
	avatarSrc="{import.meta.env.BASE_URL}avatars/normal.jpeg"
	avatarSize={48}
	replyLabel="In reply to"
	replyIcon="&#8617;"
>
	{#snippet header()}
		<span class="display-name">{resolveDisplayName(post)}</span>
		<span class="handle">@{resolveHandle(post)}</span>
		<span class="separator">&middot;</span>
		<span class="timestamp">{formattedDate}</span>
	{/snippet}
	{#snippet engagement()}
		<span class="engagement-item">{post.likes.toLocaleString()} favorites</span>
		<span class="engagement-item">{post.shares.toLocaleString()} retweets</span>
	{/snippet}
</PostCardLayout>

<style>
	:global(.twitter-new-card) {
		background: #fff;
		border-bottom: 1px solid #e1e8ed;
		padding: 12px 16px;
		font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
		color: #14171a;
		margin-bottom: 8px;
	}

	:global(.twitter-new-card .reply-context) {
		color: #66757f;
		font-size: 12px;
		margin-bottom: 4px;
		padding-left: 58px;
	}

	:global(.twitter-new-card .reply-icon) {
		font-size: 10px;
	}

	:global(.twitter-new-card .card-layout) {
		gap: 10px;
	}

	:global(.twitter-new-card .avatar) {
		width: 48px;
		height: 48px;
		border-radius: 4px;
	}

	:global(.twitter-new-card .header) {
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

	:global(.twitter-new-card .text) {
		font-size: 14px;
		line-height: 20px;
	}

	:global(.twitter-new-card .quoted) {
		border: 1px solid #66757f;
		border-radius: 0;
		padding: 8px 12px;
		margin-top: 8px;
	}

	:global(.twitter-new-card .quoted-text) {
		font-size: 13px;
		line-height: 18px;
		color: #66757f;
	}

	:global(.twitter-new-card .engagement) {
		margin-top: 6px;
		font-size: 12px;
		color: #66757f;
		display: flex;
		gap: 12px;
	}

	@media (max-width: 639px) {
		.handle,
		.separator,
		.timestamp {
			font-size: 11px;
		}
		:global(.twitter-new-card .engagement) {
			font-size: 11px;
		}
	}

	:global(.twitter-new-card .repost-banner) {
		font-size: 12px;
		color: #66757f;
		padding: 0 0 4px 58px;
	}

	:global(.twitter-new-card .repost-icon) {
		font-size: 11px;
	}
</style>

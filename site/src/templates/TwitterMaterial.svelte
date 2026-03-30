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
	cardClass="twitter-material-card"
	avatarSrc="{import.meta.env.BASE_URL}avatars/normal.jpeg"
	avatarSize={48}
	replyLabel="Replying to"
>
	{#snippet header()}
		<span class="display-name">{resolveDisplayName(post)}</span>
		<span class="handle">@{resolveHandle(post)}</span>
		<span class="separator">&middot;</span>
		<span class="timestamp">{formattedDate}</span>
	{/snippet}
	{#snippet engagement()}
		<span class="engagement-item">{post.likes.toLocaleString()} likes</span>
		<span class="engagement-item">{post.shares.toLocaleString()} retweets</span>
	{/snippet}
</PostCardLayout>

<style>
	:global(.twitter-material-card) {
		background: #fff;
		border: 1px solid #e1e8ed;
		padding: 12px 16px;
		font-family: "Segoe UI", Arial, sans-serif;
		color: #14171a;
		margin-bottom: 8px;
	}

	:global(.twitter-material-card .reply-context) {
		color: #657786;
		font-size: 13px;
		margin-bottom: 4px;
		padding-left: 60px;
	}

	:global(.twitter-material-card .reply-mention) {
		color: #1da1f2;
	}

	:global(.twitter-material-card .card-layout) {
		gap: 12px;
	}

	:global(.twitter-material-card .avatar) {
		width: 48px;
		height: 48px;
		border-radius: 50%;
	}

	:global(.twitter-material-card .header) {
		display: flex;
		align-items: baseline;
		gap: 4px;
		margin-bottom: 2px;
	}

	.display-name {
		font-weight: bold;
		font-size: 15px;
		color: #14171a;
	}

	.handle {
		color: #657786;
		font-size: 13px;
	}

	.separator {
		color: #657786;
		font-size: 13px;
	}

	.timestamp {
		color: #657786;
		font-size: 13px;
	}

	:global(.twitter-material-card .text) {
		font-size: 14px;
		line-height: 20px;
	}

	:global(.twitter-material-card .quoted) {
		border: 1px solid #657786;
		border-radius: 0;
		padding: 8px 12px;
		margin-top: 8px;
	}

	:global(.twitter-material-card .quoted-text) {
		font-size: 13px;
		line-height: 18px;
		color: #657786;
	}

	:global(.twitter-material-card .engagement) {
		margin-top: 6px;
		font-size: 13px;
		color: #657786;
		display: flex;
		gap: 16px;
	}

	@media (max-width: 639px) {
		.handle,
		.separator,
		.timestamp {
			font-size: 12px;
		}
		:global(.twitter-material-card .engagement) {
			font-size: 12px;
		}
	}

	:global(.twitter-material-card .repost-banner) {
		font-size: 13px;
		color: #657786;
		padding: 0 0 4px 60px;
	}

	:global(.twitter-material-card .repost-icon) {
		font-size: 12px;
	}
</style>

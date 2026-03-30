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
	cardClass="bluesky-card"
	avatarSrc="{import.meta.env.BASE_URL}avatars/normal.jpeg"
	avatarSize={48}
	repostLabel="reposted"
	replyLabel="Reply to"
>
	{#snippet header()}
		<span class="display-name">{resolveDisplayName(post)}</span>
		<span class="handle">@{resolveHandle(post, "dril.bsky.social")}</span>
		<span class="separator">&middot;</span>
		<span class="timestamp">{formattedDate}</span>
	{/snippet}
	{#snippet engagement()}
		<span class="engagement-item">{post.likes.toLocaleString()} likes</span>
		<span class="engagement-item">{post.shares.toLocaleString()} reposts</span>
	{/snippet}
</PostCardLayout>

<style>
	:global(.bluesky-card) {
		background: #fff;
		border: 1px solid #e4e6eb;
		border-radius: 12px;
		padding: 14px 16px;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		color: #1a1a1a;
		margin-bottom: 8px;
	}

	:global(.bluesky-card .reply-context) {
		color: #8a8a8a;
		font-size: 13px;
		margin-bottom: 4px;
		padding-left: 52px;
	}

	:global(.bluesky-card .card-layout) {
		gap: 10px;
	}

	:global(.bluesky-card .avatar) {
		width: 42px;
		height: 42px;
		border-radius: 50%;
	}

	:global(.bluesky-card .header) {
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

	:global(.bluesky-card .text) {
		font-size: 15px;
		line-height: 21px;
	}

	:global(.bluesky-card .quoted) {
		border: 1px solid #d6d6d6;
		border-radius: 8px;
		padding: 10px 12px;
		margin-top: 8px;
		background: #f9f9f9;
	}

	:global(.bluesky-card .quoted-text) {
		font-size: 14px;
		line-height: 19px;
		color: #555;
	}

	:global(.bluesky-card .engagement) {
		margin-top: 8px;
		font-size: 13px;
		color: #8a8a8a;
		display: flex;
		gap: 14px;
	}

	@media (max-width: 639px) {
		.handle,
		.separator,
		.timestamp {
			font-size: 12px;
		}
		:global(.bluesky-card .engagement) {
			font-size: 12px;
		}
	}

	:global(.bluesky-card .repost-banner) {
		font-size: 13px;
		color: #8a8a8a;
		padding: 0 0 4px 52px;
	}

	:global(.bluesky-card .repost-icon) {
		font-size: 12px;
	}
</style>

<script lang="ts">
	import type { Post } from "../lib/types";
	import { formatPostDate, resolveDisplayName } from "../lib/format";
	import PostCardLayout from "../components/PostCardLayout.svelte";

	interface Props {
		post: Post;
	}

	let { post }: Props = $props();

	let formattedDate = $derived(formatPostDate(post.created_at));
</script>

<PostCardLayout
	{post}
	cardClass="threads-card"
	avatarSrc="{import.meta.env.BASE_URL}avatars/normal.jpeg"
	avatarSize={48}
	repostLabel="reposted"
	replyLabel="replying to"
>
	{#snippet header()}
		<span class="display-name">{resolveDisplayName(post)}</span>
		<span class="timestamp">{formattedDate}</span>
	{/snippet}
	{#snippet engagement()}
		<span class="engagement-item">{post.likes.toLocaleString()} likes</span>
		<span class="engagement-item">{post.shares.toLocaleString()} reposts</span>
	{/snippet}
</PostCardLayout>

<style>
	:global(.threads-card) {
		background: #fff;
		border-bottom: 1px solid #e0e0e0;
		padding: 16px;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		color: #000;
		margin-bottom: 8px;
	}

	:global(.threads-card .reply-context) {
		color: #999;
		font-size: 13px;
		margin-bottom: 4px;
		padding-left: 52px;
	}

	:global(.threads-card .card-layout) {
		gap: 12px;
	}

	:global(.threads-card .avatar) {
		width: 40px;
		height: 40px;
		border-radius: 50%;
	}

	:global(.threads-card .header) {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin-bottom: 2px;
	}

	.display-name {
		font-weight: 600;
		font-size: 15px;
		color: #000;
	}

	.timestamp {
		color: #999;
		font-size: 14px;
	}

	:global(.threads-card .text) {
		font-size: 15px;
		line-height: 21px;
	}

	:global(.threads-card .quoted) {
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 10px 12px;
		margin-top: 8px;
	}

	:global(.threads-card .quoted-text) {
		font-size: 14px;
		line-height: 19px;
		color: #666;
	}

	:global(.threads-card .engagement) {
		margin-top: 8px;
		font-size: 14px;
		color: #999;
		display: flex;
		gap: 16px;
	}

	@media (max-width: 639px) {
		.timestamp {
			font-size: 13px;
		}
		:global(.threads-card .engagement) {
			font-size: 13px;
		}
	}

	:global(.threads-card .repost-banner) {
		font-size: 13px;
		color: #999;
		padding: 0 0 4px 52px;
	}

	:global(.threads-card .repost-icon) {
		font-size: 12px;
	}
</style>

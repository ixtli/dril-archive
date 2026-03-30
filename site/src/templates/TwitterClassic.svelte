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
	cardClass="twitter-classic-card"
	avatarSrc="{import.meta.env.BASE_URL}avatars/bigger.jpg"
	avatarSize={73}
	replyLabel="replying to"
	replyIcon="&#8617;"
>
	{#snippet header()}
		<span class="display-name">{resolveDisplayName(post)}</span>
		<span class="handle">@{resolveHandle(post)}</span>
	{/snippet}
	{#snippet engagement()}
		<span class="engagement-item">{post.likes.toLocaleString()} likes</span>
		<span class="engagement-item">{post.shares.toLocaleString()} shares</span>
		<span class="engagement-item">{formattedDate}</span>
	{/snippet}
</PostCardLayout>

<style>
	:global(.twitter-classic-card) {
		background: rgba(255, 255, 255, 0.98);
		border: 1px solid #cccccc;
		border-radius: 5px;
		padding: 10px;
		font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
		color: rgb(136, 153, 166);
		margin-bottom: 8px;
	}

	:global(.twitter-classic-card .reply-context) {
		color: #999;
		font-size: 11px;
		margin-bottom: 6px;
		padding-left: 83px;
	}

	:global(.twitter-classic-card .reply-icon) {
		font-size: 10px;
	}

	:global(.twitter-classic-card .card-layout) {
		gap: 10px;
	}

	:global(.twitter-classic-card .avatar) {
		width: 73px;
		height: 73px;
		border-radius: 4px;
	}

	:global(.twitter-classic-card .header) {
		margin-bottom: 2px;
	}

	.display-name {
		font-weight: bold;
		font-size: 14px;
		color: rgb(136, 153, 166);
	}

	.handle {
		color: #999;
		font-size: 11px;
		margin-left: 4px;
	}

	:global(.twitter-classic-card .text) {
		font-size: 13px;
		line-height: 24px;
		color: rgb(55, 58, 61);
	}

	:global(.twitter-classic-card .quoted) {
		border: 1px solid #999;
		border-radius: 5px;
		padding: 8px 12px;
		margin-top: 8px;
	}

	:global(.twitter-classic-card .quoted-text) {
		font-size: 12px;
		line-height: 18px;
		color: #666;
	}

	:global(.twitter-classic-card .engagement) {
		margin-top: 4px;
		font-size: 11px;
		color: #999;
		display: flex;
		gap: 12px;
	}

	@media (max-width: 639px) {
		.handle {
			font-size: 10px;
		}
		:global(.twitter-classic-card .engagement) {
			font-size: 10px;
		}
	}

	:global(.twitter-classic-card .repost-banner) {
		font-size: 11px;
		color: #999;
		padding: 0 0 4px 83px;
	}

	:global(.twitter-classic-card .repost-icon) {
		font-size: 10px;
	}
</style>

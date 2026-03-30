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
	cardClass="twitter-modern-card"
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
		<span class="engagement-item">
			<span class="engagement-count">{post.likes.toLocaleString()}</span> Likes
		</span>
		<span class="engagement-item">
			<span class="engagement-count">{post.shares.toLocaleString()}</span> Reposts
		</span>
	{/snippet}
</PostCardLayout>

<style>
	:global(.twitter-modern-card) {
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

	:global(.twitter-modern-card .reply-context) {
		color: #536471;
		font-size: 13px;
		margin-bottom: 4px;
		padding-left: 52px;
	}

	:global(.twitter-modern-card .reply-mention) {
		color: #1d9bf0;
	}

	:global(.twitter-modern-card .card-layout) {
		gap: 12px;
	}

	:global(.twitter-modern-card .avatar) {
		width: 40px;
		height: 40px;
		border-radius: 50%;
	}

	:global(.twitter-modern-card .header) {
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

	:global(.twitter-modern-card .text) {
		font-size: 15px;
		line-height: 20px;
		color: rgb(15, 20, 25);
	}

	:global(.twitter-modern-card .quoted) {
		border: 1px solid #536471;
		border-radius: 16px;
		padding: 8px 12px;
		margin-top: 8px;
	}

	:global(.twitter-modern-card .quoted-text) {
		font-size: 14px;
		line-height: 18px;
		color: #536471;
	}

	:global(.twitter-modern-card .engagement) {
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

	@media (max-width: 639px) {
		.handle,
		.separator,
		.timestamp {
			font-size: 12px;
		}
		:global(.twitter-modern-card .engagement) {
			font-size: 12px;
		}
	}

	:global(.twitter-modern-card .repost-banner) {
		font-size: 13px;
		color: #536471;
		padding: 0 0 4px 52px;
	}

	:global(.twitter-modern-card .repost-icon) {
		font-size: 12px;
	}
</style>

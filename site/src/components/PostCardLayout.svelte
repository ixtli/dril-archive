<script lang="ts">
	import type { Snippet } from "svelte";
	import type { Post } from "../lib/types";
	import MediaPlaceholder from "./MediaPlaceholder.svelte";

	interface Props {
		post: Post;
		cardClass: string;
		avatarSrc: string;
		avatarSize: number;
		repostLabel?: string;
		replyLabel: string;
		replyIcon?: string;
		header: Snippet;
		engagement: Snippet;
	}

	let {
		post,
		cardClass,
		avatarSrc,
		avatarSize,
		repostLabel = "retweeted",
		replyLabel,
		replyIcon,
		header,
		engagement,
	}: Props = $props();
</script>

<article class={cardClass}>
	{#if post.is_reply && post.reply_to_user}
		<div class="reply-context">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{#if replyIcon}<span class="reply-icon">{@html replyIcon}</span>{/if}
			{replyLabel}
			<span class="reply-mention">@{post.reply_to_user}</span>
		</div>
	{/if}

	{#if post.is_repost}
		<div class="repost-banner" data-testid="repost-banner">
			<span class="repost-icon">&#8635;</span> @dril {repostLabel}
		</div>
	{/if}

	<div class="card-layout">
		<div class="avatar-col">
			<img
				class="avatar"
				src={avatarSrc}
				alt="@dril avatar"
				width={avatarSize}
				height={avatarSize}
			/>
		</div>
		<div class="content-col">
			<div class="header">
				{@render header()}
			</div>
			<div class="text">{post.text}</div>
			{#if post.is_quote && post.quoted_text}
				<div class="quoted">
					<div class="quoted-text">{post.quoted_text}</div>
				</div>
			{/if}
			<MediaPlaceholder media={post.media} />
			<div class="engagement">
				{@render engagement()}
			</div>
		</div>
	</div>
</article>

<style>
	.card-layout {
		display: flex;
	}

	.avatar-col {
		flex-shrink: 0;
	}

	.avatar {
		display: block;
	}

	.content-col {
		flex: 1;
		min-width: 0;
	}

	.text {
		white-space: pre-wrap;
		word-wrap: break-word;
	}
</style>

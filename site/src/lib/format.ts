import type { Post } from "./types";

export function formatPostDate(createdAt: string): string {
	return new Date(createdAt).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function resolveDisplayName(post: Post): string {
	return post.is_repost && post.original_user_name ? post.original_user_name : "wint";
}

export function resolveHandle(post: Post, fallback = "dril"): string {
	return post.is_repost && post.original_user_screen_name
		? post.original_user_screen_name
		: fallback;
}

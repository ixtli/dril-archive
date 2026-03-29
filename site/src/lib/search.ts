export function postUrl(platform: string, id: string): string {
	switch (platform) {
		case "threads":
			return `https://www.threads.com/@dril/post/${id}`;
		case "bsky":
			return `https://bsky.app/profile/dril.bsky.social/post/${id}`;
		default:
			return `https://x.com/dril/status/${id}`;
	}
}

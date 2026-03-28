import type { TwitterEra } from "./types.ts";

/**
 * Era-aware CSS selector chains for extracting content from archived Twitter pages.
 * Each function returns an array of selectors to try in order (first match wins).
 */

/** Selectors for the top-level tweet container element. */
export function getTweetContainerSelectors(era: TwitterEra): string[] {
	switch (era) {
		case "twitter-classic":
			return [
				".hentry",
				"#status_",
				".entry-content",
				".tweet",
			];
		case "twitter-new":
			return [
				".tweet",
				".js-stream-tweet",
				".js-tweet",
				".original-tweet",
			];
		case "twitter-material":
			return [
				".tweet",
				".js-actionable-tweet",
				".js-stream-tweet",
				".permalink-tweet",
			];
		case "twitter-modern":
			return [
				"[data-testid='tweet']",
				"article[role='article']",
				"article",
			];
	}
}

/** Selectors for the tweet text content. */
export function getTweetTextSelectors(era: TwitterEra): string[] {
	switch (era) {
		case "twitter-classic":
			return [
				".entry-content",
				".tweet-text",
				".js-tweet-text",
			];
		case "twitter-new":
			return [
				".tweet-text",
				".js-tweet-text",
				"p.tweet-text",
			];
		case "twitter-material":
			return [
				".tweet-text",
				".js-tweet-text",
				"p.TweetTextSize",
			];
		case "twitter-modern":
			return [
				"[data-testid='tweetText']",
				"[lang]",
			];
	}
}

/** Selectors for the tweet timestamp element. */
export function getTimestampSelectors(era: TwitterEra): string[] {
	switch (era) {
		case "twitter-classic":
			return [
				".published",
				"time",
				".timestamp",
				"a[href*='/status/'] span",
			];
		case "twitter-new":
			return [
				"time",
				".tweet-timestamp",
				"._timestamp",
				"a.tweet-timestamp",
			];
		case "twitter-material":
			return [
				"time",
				".tweet-timestamp",
				"a.tweet-timestamp",
			];
		case "twitter-modern":
			return [
				"time[datetime]",
				"time",
			];
	}
}

/** Selectors for engagement counts (likes, retweets). */
export function getEngagementSelectors(era: TwitterEra): {
	likes: string[];
	retweets: string[];
} {
	switch (era) {
		case "twitter-classic":
			return {
				likes: [".favor", ".fav-count"],
				retweets: [".retweet-count"],
			};
		case "twitter-new":
			return {
				likes: [
					".ProfileTweet-action--favorite .ProfileTweet-actionCount",
					".js-stat-favorites",
					".request-favorited-popup",
				],
				retweets: [
					".ProfileTweet-action--retweet .ProfileTweet-actionCount",
					".js-stat-retweets",
					".request-retweeted-popup",
				],
			};
		case "twitter-material":
			return {
				likes: [
					".ProfileTweet-action--favorite .ProfileTweet-actionCount",
					"[data-tweet-stat-count].js-stat-favorites",
				],
				retweets: [
					".ProfileTweet-action--retweet .ProfileTweet-actionCount",
					"[data-tweet-stat-count].js-stat-retweets",
				],
			};
		case "twitter-modern":
			return {
				likes: [
					"[data-testid='like'] span",
					"[aria-label*='like' i]",
					"[aria-label*='Like' i]",
				],
				retweets: [
					"[data-testid='retweet'] span",
					"[aria-label*='retweet' i]",
					"[aria-label*='Retweet' i]",
				],
			};
	}
}

/** Selectors for reply context (who the tweet is replying to). */
export function getReplyContextSelectors(era: TwitterEra): string[] {
	switch (era) {
		case "twitter-classic":
			return [
				".in-reply-to",
				".entry-meta a[href*='/status/']",
			];
		case "twitter-new":
			return [
				".ReplyingToContextBelowAuthor",
				".js-reply-info",
				".tweet-context .with-icn",
			];
		case "twitter-material":
			return [
				".ReplyingToContextBelowAuthor",
				".js-reply-info",
			];
		case "twitter-modern":
			return [
				"[data-testid='Tweet-User-Avatar'] + div a[href*='/']",
				"div[id^='id__'] > a",
			];
	}
}

/** Selectors for quoted tweet containers. */
export function getQuotedTweetSelectors(era: TwitterEra): string[] {
	switch (era) {
		case "twitter-classic":
			// Quote tweets didn't exist in this era
			return [];
		case "twitter-new":
			return [
				".QuoteTweet",
				".quote-tweet",
				".js-quote-detail",
			];
		case "twitter-material":
			return [
				".QuoteTweet",
				".QuoteTweet-container",
			];
		case "twitter-modern":
			return [
				"[data-testid='quoteTweet']",
				"[role='link'][tabindex='0']",
			];
	}
}

/** Selectors for media containers (photos, videos). */
export function getMediaSelectors(era: TwitterEra): string[] {
	switch (era) {
		case "twitter-classic":
			return [
				".media",
				"img.photo",
			];
		case "twitter-new":
			return [
				".AdaptiveMedia",
				".AdaptiveMedia-container",
				".js-adaptive-photo",
			];
		case "twitter-material":
			return [
				".AdaptiveMedia",
				".AdaptiveMedia-container",
			];
		case "twitter-modern":
			return [
				"[data-testid='tweetPhoto']",
				"[data-testid='videoPlayer']",
				"[data-testid='card.wrapper']",
			];
	}
}

/** Selectors for profile page elements. */
export function getProfileSelectors(era: TwitterEra): {
	name: string[];
	bio: string[];
	avatar: string[];
} {
	switch (era) {
		case "twitter-classic":
			return {
				name: [".fn", ".fullname", ".profile-field"],
				bio: [".bio", ".profile-bio"],
				avatar: [".profile-image", ".avatar", "img.photo"],
			};
		case "twitter-new":
			return {
				name: [
					".ProfileHeaderCard-nameLink",
					".fullname",
					"a.ProfileHeaderCard-nameLink",
				],
				bio: [
					".ProfileHeaderCard-bio",
					".bio",
					"p.ProfileHeaderCard-bio",
				],
				avatar: [
					".ProfileAvatar-image",
					".avatar",
					"img.ProfileAvatar-image",
				],
			};
		case "twitter-material":
			return {
				name: [".ProfileHeaderCard-nameLink"],
				bio: [".ProfileHeaderCard-bio"],
				avatar: [".ProfileAvatar-image"],
			};
		case "twitter-modern":
			return {
				name: ["[data-testid='UserName']"],
				bio: ["[data-testid='UserDescription']"],
				avatar: ["[data-testid='UserAvatar'] img", "img[src*='profile_images']"],
			};
	}
}

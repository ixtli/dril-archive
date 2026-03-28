import type { ThemeId } from "./types";

export function getAutoTheme(platform: string, createdAt: string): ThemeId {
	if (platform === "bsky") return "bsky";
	if (platform === "threads") return "threads";
	const d = new Date(createdAt);
	if (d < new Date("2010-09-01")) return "twitter-classic";
	if (d < new Date("2014-06-01")) return "twitter-new";
	if (d < new Date("2019-07-15")) return "twitter-material";
	return "twitter-modern";
}

export function resolveTheme(
	platform: string,
	createdAt: string,
	override: ThemeId | "auto",
): ThemeId {
	if (override !== "auto") return override;
	return getAutoTheme(platform, createdAt);
}

export const THEME_LABELS: Record<ThemeId | "auto", string> = {
	auto: "Auto (era-correct)",
	"twitter-classic": "Twitter Classic (2008-2010)",
	"twitter-new": "Twitter New (2010-2014)",
	"twitter-material": "Twitter Material (2014-2019)",
	"twitter-modern": "Twitter Modern (2019-2023)",
	bsky: "Bluesky",
	threads: "Threads",
};

export const ALL_THEMES: (ThemeId | "auto")[] = [
	"auto",
	"twitter-classic",
	"twitter-new",
	"twitter-material",
	"twitter-modern",
	"bsky",
	"threads",
];

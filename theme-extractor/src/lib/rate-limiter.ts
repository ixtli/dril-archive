/**
 * Rate limiter with configurable delay and jitter for polite Wayback Machine access.
 */
export class RateLimiter {
	private lastRequestTime = 0;

	constructor(
		private readonly minDelayMs: number = 10_000,
		private readonly maxJitterMs: number = 5_000,
	) {}

	/** Sleep for the configured delay plus random jitter since the last request. */
	async wait(): Promise<void> {
		const elapsed = Date.now() - this.lastRequestTime;
		const jitter = Math.random() * this.maxJitterMs;
		const targetDelay = this.minDelayMs + jitter;
		const remaining = targetDelay - elapsed;

		if (remaining > 0) {
			await sleep(remaining);
		}
		this.lastRequestTime = Date.now();
	}

	/** Exponential backoff: minDelay * 2^attempt, capped at 5 minutes. */
	async backoff(attempt: number): Promise<void> {
		const maxBackoff = 5 * 60 * 1000;
		const delay = Math.min(this.minDelayMs * 2 ** attempt, maxBackoff);
		const jitter = Math.random() * this.maxJitterMs;
		await sleep(delay + jitter);
		this.lastRequestTime = Date.now();
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

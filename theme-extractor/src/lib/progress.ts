import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ProgressState } from "./types.ts";

/**
 * Resumable progress tracker that persists state to a JSON file.
 * Allows long-running crawls to be interrupted and resumed.
 */
export class ProgressTracker {
	private state: ProgressState;

	constructor(private readonly stateFilePath: string) {
		this.state = this.load();
	}

	/** Check whether a key has already been successfully processed. */
	isProcessed(key: string): boolean {
		return key in this.state.processed;
	}

	/** Get the stored result for a processed key, or null. */
	getResult(key: string): unknown | null {
		return this.state.processed[key]?.result ?? null;
	}

	/** Check whether a key has failed. */
	isFailed(key: string): boolean {
		return key in this.state.failed;
	}

	/** Get the number of failed attempts for a key. */
	getFailedAttempts(key: string): number {
		return this.state.failed[key]?.attempts ?? 0;
	}

	/** Mark a key as successfully processed with its result. Writes to disk. */
	markProcessed(key: string, result: unknown): void {
		this.state.processed[key] = {
			result,
			timestamp: new Date().toISOString(),
		};
		// Remove from failed if it was there
		delete this.state.failed[key];
		this.save();
	}

	/** Mark a key as failed with an error message. Increments attempt count. Writes to disk. */
	markFailed(key: string, error: string): void {
		const existing = this.state.failed[key];
		this.state.failed[key] = {
			error,
			attempts: (existing?.attempts ?? 0) + 1,
			timestamp: new Date().toISOString(),
		};
		this.save();
	}

	/** Given all keys that need processing, return those not yet processed or permanently failed. */
	getPending(allKeys: string[], maxAttempts: number = 3): string[] {
		return allKeys.filter((key) => {
			if (this.isProcessed(key)) return false;
			if (this.getFailedAttempts(key) >= maxAttempts) return false;
			return true;
		});
	}

	/** Get summary statistics. */
	getStats(totalKeys?: number): {
		processed: number;
		failed: number;
		pending: number;
	} {
		const processed = Object.keys(this.state.processed).length;
		const failed = Object.keys(this.state.failed).length;
		const pending =
			totalKeys !== undefined ? totalKeys - processed - failed : 0;
		return { processed, failed, pending };
	}

	/** Flush current state to disk. */
	save(): void {
		const dir = dirname(this.stateFilePath);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		writeFileSync(
			this.stateFilePath,
			JSON.stringify(this.state, null, "\t") + "\n",
		);
	}

	private load(): ProgressState {
		if (!existsSync(this.stateFilePath)) {
			return { processed: {}, failed: {} };
		}
		const raw = readFileSync(this.stateFilePath, "utf-8");
		return JSON.parse(raw) as ProgressState;
	}
}

// src/services/performance/timer.ts

import { getPerformanceMetrics } from "./metrics";

/**
 * Measure operation performance and automatically record to metrics.
 *
 * @example
 * const timer = new PerformanceTimer("tile-batch-save");
 * await tileStore.saveTileBatch(tiles);
 * timer.end(); // Automatically records duration
 */
export class PerformanceTimer {
    private startTime: number;
    private operation: string;

    constructor(operation: string) {
        this.operation = operation;
        this.startTime = performance.now();
    }

    /**
     * End timing and record to metrics.
     * @returns Duration in milliseconds
     */
    end(): number {
        const duration = performance.now() - this.startTime;
        getPerformanceMetrics().record(this.operation, duration);
        return duration;
    }

    /**
     * End timing without recording (for aborted operations).
     */
    abort(): void {
        // No-op, just stop timing
    }
}

/**
 * Measure async function performance.
 *
 * @example
 * await measurePerformance("tile-batch-save", async () => {
 *     await tileStore.saveTileBatch(tiles);
 * });
 */
export async function measurePerformance<T>(
    operation: string,
    fn: () => Promise<T>
): Promise<T> {
    const timer = new PerformanceTimer(operation);
    try {
        const result = await fn();
        timer.end();
        return result;
    } catch (error) {
        timer.abort();
        throw error;
    }
}

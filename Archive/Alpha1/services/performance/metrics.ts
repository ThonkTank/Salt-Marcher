// src/services/performance/metrics.ts

import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("performance-metrics");

export interface PerformanceStats {
    count: number;
    mean: number;
    median: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
}

/**
 * Centralized performance metrics tracking with percentile statistics.
 *
 * Tracks operation timings and provides statistical analysis for
 * performance monitoring and regression detection.
 */
export class PerformanceMetrics {
    private metrics: Map<string, number[]> = new Map();
    private maxSamples: number = 100; // Keep last 100 samples per operation

    /**
     * Record a performance measurement.
     * @param operation - Operation name (e.g., "tile-batch-save", "border-detection")
     * @param durationMs - Duration in milliseconds
     */
    record(operation: string, durationMs: number): void {
        if (!this.metrics.has(operation)) {
            this.metrics.set(operation, []);
        }

        const samples = this.metrics.get(operation)!;
        samples.push(durationMs);

        // Keep last maxSamples samples (circular buffer)
        if (samples.length > this.maxSamples) {
            samples.shift();
        }

        // Log slow operations (p95 threshold exceeded)
        const stats = this.getStats(operation);
        if (stats && durationMs > stats.p95 * 1.5) {
            logger.warn(`[performance] Slow operation detected: ${operation} took ${durationMs.toFixed(1)}ms (p95: ${stats.p95.toFixed(1)}ms)`);
        }
    }

    /**
     * Get statistical summary for an operation.
     * @param operation - Operation name
     * @returns Statistics or null if no samples
     */
    getStats(operation: string): PerformanceStats | null {
        const samples = this.metrics.get(operation);
        if (!samples || samples.length === 0) return null;

        const sorted = [...samples].sort((a, b) => a - b);
        const sum = samples.reduce((a, b) => a + b, 0);

        return {
            count: samples.length,
            mean: sum / samples.length,
            median: sorted[Math.floor(sorted.length / 2)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)],
            min: sorted[0],
            max: sorted[sorted.length - 1]
        };
    }

    /**
     * Get all metrics (for DevKit integration).
     * @returns Map of operation name to statistics
     */
    dumpMetrics(): Record<string, PerformanceStats> {
        const result: Record<string, PerformanceStats> = {};
        for (const [operation, _] of this.metrics) {
            const stats = this.getStats(operation);
            if (stats) result[operation] = stats;
        }
        return result;
    }

    /**
     * Clear all metrics.
     */
    clear(): void {
        this.metrics.clear();
    }

    /**
     * Clear metrics for a specific operation.
     */
    clearOperation(operation: string): void {
        this.metrics.delete(operation);
    }
}

// Global singleton instance
let globalMetrics: PerformanceMetrics | null = null;

/**
 * Get global performance metrics instance.
 */
export function getPerformanceMetrics(): PerformanceMetrics {
    if (!globalMetrics) {
        globalMetrics = new PerformanceMetrics();
    }
    return globalMetrics;
}

/**
 * Reset global performance metrics instance (for testing).
 */
export function resetPerformanceMetrics(): void {
    globalMetrics = null;
}

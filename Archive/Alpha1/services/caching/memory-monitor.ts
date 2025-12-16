// src/services/caching/memory-monitor.ts
// Memory monitoring and pressure detection for cache management

import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('memory-monitor');
import { GlobalCacheRegistry } from "./cache-registry";

/**
 * Memory monitoring configuration
 */
export interface MemoryMonitorConfig {
    /** Check interval in milliseconds */
    checkIntervalMs?: number;

    /** Warning threshold in MB */
    warningThresholdMB?: number;

    /** Critical threshold in MB (triggers eviction) */
    criticalThresholdMB?: number;

    /** Enable automatic pressure handling */
    autoHandle?: boolean;
}

/**
 * Memory pressure level
 */
export type MemoryPressureLevel = 'normal' | 'warning' | 'critical';

/**
 * Memory monitor result
 */
export interface MemoryMonitorResult {
    currentMemoryMB: number;
    warningThresholdMB: number;
    criticalThresholdMB: number;
    pressureLevel: MemoryPressureLevel;
    cacheCount: number;
    totalItems: number;
}

/**
 * Memory monitor for cache system
 *
 * **Features:**
 * - Periodic memory usage checks
 * - Warning and critical thresholds
 * - Automatic pressure handling
 * - Event notifications
 *
 * **Usage:**
 * ```typescript
 * const monitor = new MemoryMonitor({
 *   checkIntervalMs: 30000, // 30 seconds
 *   warningThresholdMB: 50,
 *   criticalThresholdMB: 100,
 *   autoHandle: true
 * });
 *
 * monitor.start();
 *
 * monitor.on('warning', (result) => {
 *   console.warn(`Cache memory: ${result.currentMemoryMB}MB`);
 * });
 *
 * monitor.on('critical', (result) => {
 *   console.error(`Cache memory critical: ${result.currentMemoryMB}MB`);
 * });
 * ```
 */
export class MemoryMonitor {
    private config: Required<MemoryMonitorConfig>;
    private intervalId: number | null = null;
    private listeners = new Map<string, Set<(result: MemoryMonitorResult) => void>>();
    private lastPressureLevel: MemoryPressureLevel = 'normal';

    constructor(config: MemoryMonitorConfig = {}) {
        this.config = {
            checkIntervalMs: config.checkIntervalMs ?? 30000, // 30 seconds
            warningThresholdMB: config.warningThresholdMB ?? 50,
            criticalThresholdMB: config.criticalThresholdMB ?? 100,
            autoHandle: config.autoHandle ?? true,
        };

        logger.info("Initialized", this.config);
    }

    /**
     * Start monitoring
     */
    start(): void {
        if (this.intervalId !== null) {
            logger.warn("Already started");
            return;
        }

        logger.info("Starting");

        // Initial check
        this.check();

        // Periodic checks
        this.intervalId = window.setInterval(() => {
            this.check();
        }, this.config.checkIntervalMs);
    }

    /**
     * Stop monitoring
     */
    stop(): void {
        if (this.intervalId === null) {
            logger.warn("Not started");
            return;
        }

        logger.info("Stopping");

        window.clearInterval(this.intervalId);
        this.intervalId = null;
    }

    /**
     * Check current memory usage
     *
     * @returns Current memory status
     */
    check(): MemoryMonitorResult {
        const registry = GlobalCacheRegistry.getInstance();
        const stats = registry.getGlobalStats();

        const result: MemoryMonitorResult = {
            currentMemoryMB: stats.totalMemoryMB,
            warningThresholdMB: this.config.warningThresholdMB,
            criticalThresholdMB: this.config.criticalThresholdMB,
            pressureLevel: this.calculatePressureLevel(stats.totalMemoryMB),
            cacheCount: stats.cacheCount,
            totalItems: stats.totalItems,
        };

        // Log if pressure level changed
        if (result.pressureLevel !== this.lastPressureLevel) {
            logger.info("Pressure level changed", {
                from: this.lastPressureLevel,
                to: result.pressureLevel,
                currentMemoryMB: result.currentMemoryMB,
            });

            this.lastPressureLevel = result.pressureLevel;
        }

        // Emit events based on pressure level
        if (result.pressureLevel === 'warning') {
            this.emit('warning', result);
        } else if (result.pressureLevel === 'critical') {
            this.emit('critical', result);

            // Auto-handle if enabled
            if (this.config.autoHandle) {
                logger.warn("Critical pressure, triggering eviction");
                registry.onMemoryPressure();
            }
        } else {
            this.emit('normal', result);
        }

        return result;
    }

    /**
     * Get current status without triggering actions
     *
     * @returns Current memory status
     */
    getStatus(): MemoryMonitorResult {
        const registry = GlobalCacheRegistry.getInstance();
        const stats = registry.getGlobalStats();

        return {
            currentMemoryMB: stats.totalMemoryMB,
            warningThresholdMB: this.config.warningThresholdMB,
            criticalThresholdMB: this.config.criticalThresholdMB,
            pressureLevel: this.calculatePressureLevel(stats.totalMemoryMB),
            cacheCount: stats.cacheCount,
            totalItems: stats.totalItems,
        };
    }

    /**
     * Update configuration
     *
     * @param config - New configuration (partial)
     */
    updateConfig(config: Partial<MemoryMonitorConfig>): void {
        this.config = {
            ...this.config,
            ...config,
        };

        logger.info("Configuration updated", this.config);

        // Update registry threshold if critical changed
        if (config.criticalThresholdMB !== undefined) {
            const registry = GlobalCacheRegistry.getInstance();
            registry.setMemoryPressureThreshold(config.criticalThresholdMB);
        }
    }

    /**
     * Subscribe to memory events
     *
     * @param event - Event type (normal, warning, critical)
     * @param callback - Callback function
     * @returns Unsubscribe function
     */
    on(
        event: MemoryPressureLevel,
        callback: (result: MemoryMonitorResult) => void
    ): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }

        this.listeners.get(event)!.add(callback);

        // Return unsubscribe function
        return () => {
            this.listeners.get(event)?.delete(callback);
        };
    }

    /**
     * Dispose monitor and cleanup
     */
    dispose(): void {
        this.stop();
        this.listeners.clear();

        logger.info("Disposed");
    }

    /**
     * Calculate pressure level based on memory usage
     */
    private calculatePressureLevel(memoryMB: number): MemoryPressureLevel {
        if (memoryMB >= this.config.criticalThresholdMB) {
            return 'critical';
        } else if (memoryMB >= this.config.warningThresholdMB) {
            return 'warning';
        } else {
            return 'normal';
        }
    }

    /**
     * Emit event to listeners
     */
    private emit(event: MemoryPressureLevel, result: MemoryMonitorResult): void {
        const callbacks = this.listeners.get(event);
        if (!callbacks) return;

        for (const callback of callbacks) {
            try {
                callback(result);
            } catch (error) {
                logger.error(`Error in ${event} listener`, {
                    error: error.message,
                });
            }
        }
    }
}

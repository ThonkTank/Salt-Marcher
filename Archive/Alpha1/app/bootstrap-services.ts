// src/app/bootstrap-services.ts
import type { App } from "obsidian";
import {
    ensureTerrainFile,
    loadTerrains,
    watchTerrains,
    setBackgroundColorPalette,
    type TerrainWatcherOptions,
} from "@features/maps";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('bootstrap-services');

export interface TerrainBootstrapLogger {
    info?(message: string, context?: Record<string, unknown>): void;
    warn?(message: string, context?: Record<string, unknown>): void;
    error?(message: string, context?: Record<string, unknown>): void;
}

export interface TerrainBootstrapResult {
    primed: boolean;
    primeError?: unknown;
    watchError?: unknown;
}

export interface TerrainBootstrapHandle {
    start(): Promise<TerrainBootstrapResult>;
    stop(): void;
}

export interface TerrainBootstrapConfig {
    ensureTerrainFile?: typeof ensureTerrainFile;
    loadTerrains?: typeof loadTerrains;
    setBackgroundColorPalette?: typeof setBackgroundColorPalette;
    watchTerrains?: (app: App, options?: TerrainWatcherOptions | (() => void | Promise<void>)) => () => void;
    logger?: TerrainBootstrapLogger;
}

const defaultLogger: Required<TerrainBootstrapLogger> = {
    info: (message, context) => {
        if (context) {
            logger.info(`${message}`, context);
        } else {
            logger.info(`${message}`);
        }
    },
    warn: (message, context) => {
        if (context) {
            logger.warn(`${message}`, context);
        } else {
            logger.warn(`${message}`);
        }
    },
    error: (message, context) => {
        if (context) {
            logger.error(`${message}`, context);
        } else {
            logger.error(`${message}`);
        }
    },
};

export function createTerrainBootstrap(app: App, config: TerrainBootstrapConfig = {}): TerrainBootstrapHandle {
    const deps = {
        ensureTerrainFile: config.ensureTerrainFile ?? ensureTerrainFile,
        loadTerrains: config.loadTerrains ?? loadTerrains,
        setBackgroundColorPalette: config.setBackgroundColorPalette ?? setBackgroundColorPalette,
        watchTerrains: config.watchTerrains ?? watchTerrains,
        logger: config.logger ?? defaultLogger,
    } as const;

    let disposeWatcher: (() => void) | null = null;

    const stop = () => {
        if (disposeWatcher) {
            try {
                disposeWatcher();
            } catch (error) {
                deps.logger.warn?.("Failed to dispose terrain watcher", { error: error as unknown });
            }
        }
        disposeWatcher = null;
    };

    const start = async (): Promise<TerrainBootstrapResult> => {
        stop();
        let primeError: unknown | undefined;
        let watchError: unknown | undefined;

        // Try to load terrain palette with retry (metadata cache may not be ready on first load)
        const maxRetries = 2;
        const retryDelay = 100; // ms

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                await deps.ensureTerrainFile(app);
                const map = await deps.loadTerrains(app);
                const colorMap = Object.fromEntries(
                    Object.entries(map).map(([name, data]) => [name, data.color])
                );
                deps.setBackgroundColorPalette(colorMap);

                // Success - log if it took retries
                if (attempt > 0) {
                    deps.logger.info?.(`Terrain palette loaded successfully on attempt ${attempt + 1}`);
                }

                break; // Success, exit retry loop
            } catch (error) {
                primeError = error;

                if (attempt < maxRetries) {
                    // Retry after delay
                    deps.logger.warn?.(`Terrain palette load failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${retryDelay}ms...`, {
                        error: error as unknown,
                    });
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                } else {
                    // Final attempt failed
                    deps.logger.error?.("Failed to prime terrain palette from vault after all retries", {
                        error: error as unknown,
                        attempts: maxRetries + 1,
                    });
                }
            }
        }

        try {
            disposeWatcher = deps.watchTerrains(app, {
                onError: (error, meta) => {
                    deps.logger.error?.("Terrain watcher failed to apply vault change", {
                        error: error as unknown,
                        reason: meta.reason,
                    });
                },
            });
        } catch (error) {
            watchError = error;
            deps.logger.error?.("Failed to register terrain watcher", { error: error as unknown });
            disposeWatcher = null;
        }

        return {
            primed: !primeError && !watchError,
            primeError,
            watchError,
        };
    };

    return {
        start,
        stop,
    };
}

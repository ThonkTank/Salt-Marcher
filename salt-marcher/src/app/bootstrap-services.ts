// src/app/bootstrap-services.ts
import type { App } from "obsidian";
import {
    ensureTerrainFile,
    loadTerrains,
    watchTerrains,
    type TerrainWatcherOptions,
} from "../core/terrain-store";
import { setTerrains } from "../core/terrain";

export interface TerrainBootstrapLogger {
    info?(message: string, context?: Record<string, unknown>): void;
    warn?(message: string, context?: Record<string, unknown>): void;
    error?(message: string, context?: Record<string, unknown>): void;
}

export interface TerrainBootstrapHandle {
    start(): Promise<boolean>;
    stop(): void;
}

export interface TerrainBootstrapConfig {
    ensureTerrainFile?: typeof ensureTerrainFile;
    loadTerrains?: typeof loadTerrains;
    setTerrains?: typeof setTerrains;
    watchTerrains?: (app: App, options?: TerrainWatcherOptions | (() => void | Promise<void>)) => () => void;
    logger?: TerrainBootstrapLogger;
}

const defaultLogger: Required<TerrainBootstrapLogger> = {
    info: (message, context) => {
        if (context) {
            console.info(`[salt-marcher] ${message}`, context);
        } else {
            console.info(`[salt-marcher] ${message}`);
        }
    },
    warn: (message, context) => {
        if (context) {
            console.warn(`[salt-marcher] ${message}`, context);
        } else {
            console.warn(`[salt-marcher] ${message}`);
        }
    },
    error: (message, context) => {
        if (context) {
            console.error(`[salt-marcher] ${message}`, context);
        } else {
            console.error(`[salt-marcher] ${message}`);
        }
    },
};

export function createTerrainBootstrap(app: App, config: TerrainBootstrapConfig = {}): TerrainBootstrapHandle {
    const deps = {
        ensureTerrainFile: config.ensureTerrainFile ?? ensureTerrainFile,
        loadTerrains: config.loadTerrains ?? loadTerrains,
        setTerrains: config.setTerrains ?? setTerrains,
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

    const start = async (): Promise<boolean> => {
        stop();
        let primed = true;
        try {
            await deps.ensureTerrainFile(app);
            const map = await deps.loadTerrains(app);
            deps.setTerrains(map);
        } catch (error) {
            primed = false;
            deps.logger.error?.("Failed to prime terrain palette from vault", { error: error as unknown });
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
            primed = false;
            deps.logger.error?.("Failed to register terrain watcher", { error: error as unknown });
            disposeWatcher = null;
        }

        return primed;
    };

    return {
        start,
        stop,
    };
}

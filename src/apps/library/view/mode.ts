// src/apps/library/view/mode.ts
// Basistypen für Library-Ansichtsmodi.
// Verwendet shared workmode infrastructure

import type { FilterableLibraryMode } from "../core/data-sources";
import { BaseModeRenderer as SharedBaseModeRenderer, scoreName as sharedScoreName, WatcherHub } from "../../../ui/workmode";
import type { ModeRenderer as SharedModeRenderer } from "../../../ui/workmode";

export type Mode = FilterableLibraryMode;

export interface ModeRenderer extends SharedModeRenderer<Mode> {
    readonly mode: Mode;
}

// Re-export shared utilities for backward compatibility
export { scoreName } from "../../../ui/workmode";

// Library-specific base renderer that extends shared base
export abstract class BaseModeRenderer extends SharedBaseModeRenderer<Mode> implements ModeRenderer {
    readonly abstract mode: Mode;

    // Override setQuery to trim the query (Library-specific behavior)
    setQuery(query: string): void {
        this.query = (query || "").toLowerCase();
        this.render();
    }
}

/**
 * Orchestriert Dateisystem-Watcher pro Library-Quelle, sodass mehrere Renderer
 * dieselben Signale nutzen können ohne redundante Abos aufzubauen.
 *
 * This is a typed wrapper around the generic WatcherHub.
 */
export class LibrarySourceWatcherHub {
    private readonly hub = new WatcherHub<Mode>();

    subscribe(source: Mode, factory: (onChange: () => void) => () => void, listener: () => void): () => void {
        return this.hub.subscribe(source, factory, listener);
    }

    destroy(): void {
        this.hub.destroy();
    }
}

// src/apps/library/view/mode.ts
// Basistypen für Library-Ansichtsmodi.
import type { App } from "obsidian";
import type { LibrarySourceId } from "../core/sources";

type WatchFactory = (onChange: () => void) => () => void;

type WatchRegistryEntry = {
    stop?: () => void;
    listeners: Set<() => void>;
};

export type Mode = LibrarySourceId;

export interface ModeRenderer {
    readonly mode: Mode;
    init(): Promise<void>;
    render(): void;
    setQuery(query: string): void;
    handleCreate(name: string): Promise<void>;
    destroy(): Promise<void>;
}

export function scoreName(name: string, q: string): number {
    if (!q) return 0.0001;
    if (name === q) return 1000;
    if (name.startsWith(q)) return 900 - (name.length - q.length);
    const idx = name.indexOf(q);
    if (idx >= 0) return 700 - idx;
    const tokenIdx = name.split(/\s+|[-_]/).findIndex(t => t.startsWith(q));
    if (tokenIdx >= 0) return 600 - tokenIdx * 5;
    return -Infinity;
}

export abstract class BaseModeRenderer implements ModeRenderer {
    readonly abstract mode: Mode;
    protected query = "";
    private cleanups: Array<() => void> = [];
    private disposed = false;

    constructor(protected readonly app: App, protected readonly container: HTMLElement) {}

    async init(): Promise<void> { /* optional */ }

    setQuery(query: string): void {
        this.query = (query || "").toLowerCase();
        this.render();
    }

    abstract render(): void;

    async handleCreate(_name: string): Promise<void> { /* optional */ }

    async destroy(): Promise<void> {
        if (this.disposed) return;
        this.disposed = true;
        for (const fn of this.cleanups.splice(0)) {
            try { fn(); } catch { /* noop */ }
        }
        this.container.empty();
    }

    protected isDisposed(): boolean {
        return this.disposed;
    }

    protected registerCleanup(fn: () => void): void {
        this.cleanups.push(fn);
    }
}

/**
 * Orchestriert Dateisystem-Watcher pro Library-Quelle, sodass mehrere Renderer
 * dieselben Signale nutzen können ohne redundante Abos aufzubauen.
 */
export class LibrarySourceWatcherHub {
    private readonly registry = new Map<LibrarySourceId, WatchRegistryEntry>();

    subscribe(source: LibrarySourceId, factory: WatchFactory, listener: () => void): () => void {
        let entry = this.registry.get(source);
        if (!entry) {
            const listeners = new Set<() => void>();
            const stop = factory(() => {
                for (const cb of listeners) {
                    try {
                        cb();
                    } catch (err) {
                        console.error("Library watch callback failed", err);
                    }
                }
            });
            entry = { stop, listeners };
            this.registry.set(source, entry);
        }

        entry.listeners.add(listener);

        return () => {
            const current = this.registry.get(source);
            if (!current) return;
            current.listeners.delete(listener);
            if (current.listeners.size === 0) {
                try {
                    current.stop?.();
                } catch (err) {
                    console.error("Failed to stop library watcher", err);
                }
                this.registry.delete(source);
            }
        };
    }
}

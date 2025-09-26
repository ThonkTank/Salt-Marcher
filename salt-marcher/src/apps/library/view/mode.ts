import type { App } from "obsidian";

export type Mode = "creatures" | "spells" | "terrains" | "regions";

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

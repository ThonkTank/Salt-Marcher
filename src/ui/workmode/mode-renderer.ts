// src/ui/workmode/mode-renderer.ts
// Base renderer pattern for workmode views

import type { App } from "obsidian";

/**
 * Renderer interface for a specific mode within a workmode view.
 * Each mode handles its own rendering, state, and lifecycle.
 */
export interface ModeRenderer<M extends string = string> {
    /** The unique identifier for this mode */
    readonly mode: M;

    /** Initialize the renderer (load data, setup watchers, etc.) */
    init(): Promise<void>;

    /** Render the current state to the DOM */
    render(): void;

    /** Update the search/filter query and re-render */
    setQuery(query: string): void;

    /** Handle creation of a new entry (optional) */
    handleCreate?(name: string): Promise<void>;

    /** Clean up resources and remove DOM elements */
    destroy(): Promise<void>;
}

/**
 * Base implementation of ModeRenderer providing common functionality.
 * Subclasses should implement the abstract render() method and optionally
 * override other methods as needed.
 */
export abstract class BaseModeRenderer<M extends string = string> implements ModeRenderer<M> {
    abstract readonly mode: M;

    protected query = "";
    protected disposed = false;
    private cleanups: Array<() => void> = [];

    constructor(
        protected readonly app: App,
        protected readonly container: HTMLElement
    ) {}

    /**
     * Initialize the renderer. Override to load initial data.
     */
    async init(): Promise<void> {
        // Default: no-op, subclasses can override
    }

    /**
     * Update the search query and trigger a re-render.
     */
    setQuery(query: string): void {
        this.query = (query || "").toLowerCase().trim();
        this.render();
    }

    /**
     * Render the current state. Must be implemented by subclasses.
     */
    abstract render(): void;

    /**
     * Handle creation of a new entry. Override if needed.
     */
    async handleCreate(_name: string): Promise<void> {
        // Default: no-op, subclasses can override
    }

    /**
     * Clean up all resources and remove DOM elements.
     */
    async destroy(): Promise<void> {
        if (this.disposed) return;
        this.disposed = true;

        // Run all cleanup functions
        for (const fn of this.cleanups.splice(0)) {
            try {
                fn();
            } catch (err) {
                console.error("Cleanup function failed:", err);
            }
        }

        // Clear container
        this.container.empty();
    }

    /**
     * Check if this renderer has been disposed.
     */
    protected isDisposed(): boolean {
        return this.disposed;
    }

    /**
     * Register a cleanup function to be called during destroy().
     */
    protected registerCleanup(fn: () => void): void {
        if (this.disposed) {
            console.warn("Attempted to register cleanup on disposed renderer");
            return;
        }
        this.cleanups.push(fn);
    }

    /**
     * Helper to create a simple message element in the container.
     */
    protected renderMessage(message: string, className?: string): void {
        this.container.empty();
        const el = this.container.createDiv({ text: message });
        if (className) {
            el.addClass(className);
        }
    }

    /**
     * Helper to render an empty state.
     */
    protected renderEmptyState(message: string): void {
        this.renderMessage(message, "sm-mode-empty");
    }

    /**
     * Helper to render an error state.
     */
    protected renderErrorState(message: string): void {
        this.renderMessage(message, "sm-mode-error");
    }
}

/**
 * Utility function to score a name against a search query.
 * Higher scores indicate better matches.
 */
export function scoreName(name: string, query: string): number {
    if (!query) return 0.0001; // Small positive score for no query

    const lowerName = name.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Exact match
    if (lowerName === lowerQuery) return 1000;

    // Starts with query
    if (lowerName.startsWith(lowerQuery)) {
        return 900 - (name.length - query.length);
    }

    // Contains query
    const idx = lowerName.indexOf(lowerQuery);
    if (idx >= 0) {
        return 700 - idx;
    }

    // Word boundary match (after space, dash, underscore)
    const tokens = lowerName.split(/\s+|[-_]/);
    const tokenIdx = tokens.findIndex(t => t.startsWith(lowerQuery));
    if (tokenIdx >= 0) {
        return 600 - tokenIdx * 5;
    }

    // No match
    return -Infinity;
}

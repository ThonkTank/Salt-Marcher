/**
 * ============================================================================
 * CREATURE STORE - Global Reactive Store for Creature Data
 * ============================================================================
 *
 * This is the SINGLE SOURCE OF TRUTH for creature data in Salt Marcher.
 * All encounter-related systems use this store to access creature information.
 *
 * ## Architecture Overview
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                        CREATURE DATA FLOW                                │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │                                                                          │
 * │   Vault Markdown Files          CreatureStore              Consumers     │
 * │   ───────────────────          ──────────────              ─────────     │
 * │                                                                          │
 * │   SaltMarcher/Creatures/   ──►  Global Store  ──►  encounter-generator   │
 * │     ├── Animals/               (this file)        encounter-tracker      │
 * │     │   ├── wolf.md                               encounter-filter       │
 * │     │   └── bear.md                                                      │
 * │     └── Monsters/                                                        │
 * │         └── goblin.md                                                    │
 * │                                                                          │
 * │   First Run: Auto-imports                                                │
 * │   from Presets/Creatures/                                                │
 * │                                                                          │
 * └─────────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Key Design Decisions
 *
 * 1. **User Vault as Source**: Creatures are loaded from `SaltMarcher/Creatures/`
 *    (user-editable), NOT from the plugin's Presets folder. This allows users
 *    to create custom creatures that work in encounters.
 *
 * 2. **Auto-Import on First Run**: When `SaltMarcher/Creatures/` is empty,
 *    presets are automatically copied from `Presets/Creatures/`.
 *
 * 3. **Reactive Updates**: The store watches vault file changes and automatically
 *    reloads when creatures are added/modified/deleted.
 *
 * 4. **Flat Structure**: The `Creature` interface is intentionally flat (no nested
 *    `data` field) for simplicity. Habitat preferences are at the root level.
 *
 * 5. **Global Singleton**: Initialized once at plugin load, accessed via
 *    `getCreatureStore()`. This avoids passing repository instances through
 *    the entire call stack.
 *
 * ## Usage
 *
 * ```typescript
 * // In plugin main.ts (initialization)
 * import { initializeCreatureStore, getCreatureStore } from '@features/encounters/creature-store';
 * initializeCreatureStore(this.app);
 * await getCreatureStore().initialize();
 *
 * // In any consumer (encounter generator, tracker, etc.)
 * import { getCreatureStore } from '@features/encounters/creature-store';
 * const store = getCreatureStore();
 * const beasts = store.getByType('Beast');
 * const lowCR = store.getByCRRange(0, 2);
 *
 * // Reactive subscription
 * const unsubscribe = store.subscribe((state) => {
 *     console.log(`${state.creatures.length} creatures loaded`);
 * });
 * ```
 *
 * ## Related Files
 *
 * - `encounter-generator.ts` - Uses store to get creatures for encounter generation
 * - `encounter-filter.ts` - Filters creatures by habitat compatibility
 * - `encounter-tracker-view.ts` - Displays nearby creatures in tracker UI
 * - `src/app/main.ts` - Initializes store at plugin load
 *
 * @see docs/guides/encounter-system-architecture.md for full architecture docs
 * @module features/encounters/creature-store
 */

import type { App, TFile, TFolder, EventRef } from "obsidian";
import { Notice } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";
import { parseCR } from "./cr-utils";

const logger = configurableLogger.forModule("encounter-creature-store");

// ============================================================================
// Types
// ============================================================================

/**
 * Creature data structure - simple, flat, no domain entity overhead.
 *
 * This interface is used throughout the encounter system. The flat structure
 * (preferences at root level, not nested in a `data` field) simplifies
 * filtering and reduces boilerplate.
 *
 * @example
 * ```typescript
 * const wolf: Creature = {
 *     name: "Wolf",
 *     type: "Beast",
 *     cr: 0.25,
 *     hp: "11",
 *     ac: 13,
 *     file: "SaltMarcher/Creatures/Animals/wolf.md",
 *     terrainPreference: ["forest", "hills"],
 *     floraPreference: ["medium", "sparse"],
 *     moisturePreference: ["moderate"]
 * };
 * ```
 */
export interface Creature {
    /** Display name (from frontmatter `name` field) */
    readonly name: string;
    /** Creature type: Beast, Humanoid, Undead, etc. */
    readonly type: string;
    /** Challenge Rating as number (0.125, 0.25, 0.5, 1, 2, ..., 30) */
    readonly cr: number;
    /** Hit points as string (may include dice notation like "2d8+4") */
    readonly hp: string;
    /** Armor Class */
    readonly ac: number;
    /** Path to creature markdown file in vault */
    readonly file: string;

    // Habitat preferences for encounter filtering
    // Used by encounter-filter.ts to score creatures against tile data

    /** Preferred terrain types (e.g., ["forest", "hills", "mountains"]) */
    readonly terrainPreference?: readonly string[];
    /** Preferred flora density (e.g., ["dense", "medium"]) */
    readonly floraPreference?: readonly string[];
    /** Preferred moisture levels (e.g., ["dry", "moderate"]) */
    readonly moisturePreference?: readonly string[];
}

/**
 * Store state - immutable snapshot of current creature data.
 */
export interface CreatureState {
    /** All loaded creatures (immutable array) */
    readonly creatures: ReadonlyArray<Creature>;
    /** True while loading/reloading creatures */
    readonly loading: boolean;
    /** Timestamp of last successful load */
    readonly lastUpdate: number;
}

type CreatureStateListener = (state: CreatureState) => void;

// ============================================================================
// Constants
// ============================================================================

/**
 * Path where USER creatures are stored (editable, source of truth).
 * This is where creatures are loaded from.
 */
const USER_CREATURE_PATH = "SaltMarcher/Creatures";

/**
 * Path where PRESET creatures are stored (read-only, plugin data).
 * On first run, presets are copied to USER_CREATURE_PATH.
 */
const PRESET_CREATURE_PATH = "Presets/Creatures";

// ============================================================================
// Store Instance (Global Singleton)
// ============================================================================

let creatureStore: CreatureStoreInstance | null = null;
let appInstance: App | null = null;

/**
 * CreatureStore API - all methods available on the store instance.
 *
 * @example
 * ```typescript
 * const store = getCreatureStore();
 *
 * // Get current state
 * const { creatures, loading } = store.get();
 *
 * // Query helpers
 * const beasts = store.getByType('Beast');
 * const lowCR = store.getByCRRange(0, 2);
 * const wolf = store.getByName('Wolf');
 * const types = store.getAllTypes(); // ['Beast', 'Humanoid', ...]
 *
 * // Reactive subscription
 * const unsubscribe = store.subscribe((state) => {
 *     updateUI(state.creatures);
 * });
 * ```
 */
export interface CreatureStoreInstance {
    /** Get current state (non-reactive) */
    get(): CreatureState;
    /** Subscribe to state changes (reactive) */
    subscribe(listener: CreatureStateListener): () => void;
    /** Initialize store (call once at plugin load) */
    initialize(): Promise<void>;
    /** Force reload from vault */
    reload(): Promise<void>;
    /** Cleanup resources (call at plugin unload) */
    dispose(): void;

    // Query helpers (convenience methods)
    /** Get creatures by type (case-insensitive) */
    getByType(type: string): ReadonlyArray<Creature>;
    /** Get creatures within CR range (inclusive) */
    getByCRRange(min: number, max: number): ReadonlyArray<Creature>;
    /** Find creature by name (case-insensitive) */
    getByName(name: string): Creature | undefined;
    /** Get all unique creature types */
    getAllTypes(): string[];
}

// ============================================================================
// Initialization Functions
// ============================================================================

/**
 * Initialize creature store with Obsidian app context.
 *
 * **MUST be called during plugin load** before any consumers access the store.
 * Called from `src/app/main.ts` in the `onload()` method.
 *
 * @param app - Obsidian App instance
 * @returns Store instance (also accessible via getCreatureStore())
 *
 * @example
 * ```typescript
 * // In main.ts onload():
 * import { initializeCreatureStore, getCreatureStore } from '@features/encounters/creature-store';
 *
 * const store = initializeCreatureStore(this.app);
 * await store.initialize(); // Loads creatures from vault
 * ```
 */
export function initializeCreatureStore(app: App): CreatureStoreInstance {
    if (creatureStore) {
        logger.warn("Already initialized, returning existing instance");
        return creatureStore;
    }

    appInstance = app;
    creatureStore = createCreatureStore(app);

    logger.info("Initialized");
    return creatureStore;
}

/**
 * Get creature store instance.
 *
 * **Throws if store not initialized** - ensure initializeCreatureStore() was
 * called during plugin load.
 *
 * This is the primary way to access creature data throughout the codebase.
 *
 * @returns Store instance
 * @throws Error if store not initialized
 *
 * @example
 * ```typescript
 * // In encounter-generator.ts:
 * import { getCreatureStore } from '@features/encounters/creature-store';
 *
 * const store = getCreatureStore();
 * const beasts = store.getByType('Beast');
 * ```
 */
export function getCreatureStore(): CreatureStoreInstance {
    if (!creatureStore) {
        throw new Error(
            "[CreatureStore] Not initialized. Call initializeCreatureStore() during plugin load."
        );
    }
    return creatureStore;
}

/**
 * Dispose of creature store resources.
 *
 * **MUST be called during plugin unload** to cleanup vault watchers.
 * Called from `src/app/main.ts` in the `onunload()` method.
 */
export function disposeCreatureStore(): void {
    if (!creatureStore) {
        logger.warn("Not initialized, nothing to dispose");
        return;
    }

    creatureStore.dispose();
    creatureStore = null;
    appInstance = null;
    logger.info("Disposed");
}

// ============================================================================
// Store Factory (Internal)
// ============================================================================

/**
 * Create the store instance with all functionality.
 * This is an internal factory - use initializeCreatureStore() instead.
 */
function createCreatureStore(app: App): CreatureStoreInstance {
    // Internal state
    let state: CreatureState = {
        creatures: [],
        loading: true,
        lastUpdate: 0,
    };

    const listeners = new Set<CreatureStateListener>();
    const eventRefs: EventRef[] = [];

    // Flag to prevent vault events during initialization from triggering reload
    // This prevents the "double load" issue where preset import events cause a second load
    let isInitializing = false;

    // Notify all listeners of state change
    function emit(): void {
        for (const listener of listeners) {
            try {
                listener(state);
            } catch (err) {
                logger.error("Listener error:", err);
            }
        }
    }

    // Update state and notify listeners
    function setState(newState: CreatureState): void {
        state = newState;
        emit();
    }

    // ========================================================================
    // Preset Import (First Run)
    // ========================================================================

    /**
     * Auto-import presets to user folder on first run.
     *
     * This ensures new users have creatures available immediately.
     * Only runs if SaltMarcher/Creatures/ is empty or doesn't exist.
     */
    async function ensurePresetsImported(): Promise<void> {
        // Check if user folder exists and has content
        const userFolder = app.vault.getAbstractFileByPath(USER_CREATURE_PATH);

        if (userFolder && (userFolder as TFolder).children?.length > 0) {
            logger.info("User creatures folder exists with content, skipping import");
            return;
        }

        // Check if presets exist
        const presetFolder = app.vault.getAbstractFileByPath(PRESET_CREATURE_PATH);
        if (!presetFolder || !(presetFolder as TFolder).children) {
            logger.warn("No presets found to import");
            return;
        }

        logger.info("Importing presets to user folder...");

        // Create user folder if needed
        try {
            await app.vault.createFolder(USER_CREATURE_PATH);
        } catch {
            // Folder might already exist
        }

        // Copy all preset files recursively
        await copyFolderRecursive(app, presetFolder as TFolder, USER_CREATURE_PATH);
        const importCount = countMarkdownFiles(
            app.vault.getAbstractFileByPath(USER_CREATURE_PATH) as TFolder
        );

        new Notice(`Imported ${importCount} creatures to ${USER_CREATURE_PATH}`);
        logger.info(`Imported ${importCount} creatures`);
    }

    // ========================================================================
    // Loading
    // ========================================================================

    /**
     * Load all creatures from USER_CREATURE_PATH.
     * Parses frontmatter from each markdown file.
     */
    async function loadCreatures(): Promise<Creature[]> {
        const folder = app.vault.getAbstractFileByPath(USER_CREATURE_PATH);
        if (!folder || !(folder as TFolder).children) {
            logger.warn("User creatures folder not found");
            return [];
        }

        const creatures: Creature[] = [];
        const files = collectMarkdownFiles(folder as TFolder);

        for (const file of files) {
            const creature = parseCreatureFile(app, file);
            if (creature) {
                creatures.push(creature);
            }
        }

        logger.info(`Loaded ${creatures.length} creatures from ${USER_CREATURE_PATH}`);
        return creatures;
    }

    // ========================================================================
    // Vault Watching (Reactive Updates)
    // ========================================================================

    /**
     * Setup vault watchers for reactive updates.
     *
     * When files in SaltMarcher/Creatures/ change, the store automatically
     * reloads. This ensures the UI always reflects current vault state.
     */
    function setupVaultWatchers(): void {
        const handleChange = async (file: TFile | { path: string }) => {
            // Skip vault events during initialization to prevent double loading
            // (preset import can trigger file events that arrive after initialize() completes)
            if (isInitializing) {
                logger.debug("Ignoring vault event during initialization");
                return;
            }

            if (file.path.startsWith(USER_CREATURE_PATH) && file.path.endsWith(".md")) {
                logger.debug("Detected change, reloading...");
                const creatures = await loadCreatures();
                setState({
                    creatures: Object.freeze(creatures),
                    loading: false,
                    lastUpdate: Date.now(),
                });
            }
        };

        eventRefs.push(
            app.vault.on("modify", (file) => handleChange(file)),
            app.vault.on("create", (file) => handleChange(file)),
            app.vault.on("delete", (file) => handleChange(file)),
            app.vault.on("rename", (file, oldPath) => {
                if (
                    file.path.startsWith(USER_CREATURE_PATH) ||
                    oldPath.startsWith(USER_CREATURE_PATH)
                ) {
                    handleChange(file);
                }
            })
        );
    }

    // ========================================================================
    // Public API
    // ========================================================================

    return {
        get(): CreatureState {
            return state;
        },

        subscribe(listener: CreatureStateListener): () => void {
            listeners.add(listener);
            // Immediately call with current state (Svelte store pattern)
            listener(state);
            return () => listeners.delete(listener);
        },

        async initialize(): Promise<void> {
            // Set flag to prevent vault events from triggering reload during init
            isInitializing = true;

            try {
                // Import presets if needed (first run)
                await ensurePresetsImported();

                // Load creatures from vault
                const creatures = await loadCreatures();
                setState({
                    creatures: Object.freeze(creatures),
                    loading: false,
                    lastUpdate: Date.now(),
                });

                // Setup vault watchers for reactive updates
                setupVaultWatchers();

                logger.info(`Ready with ${creatures.length} creatures`);
            } finally {
                // Clear flag after initialization complete
                // Use setTimeout to handle any pending vault events in the queue
                setTimeout(() => {
                    isInitializing = false;
                    logger.debug("Initialization complete, vault watchers active");
                }, 100);
            }
        },

        async reload(): Promise<void> {
            setState({ ...state, loading: true });
            const creatures = await loadCreatures();
            setState({
                creatures: Object.freeze(creatures),
                loading: false,
                lastUpdate: Date.now(),
            });
        },

        dispose(): void {
            // Unregister vault event listeners
            for (const ref of eventRefs) {
                app.vault.offref(ref);
            }
            eventRefs.length = 0;
            listeners.clear();
        },

        // Query helpers
        getByType(type: string): ReadonlyArray<Creature> {
            return state.creatures.filter(
                (c) => c.type.toLowerCase() === type.toLowerCase()
            );
        },

        getByCRRange(min: number, max: number): ReadonlyArray<Creature> {
            return state.creatures.filter((c) => c.cr >= min && c.cr <= max);
        },

        getByName(name: string): Creature | undefined {
            return state.creatures.find(
                (c) => c.name.toLowerCase() === name.toLowerCase()
            );
        },

        getAllTypes(): string[] {
            const types = new Set<string>();
            for (const c of state.creatures) {
                types.add(c.type);
            }
            return Array.from(types).sort();
        },
    };
}

// ============================================================================
// Helper Functions (Internal)
// ============================================================================

/**
 * Parse creature data from markdown file frontmatter.
 *
 * Uses Obsidian's metadataCache for fast access (no file read needed).
 *
 * @param app - Obsidian App
 * @param file - Markdown file to parse
 * @returns Creature object or null if invalid
 */
function parseCreatureFile(app: App, file: TFile): Creature | null {
    const cache = app.metadataCache.getFileCache(file);
    if (!cache?.frontmatter) {
        return null;
    }

    const fm = cache.frontmatter;

    // Required fields
    if (!fm.name || fm.cr === undefined) {
        return null;
    }

    // Parse AC (handle various formats: number, string, array)
    let ac = 10;
    if (fm.ac !== undefined) {
        if (typeof fm.ac === "number") {
            ac = fm.ac;
        } else if (typeof fm.ac === "string") {
            const match = fm.ac.match(/\d+/);
            if (match) ac = parseInt(match[0]);
        } else if (Array.isArray(fm.ac) && fm.ac.length > 0) {
            const first = fm.ac[0];
            if (typeof first === "number") ac = first;
            else if (typeof first === "object" && first?.ac) ac = first.ac;
        }
    }

    return {
        name: fm.name,
        type: fm.type || "Unknown",
        cr: parseCR(fm.cr),
        hp: String(fm.hp || "10"),
        ac,
        file: file.path,
        terrainPreference: parseArrayField(fm.terrainPreference),
        floraPreference: parseArrayField(fm.floraPreference),
        moisturePreference: parseArrayField(fm.moisturePreference),
    };
}

/**
 * Parse a field that can be string or array into readonly string array.
 */
function parseArrayField(value: unknown): readonly string[] | undefined {
    if (!value) return undefined;
    if (Array.isArray(value)) return Object.freeze(value.map(String));
    if (typeof value === "string") return Object.freeze([value]);
    return undefined;
}

/**
 * Recursively collect all markdown files in a folder.
 */
function collectMarkdownFiles(folder: TFolder): TFile[] {
    const files: TFile[] = [];

    for (const child of folder.children) {
        if ((child as TFile).extension === "md") {
            files.push(child as TFile);
        } else if ((child as TFolder).children) {
            files.push(...collectMarkdownFiles(child as TFolder));
        }
    }

    return files;
}

/**
 * Recursively copy a folder's markdown files to a new location.
 * Used for preset import on first run.
 */
async function copyFolderRecursive(
    app: App,
    source: TFolder,
    targetPath: string
): Promise<void> {
    for (const child of source.children) {
        const targetChildPath = `${targetPath}/${child.name}`;

        if ((child as TFolder).children) {
            // Directory - create and recurse
            try {
                await app.vault.createFolder(targetChildPath);
            } catch {
                // Folder might exist
            }
            await copyFolderRecursive(app, child as TFolder, targetChildPath);
        } else if ((child as TFile).extension === "md") {
            // Markdown file - copy content
            try {
                const content = await app.vault.read(child as TFile);
                await app.vault.create(targetChildPath, content);
            } catch (err) {
                logger.warn(`Failed to copy ${child.path}:`, err);
            }
        }
    }
}

/**
 * Count markdown files in a folder (recursive).
 */
function countMarkdownFiles(folder: TFolder | null): number {
    if (!folder) return 0;
    let count = 0;
    for (const child of folder.children) {
        if ((child as TFile).extension === "md") {
            count++;
        } else if ((child as TFolder).children) {
            count += countMarkdownFiles(child as TFolder);
        }
    }
    return count;
}

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * Get all creatures (convenience function).
 *
 * @example
 * ```typescript
 * import { getAllCreatures } from '@features/encounters/creature-store';
 * const creatures = getAllCreatures();
 * ```
 */
export function getAllCreatures(): ReadonlyArray<Creature> {
    return getCreatureStore().get().creatures;
}

/**
 * Get creatures by type (convenience function).
 *
 * @example
 * ```typescript
 * import { getCreaturesByType } from '@features/encounters/creature-store';
 * const beasts = getCreaturesByType('Beast');
 * ```
 */
export function getCreaturesByType(type: string): ReadonlyArray<Creature> {
    return getCreatureStore().getByType(type);
}

/**
 * Get creatures by CR range (convenience function).
 *
 * @example
 * ```typescript
 * import { getCreaturesByCRRange } from '@features/encounters/creature-store';
 * const lowCR = getCreaturesByCRRange(0, 2);
 * ```
 */
export function getCreaturesByCRRange(
    min: number,
    max: number
): ReadonlyArray<Creature> {
    return getCreatureStore().getByCRRange(min, max);
}

/**
 * Subscribe to creature state changes (convenience function).
 *
 * @example
 * ```typescript
 * import { subscribeCreatureState } from '@features/encounters/creature-store';
 *
 * const unsubscribe = subscribeCreatureState((state) => {
 *     console.log(`Loaded ${state.creatures.length} creatures`);
 * });
 *
 * // Later: unsubscribe();
 * ```
 */
export function subscribeCreatureState(
    callback: CreatureStateListener
): () => void {
    return getCreatureStore().subscribe(callback);
}

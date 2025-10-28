// src/workmodes/library/view.ts
import type { WorkspaceLeaf, App } from "obsidian";
import { TabbedBrowseView } from "../../features/data-manager";
import { LIBRARY_DATA_SOURCES, type FilterableLibraryMode, type LibraryEntry } from "./storage/data-sources";
import { LIBRARY_LIST_SCHEMAS, LIBRARY_VIEW_CONFIGS } from "./registry";
import type { LibraryActionContext } from "./types";
import { describeLibrarySource, ensureLibrarySources } from "./core/sources";

type Mode = FilterableLibraryMode;

/**
 * Authoritative UI copy for the library view. Keep aligned with `docs/ui/terminology.md`.
 */
export const LIBRARY_COPY = {
    title: "Library",
    searchPlaceholder: "Search the library or enter a name…",
    createButton: "Create entry",
    modes: {
        creatures: "Creatures",
        spells: "Spells",
        items: "Items",
        equipment: "Equipment",
        terrains: "Terrains",
        regions: "Regions",
        factions: "Factions",
        calendars: "Calendars",
    },
    sources: {
        prefix: "Source: ",
    },
} as const;

type ModeCopy = typeof LIBRARY_COPY.modes;

export const VIEW_LIBRARY = "salt-library";

const LIBRARY_MODES: Mode[] = ["creatures", "spells", "items", "equipment", "terrains", "regions", "factions", "calendars"];

/**
 * Library view: Tab-based browser for all game entities.
 * Extends TabbedBrowseView with Library-specific configuration.
 */
export class LibraryView extends TabbedBrowseView<Mode, LibraryEntry<Mode>, LibraryActionContext> {
    private static readonly LIBRARY_CONFIG = {
        viewType: VIEW_LIBRARY,
        icon: "library",
        copy: LIBRARY_COPY,
        defaultMode: "creatures" as const,
        modes: LIBRARY_MODES,
        dataSources: LIBRARY_DATA_SOURCES,
        schemas: LIBRARY_LIST_SCHEMAS,
        viewConfigs: LIBRARY_VIEW_CONFIGS,
        ensureSources: ensureLibrarySources,
        describeSource: describeLibrarySource,
    };

    protected get config() {
        return LibraryView.LIBRARY_CONFIG;
    }

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }
}

/** Opens the library view in a dedicated workspace leaf. */
export async function openLibrary(app: App): Promise<void> {
    const leaf = app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_LIBRARY, active: true });
    app.workspace.revealLeaf(leaf);
}

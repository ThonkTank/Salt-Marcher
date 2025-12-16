// src/workmodes/library/view.ts
import type { WorkspaceLeaf, App } from "obsidian";
import { TabbedBrowseView, GenericListRenderer } from "@features/data-manager";
import { describeLibrarySource, ensureLibrarySources } from "./core/sources";
import { LocationListRenderer } from "./locations/location-list-renderer";
import { LIBRARY_LIST_SCHEMAS, LIBRARY_VIEW_CONFIGS } from "./registry";
import { LIBRARY_DATA_SOURCES, type FilterableLibraryMode, type LibraryEntry } from "./storage/data-sources";
import type { LibraryActionContext } from "./library-types";
import type { GenericListRendererConfig } from "@features/data-manager/browse/browse-types";

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
        locations: "Locations",
        playlists: "Playlists",
        "encounter-tables": "Encounter Tables",
    },
    sources: {
        prefix: "Source: ",
    },
} as const;

type ModeCopy = typeof LIBRARY_COPY.modes;

export const VIEW_LIBRARY = "salt-library";

const LIBRARY_MODES: Mode[] = ["creatures", "spells", "items", "equipment", "terrains", "regions", "factions", "calendars", "locations", "playlists", "encounter-tables"];

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

    /**
     * Override createRenderer to use LocationListRenderer for locations mode.
     */
    protected createRenderer(mode: Mode, container: HTMLElement): GenericListRenderer<Mode, LibraryEntry<Mode>, LibraryActionContext> {
        const rendererConfig: GenericListRendererConfig<Mode, LibraryEntry<Mode>, LibraryActionContext> = {
            mode,
            source: this.config.dataSources[mode],
            schema: this.config.schemas[mode],
            viewConfig: this.config.viewConfigs[mode],
            watchers: this.watchers,
        };

        // Use custom LocationListRenderer for locations mode
        if (mode === "locations") {
            return new LocationListRenderer(
                this.app,
                container,
                rendererConfig as any // Type assertion needed due to Mode generics
            ) as any;
        }

        // Use default GenericListRenderer for all other modes
        return new GenericListRenderer(this.app, container, rendererConfig);
    }
}

/** Opens the library view in a dedicated workspace leaf. */
export async function openLibrary(app: App): Promise<void> {
    const leaf = app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_LIBRARY, active: true });
    app.workspace.revealLeaf(leaf);
}

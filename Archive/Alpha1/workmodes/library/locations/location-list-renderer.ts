// src/workmodes/library/locations/location-list-renderer.ts
// Custom list renderer for locations with tree view support

import type { App } from "obsidian";
import { GenericListRenderer } from "@features/data-manager/browse/generic-list-renderer";
import { buildLocationTree, LocationTreeView } from "./index";
import type { GenericListRendererConfig } from "@features/data-manager/browse/browse-types";
import type { LibraryEntry } from "../storage/data-sources";
import type { LibraryActionContext } from "../library-types";
import type { LocationData } from './calendar-types';

type LocationEntry = LibraryEntry<"locations">;
type ViewMode = "list" | "tree";

/**
 * Custom renderer for locations that supports both list and tree views.
 * Extends GenericListRenderer and adds view mode toggle functionality.
 */
export class LocationListRenderer extends GenericListRenderer<"locations", LocationEntry, LibraryActionContext> {
    private viewMode: ViewMode = "list";
    private treeView?: LocationTreeView;
    private treeContainer?: HTMLElement;

    constructor(
        app: App,
        container: HTMLElement,
        config: GenericListRendererConfig<"locations", LocationEntry, LibraryActionContext>
    ) {
        super(app, container, config);
    }

    /**
     * Sets the view mode and triggers re-render.
     */
    setViewMode(mode: ViewMode): void {
        if (this.viewMode !== mode) {
            this.viewMode = mode;
            this.render();
        }
    }

    /**
     * Gets the current view mode.
     */
    getViewMode(): ViewMode {
        return this.viewMode;
    }

    /**
     * Override render to add view mode toggle and conditional rendering.
     */
    render(): void {
        if (this.isDisposed()) return;

        // Get the container from parent
        const container = (this as any).container as HTMLElement;
        container.empty();

        // Render view mode toggle
        this.renderViewModeToggle(container);

        // Render based on current view mode
        if (this.viewMode === "tree") {
            this.renderTreeView(container);
        } else {
            // Call parent's renderInternal for list view
            (this as any).renderInternal();
        }
    }

    /**
     * Renders the view mode toggle button.
     */
    private renderViewModeToggle(container: HTMLElement): void {
        const toggleContainer = container.createDiv({ cls: "sm-location-view-toggle" });

        const listBtn = toggleContainer.createEl("button", {
            cls: this.viewMode === "list" ? "sm-toggle-active" : "",
            text: "📋 List",
        });

        const treeBtn = toggleContainer.createEl("button", {
            cls: this.viewMode === "tree" ? "sm-toggle-active" : "",
            text: "🌳 Tree",
        });

        listBtn.addEventListener("click", () => {
            this.setViewMode("list");
        });

        treeBtn.addEventListener("click", () => {
            this.setViewMode("tree");
        });
    }

    /**
     * Renders locations in tree view.
     */
    private renderTreeView(container: HTMLElement): void {
        // Get entries from parent
        const entries = (this as any).entries as LocationEntry[];

        if (!entries || entries.length === 0) {
            container.createDiv({ cls: "sm-tree-empty", text: "Keine Orte vorhanden" });
            return;
        }

        // Convert entries to LocationData
        const locations: LocationData[] = entries.map(entry => ({
            name: entry.name,
            type: (entry as any).type || "Gebäude",
            description: (entry as any).description,
            parent: (entry as any).parent,
            owner_type: (entry as any).owner_type,
            owner_name: (entry as any).owner_name,
            region: (entry as any).region,
            coordinates: (entry as any).coordinates,
            notes: (entry as any).notes,
        }));

        // Build tree
        const treeNodes = buildLocationTree(locations);

        // Create tree container
        this.treeContainer = container.createDiv({ cls: "sm-location-tree-container" });

        // Render tree view
        this.treeView = new LocationTreeView(this.treeContainer, {
            onLocationClick: (locationName) => {
                this.handleLocationClick(locationName);
            },
        });

        this.treeView.render(treeNodes);
    }

    /**
     * Handles click on a location in tree view.
     * Opens the location details by triggering the "Open" action.
     */
    private handleLocationClick(locationName: string): void {
        const entries = (this as any).entries as LocationEntry[];
        const entry = entries.find(e => e.name === locationName);

        if (!entry) return;

        // Get view config and trigger "Open" action
        const viewConfig = (this as any).viewConfig;
        const actionContext = (this as any).createActionContext();
        const openAction = viewConfig.actions?.find((a: any) => a.id === "open");

        if (openAction) {
            openAction.handler(entry, actionContext);
        }
    }

    /**
     * Override destroy to clean up tree view.
     */
    destroy(): void {
        this.treeView = undefined;
        this.treeContainer = undefined;
        super.destroy();
    }
}

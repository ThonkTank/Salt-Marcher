/**
 * Salt Marcher - Obsidian Plugin
 *
 * D&D world-building tool with hex map editor.
 *
 * @module main
 */

import { Plugin, WorkspaceLeaf } from 'obsidian';
import { CartographerView, CARTOGRAPHER_VIEW_TYPE } from './adapters/cartographer';
import { LibraryView, LIBRARY_VIEW_TYPE, LibraryStore } from './adapters/library';
import { TravelerObsidianView, TRAVELER_VIEW_TYPE } from './adapters/traveler';

// ============================================================================
// Plugin
// ============================================================================

export default class SaltMarcherPlugin extends Plugin {
    private libraryStore: LibraryStore | null = null;

    async onload(): Promise<void> {
        // Initialize library store
        this.libraryStore = new LibraryStore(this.app.vault, 'SaltMarcher');

        // Register views
        this.registerView(
            CARTOGRAPHER_VIEW_TYPE,
            (leaf) => new CartographerView(leaf)
        );
        this.registerView(
            LIBRARY_VIEW_TYPE,
            (leaf) => new LibraryView(leaf)
        );
        this.registerView(
            TRAVELER_VIEW_TYPE,
            (leaf) => new TravelerObsidianView(leaf)
        );

        // Add ribbon icons
        this.addRibbonIcon('map', 'Open Cartographer', () => {
            this.activateCartographerView();
        });
        this.addRibbonIcon('book-open', 'Open Library', () => {
            this.activateLibraryView();
        });
        this.addRibbonIcon('footprints', 'Open Traveler', () => {
            this.activateTravelerView();
        });

        // Add commands
        this.addCommand({
            id: 'open-cartographer',
            name: 'Open Cartographer',
            callback: () => {
                this.activateCartographerView();
            },
        });
        this.addCommand({
            id: 'open-library',
            name: 'Open Library',
            callback: () => {
                this.activateLibraryView();
            },
        });
        this.addCommand({
            id: 'open-traveler',
            name: 'Open Traveler',
            callback: () => {
                this.activateTravelerView();
            },
        });

        // Cartographer undo/redo commands (user configures hotkeys in Settings)
        this.addCommand({
            id: 'cartographer-undo',
            name: 'Cartographer: Undo',
            checkCallback: (checking) => {
                const view = this.getActiveCartographerView();
                if (view) {
                    if (!checking) view.triggerUndo();
                    return true;
                }
                return false;
            },
        });
        this.addCommand({
            id: 'cartographer-redo',
            name: 'Cartographer: Redo',
            checkCallback: (checking) => {
                const view = this.getActiveCartographerView();
                if (view) {
                    if (!checking) view.triggerRedo();
                    return true;
                }
                return false;
            },
        });
    }

    async onunload(): Promise<void> {
        this.app.workspace.detachLeavesOfType(CARTOGRAPHER_VIEW_TYPE);
        this.app.workspace.detachLeavesOfType(LIBRARY_VIEW_TYPE);
        this.app.workspace.detachLeavesOfType(TRAVELER_VIEW_TYPE);
    }

    private async activateCartographerView(): Promise<void> {
        await this.activateView(CARTOGRAPHER_VIEW_TYPE);
    }

    private async activateLibraryView(): Promise<void> {
        await this.activateView(LIBRARY_VIEW_TYPE);
    }

    private async activateTravelerView(): Promise<void> {
        await this.activateView(TRAVELER_VIEW_TYPE);
    }

    private async activateView(viewType: string): Promise<void> {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(viewType);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            // Open as new tab in main area
            leaf = workspace.getLeaf('tab');
            await leaf.setViewState({
                type: viewType,
                active: true,
            });
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    /**
     * Get the library store instance.
     * Used by views that need access to creature/terrain data.
     */
    getLibraryStore(): LibraryStore | null {
        return this.libraryStore;
    }

    /**
     * Get the active CartographerView if it exists and is focused.
     */
    private getActiveCartographerView(): CartographerView | null {
        const leaf = this.app.workspace.getActiveViewOfType(CartographerView);
        return leaf;
    }
}

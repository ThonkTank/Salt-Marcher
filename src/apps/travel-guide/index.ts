// src/apps/travel-guide/index.ts
import { Plugin, ItemView, WorkspaceLeaf, TFile } from "obsidian";
import type { App } from "obsidian";
import { mountTravelGuide, type TravelGuideController } from "./ui/view-shell";

export const VIEW_TYPE_TRAVEL_GUIDE = "travel-guide-view";
export const VIEW_TRAVEL_GUIDE = VIEW_TYPE_TRAVEL_GUIDE;

export class TravelGuideView extends ItemView {
    controller: TravelGuideController | null = null;
    hostEl: HTMLElement | null = null;
    initialFile: TFile | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return VIEW_TYPE_TRAVEL_GUIDE;
    }

    getDisplayText(): string {
        return "Travel Guide";
    }

    getIcon(): string {
        return "map"; // any Obsidian icon id
    }

    /** Optional: open view with a preselected file */
    setFile(file: TFile | null) {
        this.initialFile = file;
        void this.controller?.setFile(file ?? null);
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl;
        const content = container.children[1] as HTMLElement; // standard ItemView content slot
        content.empty();

        // host for our app
        this.hostEl = content.createDiv({ cls: "travel-guide-host" });

        // try current active file as a convenience; user can still choose another via "Karte öffnen…"
        const file = this.initialFile ?? this.app.workspace.getActiveFile() ?? null;

        this.controller = await mountTravelGuide(this.app as App, this.hostEl, file);
    }

    async onClose(): Promise<void> {
        this.controller?.destroy();
        this.controller = null;
        this.hostEl = null;
    }
}

export default class TravelGuidePlugin extends Plugin {
    async onload() {
        // Register the view
        this.registerView(VIEW_TYPE_TRAVEL_GUIDE, (leaf) => new TravelGuideView(leaf));

        // Command: open empty Travel Guide (user can pick a map)
        this.addCommand({
            id: "travel-guide-open",
            name: "Open Travel Guide",
            callback: () => this.activateTravelGuide(),
        });

        // Command: open and bind to current file (if any)
        this.addCommand({
            id: "travel-guide-open-for-current",
            name: "Open Travel Guide for current file",
            callback: () => {
                const file = this.app.workspace.getActiveFile() ?? null;
                this.activateTravelGuide(file);
            },
        });

        // Optional ribbon
        // @ts-ignore: addRibbonIcon exists in Obsidian
        this.addRibbonIcon?.("map", "Travel Guide", () => this.activateTravelGuide());
    }

    async onunload() {
        // Close all leaves of our view type
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TRAVEL_GUIDE);
        for (const leaf of leaves) await leaf.detach();
    }

    private async activateTravelGuide(file?: TFile | null) {
        const leaf = this.getOrCreateLeaf();
        await leaf.setViewState({ type: VIEW_TYPE_TRAVEL_GUIDE, active: true });
        this.app.workspace.revealLeaf(leaf);

        if (file) {
            const view = leaf.view instanceof TravelGuideView ? (leaf.view as TravelGuideView) : null;
            view?.setFile(file);
        }
    }

    private getOrCreateLeaf(): WorkspaceLeaf {
        const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_TRAVEL_GUIDE);
        if (existing.length > 0) return existing[0];

        // Prefer right split if available, else create a new leaf
        // @ts-ignore: getRightLeaf exists in Obsidian
        return this.app.workspace.getRightLeaf?.(false) ?? this.app.workspace.getLeaf(true);
    }
}

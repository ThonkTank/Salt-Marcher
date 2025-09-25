// src/apps/cartographer/index.ts
import { Plugin, ItemView, WorkspaceLeaf, TFile } from "obsidian";
import type { App } from "obsidian";
import { mountCartographer, type CartographerController } from "./view-shell";

export const VIEW_TYPE_CARTOGRAPHER = "cartographer-view";
export const VIEW_CARTOGRAPHER = VIEW_TYPE_CARTOGRAPHER;

export class CartographerView extends ItemView {
    controller: CartographerController | null = null;
    hostEl: HTMLElement | null = null;
    initialFile: TFile | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return VIEW_TYPE_CARTOGRAPHER;
    }

    getDisplayText(): string {
        return "Cartographer";
    }

    getIcon(): string {
        return "compass";
    }

    setFile(file: TFile | null) {
        this.initialFile = file;
        void this.controller?.setFile(file ?? null);
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl;
        const content = container.children[1] as HTMLElement;
        content.empty();

        this.hostEl = content.createDiv({ cls: "cartographer-host" });

        const file = this.initialFile ?? this.app.workspace.getActiveFile() ?? null;

        this.controller = await mountCartographer(this.app as App, this.hostEl, file);
    }

    async onClose(): Promise<void> {
        await this.controller?.destroy();
        this.controller = null;
        this.hostEl = null;
    }
}

export default class CartographerPlugin extends Plugin {
    async onload() {
        this.registerView(VIEW_TYPE_CARTOGRAPHER, (leaf) => new CartographerView(leaf));

        this.addCommand({
            id: "cartographer-open",
            name: "Open Cartographer",
            callback: () => this.activateCartographer(),
        });

        this.addRibbonIcon("compass", "Open Cartographer", () => this.activateCartographer());
    }

    async onunload() {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CARTOGRAPHER);
        for (const leaf of leaves) await leaf.detach();
    }

    private async activateCartographer(file?: TFile | null) {
        const leaf = this.getOrCreateLeaf();
        await leaf.setViewState({ type: VIEW_TYPE_CARTOGRAPHER, active: true });
        this.app.workspace.revealLeaf(leaf);

        if (file) {
            const view = leaf.view instanceof CartographerView ? (leaf.view as CartographerView) : null;
            view?.setFile(file);
        }
    }

    private getOrCreateLeaf(): WorkspaceLeaf {
        const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CARTOGRAPHER);
        if (existing.length > 0) return existing[0];
        return this.app.workspace.getLeaf(false) ?? this.app.workspace.getLeaf(true);
    }
}

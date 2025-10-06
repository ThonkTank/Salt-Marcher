// src/apps/cartographer/index.ts
import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import type { App } from "obsidian";
import { CartographerController, type CartographerControllerCallbacks } from "./controller";

export const VIEW_TYPE_CARTOGRAPHER = "cartographer-view";
export const VIEW_CARTOGRAPHER = VIEW_TYPE_CARTOGRAPHER;

export class CartographerView extends ItemView {
    controller: CartographerController;
    readonly callbacks: CartographerControllerCallbacks;
    hostEl: HTMLElement | null = null;
    pendingFile: TFile | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
        this.controller = new CartographerController(this.app as App);
        this.callbacks = this.controller.callbacks;
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
        this.pendingFile = file;
        void this.controller.setFile(file ?? null);
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl;
        const content = container.children[1] as HTMLElement;
        content.empty();

        this.hostEl = content.createDiv({ cls: "cartographer-host" });

        const fallbackFile = this.pendingFile ?? this.app.workspace.getActiveFile() ?? null;
        await this.controller.onOpen(this.hostEl, fallbackFile);
    }

    async onClose(): Promise<void> {
        await this.controller.onClose();
        this.hostEl = null;
    }
}

export function getExistingCartographerLeaves(app: App): WorkspaceLeaf[] {
    return app.workspace.getLeavesOfType(VIEW_TYPE_CARTOGRAPHER);
}

export function getOrCreateCartographerLeaf(app: App): WorkspaceLeaf {
    const existing = getExistingCartographerLeaves(app);
    if (existing.length > 0) return existing[0];
    return app.workspace.getLeaf(false) ?? app.workspace.getLeaf(true);
}

export async function openCartographer(app: App, file?: TFile | null): Promise<void> {
    const leaf = getOrCreateCartographerLeaf(app);
    await leaf.setViewState({ type: VIEW_TYPE_CARTOGRAPHER, active: true });
    app.workspace.revealLeaf(leaf);

    if (file) {
        const view = leaf.view instanceof CartographerView ? leaf.view : null;
        view?.setFile(file);
    }
}

export async function detachCartographerLeaves(app: App): Promise<void> {
    const leaves = getExistingCartographerLeaves(app);
    for (const leaf of leaves) {
        await leaf.detach();
    }
}

// src/apps/map-gallery.ts
// Die ehemalige Galerie leitet jetzt auf den Cartographer weiter, damit Verwaltung & Preview
// an einem Ort stattfinden.

import { App, ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_CARTOGRAPHER } from "./cartographer";

export const VIEW_TYPE_HEX_GALLERY = "hex-gallery-view" as const;

export class HexGalleryView extends ItemView {
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() {
        return VIEW_TYPE_HEX_GALLERY;
    }

    getDisplayText() {
        return "Map Gallery";
    }

    async onOpen() {
        const app = this.app as App;
        const existing = app.workspace.getLeavesOfType(VIEW_TYPE_CARTOGRAPHER);
        const targetLeaf = existing.length > 0 ? existing[0] : app.workspace.getLeaf(true);

        await targetLeaf.setViewState({ type: VIEW_TYPE_CARTOGRAPHER, active: true });
        app.workspace.revealLeaf(targetLeaf);
        new Notice("Die Map Gallery wurde in den Cartographer integriert.");

        if (targetLeaf !== this.leaf) {
            queueMicrotask(() => this.leaf.detach());
        }
    }

    async onClose() {
        this.contentEl.empty();
    }
}

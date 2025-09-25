// src/apps/encounter/view.ts
import { ItemView, WorkspaceLeaf } from "obsidian";

export const VIEW_ENCOUNTER = "salt-encounter";

export class EncounterView extends ItemView {
    getViewType() { return VIEW_ENCOUNTER; }
    getDisplayText() { return "Encounter"; }
    getIcon() { return "swords" as any; }

    async onOpen() {
        this.contentEl.addClass("sm-encounter-view");
        this.contentEl.empty();
        this.contentEl.createEl("h2", { text: "Encounter" });
        this.contentEl.createDiv({ text: "", cls: "desc" });
    }

    async onClose() {
        this.contentEl.empty();
        this.contentEl.removeClass("sm-encounter-view");
    }
}


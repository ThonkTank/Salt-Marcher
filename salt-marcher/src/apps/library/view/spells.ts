// src/apps/library/view/spells.ts
// Rendert und erstellt Zauber-Einträge.
import type { TFile } from "obsidian";
import type { ModeRenderer } from "./mode";
import { BaseModeRenderer, scoreName } from "./mode";
import { listSpellFiles, watchSpellDir, createSpellFile } from "../core/spell-files";
import { CreateSpellModal } from "../create";

export class SpellsRenderer extends BaseModeRenderer implements ModeRenderer {
    readonly mode = "spells" as const;
    private files: TFile[] = [];

    async init(): Promise<void> {
        this.files = await listSpellFiles(this.app);
        const stop = watchSpellDir(this.app, async () => {
            this.files = await listSpellFiles(this.app);
            if (!this.isDisposed()) this.render();
        });
        this.registerCleanup(stop);
    }

    render(): void {
        if (this.isDisposed()) return;
        const list = this.container;
        list.empty();
        const q = this.query;
        const items = this.files.map(f => ({ name: f.basename, file: f, score: scoreName(f.basename.toLowerCase(), q) }))
            .filter(x => q ? x.score > -Infinity : true)
            .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

        for (const it of items) {
            const row = list.createDiv({ cls: "sm-cc-item" });
            row.createDiv({ cls: "sm-cc-item__name", text: it.name });
            const openBtn = row.createEl("button", { text: "Open" });
            openBtn.onclick = async () => {
                await this.app.workspace.openLinkText(it.file.path, it.file.path, true);
            };
        }
    }

    async handleCreate(name: string): Promise<void> {
        new CreateSpellModal(this.app, name, async (data) => {
            const file = await createSpellFile(this.app, data);
            this.files = await listSpellFiles(this.app);
            if (!this.isDisposed()) {
                this.render();
                await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
            }
        }).open();
    }
}

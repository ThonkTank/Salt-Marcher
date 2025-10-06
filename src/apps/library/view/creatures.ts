// src/apps/library/view/creatures.ts
// Rendert Kreaturen und bietet die generische Filter-Logik für weitere Library-Ansichten.
import type { App, TFile } from "obsidian";
import type { ModeRenderer } from "./mode";
import { loadCreaturePreset } from "../core/creature-presets";
import { createCreatureFile, type StatblockData } from "../core/creature-files";
import { CreateCreatureModal } from "../create";
import { FilterableLibraryRenderer } from "./filterable-mode";
import type { LibrarySourceWatcherHub } from "./mode";
import type { LibraryEntry } from "../core/data-sources";

type CreatureEntry = LibraryEntry<"creatures">;

export class CreaturesRenderer extends FilterableLibraryRenderer<"creatures"> implements ModeRenderer {
    constructor(app: App, container: HTMLElement, watchers: LibrarySourceWatcherHub) {
        super(app, container, watchers, "creatures");
    }

    protected renderEntry(row: HTMLElement, entry: CreatureEntry): void {
        const nameContainer = row.createDiv({ cls: "sm-cc-item__name-container" });
        nameContainer.createDiv({ cls: "sm-cc-item__name", text: entry.name });

        const infoContainer = row.createDiv({ cls: "sm-cc-item__info" });
        if (entry.type) {
            infoContainer.createEl("span", { cls: "sm-cc-item__type", text: entry.type });
        }
        if (entry.cr) {
            infoContainer.createEl("span", { cls: "sm-cc-item__cr", text: `CR ${entry.cr}` });
        }

        const actions = row.createDiv({ cls: "sm-cc-item__actions" });
        const openBtn = actions.createEl("button", { text: "Open", cls: "sm-cc-item__action" });
        openBtn.onclick = async () => {
            await this.app.workspace.openLinkText(entry.file.path, entry.file.path, true);
        };

        const editBtn = actions.createEl("button", { text: "Edit", cls: "sm-cc-item__action sm-cc-item__action--edit" });
        editBtn.onclick = async () => {
            try {
                const creatureData = await this.loadCreatureData(entry.file);
                new CreateCreatureModal(this.app, creatureData.name, async (data) => {
                    const file = await createCreatureFile(this.app, data);
                    await this.reloadEntries();
                    await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
                }, creatureData).open();
            } catch (err) {
                console.error("Failed to load creature for editing", err);
            }
        };

        const duplicateBtn = actions.createEl("button", { text: "Duplicate", cls: "sm-cc-item__action" });
        duplicateBtn.onclick = async () => {
            try {
                await this.duplicateCreature(entry.file);
            } catch (err) {
                console.error("Failed to duplicate creature", err);
            }
        };

        const deleteBtn = actions.createEl("button", { text: "Delete", cls: "sm-cc-item__action sm-cc-item__action--danger" });
        deleteBtn.onclick = async () => {
            const question = `Delete ${entry.name}? This moves the file to the trash.`;
            const confirmation = typeof window !== "undefined" && typeof window.confirm === "function"
                ? window.confirm(question)
                : true;
            if (!confirmation) return;
            try {
                await this.app.vault.trash(entry.file, true);
                await this.reloadEntries();
            } catch (err) {
                console.error("Failed to delete creature", err);
            }
        };
    }

    async handleCreate(name: string): Promise<void> {
        new CreateCreatureModal(this.app, name, async (data) => {
            const file = await createCreatureFile(this.app, data);
            await this.reloadEntries();
            await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
        }, undefined).open();
    }

    private async loadCreatureData(file: TFile): Promise<StatblockData> {
        return await loadCreaturePreset(this.app, file);
    }

    private async duplicateCreature(file: TFile): Promise<void> {
        const data = await this.loadCreatureData(file);
        const duplicateName = this.buildDuplicateName(data.name);
        const duplicateData = { ...data, name: duplicateName };
        const duplicateFile = await createCreatureFile(this.app, duplicateData);
        await this.reloadEntries();
        await this.app.workspace.openLinkText(duplicateFile.path, duplicateFile.path, true, { state: { mode: "source" } });
    }

    private buildDuplicateName(originalName: string): string {
        const base = originalName.trim() || "Creature";
        const suffix = " copy";
        if (!base.endsWith(suffix)) {
            return `${base}${suffix}`;
        }
        const match = base.match(/ copy (\d+)$/);
        if (!match) {
            return `${base} 2`;
        }
        const next = Number(match[1]) + 1;
        return base.replace(/ copy \d+$/, ` copy ${next}`);
    }
}

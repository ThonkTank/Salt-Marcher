// src/apps/library/view/equipment.ts
// Rendert Equipment mit konfigurierbaren Filtern für Typ und Einsatzbereich.
import type { App, TFile } from "obsidian";
import type { ModeRenderer } from "./mode";
import { FilterableLibraryRenderer } from "./filterable-mode";
import { createEquipmentFile, type EquipmentData } from "../core/equipment-files";
import { CreateEquipmentModal } from "../create/equipment";
import type { LibrarySourceWatcherHub } from "./mode";
import type { LibraryEntry } from "../core/data-sources";

type EquipmentEntry = LibraryEntry<"equipment">;

export class EquipmentRenderer extends FilterableLibraryRenderer<"equipment"> implements ModeRenderer {
    constructor(app: App, container: HTMLElement, watchers: LibrarySourceWatcherHub) {
        super(app, container, watchers, "equipment");
    }

    protected renderEntry(row: HTMLElement, entry: EquipmentEntry): void {
        row.createDiv({ cls: "sm-cc-item__name", text: entry.name });

        const info = row.createDiv({ cls: "sm-cc-item__info" });
        if (entry.type) {
            info.createEl("span", { cls: "sm-cc-item__type", text: entry.type });
        }
        if (entry.role) {
            info.createEl("span", { cls: "sm-cc-item__cr", text: entry.role });
        }

        const actions = row.createDiv({ cls: "sm-cc-item__actions" });
        const importBtn = actions.createEl("button", { text: "Import", cls: "sm-cc-item__action" });
        importBtn.onclick = async () => {
            await this.handleImport(entry.file);
        };

        const openBtn = actions.createEl("button", { text: "Open", cls: "sm-cc-item__action" });
        openBtn.onclick = async () => {
            await this.app.workspace.openLinkText(entry.file.path, entry.file.path, true);
        };
    }

    async handleCreate(name: string): Promise<void> {
        new CreateEquipmentModal(this.app, name, async (data) => {
            const file = await createEquipmentFile(this.app, data);
            await this.reloadEntries();
            await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
        }).open();
    }

    private async handleImport(file: TFile): Promise<void> {
        try {
            const equipmentData = await this.parseEquipmentFromFile(file);
            new CreateEquipmentModal(this.app, equipmentData, async (updatedData) => {
                const { equipmentToMarkdown } = await import("../core/equipment-files");
                const newContent = equipmentToMarkdown(updatedData);
                await this.app.vault.modify(file, newContent);
                await this.reloadEntries();
                await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
            }).open();
        } catch (err) {
            console.error("Failed to import equipment", err);
        }
    }

    private async parseEquipmentFromFile(file: TFile): Promise<EquipmentData> {
        const cache = this.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter || {};

        const data: EquipmentData = {
            name: frontmatter.name || file.basename,
            type: frontmatter.type || "weapon",
            cost: frontmatter.cost,
            weight: frontmatter.weight,
            weapon_category: frontmatter.weapon_category,
            weapon_type: frontmatter.weapon_type,
            damage: frontmatter.damage,
            properties: frontmatter.properties,
            mastery: frontmatter.mastery,
            armor_category: frontmatter.armor_category,
            ac: frontmatter.ac,
            strength_requirement: frontmatter.strength_requirement,
            stealth_disadvantage: frontmatter.stealth_disadvantage,
            don_time: frontmatter.don_time,
            doff_time: frontmatter.doff_time,
            tool_category: frontmatter.tool_category,
            ability: frontmatter.ability,
            utilize: frontmatter.utilize,
            craft: frontmatter.craft,
            variants: frontmatter.variants,
            gear_category: frontmatter.gear_category,
            special_use: frontmatter.special_use,
            capacity: frontmatter.capacity,
            duration: frontmatter.duration,
        };

        const content = await this.app.vault.read(file);
        const bodyMatch = content.match(/^---[\s\S]*?---\s*\n([\s\S]*)/);
        if (bodyMatch) {
            data.description = bodyMatch[1].trim();
        }

        return data;
    }
}

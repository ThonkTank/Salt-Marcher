// src/apps/library/view/equipment.ts
// Rendert Equipment mit konfigurierbaren Filtern für Typ und Einsatzbereich.
import type { TFile } from "obsidian";
import type { ModeRenderer } from "./mode";
import { FilterableLibraryRenderer, type FilterDefinition, type FilterableEntry, type SortDefinition } from "./filterable-mode";
import { createEquipmentFile, listEquipmentFiles, watchEquipmentDir, type EquipmentData } from "../core/equipment-files";
import { CreateEquipmentModal } from "../create/equipment";

interface EquipmentMetadata extends FilterableEntry {
    type?: string;
    role?: string;
}

async function getEquipmentMetadata(app: any, file: TFile): Promise<EquipmentMetadata> {
    const cache = app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter || {};

    const role = [
        fm.weapon_category,
        fm.armor_category,
        fm.tool_category,
        fm.gear_category,
    ].find((value): value is string => typeof value === "string" && value.length > 0);

    return {
        name: file.basename,
        file,
        type: typeof fm.type === "string" ? fm.type : undefined,
        role,
    };
}

export class EquipmentRenderer extends FilterableLibraryRenderer<EquipmentMetadata> implements ModeRenderer {
    readonly mode = "equipment" as const;

    protected listSourceFiles(): Promise<TFile[]> {
        return listEquipmentFiles(this.app);
    }

    protected watchSourceFiles(onChange: () => void): () => void {
        return watchEquipmentDir(this.app, onChange);
    }

    protected loadEntry(file: TFile): Promise<EquipmentMetadata> {
        return getEquipmentMetadata(this.app, file);
    }

    protected getFilters(): FilterDefinition<EquipmentMetadata>[] {
        return [
            {
                id: "type",
                label: "Type",
                getValues: entry => entry.type ? [entry.type] : [],
            },
            {
                id: "role",
                label: "Role",
                getValues: entry => entry.role ? [entry.role] : [],
            },
        ];
    }

    protected getSortOptions(): SortDefinition<EquipmentMetadata>[] {
        return [
            {
                id: "name",
                label: "Name",
                compare: (a, b) => a.name.localeCompare(b.name),
            },
            {
                id: "type",
                label: "Type",
                compare: (a, b) => (a.type || "").localeCompare(b.type || "") || a.name.localeCompare(b.name),
            },
            {
                id: "role",
                label: "Role",
                compare: (a, b) => (a.role || "").localeCompare(b.role || "") || a.name.localeCompare(b.name),
            },
        ];
    }

    protected getSearchCandidates(entry: EquipmentMetadata): string[] {
        const extras = [entry.type, entry.role].filter((val): val is string => Boolean(val));
        return [entry.name, ...extras];
    }

    protected renderEntry(row: HTMLElement, entry: EquipmentMetadata): void {
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
            await this.refreshEntries();
            if (!this.isDisposed()) {
                this.render();
                await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
            }
        }).open();
    }

    private async handleImport(file: TFile): Promise<void> {
        try {
            const equipmentData = await this.parseEquipmentFromFile(file);
            new CreateEquipmentModal(this.app, equipmentData, async (updatedData) => {
                const { equipmentToMarkdown } = await import("../core/equipment-files");
                const newContent = equipmentToMarkdown(updatedData);
                await this.app.vault.modify(file, newContent);
                await this.refreshEntries();
                if (!this.isDisposed()) {
                    this.render();
                    await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
                }
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

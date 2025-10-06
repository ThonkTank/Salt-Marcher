// src/apps/library/view/equipment.ts
// Renders and creates equipment entries
import type { TFile } from "obsidian";
import type { ModeRenderer } from "./mode";
import { BaseModeRenderer, scoreName } from "./mode";
import { listEquipmentFiles, watchEquipmentDir, createEquipmentFile, type EquipmentData } from "../core/equipment-files";
import { CreateEquipmentModal } from "../create/equipment";

export class EquipmentRenderer extends BaseModeRenderer implements ModeRenderer {
    readonly mode = "equipment" as const;
    private files: TFile[] = [];

    async init(): Promise<void> {
        this.files = await listEquipmentFiles(this.app);
        const stop = watchEquipmentDir(this.app, async () => {
            this.files = await listEquipmentFiles(this.app);
            if (!this.isDisposed()) this.render();
        });
        this.registerCleanup(stop);
    }

    render(): void {
        if (this.isDisposed()) return;
        const list = this.container;
        list.empty();
        const q = this.query;
        const equipment = this.files.map(f => ({ name: f.basename, file: f, score: scoreName(f.basename.toLowerCase(), q) }))
            .filter(x => q ? x.score > -Infinity : true)
            .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

        for (const eq of equipment) {
            const row = list.createDiv({ cls: "sm-cc-item" });
            row.createDiv({ cls: "sm-cc-item__name", text: eq.name });

            const importBtn = row.createEl("button", { text: "Import" });
            importBtn.onclick = async () => {
                await this.handleImport(eq.file);
            };

            const openBtn = row.createEl("button", { text: "Open" });
            openBtn.onclick = async () => {
                await this.app.workspace.openLinkText(eq.file.path, eq.file.path, true);
            };
        }
    }

    private async handleImport(file: TFile): Promise<void> {
        try {
            // Parse equipment data from file
            const equipmentData = await this.parseEquipmentFromFile(file);

            // Open in editor modal with existing data
            new CreateEquipmentModal(this.app, equipmentData, async (updatedData) => {
                // Import equipmentToMarkdown to generate updated content
                const { equipmentToMarkdown } = await import("../core/equipment-files");
                const newContent = equipmentToMarkdown(updatedData);

                // Update the existing file
                await this.app.vault.modify(file, newContent);

                // Refresh and open
                this.files = await listEquipmentFiles(this.app);
                if (!this.isDisposed()) {
                    this.render();
                    await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
                }
            }).open();
        } catch (err) {
            console.error("Failed to import equipment:", err);
        }
    }

    private async parseEquipmentFromFile(file: TFile): Promise<EquipmentData> {
        const cache = this.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter || {};

        // Parse basic data from frontmatter
        const data: EquipmentData = {
            name: frontmatter.name || file.basename,
            type: frontmatter.type || "weapon",
            cost: frontmatter.cost,
            weight: frontmatter.weight,

            // Weapon fields
            weapon_category: frontmatter.weapon_category,
            weapon_type: frontmatter.weapon_type,
            damage: frontmatter.damage,
            properties: frontmatter.properties,
            mastery: frontmatter.mastery,

            // Armor fields
            armor_category: frontmatter.armor_category,
            ac: frontmatter.ac,
            strength_requirement: frontmatter.strength_requirement,
            stealth_disadvantage: frontmatter.stealth_disadvantage,
            don_time: frontmatter.don_time,
            doff_time: frontmatter.doff_time,

            // Tool fields
            tool_category: frontmatter.tool_category,
            ability: frontmatter.ability,
            utilize: frontmatter.utilize,
            craft: frontmatter.craft,
            variants: frontmatter.variants,

            // Gear fields
            gear_category: frontmatter.gear_category,
            special_use: frontmatter.special_use,
            capacity: frontmatter.capacity,
            duration: frontmatter.duration,
        };

        // Read description from body (skip frontmatter)
        const content = await this.app.vault.read(file);
        const bodyMatch = content.match(/^---[\s\S]*?---\s*\n([\s\S]*)/);
        if (bodyMatch) {
            data.description = bodyMatch[1].trim();
        }

        return data;
    }

    async handleCreate(name: string): Promise<void> {
        new CreateEquipmentModal(this.app, name, async (data) => {
            const file = await createEquipmentFile(this.app, data);
            this.files = await listEquipmentFiles(this.app);
            if (!this.isDisposed()) {
                this.render();
                await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
            }
        }).open();
    }
}

// src/apps/library/view/items.ts
// Renders and creates item entries
import type { TFile } from "obsidian";
import type { ModeRenderer } from "./mode";
import { BaseModeRenderer, scoreName } from "./mode";
import { listItemFiles, watchItemDir, createItemFile, type ItemData } from "../core/item-files";
import { CreateItemModal } from "../create";

export class ItemsRenderer extends BaseModeRenderer implements ModeRenderer {
    readonly mode = "items" as const;
    private files: TFile[] = [];

    async init(): Promise<void> {
        this.files = await listItemFiles(this.app);
        const stop = watchItemDir(this.app, async () => {
            this.files = await listItemFiles(this.app);
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

            const importBtn = row.createEl("button", { text: "Import" });
            importBtn.onclick = async () => {
                await this.handleImport(it.file);
            };

            const openBtn = row.createEl("button", { text: "Open" });
            openBtn.onclick = async () => {
                await this.app.workspace.openLinkText(it.file.path, it.file.path, true);
            };
        }
    }

    private async handleImport(file: TFile): Promise<void> {
        try {
            // Parse item data from file
            const itemData = await this.parseItemFromFile(file);

            // Open in editor modal with existing data
            new CreateItemModal(this.app, itemData, async (updatedData) => {
                // Import itemToMarkdown to generate updated content
                const { itemToMarkdown } = await import("../core/item-files");
                const newContent = itemToMarkdown(updatedData);

                // Update the existing file
                await this.app.vault.modify(file, newContent);

                // Refresh and open
                this.files = await listItemFiles(this.app);
                if (!this.isDisposed()) {
                    this.render();
                    await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
                }
            }).open();
        } catch (err) {
            console.error("Failed to import item:", err);
        }
    }

    private async parseItemFromFile(file: TFile): Promise<ItemData> {
        const cache = this.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter || {};

        // Parse basic data from frontmatter
        const data: ItemData = {
            name: frontmatter.name || file.basename,
            category: frontmatter.category,
            type: frontmatter.type,
            rarity: frontmatter.rarity,
            attunement: frontmatter.attunement,
            attunement_req: frontmatter.attunement_req,
            max_charges: frontmatter.max_charges,
            recharge_formula: frontmatter.recharge_formula,
            recharge_time: frontmatter.recharge_time,
            destruction_risk: frontmatter.destruction_risk,
            spell_storage_capacity: frontmatter.spell_storage_capacity,
            resistances: frontmatter.resistances,
            immunities: frontmatter.immunities,
            cursed: frontmatter.cursed,
            curse_description: frontmatter.curse_description,
            has_variants: frontmatter.has_variants,
            variant_info: frontmatter.variant_info,
            sentient: frontmatter.sentient,
            weight: frontmatter.weight,
            value: frontmatter.value,
        };

        // Parse JSON fields
        if (frontmatter.spells_json) {
            try {
                data.spells = JSON.parse(frontmatter.spells_json);
            } catch {}
        }
        if (frontmatter.bonuses_json) {
            try {
                data.bonuses = JSON.parse(frontmatter.bonuses_json);
            } catch {}
        }
        if (frontmatter.ability_changes_json) {
            try {
                data.ability_changes = JSON.parse(frontmatter.ability_changes_json);
            } catch {}
        }
        if (frontmatter.speed_changes_json) {
            try {
                data.speed_changes = JSON.parse(frontmatter.speed_changes_json);
            } catch {}
        }
        if (frontmatter.properties_json) {
            try {
                data.properties = JSON.parse(frontmatter.properties_json);
            } catch {}
        }
        if (frontmatter.usage_limit_json) {
            try {
                data.usage_limit = JSON.parse(frontmatter.usage_limit_json);
            } catch {}
        }
        if (frontmatter.tables_json) {
            try {
                data.tables = JSON.parse(frontmatter.tables_json);
            } catch {}
        }
        if (frontmatter.sentient_props_json) {
            try {
                data.sentient_props = JSON.parse(frontmatter.sentient_props_json);
            } catch {}
        }

        // Read description from body (skip frontmatter)
        const content = await this.app.vault.read(file);
        const bodyMatch = content.match(/^---[\s\S]*?---\s*\n([\s\S]*)/);
        if (bodyMatch) {
            data.description = bodyMatch[1].trim();
        }

        return data;
    }

    async handleCreate(name: string): Promise<void> {
        new CreateItemModal(this.app, name, async (data) => {
            const file = await createItemFile(this.app, data);
            this.files = await listItemFiles(this.app);
            if (!this.isDisposed()) {
                this.render();
                await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
            }
        }).open();
    }
}

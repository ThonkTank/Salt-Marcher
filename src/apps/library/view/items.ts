// src/apps/library/view/items.ts
// Rendert Items mit einheitlicher Filter- und Sortierlogik.
import type { TFile } from "obsidian";
import type { ModeRenderer } from "./mode";
import { FilterableLibraryRenderer, type FilterDefinition, type FilterableEntry, type SortDefinition } from "./filterable-mode";
import { createItemFile, listItemFiles, watchItemDir, type ItemData } from "../core/item-files";
import { CreateItemModal } from "../create";

interface ItemMetadata extends FilterableEntry {
    category?: string;
    rarity?: string;
}

const RARITY_ORDER = new Map<string, number>([
    ["common", 0],
    ["uncommon", 1],
    ["rare", 2],
    ["very rare", 3],
    ["legendary", 4],
    ["artifact", 5],
]);

async function getItemMetadata(app: any, file: TFile): Promise<ItemMetadata> {
    const cache = app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter || {};

    return {
        name: file.basename,
        file,
        category: typeof fm.category === "string" ? fm.category : undefined,
        rarity: typeof fm.rarity === "string" ? fm.rarity : undefined,
    };
}

function raritySortValue(rarity?: string): number {
    if (!rarity) return Number.POSITIVE_INFINITY;
    const key = rarity.toLowerCase();
    return RARITY_ORDER.get(key) ?? Number.POSITIVE_INFINITY;
}

export class ItemsRenderer extends FilterableLibraryRenderer<ItemMetadata> implements ModeRenderer {
    readonly mode = "items" as const;

    protected listSourceFiles(): Promise<TFile[]> {
        return listItemFiles(this.app);
    }

    protected watchSourceFiles(onChange: () => void): () => void {
        return watchItemDir(this.app, onChange);
    }

    protected loadEntry(file: TFile): Promise<ItemMetadata> {
        return getItemMetadata(this.app, file);
    }

    protected getFilters(): FilterDefinition<ItemMetadata>[] {
        return [
            {
                id: "category",
                label: "Category",
                getValues: entry => entry.category ? [entry.category] : [],
            },
            {
                id: "rarity",
                label: "Rarity",
                getValues: entry => entry.rarity ? [entry.rarity] : [],
                sortComparator: (a, b) => raritySortValue(a) - raritySortValue(b) || a.localeCompare(b),
            },
        ];
    }

    protected getSortOptions(): SortDefinition<ItemMetadata>[] {
        return [
            {
                id: "name",
                label: "Name",
                compare: (a, b) => a.name.localeCompare(b.name),
            },
            {
                id: "rarity",
                label: "Rarity",
                compare: (a, b) => raritySortValue(a.rarity) - raritySortValue(b.rarity) || a.name.localeCompare(b.name),
            },
            {
                id: "category",
                label: "Category",
                compare: (a, b) => (a.category || "").localeCompare(b.category || "") || a.name.localeCompare(b.name),
            },
        ];
    }

    protected getSearchCandidates(entry: ItemMetadata): string[] {
        const extras = [entry.category, entry.rarity].filter((val): val is string => Boolean(val));
        return [entry.name, ...extras];
    }

    protected renderEntry(row: HTMLElement, entry: ItemMetadata): void {
        row.createDiv({ cls: "sm-cc-item__name", text: entry.name });

        const info = row.createDiv({ cls: "sm-cc-item__info" });
        if (entry.category) {
            info.createEl("span", { cls: "sm-cc-item__type", text: entry.category });
        }
        if (entry.rarity) {
            info.createEl("span", { cls: "sm-cc-item__cr", text: entry.rarity });
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
        new CreateItemModal(this.app, name, async (data) => {
            const file = await createItemFile(this.app, data);
            await this.refreshEntries();
            if (!this.isDisposed()) {
                this.render();
                await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
            }
        }).open();
    }

    private async handleImport(file: TFile): Promise<void> {
        try {
            const itemData = await this.parseItemFromFile(file);
            new CreateItemModal(this.app, itemData, async (updatedData) => {
                const { itemToMarkdown } = await import("../core/item-files");
                const newContent = itemToMarkdown(updatedData);
                await this.app.vault.modify(file, newContent);
                await this.refreshEntries();
                if (!this.isDisposed()) {
                    this.render();
                    await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
                }
            }).open();
        } catch (err) {
            console.error("Failed to import item", err);
        }
    }

    private async parseItemFromFile(file: TFile): Promise<ItemData> {
        const cache = this.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter || {};

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

        if (frontmatter.spells_json) {
            try { data.spells = JSON.parse(frontmatter.spells_json); } catch {}
        }
        if (frontmatter.bonuses_json) {
            try { data.bonuses = JSON.parse(frontmatter.bonuses_json); } catch {}
        }
        if (frontmatter.ability_changes_json) {
            try { data.ability_changes = JSON.parse(frontmatter.ability_changes_json); } catch {}
        }
        if (frontmatter.speed_changes_json) {
            try { data.speed_changes = JSON.parse(frontmatter.speed_changes_json); } catch {}
        }
        if (frontmatter.properties_json) {
            try { data.properties = JSON.parse(frontmatter.properties_json); } catch {}
        }
        if (frontmatter.usage_limit_json) {
            try { data.usage_limit = JSON.parse(frontmatter.usage_limit_json); } catch {}
        }
        if (frontmatter.tables_json) {
            try { data.tables = JSON.parse(frontmatter.tables_json); } catch {}
        }
        if (frontmatter.sentient_props_json) {
            try { data.sentient_props = JSON.parse(frontmatter.sentient_props_json); } catch {}
        }

        const content = await this.app.vault.read(file);
        const bodyMatch = content.match(/^---[\s\S]*?---\s*\n([\s\S]*)/);
        if (bodyMatch) {
            data.description = bodyMatch[1].trim();
        }

        return data;
    }
}

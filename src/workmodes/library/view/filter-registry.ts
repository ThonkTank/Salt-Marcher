// src/workmodes/library/view/filter-registry.ts
// Deklariert Filter-, Sortier- und Suchschemata für alle filterbaren Library-Ansichten.
import type { LibraryEntry, FilterableLibraryMode } from "../core/data-sources";
import { createSchema, type LibraryListSchema } from "../../../features/data-manager/browse/schema-builder";

// Re-export for backward compatibility
export type { LibraryListSchema };

const RARITY_ORDER = new Map<string, number>([
    ["common", 0],
    ["uncommon", 1],
    ["rare", 2],
    ["very rare", 3],
    ["legendary", 4],
    ["artifact", 5],
]);

function rarityOrder(value?: string): number {
    if (!value) return Number.POSITIVE_INFINITY;
    return RARITY_ORDER.get(value.toLowerCase()) ?? Number.POSITIVE_INFINITY;
}

function parseCr(value?: string): number {
    if (!value) return Number.POSITIVE_INFINITY;
    if (value.includes("/")) {
        const [num, denom] = value.split("/").map(part => Number(part.trim()));
        if (Number.isFinite(num) && Number.isFinite(denom) && denom !== 0) {
            return num / denom;
        }
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
}

export function formatSpellLevel(level?: number): string {
    if (level == null) return "Unknown";
    if (level === 0) return "Cantrip";
    return `Level ${level}`;
}

export const LIBRARY_LIST_SCHEMAS: { [M in FilterableLibraryMode]: LibraryListSchema<LibraryEntry<M>> } = {
    creatures: createSchema<LibraryEntry<"creatures">>()
        .addStringFilter("type", "type", "Type")
        .addCustomFilter("cr", "cr", {
            label: "CR",
            sortComparator: (a, b) => parseCr(a) - parseCr(b),
        })
        .addNameSort()
        .addStringFieldSort("type", "type", "Type")
        .addCustomSort("cr", "CR", (a, b) =>
            parseCr(a.cr) - parseCr(b.cr) || a.name.localeCompare(b.name)
        )
        .searchField("type")
        .searchField("cr")
        .build(),
    spells: createSchema<LibraryEntry<"spells">>()
        .addStringFilter("school", "school", "School")
        .addFilter("level", "Level",
            entry => [entry.level != null ? String(entry.level) : undefined],
            {
                sortComparator: (a, b) => Number(a) - Number(b),
                formatOption: value => formatSpellLevel(Number(value)),
            }
        )
        .addFilter("ritual", "Ritual",
            entry => [entry.ritual == null ? undefined : entry.ritual ? "true" : "false"],
            {
                emptyLabel: "All",
                formatOption: value => value === "true" ? "Only rituals" : "No rituals",
            }
        )
        .addNameSort()
        .addCustomSort("level", "Level", (a, b) =>
            (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name)
        )
        .addStringFieldSort("school", "school", "School")
        .searchField("school")
        .searchCustom(entry => entry.level != null ? formatSpellLevel(entry.level) : undefined)
        .searchField("casting_time")
        .searchField("duration")
        .searchField("description")
        .build(),
    items: createSchema<LibraryEntry<"items">>()
        .addStringFilter("category", "category", "Category")
        .addCustomFilter("rarity", "rarity", {
            label: "Rarity",
            sortComparator: (a, b) => rarityOrder(a) - rarityOrder(b) || a.localeCompare(b),
        })
        .addNameSort()
        .addCustomSort("rarity", "Rarity", (a, b) =>
            rarityOrder(a.rarity) - rarityOrder(b.rarity) || a.name.localeCompare(b.name)
        )
        .addStringFieldSort("category", "category", "Category")
        .searchField("category")
        .searchField("rarity")
        .build(),
    equipment: createSchema<LibraryEntry<"equipment">>()
        .addStringFilter("type", "type", "Type")
        .addStringFilter("role", "role", "Role")
        .addNameSort()
        .addStringFieldSort("type", "type", "Type")
        .addStringFieldSort("role", "role", "Role")
        .searchField("type")
        .searchField("role")
        .build(),
};

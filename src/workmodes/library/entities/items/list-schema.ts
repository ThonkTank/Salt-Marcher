// src/workmodes/library/entities/items/list-schema.ts
// List schema for items: filters, sorts, and search configuration

import type { LibraryEntry } from "../../storage/data-sources";
import { createSchema, type LibraryListSchema } from "../../../../features/data-manager/browse/schema-builder";

// Rarity order for sorting
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

// Build items list schema with filters, sorts, and search
export const itemListSchema: LibraryListSchema<LibraryEntry<"items">> = createSchema<LibraryEntry<"items">>()
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
    .build();

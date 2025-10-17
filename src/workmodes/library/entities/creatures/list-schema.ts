// src/workmodes/library/entities/creatures/list-schema.ts
// List schema for creatures: filters, sorts, and search configuration

import type { LibraryEntry } from "../../storage/data-sources";
import { createSchema, type LibraryListSchema } from "../../../../features/data-manager/browse/schema-builder";

// Helper to parse CR values (handles fractions like "1/2")
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

// Build creatures list schema with filters, sorts, and search
export const creatureListSchema: LibraryListSchema<LibraryEntry<"creatures">> = createSchema<LibraryEntry<"creatures">>()
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
    .build();

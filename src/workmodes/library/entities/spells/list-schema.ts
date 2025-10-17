// src/workmodes/library/entities/spells/list-schema.ts
// List schema for spells: filters, sorts, and search configuration

import type { LibraryEntry } from "../../storage/data-sources";
import { createSchema, type LibraryListSchema } from "../../../../features/data-manager/browse/schema-builder";

// Format spell level for display
export function formatSpellLevel(level?: number): string {
    if (level == null) return "Unknown";
    if (level === 0) return "Cantrip";
    return `Level ${level}`;
}

// Build spells list schema with filters, sorts, and search
export const spellListSchema: LibraryListSchema<LibraryEntry<"spells">> = createSchema<LibraryEntry<"spells">>()
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
    .build();

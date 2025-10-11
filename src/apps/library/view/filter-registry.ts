// src/apps/library/view/filter-registry.ts
// Deklariert Filter-, Sortier- und Suchschemata für alle filterbaren Library-Ansichten.
import type { LibraryEntry, FilterableLibraryMode } from "../core/data-sources";
import type {
    FilterDefinition as BaseFilterDefinition,
    SortDefinition as BaseSortDefinition,
} from "../../../ui/workmode/filter-controls";

export type FilterDefinition<M extends FilterableLibraryMode> = BaseFilterDefinition<LibraryEntry<M>>;

export type SortDefinition<M extends FilterableLibraryMode> = BaseSortDefinition<LibraryEntry<M>>;

export interface LibraryListSchema<M extends FilterableLibraryMode> {
    readonly filters: FilterDefinition<M>[];
    readonly sorts: SortDefinition<M>[];
    readonly search: (entry: LibraryEntry<M>) => string[];
}

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

export const LIBRARY_LIST_SCHEMAS: { [M in FilterableLibraryMode]: LibraryListSchema<M> } = {
    creatures: {
        filters: [
            {
                id: "type",
                label: "Type",
                getValues: entry => [entry.type],
            },
            {
                id: "cr",
                label: "CR",
                getValues: entry => [entry.cr],
                sortComparator: (a, b) => parseCr(a) - parseCr(b),
            },
        ],
        sorts: [
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
                id: "cr",
                label: "CR",
                compare: (a, b) => parseCr(a.cr) - parseCr(b.cr) || a.name.localeCompare(b.name),
            },
        ],
        search: entry => [entry.type, entry.cr].filter((value): value is string => Boolean(value)),
    },
    spells: {
        filters: [
            {
                id: "school",
                label: "School",
                getValues: entry => [entry.school],
            },
            {
                id: "level",
                label: "Level",
                getValues: entry => [entry.level != null ? String(entry.level) : undefined],
                sortComparator: (a, b) => Number(a) - Number(b),
                formatOption: value => formatSpellLevel(Number(value)),
            },
            {
                id: "ritual",
                label: "Ritual",
                getValues: entry => [entry.ritual == null ? undefined : entry.ritual ? "true" : "false"],
                emptyLabel: "All",
                formatOption: value => value === "true" ? "Only rituals" : "No rituals",
            },
        ],
        sorts: [
            {
                id: "name",
                label: "Name",
                compare: (a, b) => a.name.localeCompare(b.name),
            },
            {
                id: "level",
                label: "Level",
                compare: (a, b) => (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name),
            },
            {
                id: "school",
                label: "School",
                compare: (a, b) => (a.school || "").localeCompare(b.school || "") || a.name.localeCompare(b.name),
            },
        ],
        search: entry => [
            entry.school,
            entry.level != null ? formatSpellLevel(entry.level) : undefined,
            entry.casting_time,
            entry.duration,
            entry.description,
        ].filter((value): value is string => Boolean(value)),
    },
    items: {
        filters: [
            {
                id: "category",
                label: "Category",
                getValues: entry => [entry.category],
            },
            {
                id: "rarity",
                label: "Rarity",
                getValues: entry => [entry.rarity],
                sortComparator: (a, b) => rarityOrder(a) - rarityOrder(b) || a.localeCompare(b),
            },
        ],
        sorts: [
            {
                id: "name",
                label: "Name",
                compare: (a, b) => a.name.localeCompare(b.name),
            },
            {
                id: "rarity",
                label: "Rarity",
                compare: (a, b) => rarityOrder(a.rarity) - rarityOrder(b.rarity) || a.name.localeCompare(b.name),
            },
            {
                id: "category",
                label: "Category",
                compare: (a, b) => (a.category || "").localeCompare(b.category || "") || a.name.localeCompare(b.name),
            },
        ],
        search: entry => [entry.category, entry.rarity].filter((value): value is string => Boolean(value)),
    },
    equipment: {
        filters: [
            {
                id: "type",
                label: "Type",
                getValues: entry => [entry.type],
            },
            {
                id: "role",
                label: "Role",
                getValues: entry => [entry.role],
            },
        ],
        sorts: [
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
        ],
        search: entry => [entry.type, entry.role].filter((value): value is string => Boolean(value)),
    },
};

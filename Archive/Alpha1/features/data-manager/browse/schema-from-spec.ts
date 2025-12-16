// src/features/data-manager/browse/schema-from-spec.ts
// Converts BrowseSpec from CreateSpec into ListSchema format

import type { CreateSpec, FilterSpec, SortSpec } from "../data-manager-types";
import type { FilterDefinition, SortDefinition } from "./schema-builder";
import type { ListSchema } from "./browse-types";

/**
 * Converts a FilterSpec from BrowseSpec into a FilterDefinition for ListSchema.
 */
function convertFilter<TEntry>(filter: FilterSpec<TEntry>): FilterDefinition<TEntry> {
    return {
        id: filter.id,
        label: filter.label,
        getValues: (entry) => {
            const value = (entry as any)[filter.field];
            return [value];
        },
        sortComparator: filter.sortComparator,
    };
}

/**
 * Converts a SortSpec from BrowseSpec into a SortDefinition for ListSchema.
 */
function convertSort<TEntry>(sort: SortSpec<TEntry>): SortDefinition<TEntry> {
    return {
        id: sort.id,
        label: sort.label,
        compare: sort.compareFn ?? ((a, b) => {
            // Default sort by field if compareFn not provided
            const field = sort.field;
            if (!field) return 0;
            const aVal = (a as any)[field] ?? "";
            const bVal = (b as any)[field] ?? "";
            if (typeof aVal === "string" && typeof bVal === "string") {
                return aVal.localeCompare(bVal);
            }
            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        }),
    };
}

/**
 * Creates a ListSchema from a CreateSpec's browse configuration.
 *
 * This converts the declarative BrowseSpec format into the runtime ListSchema
 * format used by the browse infrastructure.
 *
 * @param spec - CreateSpec with browse configuration
 * @returns ListSchema compatible with filterable mode
 */
export function createListSchemaFromSpec<TDraft extends Record<string, unknown>>(
    spec: CreateSpec<TDraft>
): ListSchema<any> {
    const browse = spec.browse;

    if (!browse) {
        // Return empty schema if no browse config
        return {
            filters: [],
            sorts: [],
            search: () => [],
        };
    }

    return {
        filters: (browse.filters ?? []).map(convertFilter),
        sorts: (browse.sorts ?? []).map(convertSort),
        search: (entry) => {
            // Extract search fields from entry
            const searchFields = browse.search ?? [];
            return searchFields
                .map(fieldId => {
                    const value = (entry as any)[fieldId];
                    return typeof value === "string" ? value :
                           typeof value === "number" ? String(value) :
                           undefined;
                })
                .filter((v): v is string => Boolean(v));
        },
    };
}

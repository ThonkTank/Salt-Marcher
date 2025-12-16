// src/features/data-manager/browse/schema-builder.ts
// Fluent builder API for creating filter/sort/search schemas

import type { BaseEntry, ListSchema } from "./browse-types";

/**
 * Generic filter definition for library entries
 */
export interface FilterDefinition<TEntry> {
    id: string;
    label: string;
    getValues: (entry: TEntry) => (string | undefined)[];
    sortComparator?: (a: string, b: string) => number;
    formatOption?: (value: string) => string;
    emptyLabel?: string;
}

/**
 * Generic sort definition for library entries
 */
export interface SortDefinition<TEntry> {
    id: string;
    label: string;
    compare: (a: TEntry, b: TEntry) => number;
}

/**
 * Fluent builder for creating library list schemas.
 * Reduces boilerplate by providing common patterns for filters, sorts, and search.
 *
 * @example
 * ```typescript
 * const schema = createSchema<LibraryEntry<"creatures">>()
 *   .addStringFilter("type", "type", "Type")
 *   .addNameSort()
 *   .searchField("type")
 *   .build();
 * ```
 */
export class SchemaBuilder<TEntry extends BaseEntry> {
    private _filters: FilterDefinition<TEntry>[] = [];
    private _sorts: SortDefinition<TEntry>[] = [];
    private _searchFields: ((entry: TEntry) => string | undefined)[] = [];

    /**
     * Add a simple string field filter.
     * Automatically creates filter with getValues that extracts the specified field.
     *
     * @param id - Filter ID (used in URL params, state management)
     * @param field - Field key to filter on
     * @param label - Display label (defaults to id)
     */
    addStringFilter<K extends keyof TEntry>(
        id: string,
        field: K,
        label?: string
    ): this {
        this._filters.push({
            id,
            label: label || String(id),
            getValues: (entry) => [entry[field] as any],
        });
        return this;
    }

    /**
     * Add a filter with custom options (comparator, formatter, etc.).
     * Use for filters that need special sorting or display logic.
     *
     * @param id - Filter ID
     * @param field - Field key to filter on
     * @param options - Custom filter options
     *
     * @example
     * ```typescript
     * .addCustomFilter("cr", "cr", {
     *   label: "CR",
     *   sortComparator: (a, b) => parseCr(a) - parseCr(b)
     * })
     * ```
     */
    addCustomFilter<K extends keyof TEntry>(
        id: string,
        field: K,
        options: {
            label?: string;
            sortComparator?: (a: string, b: string) => number;
            formatOption?: (value: string) => string;
            emptyLabel?: string;
        }
    ): this {
        this._filters.push({
            id,
            label: options.label || String(id),
            getValues: (entry) => [entry[field] as any],
            sortComparator: options.sortComparator,
            formatOption: options.formatOption,
            emptyLabel: options.emptyLabel,
        });
        return this;
    }

    /**
     * Add a filter with completely custom getValue logic.
     * Use when field extraction is complex or involves multiple fields.
     *
     * @param id - Filter ID
     * @param label - Display label
     * @param getValues - Function to extract filter values from entry
     * @param options - Additional filter options
     */
    addFilter(
        id: string,
        label: string,
        getValues: (entry: TEntry) => (string | undefined)[],
        options?: {
            sortComparator?: (a: string, b: string) => number;
            formatOption?: (value: string) => string;
            emptyLabel?: string;
        }
    ): this {
        this._filters.push({
            id,
            label,
            getValues,
            sortComparator: options?.sortComparator,
            formatOption: options?.formatOption,
            emptyLabel: options?.emptyLabel,
        });
        return this;
    }

    /**
     * Add standard name sort.
     * Every entity has a name field, so this is a common pattern.
     */
    addNameSort(): this {
        this._sorts.push({
            id: "name",
            label: "Name",
            compare: (a, b) => a.name.localeCompare(b.name),
        });
        return this;
    }

    /**
     * Add a string field sort with fallback to name.
     * Standard pattern: sort by field, then by name for stability.
     *
     * @param id - Sort ID
     * @param field - Field key to sort on
     * @param label - Display label (defaults to id)
     */
    addStringFieldSort<K extends keyof TEntry>(
        id: string,
        field: K,
        label?: string
    ): this {
        this._sorts.push({
            id,
            label: label || String(id),
            compare: (a, b) => {
                const aVal = (a[field] as any) || "";
                const bVal = (b[field] as any) || "";
                const primary = aVal.localeCompare(bVal);
                return primary !== 0 ? primary : a.name.localeCompare(b.name);
            },
        });
        return this;
    }

    /**
     * Add a custom sort with explicit compare function.
     * Use when sorting logic is complex or involves calculations.
     *
     * @param id - Sort ID
     * @param label - Display label
     * @param compare - Comparison function (negative = a before b, positive = b before a)
     */
    addCustomSort(
        id: string,
        label: string,
        compare: (a: TEntry, b: TEntry) => number
    ): this {
        this._sorts.push({ id, label, compare });
        return this;
    }

    /**
     * Add a search field (simple string field).
     * Search will look for query in all added search fields.
     *
     * @param field - Field key to search in
     */
    searchField<K extends keyof TEntry>(field: K): this {
        this._searchFields.push((entry) => {
            const value = entry[field];
            return typeof value === "string" ? value : undefined;
        });
        return this;
    }

    /**
     * Add a custom search field with extraction logic.
     * Use when search value needs transformation or involves multiple fields.
     *
     * @param fn - Function to extract searchable string from entry
     *
     * @example
     * ```typescript
     * .searchCustom(entry =>
     *   entry.level != null ? `Level ${entry.level}` : undefined
     * )
     * ```
     */
    searchCustom(fn: (entry: TEntry) => string | undefined): this {
        this._searchFields.push(fn);
        return this;
    }

    /**
     * Build the final schema object.
     * Call this after adding all filters, sorts, and search fields.
     */
    build(): ListSchema<TEntry> {
        return {
            filters: this._filters,
            sorts: this._sorts,
            search: (entry) =>
                this._searchFields
                    .map((fn) => fn(entry))
                    .filter((v): v is string => Boolean(v)),
        };
    }
}

/**
 * Factory function to create a new schema builder.
 * Provides type inference for the entry type.
 *
 * @example
 * ```typescript
 * const schema = createSchema<LibraryEntry<"creatures">>()
 *   .addStringFilter("type", "type", "Type")
 *   .addNameSort()
 *   .build();
 * ```
 */
export function createSchema<TEntry extends BaseEntry>(): SchemaBuilder<TEntry> {
    return new SchemaBuilder<TEntry>();
}

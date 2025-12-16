// src/features/data-manager/browse/spec-to-config.ts
// Utility functions to convert Record<M, CreateSpec> into Record<M, ViewConfig/ListSchema>

import { createAutoViewConfig } from "./auto-config";
import { createListSchemaFromSpec } from "./schema-from-spec";
import type { CreateSpec } from "../data-manager-types";
import type { ViewConfig, ListSchema } from "./browse-types";

/**
 * Converts a record of CreateSpecs into a record of ViewConfigs.
 * Generates view configurations automatically for each spec.
 *
 * @param specs - Record mapping mode IDs to CreateSpecs
 * @returns Record mapping mode IDs to ViewConfigs
 *
 * @example
 * ```typescript
 * const specs = { creatures: creatureSpec, spells: spellSpec };
 * const viewConfigs = generateViewConfigs(specs);
 * // → { creatures: ViewConfig, spells: ViewConfig }
 * ```
 */
export function generateViewConfigs<M extends string, E, C = any>(
    specs: Record<M, CreateSpec<any> | null>
): Record<M, ViewConfig<E, C>> {
    const result = {} as Record<M, ViewConfig<E, C>>;

    for (const key in specs) {
        const spec = specs[key];
        if (spec) {
            result[key] = createAutoViewConfig(spec) as ViewConfig<E, C>;
        }
    }

    return result;
}

/**
 * Converts a record of CreateSpecs into a record of ListSchemas.
 * Generates list schemas automatically for each spec.
 *
 * @param specs - Record mapping mode IDs to CreateSpecs
 * @returns Record mapping mode IDs to ListSchemas
 *
 * @example
 * ```typescript
 * const specs = { creatures: creatureSpec, spells: spellSpec };
 * const schemas = generateListSchemas(specs);
 * // → { creatures: ListSchema, spells: ListSchema }
 * ```
 */
export function generateListSchemas<M extends string, E>(
    specs: Record<M, CreateSpec<any> | null>
): Record<M, ListSchema<E>> {
    const result = {} as Record<M, ListSchema<E>>;

    for (const key in specs) {
        const spec = specs[key];
        if (spec) {
            result[key] = createListSchemaFromSpec(spec) as ListSchema<E>;
        }
    }

    return result;
}

// src/workmodes/library/entities/equipment/list-schema.ts
// List schema for equipment: filters, sorts, and search configuration

import type { LibraryEntry } from "../../storage/data-sources";
import { createSchema, type LibraryListSchema } from "../../../../features/data-manager/browse/schema-builder";

// Build equipment list schema with filters, sorts, and search
export const equipmentListSchema: LibraryListSchema<LibraryEntry<"equipment">> = createSchema<LibraryEntry<"equipment">>()
    .addStringFilter("type", "type", "Type")
    .addStringFilter("role", "role", "Role")
    .addNameSort()
    .addStringFieldSort("type", "type", "Type")
    .addStringFieldSort("role", "role", "Role")
    .searchField("type")
    .searchField("role")
    .build();

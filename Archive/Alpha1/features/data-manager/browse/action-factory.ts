// src/features/data-manager/browse/action-factory.ts
// Unified action factory for creating standard CRUD actions across all entity types

import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("data-manager-action-factory");
import type { BaseEntry } from "./browse-types";

/**
 * Generic action context for any entity type
 */
export interface EntityActionContext<TEntry> {
  readonly app: any; // Obsidian App instance
  reloadEntries: () => Promise<void>;
  [key: string]: any; // Allow additional context properties
}

/**
 * Generic action definition for any entity type
 */
export interface EntityAction<TEntry, TContext = EntityActionContext<TEntry>> {
  id: string;
  label: string;
  execute: (entry: TEntry, context: TContext) => Promise<void> | void;
}

/**
 * Creates a standard "open file" action.
 * Opens the entry's file in the workspace.
 */
export function createOpenAction<TEntry extends BaseEntry, TContext extends EntityActionContext<TEntry>>(): EntityAction<TEntry, TContext> {
  return {
    id: "open",
    label: "Open",
    execute: async (entry, context) => {
      await context.app.workspace.openLinkText(entry.file.path, entry.file.path, true);
    },
  };
}

/**
 * Creates a standard "delete file" action.
 * Trashes the entry's file with user confirmation.
 *
 * @param typeName - Human-readable name for the entity type (e.g., "creature", "spell")
 */
export function createDeleteAction<TEntry extends BaseEntry, TContext extends EntityActionContext<TEntry>>(
  typeName: string
): EntityAction<TEntry, TContext> {
  return {
    id: "delete",
    label: "Delete",
    execute: async (entry, context) => {
      const question = `Delete ${entry.name}? This moves the file to the trash.`;
      const confirmation =
        typeof window !== "undefined" && typeof window.confirm === "function"
          ? window.confirm(question)
          : true;
      if (!confirmation) return;
      try {
        await context.app.vault.trash(entry.file, true);
        await context.reloadEntries();
      } catch (err) {
        logger.error(`Failed to delete ${typeName}`, err);
      }
    },
  };
}

/**
 * Creates a standard set of actions (open, edit, delete) for an entity type.
 * This factory reduces boilerplate when defining action arrays for different entity types.
 *
 * @param typeName - Human-readable name for the entity type (e.g., "creature", "spell")
 * @param createEditAction - Factory function that creates the entity-specific edit action
 * @returns Array of actions: [open, edit, delete]
 *
 * @example
 * ```typescript
 * const actions = createStandardActions("creature", () => ({
 *   id: "edit",
 *   label: "Edit",
 *   execute: async (entry, context) => {
 *     const result = await openCreateModal(creatureSpec, { app: context.app, preset: entry });
 *     if (result) await context.reloadEntries();
 *   }
 * }));
 * ```
 */
export function createStandardActions<TEntry extends BaseEntry, TContext extends EntityActionContext<TEntry>>(
  typeName: string,
  createEditAction: () => EntityAction<TEntry, TContext>
): EntityAction<TEntry, TContext>[] {
  return [
    createOpenAction<TEntry, TContext>(),
    createEditAction(),
    createDeleteAction<TEntry, TContext>(typeName),
  ];
}

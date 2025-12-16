// src/features/data-manager/browse/auto-config.ts
// Automatic generation of browse configurations from CreateSpec

import type { App } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("data-manager-auto-config");
import { openCreateModal } from "../index";
import { createStandardActions } from "./action-factory";
import { loadFromFrontmatter } from "./auto-loader";
import type { CreateSpec } from "../data-manager-types";

/**
 * Context type for browse actions.
 * Must be compatible with Library's LibraryActionContext.
 */
export interface BrowseActionContext {
    readonly app: App;
    reloadEntries: () => Promise<void>;
    getFilterSelection?: (id: string) => string | undefined;
}

/**
 * Generic entry type for browse views.
 */
export interface BrowseEntry {
    file: import("obsidian").TFile;
    name: string;
    [key: string]: unknown;
}

/**
 * Generiert automatisch Edit-Action aus CreateSpec.
 */
export function createAutoEditAction<TDraft extends Record<string, unknown>>(
    spec: CreateSpec<TDraft>
) {
    return {
        id: "edit",
        label: "Edit",
        execute: async (entry: BrowseEntry, context: BrowseActionContext) => {
            const { app } = context;
            try {
                const data = await loadFromFrontmatter(app, entry.file, spec);
                const result = await openCreateModal(spec, {
                    app,
                    preset: data,
                });
                if (result) {
                    await context.reloadEntries();
                    await app.workspace.openLinkText(result.filePath, result.filePath, true, { state: { mode: "source" } });
                }
            } catch (err) {
                logger.error(`Failed to load ${spec.kind} for editing`, err);
            }
        },
    };
}

/**
 * Generiert automatisch Create-Handler aus CreateSpec.
 */
export function createAutoCreateHandler<TDraft extends Record<string, unknown>>(
    spec: CreateSpec<TDraft>
) {
    return async (context: BrowseActionContext, name: string): Promise<void> => {
        const { app } = context;

        // Build preset from active filters
        const preset: Record<string, unknown> = { name: name.trim() || `New ${spec.kind}` };

        // Apply active filter values as defaults
        if (context.getFilterSelection && spec.browse?.filters) {
            for (const filter of spec.browse.filters) {
                const value = context.getFilterSelection(filter.id);
                if (value) {
                    preset[filter.field] = value;
                }
            }
        }

        const result = await openCreateModal(spec, {
            app,
            preset,
        });

        if (result) {
            await context.reloadEntries();
            await app.workspace.openLinkText(result.filePath, result.filePath, true, { state: { mode: "source" } });
        }
    };
}

/**
 * Generiert automatisch alle Standard-Actions (Open, Edit, Duplicate, Delete) aus CreateSpec.
 */
export function createAutoActions<TDraft extends Record<string, unknown>>(
    spec: CreateSpec<TDraft>
) {
    return createStandardActions(spec.kind, () => createAutoEditAction(spec));
}

/**
 * Generiert komplette ViewConfig aus CreateSpec.
 */
export function createAutoViewConfig<TDraft extends Record<string, unknown>>(
    spec: CreateSpec<TDraft>
) {
    return {
        metadataFields: spec.browse?.metadata ?? [],
        actions: createAutoActions(spec),
        handleCreate: createAutoCreateHandler(spec),
    };
}

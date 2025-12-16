// src/features/data-manager/browse/auto-loader.ts
// Automatic frontmatter loading from CreateSpec

import type { App, TFile } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("data-manager-auto-loader");
import type { CreateSpec } from "../data-manager-types";

/**
 * Generischer Frontmatter-Loader.
 * Lädt automatisch alle Felder aus spec.storage.frontmatter.
 */
export async function loadFromFrontmatter<TDraft extends Record<string, unknown>>(
    app: App,
    file: TFile,
    spec: CreateSpec<TDraft>
): Promise<TDraft> {
    // Check if custom loader is provided
    if (spec.loader?.fromFrontmatter) {
        const cache = app.metadataCache.getFileCache(file);
        const fm = cache?.frontmatter ?? {};
        return await spec.loader.fromFrontmatter(fm, file);
    }

    // Auto-generate loader from storage.frontmatter
    const cache = app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter ?? {};

    const data: Record<string, unknown> = {
        name: typeof fm.name === "string" && fm.name.trim().length > 0
            ? fm.name.trim()
            : file.basename,
    };

    // Load all fields from frontmatter array
    if (Array.isArray(spec.storage.frontmatter)) {
        for (const fieldId of spec.storage.frontmatter) {
            if (fm[fieldId] !== undefined) {
                data[fieldId] = fm[fieldId];
                // Debug logging for token fields
                if (fieldId === 'pb' || fieldId === 'initiative' || fieldId === 'passivesList' || fieldId === 'sensesList' || fieldId === 'languagesList') {
                    logger.info('Loading token field', { fieldId, value: fm[fieldId] });
                }
            }
        }
    } else if (spec.storage.frontmatter) {
        // Handle object mapping { fieldId: frontmatterKey }
        for (const [fieldId, fmKey] of Object.entries(spec.storage.frontmatter)) {
            if (fm[fmKey] !== undefined) {
                data[fieldId] = fm[fmKey];
            }
        }
    }

    // Read description from body if not in frontmatter
    if (!data.description && spec.storage.format === "md-frontmatter") {
        const content = await app.vault.read(file);
        const bodyMatch = content.match(/^---[\s\S]*?---\s*\n([\s\S]*)/);
        if (bodyMatch) {
            data.description = bodyMatch[1].trim();
        }
    }

    return data as TDraft;
}

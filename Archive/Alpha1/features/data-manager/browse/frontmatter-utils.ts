// src/features/data-manager/browse/frontmatter-utils.ts
// Unified utilities for reading frontmatter from Obsidian files

import type { App, TFile } from "obsidian";

/**
 * Options for frontmatter reading
 */
export interface ReadFrontmatterOptions {
    /**
     * Whether to use Obsidian's metadata cache (faster, but may be stale).
     * Default: true
     */
    useCache?: boolean;
}

/**
 * Unified frontmatter reader that works with Obsidian's metadata cache.
 *
 * This function consolidates multiple frontmatter reading implementations across
 * the codebase into a single, well-tested utility.
 *
 * **IMPORTANT:** Always uses Obsidian's metadataCache for correct YAML parsing.
 * The cache properly handles arrays, nested objects, and all YAML features.
 * Manual parsing is only used as a last resort fallback.
 *
 * @param app - Obsidian App instance
 * @param file - File to read frontmatter from
 * @param options - Reading options
 * @returns Parsed frontmatter as key-value object
 *
 * @example
 * ```typescript
 * const fm = await readFrontmatter(app, file);
 * const name = fm.name as string;
 * const terrainPreference = fm.terrainPreference as string[];  // Arrays work!
 * ```
 */
export async function readFrontmatter(
    app: App,
    file: TFile,
    options: ReadFrontmatterOptions = {}
): Promise<Record<string, unknown>> {
    const { useCache = true } = options;

    // Always try cache first (correct YAML parsing for arrays/objects)
    if (useCache) {
        const cached = app.metadataCache.getFileCache(file)?.frontmatter;
        if (cached && typeof cached === "object") {
            // Defensive: Check for nested 'name' field overwriting top-level
            // This was the original concern that led to the manual parser
            if (cached.name && typeof cached.name === "object") {
                // Nested 'name' detected - use filename as fallback
                return {
                    ...cached,
                    name: file.basename
                };
            }
            return cached as Record<string, unknown>;
        }

        // Cache not available yet - wait briefly for it to populate
        // Obsidian typically populates cache within 100ms of file access
        await new Promise(resolve => setTimeout(resolve, 100));

        const retried = app.metadataCache.getFileCache(file)?.frontmatter;
        if (retried && typeof retried === "object") {
            if (retried.name && typeof retried.name === "object") {
                return {
                    ...retried,
                    name: file.basename
                };
            }
            return retried as Record<string, unknown>;
        }
    }

    // Fallback to manual parsing only if cache unavailable
    // Note: Manual parser does NOT support arrays/objects properly
    return await parseFrontmatterFromContent(app, file);
}

/**
 * Manually parses frontmatter from file content.
 * Used as fallback when cache is not available or requested.
 *
 * @internal
 */
async function parseFrontmatterFromContent(
    app: App,
    file: TFile
): Promise<Record<string, unknown>> {
    const content = await app.vault.read(file);
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};

    const lines = match[1].split(/\r?\n/);
    const data: Record<string, unknown> = {};

    for (const line of lines) {
        // Skip nested/indented lines (YAML arrays, objects, etc.)
        // Only process top-level fields (no leading whitespace)
        if (line.startsWith(" ") || line.startsWith("\t")) {
            continue;
        }

        const idx = line.indexOf(":");
        if (idx === -1) continue;

        const rawKey = line.slice(0, idx).trim();
        if (!rawKey) continue;

        let rawValue = line.slice(idx + 1).trim();
        if (!rawValue) {
            data[rawKey] = rawValue;
            continue;
        }

        // Remove quotes from string values
        if (/^".*"$/.test(rawValue)) {
            rawValue = rawValue.slice(1, -1);
        }

        // Try to parse as number
        const num = Number(rawValue);
        data[rawKey] = Number.isFinite(num) && rawValue === String(num)
            ? num
            : rawValue;
    }

    return data;
}

/**
 * Type guard helper for extracting string values from frontmatter
 */
export function asString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

/**
 * Type guard helper for extracting number values from frontmatter
 */
export function asNumber(value: unknown): number | undefined {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}

/**
 * Type guard helper for extracting boolean values from frontmatter
 */
export function asBoolean(value: unknown): boolean | undefined {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
        const normalized = value.toLowerCase();
        if (normalized === "true") return true;
        if (normalized === "false") return false;
    }
    return undefined;
}

/**
 * Type guard helper for extracting string array values from frontmatter
 */
export function asStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    return value.map(entry => typeof entry === "string" ? entry : String(entry ?? ""));
}

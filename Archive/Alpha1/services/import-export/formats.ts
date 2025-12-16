// src/services/import-export/formats.ts
// Format conversion utilities for JSON, CSV, YAML frontmatter, and Markdown

import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('import-export-formats');

/**
 * Supported import/export formats
 */
export enum ExportFormat {
    JSON = "json",
    CSV = "csv",
    JSONL = "jsonl", // JSON Lines (one JSON object per line)
    MARKDOWN = "md", // Markdown with YAML frontmatter
}

/**
 * Represents an entity with metadata
 */
export interface Entity {
    id: string;
    name: string;
    entity_type: string;
    data: any;
    created_at?: number;
    updated_at?: number;
    is_preset?: number;
    is_deleted?: number;
}

/**
 * Format converter for bulk operations
 */
export class FormatConverter {
    /**
     * Convert entity array to JSON format
     *
     * @param entities - Array of entities
     * @param pretty - Pretty-print JSON (default: false)
     * @returns JSON string
     *
     * @example
     * ```typescript
     * const json = FormatConverter.toJSON([
     *   { id: "1", name: "Dragon", entity_type: "creature", data: {...} }
     * ], true);
     * ```
     */
    static toJSON(entities: Entity[], pretty: boolean = false): string {
        try {
            return JSON.stringify(entities, null, pretty ? 2 : undefined);
        } catch (err) {
            logger.error("JSON serialization failed", err);
            throw new Error(
                `Failed to serialize to JSON: ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }

    /**
     * Convert entity array to JSONL format (one JSON object per line)
     * More memory-efficient for streaming large datasets
     *
     * @param entities - Array of entities
     * @returns JSONL string (one JSON per line)
     *
     * @example
     * ```typescript
     * const jsonl = FormatConverter.toJSONL(entities);
     * // Output:
     * // {"id":"1","name":"Dragon",...}
     * // {"id":"2","name":"Troll",...}
     * ```
     */
    static toJSONL(entities: Entity[]): string {
        try {
            return entities
                .map((entity) => JSON.stringify(entity))
                .join("\n");
        } catch (err) {
            logger.error("JSONL serialization failed", err);
            throw new Error(
                `Failed to serialize to JSONL: ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }

    /**
     * Convert entity array to CSV format
     * Flattens nested JSON data to columns
     *
     * @param entities - Array of entities
     * @returns CSV string with headers
     *
     * @example
     * ```typescript
     * const csv = FormatConverter.toCSV([
     *   { id: "1", name: "Dragon", entity_type: "creature", data: { cr: 20 } }
     * ]);
     * // Output:
     * // id,name,entity_type,cr
     * // 1,Dragon,creature,20
     * ```
     */
    static toCSV(entities: Entity[]): string {
        if (entities.length === 0) {
            return "";
        }

        try {
            // Collect all unique keys across all entities
            const keys = new Set<string>();
            keys.add("id");
            keys.add("name");
            keys.add("entity_type");

            for (const entity of entities) {
                Object.keys(entity).forEach((key) => keys.add(key));
                if (typeof entity.data === "object" && entity.data !== null) {
                    Object.keys(entity.data).forEach((key) => keys.add(key));
                }
            }

            const headers = Array.from(keys);

            // CSV escape function
            const escapeCSV = (value: any): string => {
                if (value === null || value === undefined) {
                    return "";
                }
                const str = typeof value === "string" ? value : JSON.stringify(value);
                if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };

            // Build header row
            const headerRow = headers.map((h) => escapeCSV(h)).join(",");

            // Build data rows
            const dataRows = entities
                .map((entity) => {
                    const row = headers.map((key) => {
                        let value = (entity as any)[key];
                        if (value === undefined && typeof entity.data === "object") {
                            value = entity.data[key];
                        }
                        return escapeCSV(value);
                    });
                    return row.join(",");
                });

            return [headerRow, ...dataRows].join("\n");
        } catch (err) {
            logger.error("CSV serialization failed", err);
            throw new Error(
                `Failed to serialize to CSV: ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }

    /**
     * Convert entity to Markdown with YAML frontmatter
     * Suitable for vault storage with per-entity markdown files
     *
     * @param entity - Single entity
     * @returns Markdown string with frontmatter
     *
     * @example
     * ```typescript
     * const md = FormatConverter.toMarkdown({
     *   id: "1",
     *   name: "Dragon",
     *   entity_type: "creature",
     *   data: { cr: 20, alignment: "Chaotic Evil" }
     * });
     * // Output:
     * // ---
     * // id: 1
     * // name: Dragon
     * // entity_type: creature
     * // smType: creature
     * // ---
     * // # Dragon
     * //
     * // **CR:** 20
     * // **Alignment:** Chaotic Evil
     * ```
     */
    static toMarkdown(entity: Entity): string {
        try {
            // Build YAML frontmatter
            const frontmatter: Record<string, any> = {
                id: entity.id,
                name: entity.name,
                entity_type: entity.entity_type,
                smType: entity.entity_type, // Salt Marcher type identifier
            };

            if (entity.created_at) {
                frontmatter.created_at = new Date(entity.created_at * 1000).toISOString();
            }
            if (entity.updated_at) {
                frontmatter.updated_at = new Date(entity.updated_at * 1000).toISOString();
            }
            if (entity.is_preset !== undefined) {
                frontmatter.is_preset = entity.is_preset;
            }
            if (entity.is_deleted !== undefined) {
                frontmatter.is_deleted = entity.is_deleted;
            }

            // Merge entity data into frontmatter
            if (typeof entity.data === "object" && entity.data !== null) {
                Object.assign(frontmatter, entity.data);
            }

            // Format YAML frontmatter
            const yamlLines = Object.entries(frontmatter)
                .map(([key, value]) => {
                    if (typeof value === "string") {
                        return `${key}: ${value}`;
                    } else if (typeof value === "object") {
                        return `${key}: ${JSON.stringify(value)}`;
                    } else {
                        return `${key}: ${value}`;
                    }
                });

            // Build markdown content
            const contentLines: string[] = [
                "---",
                ...yamlLines,
                "---",
                "",
                `# ${entity.name}`,
                "",
            ];

            // Add formatted data as markdown sections
            if (typeof entity.data === "object" && entity.data !== null) {
                for (const [key, value] of Object.entries(entity.data)) {
                    if (key !== "description" && key !== "notes") {
                        if (Array.isArray(value)) {
                            contentLines.push(`**${this.formatKey(key)}:**`);
                            for (const item of value) {
                                contentLines.push(`- ${item}`);
                            }
                        } else if (typeof value === "object") {
                            contentLines.push(`**${this.formatKey(key)}:**`);
                            contentLines.push("```json");
                            contentLines.push(JSON.stringify(value, null, 2));
                            contentLines.push("```");
                        } else {
                            contentLines.push(`**${this.formatKey(key)}:** ${value}`);
                        }
                        contentLines.push("");
                    }
                }

                // Add description/notes last
                if (entity.data.description) {
                    contentLines.push("## Description");
                    contentLines.push("");
                    contentLines.push(entity.data.description);
                    contentLines.push("");
                }

                if (entity.data.notes) {
                    contentLines.push("## Notes");
                    contentLines.push("");
                    contentLines.push(entity.data.notes);
                    contentLines.push("");
                }
            }

            return contentLines.join("\n");
        } catch (err) {
            logger.error("Markdown serialization failed", err);
            throw new Error(
                `Failed to serialize to Markdown: ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }

    /**
     * Parse JSON string to entities
     *
     * @param jsonString - JSON string
     * @returns Array of entities
     */
    static fromJSON(jsonString: string): Entity[] {
        try {
            const parsed = JSON.parse(jsonString);
            if (!Array.isArray(parsed)) {
                throw new Error("JSON must contain an array of entities");
            }
            return parsed as Entity[];
        } catch (err) {
            logger.error("JSON parsing failed", err);
            throw new Error(
                `Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }

    /**
     * Parse JSONL string to entities
     *
     * @param jsonlString - JSONL string (one JSON object per line)
     * @returns Array of entities
     */
    static fromJSONL(jsonlString: string): Entity[] {
        try {
            const lines = jsonlString.trim().split("\n");
            const entities: Entity[] = [];

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.length > 0) {
                    try {
                        const entity = JSON.parse(line);
                        entities.push(entity as Entity);
                    } catch (err) {
                        logger.warn(`Failed to parse JSONL line ${i + 1}`, err);
                        throw new Error(`Failed to parse JSONL line ${i + 1}: ${line.substring(0, 100)}`);
                    }
                }
            }

            return entities;
        } catch (err) {
            logger.error("JSONL parsing failed", err);
            throw new Error(
                `Failed to parse JSONL: ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }

    /**
     * Parse CSV string to entities
     * Reconstructs objects from flattened CSV columns
     *
     * @param csvString - CSV string with headers
     * @returns Array of entities
     */
    static fromCSV(csvString: string): Entity[] {
        try {
            const lines = csvString.trim().split("\n");
            if (lines.length < 2) {
                throw new Error("CSV must contain at least headers and one data row");
            }

            const headers = this.parseCSVLine(lines[0]);
            const requiredFields = ["id", "name", "entity_type"];

            for (const field of requiredFields) {
                if (!headers.includes(field)) {
                    throw new Error(`CSV missing required field: ${field}`);
                }
            }

            const entities: Entity[] = [];

            for (let i = 1; i < lines.length; i++) {
                const values = this.parseCSVLine(lines[i]);
                const entity: any = {};

                for (let j = 0; j < headers.length; j++) {
                    const header = headers[j];
                    const value = values[j] || "";

                    if (header === "data") {
                        try {
                            entity.data = JSON.parse(value);
                        } catch {
                            entity.data = {};
                        }
                    } else if (
                        ["created_at", "updated_at", "is_preset", "is_deleted"].includes(header)
                    ) {
                        entity[header] = isNaN(Number(value)) ? undefined : Number(value);
                    } else {
                        entity[header] = value;
                    }
                }

                if (!entity.data) {
                    entity.data = {};
                }

                entities.push(entity as Entity);
            }

            return entities;
        } catch (err) {
            logger.error("CSV parsing failed", err);
            throw new Error(
                `Failed to parse CSV: ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }

    /**
     * Parse a single CSV line handling quoted fields
     *
     * @private
     */
    private static parseCSVLine(line: string): string[] {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++; // Skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === "," && !inQuotes) {
                result.push(current.trim());
                current = "";
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    }

    /**
     * Format a key name for markdown display
     *
     * @private
     */
    private static formatKey(key: string): string {
        return key
            .replace(/_/g, " ")
            .replace(/([A-Z])/g, " $1")
            .replace(/^\s+/, "")
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(" ");
    }
}
